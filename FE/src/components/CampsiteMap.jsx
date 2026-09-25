import React, { useState, useEffect, useRef } from 'react';
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
  Box
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

  // Manager Proactive Setup State - persistent so it never unexpectedly toggles off
  const [isSetupMode, setIsSetupMode] = useState(() => {
    return localStorage.getItem('buihui_campsite_setup_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('buihui_campsite_setup_mode', isSetupMode);
  }, [isSetupMode]);

  const [isPlacingSlot, setIsPlacingSlot] = useState(false);
  const [localPositions, setLocalPositions] = useState({});
  const [draggingTentId, setDraggingTentId] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [hasUnsavedPositions, setHasUnsavedPositions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSelectedParcel, setActiveSelectedParcel] = useState(null);

  const mapContainerRef = useRef(null);

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

  // Global window mousemove & mouseup listeners for butter-smooth dragging
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!draggingTentId || !dragStart) return;
      const deltaX = e.clientX - dragStart.clientX;
      const deltaY = e.clientY - dragStart.clientY;

      const deltaLeftPercent = (deltaX / dragStart.containerWidth) * 100;
      const deltaTopPercent = (deltaY / dragStart.containerHeight) * 100;

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

    const handleWindowMouseUp = () => {
      if (draggingTentId) {
        setDraggingTentId(null);
        setDragStart(null);
      }
    };

    if (draggingTentId) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingTentId, dragStart]);

  // Handle Drag Start
  const handleMouseDown = (e, tent) => {
    if (!isSetupMode) return;
    e.stopPropagation();
    e.preventDefault();
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    
    const curPos = localPositions[tent.id] || { 
      top: tent.mapTop || '50%', 
      left: tent.mapLeft || '50%' 
    };
    const initLeftPercent = parseFloat(curPos.left) || 50;
    const initTopPercent = parseFloat(curPos.top) || 50;

    setDraggingTentId(tent.id);
    setActiveSelectedParcel(tent);
    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialLeft: initLeftPercent,
      initialTop: initTopPercent,
      containerWidth: rect.width,
      containerHeight: rect.height
    });
  };

  // Handle Click on the Aerial Photo (e.g. Click to place a new slot)
  const handleMapClick = (e) => {
    if (!mapContainerRef.current) return;
    if (isPlacingSlot && onAddTentAtSlot) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const leftPercent = `${Math.min(95, Math.max(3, (clickX / rect.width) * 100)).toFixed(1)}%`;
      const topPercent = `${Math.min(95, Math.max(5, (clickY / rect.height) * 100)).toFixed(1)}%`;

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

          {/* PROACTIVE SETUP MODE TOGGLE BUTTON */}
          {allowSetup && mode !== 'customer' && (
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

      {/* SETUP WORKBENCH TOOLBAR - ONLY SHOWN WHEN SETUP MODE IS ON */}
      {isSetupMode && allowSetup && mode !== 'customer' && (
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
        onClick={handleMapClick}
        className={`w-full overflow-x-auto custom-scrollbar rounded-3xl shadow-2xl border-4 border-white bg-slate-950 relative ${
          isPlacingSlot ? 'cursor-crosshair' : ''
        }`}
      >
        <div className="relative w-[1000px] lg:w-full aspect-[16/9] group select-none overflow-hidden">
          {/* Aerial Flycam Map Image */}
          <img 
            src="/campsite-map-new.jpg" 
            alt="Bản đồ flycam tương tác khu vực cắm trại Bùi Hui" 
            className="w-full h-full object-cover object-center pointer-events-none"
          />

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

          {/* Map Header Status Overlay */}
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

          {/* Quick Setup Mode Toggle Button directly on top-right of Map */}
          {allowSetup && mode !== 'customer' && !isPlacingSlot && (
            <div className="absolute top-4 right-4 z-30 pointer-events-auto">
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
            </div>
          )}

          {/* Crosshair notice when placing slot */}
          {isPlacingSlot && (
            <div className="absolute top-4 right-4 z-30 bg-amber-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-2xl shadow-xl border border-white flex items-center gap-2 animate-bounce">
              <Crosshair size={16} /> Nhấp chuột vào bất cứ đâu trên bãi cỏ để đặt ô đất mới
            </div>
          )}

          {/* INDIVIDUAL LAND PARCEL BOXES OVERLAID DIRECTLY ON TERRAIN (Styled like user hand-drawn boxes) */}
          {showPixelGrid && placedTents.map((tent) => {
            const curPos = localPositions[tent.id] || { top: tent.mapTop, left: tent.mapLeft };
            const isSelected = selectedTentIds.includes(tent.id);
            const isDragging = draggingTentId === tent.id;
            const isHovered = hoveredSlot?.id === tent.id;
            const isActiveParcel = activeSelectedParcel?.id === tent.id;
            const isAvailable = tent.status === 'Available';
            const isOccupied = tent.status === 'Occupied';
            const isBooked = tent.status === 'Booked' || tent.status === 'Pending';

            // Active booking detection
            const activeBooking = tent.activeBooking || tent.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected');
            const tentBookingId = activeBooking?.id;

            // Sibling slots belonging to the same booking across all placed tents
            const groupedSiblingSlots = tentBookingId 
              ? placedTents.filter(t => {
                  const bId = t.activeBooking?.id || t.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected')?.id;
                  return bId === tentBookingId;
                })
              : [];
            const isGrouped = groupedSiblingSlots.length > 1;

            // Linked Hover: if any slot of this booking is hovered, highlight all slots in this booking simultaneously
            const isLinkedToHoveredBooking = Boolean(hoveredBookingId && tentBookingId === hoveredBookingId);
            const isDimmed = Boolean(hoveredBookingId && !isLinkedToHoveredBooking);

            // Single standardized unit box dimension (~3m² minimum unit parcel)
            const boxDim = 'w-[5.4%] min-w-[50px] aspect-[4/3]';
            const displayCode = tent.slotCode || tent.name.replace(/^Lều\s+/i, '');

            return (
              <div
                key={tent.id}
                style={{
                  top: curPos.top,
                  left: curPos.left,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseDown={(e) => handleMouseDown(e, tent)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSetupMode) {
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
                className={`absolute z-20 select-none rounded-xl transition-all duration-200 flex flex-col justify-between p-1 shadow-lg ${boxDim} ${
                  isDragging 
                    ? 'cursor-grabbing scale-110 z-50 ring-4 ring-amber-300 shadow-2xl bg-amber-950/80 border-2 border-white' 
                    : isSetupMode 
                      ? 'cursor-grab hover:scale-105 hover:z-30' 
                      : 'cursor-pointer hover:scale-105 hover:z-30'
                } ${
                  isLinkedToHoveredBooking
                    ? 'ring-4 ring-amber-400 bg-amber-950/95 border-2 border-white shadow-[0_0_25px_rgba(251,191,36,0.95)] scale-110 z-40'
                    : isDimmed
                      ? 'opacity-30 scale-95 transition-all duration-200'
                      : isSelected
                        ? 'bg-amber-900/90 border-2 border-amber-300 ring-4 ring-amber-400/80 shadow-2xl scale-105 z-30'
                        : isOccupied
                          ? 'bg-rose-950/75 border-2 border-rose-400 text-rose-100'
                          : isBooked
                            ? 'bg-amber-950/75 border-2 border-amber-400 text-amber-100'
                            : 'bg-sky-950/60 border-2 border-sky-400 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.3)] hover:border-white'
                }`}
                title={`Ô ${displayCode} (${isGrouped ? `Lều Gộp ${groupedSiblingSlots.length} ô` : 'Ô Chuẩn ~3m²'})`}
              >
                {/* Header: Slot Code + Grouped / Size Tag */}
                <div className="flex items-center justify-between text-[9px] font-mono font-black pointer-events-none leading-none">
                  <span className="truncate text-white drop-shadow-sm font-extrabold">
                    {displayCode}
                  </span>
                  {isGrouped ? (
                    <span className="text-[7px] px-1 py-0.2 rounded font-black uppercase bg-amber-400 text-slate-950 shadow-xs">
                      Gộp {groupedSiblingSlots.length} ô
                    </span>
                  ) : (
                    <span className="text-[7px] px-1 py-0.2 rounded font-bold uppercase bg-emerald-600/80 text-white">
                      ~3m²
                    </span>
                  )}
                </div>

                {/* Center: Tent Icon or Drag Handle */}
                <div className="my-auto flex items-center justify-center pointer-events-none">
                  {isSetupMode ? (
                    <div className="flex items-center gap-0.5 text-amber-300 font-bold text-[8px]">
                      <Move size={10} />
                      <span className="text-[7px] font-mono">{curPos.top?.replace('%', '')}</span>
                    </div>
                  ) : (
                    <Tent size={12} className={isLinkedToHoveredBooking || isSelected ? 'text-amber-300 animate-pulse' : isOccupied ? 'text-rose-300' : isBooked ? 'text-amber-300' : 'text-sky-300'} />
                  )}
                </div>

                {/* Footer: Status / Price */}
                <div className="flex items-center justify-between text-[7px] font-bold border-t border-white/20 pt-0.5 pointer-events-none">
                  <span className="truncate">
                    {isOccupied ? 'Đang ở' : isBooked ? 'Đã cọc' : 'Trống'}
                  </span>
                  <span className="text-white/80 font-mono">
                    {isGrouped ? `Lều gộp` : `~3m²`}
                  </span>
                </div>

                {/* Live Floating Coordinates Badge when Dragging */}
                {isDragging && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-lg pointer-events-none whitespace-nowrap z-50">
                    {curPos.top}, {curPos.left}
                  </div>
                )}

                {/* Hover Tooltip in Normal View */}

                {!isSetupMode && isHovered && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border ${
                      isGrouped ? 'border-amber-400 w-64 ring-2 ring-amber-400/40' : 'border-white/20 w-56'
                    } z-50 text-left animate-in zoom-in-95 duration-150 ${
                      mode === 'manager' ? 'pointer-events-auto' : 'pointer-events-none'
                    }`}
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
                          <span className="font-extrabold text-xs text-sky-300">
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
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-extrabold text-xs text-emerald-300">
                            Ô Đất {displayCode}
                          </span>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 uppercase">
                            Đất Trống
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300">
                          Ô quy chuẩn đơn vị nhỏ nhất (~3m²).
                        </p>
                        <p className="text-[9px] text-emerald-400 font-bold mt-1">
                          + Nhấp để chọn (có thể chọn nhiều ô để gộp dựng lều lớn).
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
                )}
              </div>
            );
          })}

          {/* Facility & Amenity Hotspots */}
          {facilityHotspots.map(spot => (
            <div 
              key={spot.id}
              style={{ top: spot.top, left: spot.left }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-default pointer-events-none"
            >
              <div className={`px-2.5 py-1 rounded-xl text-white/90 font-bold text-[10px] shadow-lg border border-white/20 backdrop-blur-md flex items-center gap-1.5 ${spot.color}`}>
                <MapPin size={10} className="text-amber-300" />
                <span>{spot.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flycam Map Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md border-2 border-sky-400 bg-sky-950/60 inline-block shadow-xs"></span>
            Ô đất trống (~3m² quy chuẩn)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md border-2 border-amber-300 bg-amber-900/90 inline-block shadow-xs"></span>
            Ô đang chọn (Tick nhiều ô để gộp)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-600 inline-block shadow-xs"></span>
            Lều đã cọc / Lều gộp
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-rose-600 inline-block shadow-xs"></span>
            Đang có khách lưu trú
          </span>
        </div>
        <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-500" />
          <span>* Di chuột vào ô đã đặt để phát sáng toàn bộ các ô thuộc cùng 1 đơn đặt lều gộp</span>
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
