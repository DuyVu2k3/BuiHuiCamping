import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Tent, 
  MapPin, 
  CheckCircle2, 
  Users, 
  Layers, 
  Compass, 
  Check, 
  AlertCircle, 
  Plus, 
  Minus, 
  Info, 
  Eye, 
  EyeOff, 
  LayoutGrid, 
  Sparkles,
  Move,
  Save,
  Sliders,
  Crosshair,
  Edit,
  Trash2,
  RefreshCw,
  Maximize2,
  Power,
  Box,
  Link2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { getApiUrl } from '../apiConfig';



export default function CampsiteMap({ 
  tents = [], 
  zones = [], 
  selectedTentIds = [], 
  onSelectTent,
  onSelectMultipleTents,
  onQuickSetupTentType,
  tentTypes = [],
  stayType = 'overnight',
  duration = 1,
  mode = 'customer', // 'customer' | 'staff' | 'manager'
  onAddTentAtSlot,
  onOpenTentDetail,
  onRefreshData,
  onDeleteTent,
  allowSetup = true
}) {
  const [activeZoneId, setActiveZoneId] = useState('All');
  const [showPixelGrid, setShowPixelGrid] = useState(true);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [hoveredBookingId, setHoveredBookingId] = useState(null);

  // Manager Proactive Setup State - strictly restricted to Manager only
  const [isSetupMode, setIsSetupMode] = useState(() => {
    if (mode !== 'manager' || !allowSetup) return false;
    return localStorage.getItem('buihui_campsite_setup_mode') === 'true';
  });

  useEffect(() => {
    if (mode !== 'manager' || !allowSetup) {
      setIsSetupMode(false);
      localStorage.removeItem('buihui_campsite_setup_mode');
    } else {
      localStorage.setItem('buihui_campsite_setup_mode', isSetupMode);
    }
  }, [isSetupMode, mode, allowSetup]);

  const [isPlacingSlot, setIsPlacingSlot] = useState(false);
  const [localPositions, setLocalPositions] = useState({});
  const [draggingTentId, setDraggingTentId] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [hasUnsavedPositions, setHasUnsavedPositions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSelectedParcel, setActiveSelectedParcel] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const mapContainerRef = useRef(null);
  const svgRef = useRef(null);

  // Sync incoming tents mapTop & mapLeft into localPositions
  useEffect(() => {
    setLocalPositions(prev => {
      const posMap = { ...prev };
      tents.forEach(t => {
        if (!hasUnsavedPositions || !posMap[t.id]) {
          if (t.mapTop && t.mapLeft) {
            posMap[t.id] = { top: t.mapTop, left: t.mapLeft };
          }
        }
      });
      return posMap;
    });
  }, [tents, hasUnsavedPositions]);

  // Convert screen client coordinates (mouse/pointer) to SVG viewBox units (0..1000, 0..562.5)
  // Perfectly handles zoom, window resizing, mobile scaling, and scroll offsets
  const getSvgCoordinates = (e) => {
    if (!svgRef.current) return { x: 500, y: 281.25 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 500, y: 281.25 };
    const svgP = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.min(965, Math.max(35, svgP.x)),
      y: Math.min(530, Math.max(25, svgP.y))
    };
  };

  // Global window pointermove & pointerup listeners for butter-smooth dragging in SVG space
  useEffect(() => {
    const handleWindowPointerMove = (e) => {
      if (!draggingTentId || !dragStart || !svgRef.current) return;
      const svgPt = getSvgCoordinates(e);
      const deltaSvgX = svgPt.x - dragStart.startX;
      const deltaSvgY = svgPt.y - dragStart.startY;

      // In SVG space: 1000 width = 100%, 562.5 height = 100%
      const deltaLeftPercent = (deltaSvgX / 1000) * 100;
      const deltaTopPercent = (deltaSvgY / 562.5) * 100;

      const newLeft = Math.min(94, Math.max(3, dragStart.initialLeft + deltaLeftPercent));
      const newTop = Math.min(94, Math.max(5, dragStart.initialTop + deltaTopPercent));

      setLocalPositions(prev => ({
        ...prev,
        [draggingTentId]: {
          top: `${newTop.toFixed(1)}%`,
          left: `${newLeft.toFixed(1)}%`
        }
      }));
      setHasUnsavedPositions(true);
    };

    const handleWindowPointerUp = () => {
      if (draggingTentId) {
        setDraggingTentId(null);
        setDragStart(null);
      }
    };

    if (draggingTentId) {
      window.addEventListener('pointermove', handleWindowPointerMove);
      window.addEventListener('pointerup', handleWindowPointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [draggingTentId, dragStart]);

  // Handle Drag Start (Strictly for Manager in Setup Mode)
  const handlePointerDown = (e, tent) => {
    if (!isSetupMode || mode !== 'manager' || !allowSetup) return;
    e.stopPropagation();
    e.preventDefault();
    if (!svgRef.current) return;
    
    const curPos = localPositions[tent.id] || { 
      top: tent.mapTop || '50%', 
      left: tent.mapLeft || '50%' 
    };
    const initLeftPercent = parseFloat(curPos.left) || 50;
    const initTopPercent = parseFloat(curPos.top) || 50;
    const svgPt = getSvgCoordinates(e);

    setDraggingTentId(tent.id);
    setActiveSelectedParcel(tent);
    setDragStart({
      startX: svgPt.x,
      startY: svgPt.y,
      initialLeft: initLeftPercent,
      initialTop: initTopPercent
    });
  };

  // Handle Click on the Aerial Photo (e.g. Click to place a new slot - Manager only)
  const handleMapClick = (e) => {
    if (!svgRef.current) return;
    if (isPlacingSlot && mode === 'manager' && onAddTentAtSlot) {
      const svgPt = getSvgCoordinates(e);
      const leftPercent = `${Math.min(95, Math.max(3, (svgPt.x / 1000) * 100)).toFixed(1)}%`;
      const topPercent = `${Math.min(95, Math.max(5, (svgPt.y / 562.5) * 100)).toFixed(1)}%`;

      setIsPlacingSlot(false);
      const defaultZone = campingZones.find(z => z.id === activeZoneId) || campingZones[0];
      onAddTentAtSlot(defaultZone, {
        slotCode: '',
        mapTop: topPercent,
        mapLeft: leftPercent
      });
    } else {
      setActiveSelectedParcel(null);
    }
  };

  // Batch Save Dragged Positions
  const handleSaveAllPositions = async () => {
    if (!hasUnsavedPositions && Object.keys(localPositions).length === 0) {
      toast.success("Vị trí các ô đất hiện tại đã được lưu an toàn. Bạn có thể tiếp tục thao tác!");
      return;
    }
    setIsSaving(true);
    try {
      const dtoList = Object.entries(localPositions).map(([id, pos]) => ({
        id: parseInt(id),
        mapTop: pos.top,
        mapLeft: pos.left
      }));
      await axios.put(getApiUrl('/api/Tents/batch-coordinates'), dtoList);
      toast.success(`Đã lưu hoàn tất vị trí các ô đất! Chế độ setup vẫn tiếp tục hoạt động.`);
      setHasUnsavedPositions(false);
      setIsSetupMode(true);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Lỗi lưu tọa độ ô đất:", err);
      toast.error("Không thể lưu vị trí các ô đất.");
    } finally {
      setIsSaving(false);
    }
  };

  // Apply Preset Hand-Drawn Diagram Layout (16 Slots from user's image)
  const handleApplyPresetLayout = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xếp 16 ô đất theo bản vẽ mẫu Bùi Hui không?")) return;
    setIsSaving(true);
    try {
      await axios.post(getApiUrl('/api/Tents/preset-diagram-layout'));
      toast.success("Đã xếp 16 ô đất theo đúng sơ đồ phác họa flycam Bùi Hui! Chế độ setup tiếp tục được giữ.");
      setHasUnsavedPositions(false);
      setIsSetupMode(true);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Lỗi áp dụng sơ đồ mẫu:", err);
      toast.error("Không thể thiết lập sơ đồ mẫu.");
    } finally {
      setIsSaving(false);
    }
  };

  // Fixed Landmark Hotspots on the aerial image
  const facilityHotspots = [
    { id: 'am-thuc', name: 'Khu Ẩm Thực & BBQ', top: '54%', left: '25%', color: 'bg-amber-700/90', desc: 'Nhà hàng ẩm thực, BBQ & sân khấu đêm' },
    { id: 'san-may', name: 'Sàn Check-in Săn Mây', top: '90%', left: '73%', color: 'bg-emerald-700/90', desc: 'Lễ tân, đài quan sát & sàn ngắm cảnh' },
    { id: 'tro-choi', name: 'Máng Trượt Vui Chơi', top: '78%', left: '9%', color: 'bg-indigo-700/90', desc: 'Máng trượt cầu vồng, bãi dã ngoại' },
    { id: 'do-xe', name: 'Bãi Đỗ Xe 24/7', top: '14%', left: '48%', color: 'bg-slate-700/90', desc: 'Bãi xe ô tô & xe máy an toàn 24/7' },
  ];

  // Default fallback tent types
  const defaultTentTypes = [
    {
      id: 1,
      name: 'Lều Nhỏ',
      size: 'Small',
      slotsOccupied: 1,
      capacity: '1 - 2 khách',
      description: 'Gọn gàng, ấm cúng, phù hợp cho cặp đôi hoặc đi 1 mình.',
      totalQuantity: 12,
      usedQuantity: 0,
      availableQuantity: 12,
      price: 500000,
      hourlyFirstHourPrice: 100000,
      hourlyExtraHourPrice: 50000
    },
    {
      id: 2,
      name: 'Lều Trung',
      size: 'Medium',
      slotsOccupied: 2,
      capacity: '3 - 4 khách',
      description: 'Rộng rãi, thoải mái, phù hợp cho nhóm bạn nhỏ hoặc gia đình nhỏ.',
      totalQuantity: 6,
      usedQuantity: 0,
      availableQuantity: 6,
      price: 800000,
      hourlyFirstHourPrice: 150000,
      hourlyExtraHourPrice: 80000
    },
    {
      id: 3,
      name: 'Lều Lớn',
      size: 'Large',
      slotsOccupied: 4,
      capacity: '6 - 8 khách',
      description: 'Không gian đại gia đình, lều vòm cao cấp, sinh hoạt thoải mái.',
      totalQuantity: 3,
      usedQuantity: 0,
      availableQuantity: 3,
      price: 1200000,
      hourlyFirstHourPrice: 250000,
      hourlyExtraHourPrice: 120000
    }
  ];

  const [internalTentTypes, setInternalTentTypes] = useState(
    tentTypes && tentTypes.length > 0 ? tentTypes : defaultTentTypes
  );

  useEffect(() => {
    if (tentTypes && tentTypes.length > 0) {
      setInternalTentTypes(tentTypes);
    } else {
      axios.get(getApiUrl('/api/TentTypes'))
        .then(res => {
          if (res.data && res.data.length > 0) {
            setInternalTentTypes(res.data);
          }
        })
        .catch(err => {
          console.warn("Could not load TentTypes:", err);
        });
    }
  }, [tentTypes]);

  // Helper to calculate zone capacity
  const getZoneCapacity = (zone) => {
    const zoneTents = zone.tents || [];
    const totalSlots = zoneTents.length > 0 ? zoneTents.length : (zone.totalSlots || 20);
    const usedSlots = zoneTents.filter(t => {
      return t.status === 'Booked' || t.status === 'Occupied' || t.status === 'Pending';
    }).length;
    const availableSlots = Math.max(0, totalSlots - usedSlots);
    const percentUsed = totalSlots > 0 ? Math.min(100, Math.round((usedSlots / totalSlots) * 100)) : 0;
    return { totalSlots, usedSlots, availableSlots, percentUsed };
  };

  const handlePickTentType = (zone, tt) => {
    const slotsNeeded = tt.slotsOccupied || 1;
    const availableSlotsInZone = (zone.tents || []).filter(
      t => t.status === 'Available' && !selectedTentIds.includes(t.id)
    );

    if (availableSlotsInZone.length < slotsNeeded) {
      toast.error(`Khu "${zone.name}" chỉ còn ${availableSlotsInZone.length} ô đất trống, không đủ để dựng ${tt.name} (cần ${slotsNeeded} ô)!`);
      return;
    }

    if (tt.availableQuantity !== undefined && tt.availableQuantity <= 0) {
      toast.error(`Kho campsite đã hết loại lều "${tt.name}", không thể dựng thêm!`);
      return;
    }

    const chosenSlots = availableSlotsInZone.slice(0, slotsNeeded);

    if (onQuickSetupTentType) {
      onQuickSetupTentType(zone, tt, chosenSlots);
    } else if (onSelectMultipleTents) {
      onSelectMultipleTents(chosenSlots, tt);
    } else if (onSelectTent) {
      chosenSlots.forEach(slot => onSelectTent(slot));
    }
  };

  const campingZones = zones.filter(z => z.zoneType !== 'DiningTable');

  // Filtered zones to display in the selector panel
  const displayedZones = activeZoneId === 'All' 
    ? campingZones 
    : campingZones.filter(z => z.id === activeZoneId);

  // Placed tents (having mapTop and mapLeft)
  const placedTents = tents.filter(t => {
    const pos = localPositions[t.id] || (t.mapTop && t.mapLeft ? { top: t.mapTop, left: t.mapLeft } : null);
    if (!pos) return false;
    if (activeZoneId !== 'All' && t.zoneId !== activeZoneId && t.zone?.id !== activeZoneId) return false;
    return true;
  });

  // Tents not placed yet on the map
  const unplacedTents = tents.filter(t => {
    const pos = localPositions[t.id] || (t.mapTop && t.mapLeft ? { top: t.mapTop, left: t.mapLeft } : null);
    return !pos;
  });

  // Connecting dashed links between slots sharing the same bookingId (Lều gộp)
  const bookingConnections = useMemo(() => {
    const map = {};
    placedTents.forEach(tent => {
      if (tent.status === 'Available') return;
      const activeBooking = tent.activeBooking !== undefined
        ? tent.activeBooking
        : tent.bookings?.find(b => 
            b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected'
          );
      const bId = activeBooking?.id;
      if (!bId) return;

      const pos = localPositions[tent.id] || { top: tent.mapTop, left: tent.mapLeft };
      const topNum = parseFloat(pos?.top) || 0;
      const leftNum = parseFloat(pos?.left) || 0;
      const svgX = (leftNum / 100) * 1000;
      const svgY = (topNum / 100) * 562.5;

      if (!map[bId]) {
        map[bId] = {
          bookingId: bId,
          status: tent.status,
          slots: []
        };
      }
      map[bId].slots.push({ id: tent.id, x: svgX, y: svgY });
    });

    const groups = [];
    Object.values(map).forEach(g => {
      if (g.slots.length < 2) return;

      // Compute pairwise distances between all slots in the group
      const edges = [];
      for (let i = 0; i < g.slots.length; i++) {
        for (let j = i + 1; j < g.slots.length; j++) {
          const dx = g.slots[i].x - g.slots[j].x;
          const dy = g.slots[i].y - g.slots[j].y;
          edges.push({
            p1: { x: g.slots[i].x, y: g.slots[i].y },
            p2: { x: g.slots[j].x, y: g.slots[j].y },
            dist: Math.hypot(dx, dy)
          });
        }
      }

      // Build Minimum Spanning Tree (Kruskal) to cleanly link all slots without redundant loops
      edges.sort((a, b) => a.dist - b.dist);
      const parent = {};
      const find = (i) => {
        if (parent[i] === undefined) parent[i] = i;
        if (parent[i] === i) return i;
        return (parent[i] = find(parent[i]));
      };
      const union = (i, j) => {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) {
          parent[rootI] = rootJ;
          return true;
        }
        return false;
      };

      const connections = [];
      for (const edge of edges) {
        const idx1 = g.slots.findIndex(s => s.x === edge.p1.x && s.y === edge.p1.y);
        const idx2 = g.slots.findIndex(s => s.x === edge.p2.x && s.y === edge.p2.y);
        if (union(idx1, idx2)) {
          connections.push(edge);
          if (connections.length === g.slots.length - 1) break;
        }
      }

      groups.push({
        bookingId: g.bookingId,
        status: g.status,
        connections
      });
    });

    return groups;
  }, [placedTents, localPositions]);

  return (
    <div className="space-y-6">
      {/* Top Filter & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Zone Pill Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <button 
            onClick={() => setActiveZoneId('All')}
            className={`px-4 py-2 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
              activeZoneId === 'All' 
                ? 'bg-[#1B4D3E] text-white shadow-md' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Compass size={14} />
            Tất Cả Khu Vực ({campingZones.length} Khu)
          </button>

          {campingZones.map(z => {
            const cap = getZoneCapacity(z);
            const isSelected = activeZoneId === z.id;
            return (
              <button 
                key={z.id}
                onClick={() => setActiveZoneId(z.id)}
                className={`px-4 py-2 rounded-2xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                  isSelected 
                    ? 'bg-[#1B4D3E] text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Layers size={14} />
                {z.name} (Còn {cap.availableSlots} ô)
              </button>
            );
          })}
        </div>

        {/* View Controls & Proactive Setup Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPixelGrid(!showPixelGrid)}
            className={`px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 border transition-all ${
              showPixelGrid 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            title="Bật/Tắt hiển thị các ô đất cắm trại trên ảnh chụp flycam"
          >
            {showPixelGrid ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>Hiển Thị Ô Đất: <strong>{showPixelGrid ? 'BẬT' : 'TẮT'}</strong></span>
          </button>

          {/* PROACTIVE SETUP MODE TOGGLE BUTTON - STRICTLY MANAGER ONLY */}
          {allowSetup && mode === 'manager' && (
            <button
              type="button"
              onClick={() => {
                setIsSetupMode(!isSetupMode);
                setIsPlacingSlot(false);
              }}
              className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 border transition-all shadow-sm active:scale-95 ${
                isSetupMode 
                  ? 'bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 shadow-amber-200' 
                  : 'bg-white text-slate-700 hover:text-slate-950 hover:bg-slate-50 border-slate-200'
              }`}
              title="Nhấp để chủ động bật hoặc tắt chế độ định vị, kéo thả ô đất trên ảnh flycam"
            >
              <Sliders size={15} className={isSetupMode ? 'text-slate-950' : 'text-slate-500'} />
              <span>Chế Độ Setup Mặt Bằng:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isSetupMode ? 'bg-slate-950 text-amber-300' : 'bg-slate-200 text-slate-600'
              }`}>
                {isSetupMode ? 'ĐANG BẬT' : 'TẮT'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* SETUP WORKBENCH TOOLBAR - ONLY SHOWN FOR MANAGER WHEN SETUP MODE IS ON */}
      {isSetupMode && allowSetup && mode === 'manager' && (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-3xl border-2 border-amber-400/80 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Move size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Đang Bật Chế Độ Setup Mặt Bằng
                </span>
                <span className="text-[10px] bg-amber-400/20 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                  {placedTents.length} ô đất
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                Giữ chuột và kéo thả trực tiếp các ô đất để định vị trên mặt cỏ • Nhấp vào nút "Thêm Ô Đất" để cắm thêm ô mới
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tool: Place new slot */}
            <button
              type="button"
              onClick={() => setIsPlacingSlot(!isPlacingSlot)}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border ${
                isPlacingSlot
                  ? 'bg-emerald-500 text-white border-white ring-2 ring-emerald-300 animate-pulse'
                  : 'bg-slate-800 text-emerald-300 border-emerald-500/50 hover:bg-slate-700'
              }`}
              title="Nhấp vào vị trí bất kỳ trên ảnh flycam để tạo ô đất mới"
            >
              <Crosshair size={14} />
              {isPlacingSlot ? 'Nhấp Vào Bãi Cỏ Để Đặt' : 'Thêm Ô Đất Mới'}
            </button>

            {/* Tool: Preset Diagram */}
            <button
              type="button"
              onClick={handleApplyPresetLayout}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-indigo-600/90 hover:bg-indigo-600 text-white border border-indigo-400/50 flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Tự động xếp 16 ô đất thành 3 hàng theo bản vẽ tay thực tế của Bùi Hui"
            >
              <Sparkles size={14} className="text-amber-300" />
              Xếp 16 Ô Theo Bản Vẽ
            </button>

            {/* Tool: Save / Hoàn Tất Sắp Xếp (GIỮ CHẾ ĐỘ SETUP ĐỂ TIẾP TỤC THAO TÁC) */}
            <button
              type="button"
              onClick={handleSaveAllPositions}
              disabled={isSaving}
              className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 ${
                hasUnsavedPositions 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-300 animate-pulse'
                  : 'bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-500/40'
              }`}
              title="Lưu lại vị trí vừa sắp xếp và tiếp tục giữ chế độ setup để thao tác"
            >
              <Save size={14} />
              {isSaving ? 'Đang lưu vị trí...' : hasUnsavedPositions ? 'Hoàn Tất & Lưu Vị Trí' : 'Đã Lưu Xong (Giữ Setup)'}
            </button>

            {/* Exit Setup Mode button - Chỉ đóng khi người dùng chủ động bấm Thoát */}
            <button
              type="button"
              onClick={() => {
                if (hasUnsavedPositions) {
                  if (window.confirm("Bạn có vị trí ô đất vừa đổi chưa lưu. Bạn có muốn lưu trước khi thoát không?")) {
                    handleSaveAllPositions();
                  }
                }
                setIsSetupMode(false);
                setIsPlacingSlot(false);
              }}
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 transition-all flex items-center gap-1.5"
              title="Chỉ bấm nút này khi bạn muốn đóng thanh công cụ Setup"
            >
              <Power size={13} className="text-rose-400" />
              Thoát Chế Độ Setup
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Aerial Flycam Map Container */}
      <div 
        ref={mapContainerRef}
        className={`w-full overflow-auto custom-scrollbar rounded-3xl shadow-2xl border-4 border-white bg-slate-950 relative ${
          isPlacingSlot ? 'cursor-crosshair' : ''
        }`}
      >
        <div 
          style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
          className="relative aspect-[16/9] select-none transition-[width] duration-150 overflow-hidden"
        >
          {/* Map Header Status Overlay (Top-Left) */}
          <div className="absolute top-4 left-4 z-30 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl border border-white/20 shadow-lg flex items-center gap-3 pointer-events-auto">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <LayoutGrid size={13} /> SƠ ĐỒ MẶT BẰNG & CÁC Ô ĐẤT TRÊN ẢNH FLYCAM
              </p>
              <p className="text-[11px] text-slate-300">
                {isSetupMode 
                  ? 'Chế độ Setup: Kéo thả các ô đất trực tiếp trên cỏ hoặc bấm Thêm Ô Đất Mới' 
                  : `Đang hiển thị ${placedTents.length} ô đất được bố trí thực tế trên mặt bằng bãi cắm trại`}
              </p>
            </div>
          </div>

          {/* Map Controls (Top-Right): Zoom & Setup Toggle */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
            {/* Map Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md text-white px-2 py-1.5 rounded-2xl border border-white/20 shadow-xl">
              <button 
                type="button" 
                onClick={() => setZoomLevel(prev => Math.max(1, +(prev - 0.25).toFixed(2)))}
                disabled={zoomLevel <= 1}
                className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all text-slate-300 hover:text-white"
                title="Thu nhỏ bản đồ"
              >
                <Minus size={13} />
              </button>
              <span className="text-[11px] font-mono font-bold px-1.5 min-w-[38px] text-center text-amber-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button 
                type="button" 
                onClick={() => setZoomLevel(prev => Math.min(2.5, +(prev + 0.25).toFixed(2)))}
                disabled={zoomLevel >= 2.5}
                className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all text-slate-300 hover:text-white"
                title="Phóng to bản đồ"
              >
                <Plus size={13} />
              </button>
              {zoomLevel > 1 && (
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="text-[10px] px-1.5 py-0.5 ml-0.5 rounded-md bg-white/15 hover:bg-white/25 text-amber-300 font-bold"
                  title="Về kích thước mặc định"
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </div>

            {/* Quick Setup Mode Toggle Button (Manager only) */}
            {allowSetup && mode === 'manager' && !isPlacingSlot && (
              <button
                type="button"
                onClick={() => {
                  setIsSetupMode(!isSetupMode);
                  setIsPlacingSlot(false);
                }}
                className={`px-3.5 py-2 rounded-2xl font-black text-xs flex items-center gap-1.5 backdrop-blur-md shadow-xl border transition-all active:scale-95 ${
                  isSetupMode 
                    ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-300' 
                    : 'bg-slate-900/85 text-white hover:bg-slate-900 border-white/20 hover:border-amber-300/50'
                }`}
                title="Bật/Tắt chế độ kéo thả ô đất"
              >
                <Sliders size={14} className={isSetupMode ? 'text-slate-950' : 'text-amber-400'} />
                <span>Setup: <strong>{isSetupMode ? 'BẬT' : 'TẮT'}</strong></span>
              </button>
            )}
          </div>

          {/* Crosshair notice when placing slot */}
          {isPlacingSlot && (
            <div className="absolute top-16 right-4 z-30 bg-amber-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-2xl shadow-xl border border-white flex items-center gap-2 animate-bounce">
              <Crosshair size={16} /> Nhấp chuột vào bất cứ đâu trên bãi cỏ để đặt ô đất mới
            </div>
          )}

          {/* Pure SVG Vector Canvas */}
          <svg 
            ref={svgRef}
            viewBox="0 0 1000 562.5"
            preserveAspectRatio="xMidYMid meet"
            onClick={handleMapClick}
            className="w-full h-full block"
          >
            <defs>
              {/* Premium Glow Filters */}
              <filter id="slotGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#f59e0b" floodOpacity="0.85" />
              </filter>
              <filter id="amberGlow" x="-35%" y="-35%" width="170%" height="170%">
                <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#fbbf24" floodOpacity="0.9" />
              </filter>
              <filter id="roseGlow" x="-35%" y="-35%" width="170%" height="170%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f43f5e" floodOpacity="0.85" />
              </filter>
              <filter id="softEmeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#34d399" floodOpacity="0.6" />
              </filter>
              <filter id="boxDropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#020617" floodOpacity="0.5" />
              </filter>

              {/* Gradients for Land Parcels (Transparent Frosted Glass Center + Colored Border) */}
              {/* 1. Available: Translucent Frosted Glass with clear definition */}
              <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#022c22" stopOpacity="0.24" />
              </linearGradient>

              {/* 2. Selected: Translucent Golden Amber Glass */}
              <linearGradient id="selectedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b45309" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#78350f" stopOpacity="0.40" />
              </linearGradient>

              {/* 3. Booked: Translucent Cedar / Honey Bronze Glass */}
              <linearGradient id="bookedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#92400e" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#451a03" stopOpacity="0.32" />
              </linearGradient>

              {/* 4. Occupied: Translucent Ruby Wine Rose Glass */}
              <linearGradient id="occupiedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9f1239" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#4c0519" stopOpacity="0.32" />
              </linearGradient>

              {/* Glass Top Highlight Shine */}
              <linearGradient id="glassShine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
              </linearGradient>

              {/* Terrain Vignette */}
              <linearGradient id="vignetteGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
                <stop offset="35%" stopColor="#000000" stopOpacity="0.0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {/* 1. Aerial Flycam Image Layer */}
            <image 
              href="/campsite-map-new.jpg" 
              x="0" 
              y="0" 
              width="1000" 
              height="562.5" 
              preserveAspectRatio="none" 
              className="pointer-events-none select-none"
            />

            {/* 2. Terrain Vignette Overlay */}
            <rect 
              x="0" 
              y="0" 
              width="1000" 
              height="562.5" 
              fill="url(#vignetteGrad)" 
              pointerEvents="none" 
            />

            {/* 3. Connecting Dashed Conduits between Grouped Slots (Lều gộp) */}
            {showPixelGrid && bookingConnections.map(group => {
              const isGroupHovered = hoveredBookingId === group.bookingId;
              const isOccupiedGroup = group.status === 'Occupied';
              const strokeColor = isOccupiedGroup ? '#f43f5e' : '#f59e0b';
              const activeStroke = isOccupiedGroup ? '#fb7185' : '#fbbf24';

              return (
                <g key={group.bookingId} className="pointer-events-none">
                  {group.connections.map((conn, cIdx) => (
                    <line
                      key={cIdx}
                      x1={conn.p1.x}
                      y1={conn.p1.y}
                      x2={conn.p2.x}
                      y2={conn.p2.y}
                      stroke={isGroupHovered ? activeStroke : strokeColor}
                      strokeWidth={isGroupHovered ? 2.5 : 1.8}
                      strokeDasharray={isGroupHovered ? "4, 2" : "5, 4"}
                      strokeLinecap="round"
                      strokeOpacity={isGroupHovered ? 1 : 0.85}
                      filter={isGroupHovered ? "url(#amberGlow)" : undefined}
                    />
                  ))}
                </g>
              );
            })}

            {/* 4. Individual Land Parcel SVG Slots */}
            {showPixelGrid && placedTents.map((tent) => {
              const curPos = localPositions[tent.id] || { top: tent.mapTop, left: tent.mapLeft };
              const isSelected = selectedTentIds.includes(tent.id);
              const isDragging = draggingTentId === tent.id;
              const isHovered = hoveredSlot?.id === tent.id;
              const isAvailable = tent.status === 'Available';
              const isOccupied = !isAvailable && tent.status === 'Occupied';
              const isBooked = !isAvailable && (tent.status === 'Booked' || tent.status === 'Pending');

              const activeBooking = isAvailable 
                ? null 
                : (tent.activeBooking !== undefined 
                    ? tent.activeBooking 
                    : tent.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected'));
              const tentBookingId = activeBooking?.id;

              const groupedSiblingSlots = (!isAvailable && tentBookingId) 
                ? placedTents.filter(t => {
                    if (t.status === 'Available') return false;
                    const bId = t.activeBooking !== undefined ? t.activeBooking?.id : t.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected')?.id;
                    return bId === tentBookingId;
                  })
                : [];
              const isGrouped = groupedSiblingSlots.length > 1;

              const isLinkedToHoveredBooking = Boolean(hoveredBookingId && tentBookingId === hoveredBookingId);
              const isDimmed = Boolean(hoveredBookingId && !isLinkedToHoveredBooking);

              const displayCode = tent.slotCode || tent.name.replace(/^Lều\s+/i, '');
              const canSetup = isSetupMode && mode === 'manager' && allowSetup;

              // SVG Coordinate conversions
              const cx = (parseFloat(curPos.left) / 100) * 1000;
              const cy = (parseFloat(curPos.top) / 100) * 562.5;

              // Palette parameters (Transparent Frosted Glass Center + Clearer, Refined Borders)
              let fillGradient = isHovered ? 'rgba(16, 185, 129, 0.20)' : 'url(#availGrad)';
              let strokeColor = isHovered ? '#10b981' : 'rgba(16, 185, 129, 0.72)'; // Clear emerald-mint border
              let strokeWidth = isHovered ? 1.5 : 1.3;
              let tentStrokeColor = isHovered ? '#a7f3d0' : 'rgba(167, 243, 208, 0.85)'; // Crisp mint tent outline
              let tentFillColor = 'rgba(16, 185, 129, 0.10)';
              let tentDoorColor = 'rgba(5, 150, 105, 0.35)';
              let statusLabel = 'TRỐNG';
              let statusTextColor = isHovered ? '#6ee7b7' : 'rgba(167, 243, 208, 0.88)'; // Legible mint

              if (isOccupied) {
                fillGradient = isHovered ? 'rgba(244, 63, 94, 0.30)' : 'url(#occupiedGrad)';
                strokeColor = isHovered ? '#f43f5e' : 'rgba(244, 63, 94, 0.75)'; // Clear rose border
                strokeWidth = isHovered ? 1.5 : 1.3;
                tentStrokeColor = isHovered ? '#fb7185' : 'rgba(251, 113, 133, 0.85)';
                tentFillColor = 'rgba(244, 63, 94, 0.12)';
                tentDoorColor = 'rgba(253, 164, 175, 0.5)';
                statusLabel = 'ĐANG Ở';
                statusTextColor = isHovered ? '#fda4af' : 'rgba(253, 164, 175, 0.9)';
              } else if (isBooked) {
                fillGradient = isHovered ? 'rgba(245, 158, 11, 0.30)' : 'url(#bookedGrad)';
                strokeColor = isHovered ? '#f59e0b' : 'rgba(245, 158, 11, 0.75)'; // Clear amber border
                strokeWidth = isHovered ? 1.5 : 1.3;
                tentStrokeColor = isHovered ? '#fde047' : 'rgba(253, 224, 71, 0.85)';
                tentFillColor = 'rgba(245, 158, 11, 0.12)';
                tentDoorColor = 'rgba(245, 158, 11, 0.5)';
                statusLabel = 'ĐÃ CỌC';
                statusTextColor = isHovered ? '#fde047' : 'rgba(253, 224, 71, 0.9)';
              }

              if (isSelected || isLinkedToHoveredBooking) {
                fillGradient = 'url(#selectedGrad)';
                strokeColor = '#fbbf24'; // Radiant golden amber border
                strokeWidth = 2.0;
                tentStrokeColor = '#ffffff';
                tentFillColor = 'rgba(251, 191, 36, 0.25)';
                tentDoorColor = '#fde047';
                statusLabel = isSelected ? 'ĐANG CHỌN' : (isOccupied ? 'ĐANG Ở' : 'ĐÃ CỌC');
                statusTextColor = '#fef08a';
              }

              const scale = isDragging ? 1.15 : (isHovered ? 1.08 : isSelected || isLinkedToHoveredBooking ? 1.05 : 1);

              return (
                <g
                  key={tent.id}
                  transform={`translate(${cx}, ${cy}) scale(${scale})`}
                  onPointerDown={(e) => handlePointerDown(e, tent)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canSetup) {
                      setActiveSelectedParcel(tent);
                    } else if (mode === 'manager' && onOpenTentDetail) {
                      onOpenTentDetail(tent);
                    } else if (onSelectTent) {
                      onSelectTent(tent);
                    }
                  }}
                  onMouseEnter={() => {
                    setHoveredSlot(tent);
                    if (tentBookingId) {
                      setHoveredBookingId(tentBookingId);
                    } else {
                      setHoveredBookingId(null);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredSlot(null);
                    setHoveredBookingId(null);
                  }}
                  style={{
                    cursor: canSetup ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                    opacity: isDimmed ? 0.25 : 1,
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out, opacity 0.2s ease'
                  }}
                  className="select-none"
                >
                  {/* Glowing Highlight Halo when Selected/Linked/Dragging */}
                  {(isLinkedToHoveredBooking || isSelected || isDragging) && (
                    <rect
                      x={-29}
                      y={-22.25}
                      width={58}
                      height={44.5}
                      rx={8.5}
                      fill="none"
                      stroke={isDragging ? "#fde047" : "#fbbf24"}
                      strokeWidth={isDragging ? 2.5 : 2}
                      strokeDasharray={isDragging ? "4,2" : undefined}
                      filter="url(#amberGlow)"
                    />
                  )}

                  {/* Main Translucent Frosted Glass Parcel Box (Grass shines through) */}
                  <rect
                    x={-27}
                    y={-20.25}
                    width={54}
                    height={40.5}
                    rx={6.5}
                    fill={fillGradient}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    filter="url(#boxDropShadow)"
                  />

                  {/* Frosted Glass Top Reflection Highlight */}
                  <rect
                    x={-26}
                    y={-19.25}
                    width={52}
                    height={14}
                    rx={5.5}
                    fill="url(#glassShine)"
                    pointerEvents="none"
                  />

                  {/* Top Bar: Slot Code with Contrast Shadow */}
                  <text
                    x={-20}
                    y={-11.5}
                    fill="#ffffff"
                    fontSize={7.5}
                    fontWeight={900}
                    fontFamily="ui-monospace, monospace"
                    dominantBaseline="central"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.95))' }}
                  >
                    {displayCode}
                  </text>

                  {/* Top-Right Badge: Group or Single Status Indicator */}
                  {isGrouped ? (
                    <g>
                      <rect
                        x={3}
                        y={-16.5}
                        width={21}
                        height={9}
                        rx={3}
                        fill={isOccupied ? "rgba(244, 63, 94, 0.9)" : "rgba(245, 158, 11, 0.9)"}
                      />
                      <text
                        x={13.5}
                        y={-12}
                        fill="#ffffff"
                        fontSize={5.2}
                        fontWeight={900}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        GỘP {groupedSiblingSlots.length}
                      </text>
                    </g>
                  ) : isSelected ? (
                    <g>
                      <rect
                        x={5}
                        y={-16.5}
                        width={19}
                        height={8.5}
                        rx={3}
                        fill="#f59e0b"
                      />
                      <text
                        x={14.5}
                        y={-12}
                        fill="#020617"
                        fontSize={5.2}
                        fontWeight={900}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        ✓ CHỌN
                      </text>
                    </g>
                  ) : isOccupied ? (
                    <g>
                      <rect
                        x={6}
                        y={-16.5}
                        width={18}
                        height={8.5}
                        rx={3}
                        fill="rgba(244, 63, 94, 0.2)"
                        stroke="rgba(244, 63, 94, 0.6)"
                        strokeWidth="0.7"
                      />
                      <text
                        x={15}
                        y={-12}
                        fill="#fda4af"
                        fontSize={5.2}
                        fontWeight={800}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.8))' }}
                      >
                        Ở
                      </text>
                    </g>
                  ) : isBooked ? (
                    <g>
                      <rect
                        x={5}
                        y={-16.5}
                        width={19}
                        height={8.5}
                        rx={3}
                        fill="rgba(245, 158, 11, 0.2)"
                        stroke="rgba(245, 158, 11, 0.6)"
                        strokeWidth="0.7"
                      />
                      <text
                        x={14.5}
                        y={-12}
                        fill="#fde047"
                        fontSize={5.2}
                        fontWeight={800}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.8))' }}
                      >
                        CỌC
                      </text>
                    </g>
                  ) : (
                    <g>
                      <rect
                        x={5.5}
                        y={-16.5}
                        width={19}
                        height={8.5}
                        rx={3}
                        fill="rgba(16, 185, 129, 0.15)"
                        stroke="rgba(52, 211, 153, 0.55)"
                        strokeWidth="0.7"
                      />
                      <text
                        x={15}
                        y={-12}
                        fill="#a7f3d0"
                        fontSize={5.2}
                        fontWeight={800}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.8))' }}
                      >
                        3m²
                      </text>
                    </g>
                  )}

                  {/* Center Illustration: Move handle in Setup mode, or Authentic Glamping Tent */}
                  {canSetup ? (
                    <g transform="translate(0, 0)">
                      <circle cx={0} cy={0} r={5.5} fill="#f59e0b" fillOpacity={0.25} stroke="#fde047" strokeWidth="0.8" />
                      <path d="M0 -4 L-2 -1.5 L-0.8 -1.5 L-0.8 1.5 L-2 1.5 L0 4 L2 1.5 L0.8 1.5 L0.8 -1.5 L2 -1.5 Z" fill="#fde047" />
                      <path d="M-4 0 L-1.5 -2 L-1.5 -0.8 L1.5 -0.8 L1.5 -2 L4 0 L1.5 2 L1.5 0.8 L-1.5 0.8 L-1.5 2 Z" fill="#fde047" />
                    </g>
                  ) : (
                    <g transform="translate(0, 0.5)" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>
                      {/* Tent main canopy */}
                      <path
                        d="M -7.5 4.5 L 0 -5.5 L 7.5 4.5 Z"
                        fill={tentFillColor}
                        stroke={tentStrokeColor}
                        strokeWidth={1.15}
                        strokeLinejoin="round"
                      />
                      {/* Tent illuminated inner doorway */}
                      <path
                        d="M -3 4.5 L 0 -0.5 L 3 4.5 Z"
                        fill={tentDoorColor}
                        stroke={tentStrokeColor}
                        strokeWidth={0.8}
                        strokeLinejoin="round"
                      />
                      {/* Ridge pole vertical seam */}
                      <line
                        x1="0"
                        y1="-5.5"
                        x2="0"
                        y2="-0.5"
                        stroke={tentStrokeColor}
                        strokeWidth={0.8}
                        strokeLinecap="round"
                      />
                      {/* Ground peg baseline */}
                      <line
                        x1="-9"
                        y1="4.5"
                        x2="9"
                        y2="4.5"
                        stroke={tentStrokeColor}
                        strokeWidth={0.9}
                        strokeLinecap="round"
                      />
                    </g>
                  )}

                  {/* Delicate Divider Line */}
                  <line x1="-18" y1="8" x2="18" y2="8" stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />

                  {/* Footer: Centered Status Text with Drop Shadow */}
                  <text
                    x={0}
                    y={13.5}
                    fill={statusTextColor}
                    fontSize={5.4}
                    fontWeight={800}
                    textAnchor="middle"
                    dominantBaseline="central"
                    letterSpacing="0.14em"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))' }}
                  >
                    {statusLabel}
                  </text>

                  {/* Live Dragging Floating Badge */}
                  {isDragging && (
                    <g transform="translate(0, -29)">
                      <rect
                        x={-27}
                        y={-7.5}
                        width={54}
                        height={15}
                        rx={7.5}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        filter="url(#boxDropShadow)"
                      />
                      <text
                        x={0}
                        y={0.5}
                        fill="#020617"
                        fontSize={7}
                        fontWeight={900}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {curPos.top}, {curPos.left}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* 5. Facility Landmarks */}
            {facilityHotspots.map(spot => {
              const spotX = (parseFloat(spot.left) / 100) * 1000;
              const spotY = (parseFloat(spot.top) / 100) * 562.5;

              return (
                <g key={spot.id} transform={`translate(${spotX}, ${spotY})`} className="pointer-events-none select-none">
                  <rect 
                    x={-56} 
                    y={-11} 
                    width={112} 
                    height={22} 
                    rx={11} 
                    fill="#0f172a" 
                    fillOpacity={0.85} 
                    stroke="#ffffff" 
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    filter="url(#boxDropShadow)"
                  />
                  <path 
                    d="M-43 -4 C-46 -4 -48 -2 -48 1 C-48 4.5 -43 8 -43 8 C-43 8 -38 4.5 -38 1 C-38 -2 -40 -4 -43 -4 Z" 
                    fill="#f59e0b" 
                  />
                  <circle cx={-43} cy={1} r={1.5} fill="#ffffff" />
                  <text 
                    x={-34} 
                    y={1} 
                    fill="#f8fafc" 
                    fontSize={7.2} 
                    fontWeight={800} 
                    dominantBaseline="central"
                  >
                    {spot.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Interactive HTML Hover Tooltip Layer - Strictly for Booked / Occupied Slots Only */}
          {!isSetupMode && hoveredSlot && (hoveredSlot.status !== 'Available' || (hoveredSlot.activeBooking && hoveredSlot.activeBooking.id)) && (() => {
            const tent = hoveredSlot;
            const curPos = localPositions[tent.id] || { top: tent.mapTop, left: tent.mapLeft };
            const isOccupied = tent.status === 'Occupied';
            const isBooked = tent.status === 'Booked' || tent.status === 'Pending';

            const activeBooking = tent.activeBooking !== undefined 
              ? tent.activeBooking 
              : tent.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected');
            const tentBookingId = activeBooking?.id;

            const groupedSiblingSlots = tentBookingId 
              ? placedTents.filter(t => {
                  if (t.status === 'Available') return false;
                  const bId = t.activeBooking !== undefined ? t.activeBooking?.id : t.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected')?.id;
                  return bId === tentBookingId;
                })
              : [];
            const isGrouped = groupedSiblingSlots.length > 1;
            const displayCode = tent.slotCode || tent.name.replace(/^Lều\s+/i, '');

            const topPercent = parseFloat(curPos.top) || 50;
            const isNearTop = topPercent < 26;

            return (
              <div 
                style={{
                  top: curPos.top,
                  left: curPos.left,
                  transform: isNearTop ? 'translate(-50%, 25px)' : 'translate(-50%, -100%)',
                  marginTop: isNearTop ? '15px' : '-20px'
                }}
                onMouseEnter={() => setHoveredSlot(tent)}
                onMouseLeave={() => {
                  setHoveredSlot(null);
                  setHoveredBookingId(null);
                }}
                className={`absolute z-50 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border ${
                  isGrouped ? 'border-amber-400 w-64 ring-2 ring-amber-400/40' : 'border-white/20 w-56'
                } text-left animate-in zoom-in-95 duration-150 pointer-events-auto`}
              >
                {isGrouped && activeBooking ? (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-xs text-amber-300 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" />
                        LỀU GỘP ({groupedSiblingSlots.length} Ô ĐẤT)
                      </span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border ${
                        isOccupied ? 'bg-rose-500/30 text-rose-300 border-rose-400/40' : 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                      }`}>
                        {isOccupied ? 'Đang Ở' : 'Đã Đặt Cọc'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 space-y-1 mt-1 border-t border-white/10 pt-1.5 font-medium">
                      <p className="text-white font-bold">
                        Các ô: <span className="text-amber-300 font-mono">{groupedSiblingSlots.map(s => s.slotCode || s.name.replace(/^Lều\s+/i, '')).join(' + ')}</span> (~{groupedSiblingSlots.length * 3}m²)
                      </p>
                      {activeBooking.tentSetupSummary && (
                        <p className="text-amber-300 font-bold bg-amber-950/70 p-1 rounded-lg border border-amber-500/30 flex items-center gap-1">
                          <span>⛺ Setup:</span>
                          <span className="text-white">{activeBooking.tentSetupSummary}</span>
                        </p>
                      )}
                      <p>Khách: <strong className="text-emerald-300">{activeBooking.customerName || 'Khách đặt'}</strong> {activeBooking.phoneNumber ? `(${activeBooking.phoneNumber})` : ''}</p>
                      <p>Hình thức: <strong>{activeBooking.bookingType === 'Hourly' ? 'Thuê theo giờ' : 'Thuê qua đêm'}</strong></p>
                      {activeBooking.depositAmount > 0 && (
                        <p>Đã cọc: <strong className="text-amber-400">{activeBooking.depositAmount.toLocaleString('vi-VN')}đ</strong></p>
                      )}
                    </div>
                    <div className="mt-2 text-[9px] text-amber-300/95 font-semibold bg-amber-950/70 px-2 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1">
                      <Info size={11} /> Cả {groupedSiblingSlots.length} ô này thuộc cùng 1 đơn đặt lều!
                    </div>
                  </>
                ) : activeBooking ? (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-amber-300">
                        Ô {displayCode} (~3m²)
                      </span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border ${
                        isOccupied ? 'bg-rose-500/30 text-rose-300 border-rose-400/40' : 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                      }`}>
                        {isOccupied ? 'Đang Ở' : 'Đã Đặt Cọc'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 space-y-0.5 mt-1 border-t border-white/10 pt-1 font-medium">
                      {activeBooking.tentSetupSummary && (
                        <p className="text-amber-300 font-bold bg-amber-950/70 p-1 rounded-lg border border-amber-500/30 flex items-center gap-1 mb-1">
                          <span>⛺ Setup:</span>
                          <span className="text-white">{activeBooking.tentSetupSummary}</span>
                        </p>
                      )}
                      <p>Khách: <strong className="text-emerald-300">{activeBooking.customerName || 'Khách đặt'}</strong> {activeBooking.phoneNumber ? `(${activeBooking.phoneNumber})` : ''}</p>
                      <p>Hình thức: <strong>{activeBooking.bookingType === 'Hourly' ? 'Thuê theo giờ' : 'Thuê qua đêm'}</strong></p>
                      {activeBooking.depositAmount > 0 && (
                        <p>Đã cọc: <strong className="text-amber-400">{activeBooking.depositAmount.toLocaleString('vi-VN')}đ</strong></p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-amber-300">
                        Ô {displayCode} (~3m²)
                      </span>
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-amber-500/30 text-amber-300 border border-amber-400/40">
                        {isOccupied ? 'Đang Ở' : 'Đã Đặt Cọc'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-1">
                      Ô đất hiện đang có đơn đặt lưu trú.
                    </p>
                  </>
                )}

                {mode === 'manager' && (
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/15">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenTentDetail) onOpenTentDetail(tent);
                      }}
                      className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all"
                      title="Chỉnh sửa ô đất"
                    >
                      <Edit size={11} /> Sửa Ô Đất
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteTent) onDeleteTent(tent);
                      }}
                      className="py-1.5 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all"
                      title="Xóa ô đất"
                    >
                      <Trash2 size={11} /> Xóa
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Flycam Map Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md border-2 border-emerald-500 bg-emerald-500/20 inline-block shadow-xs"></span>
            Ô đất trống (~3m² quy chuẩn)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md border-2 border-amber-400 bg-amber-400/25 inline-block shadow-xs"></span>
            Ô đang chọn (Tick nhiều ô để gộp)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md border-2 border-amber-500 bg-amber-500/20 inline-block shadow-xs"></span>
            Lều đã cọc / Lều gộp
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md border-2 border-rose-500 bg-rose-500/20 inline-block shadow-xs"></span>
            Đang có khách lưu trú
          </span>
        </div>
        <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-500" />
          <span>* Rà chuột vào các ô đã đặt để xem thông tin đơn & phát sáng các ô thuộc cùng 1 lều</span>
        </div>
      </div>

      {/* Unplaced Tents Drawer (Only shown in Manager Setup Mode if any tents lack coordinates) */}
      {mode === 'manager' && isSetupMode && unplacedTents.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-900 flex items-center gap-2">
              <AlertCircle size={15} /> Có {unplacedTents.length} ô lều chưa được định vị trên ảnh flycam:
            </span>
            <span className="text-[11px] text-amber-700">Bấm "Đặt Lên Cỏ" để gán tọa độ</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {unplacedTents.map((ut) => (
              <button
                key={ut.id}
                onClick={() => {
                  // Assign center coordinates
                  const nextTop = '80%';
                  const nextLeft = '50%';
                  setLocalPositions(prev => ({
                    ...prev,
                    [ut.id]: { top: nextTop, left: nextLeft }
                  }));
                  setHasUnsavedPositions(true);
                  toast.success(`Đã đưa ${ut.name} lên mặt cỏ! Bạn hãy kéo thả ô này vào vị trí mong muốn.`);
                }}
                className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Plus size={12} /> {ut.name} ({ut.size || 'Small'}) ➔ Đặt Lên Cỏ
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone Land & Tent Size Booking Cards (Only shown if mode !== 'flycam-only') */}
      {mode !== 'flycam-only' && (
        <div className="space-y-8 pt-4">
          {displayedZones.map(zone => {
            const cap = getZoneCapacity(zone);
            const desc = zone.description || 'Khu cắm trại góc nhìn đẹp, thiên nhiên thoáng mát.';
            const zoneSelectedSlots = (zone.tents || []).filter(t => selectedTentIds.includes(t.id));

            return (
              <div key={zone.id} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
                {/* Zone Header with Land Capacity Bar */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-10 bg-[#1B4D3E] rounded-full" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{zone.name}</h3>
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            Mặt Bằng Cắm Trại
                          </span>
                          {zoneSelectedSlots.length > 0 && (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                              Đang chọn {zoneSelectedSlots.length} ô
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-3.5 py-1.5 rounded-full border shadow-xs ${
                        cap.availableSlots === 0 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : cap.percentUsed >= 70 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        Mặt Bằng: {cap.percentUsed}% ({cap.usedSlots}/{cap.totalSlots} ô đất)
                      </span>
                    </div>
                  </div>

                  {/* Land Meter Progress Bar */}
                  <div className="space-y-2">
                    <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          cap.percentUsed >= 90 ? 'bg-rose-500' :
                          cap.percentUsed >= 70 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${cap.percentUsed}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-600 font-semibold flex-wrap gap-2">
                      <span>Tổng bãi: <strong className="font-mono text-slate-800">{cap.totalSlots} ô đất (~{cap.totalSlots * 3}m²)</strong></span>
                      <span>Đang dựng: <strong className="font-mono text-slate-800">{cap.usedSlots} ô (~{cap.usedSlots * 3}m²)</strong></span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                        Còn trống: <strong className="font-mono">{cap.availableSlots} ô (~{cap.availableSlots * 3}m²)</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section Header: Inventory & Capacity Fulfillment Overview */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h4 className="text-xs font-black uppercase text-[#1B4D3E] tracking-wider flex items-center gap-1.5">
                        <Box size={16} /> TÌNH TRẠNG KHO LỀU & NĂNG LỰC ĐÁP ỨNG CỦA KHU
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        Số lượng lều campsite sở hữu còn lại trong kho và công suất đáp ứng tối đa trên mặt bằng {zone.name}:
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      Tổng kho: {internalTentTypes.length} loại lều
                    </span>
                  </div>

                  {/* Tent Types Capacity & Stock Cards Grid (Pure Status & Capacity - No Action Buttons) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {internalTentTypes.map(tt => {
                      const slots = tt.slotsOccupied || 1;
                      const sqm = slots * 3;
                      const warehouseTotal = tt.totalQuantity || 10;
                      const warehouseUsed = tt.usedQuantity || 0;
                      const warehouseAvail = tt.availableQuantity !== undefined ? tt.availableQuantity : Math.max(0, warehouseTotal - warehouseUsed);
                      
                      const availableSlotsInZone = (zone.tents || []).filter(
                        t => t.status === 'Available'
                      ).length;

                      // Conditions to pitch
                      const hasWarehouseStock = warehouseAvail > 0;
                      const hasGroundSpace = availableSlotsInZone >= slots;
                      const canFulfill = hasWarehouseStock && hasGroundSpace;

                      // Maximum tents of this type that can be pitched here right now
                      const maxCanPitch = Math.min(warehouseAvail, Math.floor(availableSlotsInZone / slots));

                      // Warehouse stock percent
                      const stockPercent = warehouseTotal > 0 ? Math.round((warehouseAvail / warehouseTotal) * 100) : 0;

                      // Pricing
                      const priceNight = tt.price || 500000;
                      const priceFirstHour = tt.hourlyFirstHourPrice || 100000;
                      const priceExtraHour = tt.hourlyExtraHourPrice || 50000;
                      const isHourly = stayType === 'dayuse';
                      const displayPrice = isHourly
                        ? (priceFirstHour + (duration > 1 ? (duration - 1) * priceExtraHour : 0))
                        : (priceNight * duration);

                      return (
                        <div 
                          key={tt.id || tt.name}
                          className={`rounded-3xl p-6 border-2 transition-all duration-300 flex flex-col justify-between bg-white shadow-xs ${
                            canFulfill 
                              ? 'border-slate-200 hover:border-emerald-300 hover:shadow-md' 
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <div className="space-y-4">
                            {/* Card Header: Slot Size & Fulfillment Status Badge */}
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-200/80">
                                {slots} ô đất (~{sqm}m²)
                              </span>

                              {canFulfill ? (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                                  Đáp ứng: {maxCanPitch} lều
                                </span>
                              ) : !hasWarehouseStock ? (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 uppercase">
                                  Kho hết lều
                                </span>
                              ) : (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                                  Thiếu mặt bằng ({availableSlotsInZone}/{slots} ô)
                                </span>
                              )}
                            </div>

                            {/* Tent Type Name & Capacity */}
                            <div>
                              <h4 className="text-xl font-black text-slate-900">{tt.name}</h4>
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold mt-1">
                                <Users size={14} className="text-emerald-700" />
                                <span>Phù hợp: <strong>{tt.capacity || `${slots}-${slots*2} khách`}</strong></span>
                              </div>
                              <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium line-clamp-2">
                                {tt.description || `Lều tiêu chuẩn chất lượng cao, diện tích chiếm ${slots} ô đất chuẩn (~${sqm}m²).`}
                              </p>
                            </div>

                            {/* 1. Tồn Kho Lều Campsite Sở Hữu */}
                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-600 flex items-center gap-1.5">
                                  <Box size={14} className="text-emerald-700" /> Tồn kho campsite:
                                </span>
                                <span className={`font-mono text-xs font-extrabold ${warehouseAvail > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                  {warehouseAvail} / {warehouseTotal} lều ({stockPercent}%)
                                </span>
                              </div>

                              {/* Stock Bar */}
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    warehouseAvail === 0 ? 'bg-rose-500' :
                                    stockPercent <= 30 ? 'bg-amber-500' :
                                    'bg-emerald-500'
                                  }`}
                                  style={{ width: `${stockPercent}%` }}
                                />
                              </div>

                              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                                <span>Đang dựng: <strong className="text-slate-700">{warehouseUsed}</strong></span>
                                <span>Sẵn sàng: <strong className={warehouseAvail > 0 ? "text-emerald-700" : "text-rose-600"}>{warehouseAvail}</strong></span>
                                <span>Tổng sở hữu: <strong className="text-slate-700">{warehouseTotal}</strong></span>
                              </div>
                            </div>

                            {/* 2. Năng Lực Đáp Ứng Tại Mặt Bằng Khu Đất Này */}
                            <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center font-bold text-slate-700">
                                <span className="flex items-center gap-1.5 text-emerald-900">
                                  <LayoutGrid size={14} className="text-emerald-700" /> Năng lực đáp ứng bãi:
                                </span>
                                <span className="font-mono text-emerald-800 font-black text-sm">
                                  {maxCanPitch} lều
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 space-y-0.5">
                                <div className="flex justify-between">
                                  <span>Mặt bằng khu đất còn:</span>
                                  <span className="font-semibold text-slate-800 font-mono">{availableSlotsInZone} ô trống (~{availableSlotsInZone * 3}m²)</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Chiếm dụng tối đa:</span>
                                  <span className="font-semibold text-slate-800 font-mono">{maxCanPitch * slots} / {cap.totalSlots} ô đất</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Khả năng phục vụ:</span>
                                  <span className="font-semibold text-emerald-800 font-bold">~{maxCanPitch * parseInt(tt.capacity || 2)} khách</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Footer: Pricing & Status Note (No Action Buttons) */}
                          <div className="pt-4 border-t border-slate-100 mt-4 space-y-3">
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs text-slate-400 font-semibold">Giá thuê niêm yết:</span>
                              <div className="text-right">
                                <span className="text-base font-black text-[#1B4D3E] font-mono">
                                  {displayPrice.toLocaleString('vi-VN')}đ
                                </span>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  {isHourly ? `/${duration} giờ` : `/${duration} đêm`}
                                </span>
                              </div>
                            </div>

                            {/* Status Indicator Banner */}
                            {canFulfill ? (
                              <div className="text-center py-2 px-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1.5">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                <span>Sẵn sàng dựng tối đa {maxCanPitch} lều tại khu vực này</span>
                              </div>
                            ) : !hasWarehouseStock ? (
                              <div className="text-center py-2 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center justify-center gap-1.5">
                                <AlertCircle size={13} className="text-rose-500" />
                                <span>Tạm hết loại lều này trong kho campsite</span>
                              </div>
                            ) : (
                              <div className="text-center py-2 px-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center justify-center gap-1.5">
                                <AlertCircle size={13} className="text-amber-500" />
                                <span>Khu đất chỉ còn {availableSlotsInZone} ô trống (cần {slots} ô)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
