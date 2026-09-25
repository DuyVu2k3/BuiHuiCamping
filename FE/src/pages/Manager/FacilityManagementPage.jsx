import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Tent, Map, QrCode, Download, Power, CheckCircle2, Lock, LayoutGrid, Settings, Edit, Layers, Compass, Utensils, Trash2, Box, Users, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalrService';
import LandGridMatrix from '../../components/LandGridMatrix';
import CampsiteMap from '../../components/CampsiteMap';

export default function FacilityManagementPage() {
  const [activeTab, setActiveTab] = useState('flycam'); // 'flycam', 'matrix', 'zones', 'tents', or 'inventory'
  const [zones, setZones] = useState([]);
  const [tents, setTents] = useState([]);
  const [tentTypes, setTentTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [showTentModal, setShowTentModal] = useState(false);
  const [showTentTypeModal, setShowTentTypeModal] = useState(false);
  const [editingTentType, setEditingTentType] = useState(null);
  
  const [newZone, setNewZone] = useState({ name: '', description: '', zoneType: 'Camping', totalSlots: '20', gridCols: '5' });
  const [newTent, setNewTent] = useState({ name: '', zoneId: '', price: '', hourlyPriceFirstHour: '100000', hourlyPriceExtraHour: '50000', size: 'Small', slotsOccupied: '1', slotCode: '', mapTop: '', mapLeft: '' });
  const [newTentType, setNewTentType] = useState({
    name: '',
    size: 'Small',
    slotsOccupied: '1',
    capacity: '1 - 2 khách',
    totalQuantity: '10',
    price: '500000',
    hourlyFirstHourPrice: '100000',
    hourlyExtraHourPrice: '50000',
    description: ''
  });

  const fetchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [zonesRes, tentsRes, tentTypesRes] = await Promise.all([
        axios.get(getApiUrl('/api/Zones')),
        axios.get(getApiUrl('/api/Tents')),
        axios.get(getApiUrl('/api/TentTypes'))
      ]);
      setZones(zonesRes.data);
      setTents(tentsRes.data);
      setTentTypes(tentTypesRes.data || []);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    signalRService.startConnection();

    const handleRefresh = () => {
      fetchData();
    };

    signalRService.on("TentStatusChanged", handleRefresh);
    signalRService.on("BookingQrStatusChanged", handleRefresh);
    signalRService.on("TentTypesUpdated", handleRefresh);

    return () => {
      signalRService.off("TentStatusChanged", handleRefresh);
      signalRService.off("BookingQrStatusChanged", handleRefresh);
      signalRService.off("TentTypesUpdated", handleRefresh);
    };
  }, []);

  const isZoneTable = (z) => {
    if (!z) return false;
    if (z.zoneType === 'DiningTable') return true;
    const nameLower = (z.name || '').toLowerCase();
    return nameLower.includes('bàn') || nameLower.includes('ẩm thực') || nameLower.includes('nhà hàng') || nameLower.includes('ăn uống');
  };

  const isTableEntity = (tent) => {
    if (!tent) return false;
    if (tent.zone?.zoneType === 'DiningTable') return true;
    const zName = (tent.zone?.name || '').toLowerCase();
    const tType = (tent.tentType || '').toLowerCase();
    return zName.includes('bàn') || zName.includes('ẩm thực') || zName.includes('nhà hàng') || zName.includes('ăn uống') || tType.includes('bàn');
  };

  const isQrActive = (tent) => {
    if (!tent) return false;
    if (isTableEntity(tent)) return true; // Dining Tables are ALWAYS ACTIVE 24/7!
    if (tent.isQrUnlocked || tent.IsQrUnlocked) return true;
    if (tent.bookings && tent.bookings.length > 0) {
      const activeBooking = tent.bookings.find(b => 
        b.status === 'Occupied' || b.status === 'Booked' || b.status === 'Pending'
      );
      if (activeBooking && (activeBooking.isQrUnlocked || activeBooking.IsQrUnlocked)) {
        return true;
      }
    }
    return false;
  };

  const handleToggleQrLock = (tent) => {
    const currentlyActive = isQrActive(tent);
    const actionText = currentlyActive ? 'khóa QR (Trả lều)' : 'kích hoạt QR (Check-in)';
    
    axios.post(getApiUrl(`/api/Tents/${tent.id}/toggle-qr-lock`))
      .then(() => {
        toast.success(`Đã ${actionText} cho Lều ${tent.name}!`);
        fetchData();
      })
      .catch(err => {
        console.error("Lỗi cập nhật trạng thái QR:", err);
        toast.error("Không thể thay đổi trạng thái QR");
      });
  };

  const handleSaveZone = (e) => {
    e.preventDefault();
    const tSlots = parseInt(newZone.totalSlots) || 20;
    const gCols = parseInt(newZone.gridCols) || 5;
    const payload = {
      ...newZone,
      totalSlots: tSlots,
      gridCols: gCols,
      gridRows: Math.ceil(tSlots / gCols)
    };
    
    if (editingZone) {
      axios.put(getApiUrl(`/api/Zones/${editingZone.id}`), payload)
        .then(() => {
          toast.success("Cập nhật khu vực & quy mô ô đất thành công!");
          setShowZoneModal(false);
          setEditingZone(null);
          setNewZone({ name: '', description: '', zoneType: 'Camping', totalSlots: '20', gridCols: '5' });
          fetchData();
        })
        .catch(() => toast.error("Lỗi khi cập nhật khu vực"));
    } else {
      axios.post(getApiUrl('/api/Zones'), payload)
        .then(() => {
          toast.success("Thêm khu vực mới thành công!");
          setShowZoneModal(false);
          setNewZone({ name: '', description: '', zoneType: 'Camping', totalSlots: '20', gridCols: '5' });
          fetchData();
        })
        .catch(() => toast.error("Lỗi khi thêm Khu vực"));
    }
  };

  const handleOpenEditZoneModal = (zone) => {
    setEditingZone(zone);
    setNewZone({
      name: zone.name,
      description: zone.description || '',
      zoneType: zone.zoneType || 'Camping',
      totalSlots: (zone.totalSlots || 20).toString(),
      gridCols: (zone.gridCols || 5).toString()
    });
    setShowZoneModal(true);
  };

  const handleDeleteZone = (zone) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa Khu vực "${zone.name}" không?`)) {
      axios.delete(getApiUrl(`/api/Zones/${zone.id}`))
        .then(() => {
          toast.success(`Đã xóa Khu vực "${zone.name}" thành công!`);
          fetchData();
        })
        .catch(err => {
          const msg = err.response?.data || "Không thể xóa khu vực này (có thể khu vực đang có ô đất/bàn).";
          toast.error(typeof msg === 'string' ? msg : "Lỗi khi xóa khu vực");
        });
    }
  };

  const handleOpenAddTentAtSlot = (zone, slot) => {
    setEditingTent(null);
    const z = zone || zones.find(item => item.zoneType !== 'DiningTable') || zones[0];
    setNewTent({
      name: slot?.slotCode || '',
      zoneId: z?.id ? z.id.toString() : (zone?.id ? zone.id.toString() : ''),
      price: '0',
      hourlyPriceFirstHour: '0',
      hourlyPriceExtraHour: '0',
      size: slot?.size || 'Small',
      slotsOccupied: (slot?.slotsOccupied || 1).toString(),
      slotCode: slot?.slotCode || '',
      mapTop: slot?.mapTop || '',
      mapLeft: slot?.mapLeft || ''
    });
    setShowTentModal(true);
  };

  const [editingTent, setEditingTent] = useState(null); // null = creating new, object = editing existing

  const handleOpenAddTentModal = () => {
    setEditingTent(null);
    const defaultZone = zones.find(item => item.zoneType !== 'DiningTable') || zones[0];
    setNewTent({ 
      name: '', 
      zoneId: defaultZone ? defaultZone.id.toString() : '', 
      price: '0', 
      hourlyPriceFirstHour: '0', 
      hourlyPriceExtraHour: '0',
      size: 'Small',
      slotsOccupied: '1',
      slotCode: '',
      mapTop: '',
      mapLeft: ''
    });
    setShowTentModal(true);
  };

  const handleOpenEditTentModal = (tent) => {
    setEditingTent(tent);
    const size = tent.size || 'Small';
    const slots = tent.slotsOccupied || (size === 'Large' ? 4 : (size === 'Medium' ? 2 : 1));
    setNewTent({
      name: tent.name || tent.slotCode || '',
      zoneId: tent.zoneId ? tent.zoneId.toString() : (tent.zone?.id ? tent.zone.id.toString() : ''),
      price: (tent.price || 0).toString(),
      hourlyPriceFirstHour: (tent.hourlyPriceFirstHour || 0).toString(),
      hourlyPriceExtraHour: (tent.hourlyPriceExtraHour || 0).toString(),
      size: size,
      slotsOccupied: slots.toString(),
      slotCode: tent.slotCode || tent.name || '',
      mapTop: tent.mapTop || '',
      mapLeft: tent.mapLeft || ''
    });
    setShowTentModal(true);
  };

  const handleDeleteTent = (tent) => {
    const isTable = isTableEntity(tent);
    const itemType = isTable ? "Bàn" : "Ô Đất";
    const displayName = isTable ? tent.name : (tent.slotCode ? `Ô ${tent.slotCode}` : tent.name);
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${itemType} "${displayName}" không?`)) {
      axios.delete(getApiUrl(`/api/Tents/${tent.id}`))
        .then(() => {
          toast.success(`Đã xóa ${itemType} "${displayName}" thành công!`);
          fetchData();
        })
        .catch(err => {
          console.error("Lỗi khi xóa:", err);
          toast.error(`Không thể xóa ${itemType}`);
        });
    }
  };

  const handleSaveTent = (e) => {
    e.preventDefault();
    const selectedZoneObj = zones.find(z => z.id.toString() === newTent.zoneId?.toString());
    const isTableZone = isZoneTable(selectedZoneObj);

    const finalSlotCode = newTent.slotCode || newTent.name;
    const finalName = isTableZone ? (newTent.name || newTent.slotCode) : (newTent.slotCode || newTent.name);

    const payload = {
      name: finalName,
      slotCode: finalSlotCode,
      zoneId: newTent.zoneId ? parseInt(newTent.zoneId) : null,
      status: editingTent ? editingTent.status : 'Available',
      price: isTableZone ? (newTent.price ? parseFloat(newTent.price) : 0) : 0,
      hourlyPriceFirstHour: 0,
      hourlyPriceExtraHour: 0,
      size: 'Small',
      slotsOccupied: 1,
      mapTop: newTent.mapTop || (editingTent?.mapTop || ''),
      mapLeft: newTent.mapLeft || (editingTent?.mapLeft || '')
    };

    if (editingTent) {
      axios.put(getApiUrl(`/api/Tents/${editingTent.id}`), payload)
        .then(() => {
          toast.success(isTableZone ? "Cập nhật bàn ăn thành công!" : "Cập nhật thông tin ô đất thành công!");
          setShowTentModal(false);
          setEditingTent(null);
          fetchData();
        })
        .catch(err => toast.error("Lỗi khi cập nhật thông tin"));
    } else {
      axios.post(getApiUrl('/api/Tents'), payload)
        .then(() => {
          toast.success(isTableZone ? "Tạo bàn ăn mới thành công!" : "Tạo ô đất mới thành công!");
          setShowTentModal(false);
          setNewTent({ 
            name: '', 
            zoneId: '', 
            price: '0', 
            hourlyPriceFirstHour: '0', 
            hourlyPriceExtraHour: '0',
            size: 'Small',
            slotsOccupied: '1',
            slotCode: '',
            mapTop: '',
            mapLeft: ''
          });
          fetchData();
        })
        .catch(err => toast.error("Lỗi khi tạo mới"));
    }
  };

  const downloadQR = (tentName) => {
    const svg = document.getElementById(`qr-${tentName}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${tentName}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleOpenAddTentTypeModal = () => {
    setEditingTentType(null);
    setNewTentType({
      name: '',
      size: 'Small',
      slotsOccupied: '1',
      capacity: '1 - 2 khách',
      totalQuantity: '10',
      price: '500000',
      hourlyFirstHourPrice: '100000',
      hourlyExtraHourPrice: '50000',
      description: ''
    });
    setShowTentTypeModal(true);
  };

  const handleOpenEditTentTypeModal = (tt) => {
    setEditingTentType(tt);
    setNewTentType({
      name: tt.name || '',
      size: tt.size || 'Small',
      slotsOccupied: (tt.slotsOccupied || 1).toString(),
      capacity: tt.capacity || '',
      totalQuantity: (tt.totalQuantity || 0).toString(),
      price: (tt.price || 0).toString(),
      hourlyFirstHourPrice: (tt.hourlyFirstHourPrice || 0).toString(),
      hourlyExtraHourPrice: (tt.hourlyExtraHourPrice || 0).toString(),
      description: tt.description || ''
    });
    setShowTentTypeModal(true);
  };

  const handleDeleteTentType = (tt) => {
    if (window.confirm(`Bạn có chắc muốn xóa loại lều "${tt.name}" khỏi danh mục kho sở hữu không?`)) {
      axios.delete(getApiUrl(`/api/TentTypes/${tt.id}`))
        .then(() => {
          toast.success(`Đã xóa loại lều "${tt.name}" thành công!`);
          fetchData();
        })
        .catch(err => {
          console.error("Lỗi khi xóa loại lều:", err);
          toast.error("Không thể xóa loại lều này");
        });
    }
  };

  const handleSaveTentType = (e) => {
    e.preventDefault();
    if (!newTentType.name.trim()) {
      toast.error("Vui lòng nhập tên loại lều");
      return;
    }

    const payload = {
      name: newTentType.name.trim(),
      size: newTentType.size || 'Small',
      slotsOccupied: parseInt(newTentType.slotsOccupied) || 1,
      capacity: newTentType.capacity || '1 - 2 khách',
      totalQuantity: parseInt(newTentType.totalQuantity) >= 0 ? parseInt(newTentType.totalQuantity) : 0,
      price: parseFloat(newTentType.price) || 0,
      hourlyFirstHourPrice: parseFloat(newTentType.hourlyFirstHourPrice) || 0,
      hourlyExtraHourPrice: parseFloat(newTentType.hourlyExtraHourPrice) || 0,
      description: newTentType.description || '',
      isActive: true
    };

    if (editingTentType) {
      axios.put(getApiUrl(`/api/TentTypes/${editingTentType.id}`), payload)
        .then(() => {
          toast.success(`Cập nhật loại lều "${payload.name}" thành công!`);
          setShowTentTypeModal(false);
          setEditingTentType(null);
          fetchData();
        })
        .catch(err => {
          console.error("Lỗi cập nhật loại lều:", err);
          toast.error("Không thể cập nhật loại lều");
        });
    } else {
      axios.post(getApiUrl('/api/TentTypes'), payload)
        .then(() => {
          toast.success(`Thêm loại lều mới "${payload.name}" thành công!`);
          setShowTentTypeModal(false);
          setEditingTentType(null);
          fetchData();
        })
        .catch(err => {
          console.error("Lỗi thêm loại lều:", err);
          toast.error("Không thể thêm loại lều mới");
        });
    }
  };

  const formatTentName = (tent) => {
    if (!tent.zone) return tent.name;
    const zonePrefix = tent.zone.name.replace(/^Khu\s+/i, '');
    if (tent.name.toUpperCase().startsWith(zonePrefix.toUpperCase()) || tent.name.includes('.')) {
      return tent.name;
    }
    return `${zonePrefix}.${tent.name}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Quản lý CSVC (Lều & Bàn Ăn)</h1>
          <p className="text-slate-500 mt-1 font-medium">Theo dõi khu vực cắm trại, khu bàn ăn nhà hàng và mã QR</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl flex-wrap">
          <button 
            onClick={() => setActiveTab('flycam')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'flycam' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Compass size={18} /> Bản Đồ Flycam
          </button>
          <button 
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'matrix' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid size={18} /> Ma Trận Ô Đất
          </button>
          <button 
            onClick={() => setActiveTab('zones')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'zones' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Map size={18} /> Khu vực
          </button>
          <button 
            onClick={() => setActiveTab('tents')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'tents' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Tent size={18} /> Ô Đất & Bàn Ăn
          </button>
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'inventory' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Box size={18} /> Kho Lều Sở Hữu
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-medium animate-pulse">Đang nạp dữ liệu...</div>
      ) : activeTab === 'flycam' ? (
        // FLYCAM MAP VIEW
        <CampsiteMap
          tents={tents}
          zones={zones}
          selectedTentIds={[]}
          mode="manager"
          onOpenTentDetail={handleOpenEditTentModal}
          onAddTentAtSlot={handleOpenAddTentAtSlot}
          onRefreshData={fetchData}
          onDeleteTent={handleDeleteTent}
        />
      ) : activeTab === 'matrix' ? (
        // MATRIX VIEW
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-50/70 p-5 rounded-3xl border border-emerald-200/80">
            <div>
              <h3 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                <LayoutGrid size={18} className="text-emerald-700" />
                Mặt Bằng Ma Trận Ô Đất Định Lượng (~3m²/ô pixel)
              </h3>
              <p className="text-xs text-emerald-800 font-medium mt-1">
                Trực quan hóa bãi cắm trại theo các ô đất pixel chuẩn thực tế. Bấm vào lều để chỉnh sửa / in mã QR, hoặc bấm vào ô đất trống để dựng lều mới.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleOpenAddTentModal} 
                className="bg-[#1B4D3E] hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Plus size={16} /> Thêm Ô Đất Mới
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {zones.filter(z => z.zoneType !== 'DiningTable').map(zone => (
              <div key={zone.id} className="relative">
                <div className="absolute top-6 right-6 z-10 hidden sm:block">
                  <button
                    onClick={() => handleOpenEditZoneModal(zone)}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    <Settings size={14} className="text-emerald-600" /> Cấu hình ô đất
                  </button>
                </div>
                <LandGridMatrix
                  zone={zone}
                  tents={tents}
                  mode="manager"
                  onOpenTentDetail={handleOpenEditTentModal}
                  onAddTentAtSlot={handleOpenAddTentAtSlot}
                  onDeleteTent={handleDeleteTent}
                />
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'zones' ? (
        // ZONES VIEW
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditingZone(null); setNewZone({ name: '', description: '', zoneType: 'Camping', totalSlots: '20', gridCols: '5' }); setShowZoneModal(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
              <Plus size={18} /> Thêm Khu Vực
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {zones.map(zone => {
              const isTableZone = zone.zoneType === 'DiningTable' || zone.name.toLowerCase().includes('bàn') || zone.name.toLowerCase().includes('ẩm thực') || zone.name.toLowerCase().includes('nhà hàng');

              return (
                <div key={zone.id} className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${isTableZone ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Map size={20} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{zone.name}</h3>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isTableZone ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                          {isTableZone ? 'Khu Bàn Ăn (QR Mở 24/7)' : 'Khu Lều Qua Đêm'}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm mb-4 mt-2">{zone.description || 'Chưa có mô tả'}</p>
                    <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {isTableZone ? 'Số lượng bàn ăn' : 'Sức chứa bãi đất'}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-600">
                        {isTableZone ? `${zone.tents?.length || 0} bàn` : `${zone.totalSlots || 20} ô đất (~${(zone.totalSlots || 20) * 3}m²)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditZoneModal(zone)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-all shadow-xs"
                    >
                      <Settings size={14} className="text-emerald-600" /> Cấu hình quy mô
                    </button>
                    <button
                      onClick={() => handleDeleteZone(zone)}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs flex items-center justify-center transition-all shadow-xs"
                      title="Xóa khu vực này"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'tents' ? (
        // TENTS VIEW
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={handleOpenAddTentModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
              <Plus size={18} /> Thêm Lều / Bàn Mới
            </button>
          </div>

          <div className="space-y-12">
            {zones.map(zone => {
              const zoneTents = tents.filter(t => t.zone?.id === zone.id);
              if (zoneTents.length === 0) return null;
              
              const isTableZone = zone.zoneType === 'DiningTable' || zone.name.toLowerCase().includes('bàn') || zone.name.toLowerCase().includes('ẩm thực') || zone.name.toLowerCase().includes('nhà hàng') || zone.name.toLowerCase().includes('ăn uống');

              return (
                <div key={zone.id} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Map size={20} className={isTableZone ? "text-amber-700" : "text-emerald-600"}/> {zone.name}
                    </h3>
                    <span className="text-sm font-semibold text-slate-500">
                      {zoneTents.length} {isTableZone ? 'Bàn ăn' : 'Ô đất'} {!isTableZone && `• Dùng ${zoneTents.reduce((s, t) => s + (t.slotsOccupied || 1), 0)}/${zone.totalSlots || 20} ô`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {zoneTents.map(tent => {
                      const isTable = isTableEntity(tent);

                      return (
                        <div key={tent.id} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center group relative">
                          <div className="w-full flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                {isTable ? `Bàn: ${tent.name}` : `Ô Đất: ${tent.slotCode ? `Ô ${tent.slotCode}` : tent.name}`}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider">
                                  {tent.zone?.name || 'Chưa xếp khu'}
                                </span>
                                {!isTable && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {tent.size === 'Large' ? 'Ô Lớn (4 ô ~12m²)' : (tent.size === 'Medium' ? 'Ô Đôi (2 ô ~6m²)' : 'Ô Chuẩn (1 ô ~3m²)')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isTable ? (
                              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                QR MỞ 24/7
                              </span>
                            ) : (
                              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${isQrActive(tent) ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                {isQrActive(tent) ? 'ĐANG SỬ DỤNG' : 'SẴN SÀNG'}
                              </span>
                            )}
                          </div>

                          {/* Parcel Scale Info */}
                          <div className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 mb-4 text-xs font-semibold space-y-1">
                            {isTable ? (
                              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md text-xs font-bold border border-amber-200 block text-center">Mã QR Đặt Món Tại Bàn</span>
                            ) : (
                              <div className="flex justify-between items-center text-emerald-800 text-xs py-0.5">
                                <span className="font-semibold text-slate-500">Quy mô ô đất:</span>
                                <span className="font-extrabold">{tent.slotsOccupied || (tent.size === 'Large' ? 4 : tent.size === 'Medium' ? 2 : 1)} ô (~{(tent.slotsOccupied || (tent.size === 'Large' ? 4 : tent.size === 'Medium' ? 2 : 1)) * 3}m²)</span>
                              </div>
                            )}
                          </div>

                          {/* QR Code Section */}
                          <div className="bg-slate-50 p-4 rounded-2xl w-full flex flex-col items-center gap-3 relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                              <QRCodeSVG 
                                id={`qr-${tent.name}`}
                                value={`${window.location.origin}${tent.qrCodeData}`} 
                                size={120}
                                bgColor={"#ffffff"}
                                fgColor={"#0f172a"}
                                level={"H"}
                              />
                            </div>
                            <div className="text-center w-full flex flex-col items-center gap-2">
                              <a href={`${window.location.origin}${tent.qrCodeData}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-slate-400 break-all w-full mb-1 hover:text-emerald-500 hover:underline transition-colors block" title="Bấm vào để giả lập quét mã QR">
                                {`${window.location.origin}${tent.qrCodeData}`}
                              </a>

                              <div className="grid grid-cols-2 gap-2 w-full">
                                <button 
                                  onClick={() => handleOpenEditTentModal(tent)}
                                  className="py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center justify-center shadow-sm"
                                  title={isTable ? "Chỉnh sửa bàn" : "Chỉnh sửa ô đất"}
                                >
                                  {isTable ? "Sửa Bàn" : "Sửa Ô"}
                                </button>
                                <button 
                                  onClick={() => handleDeleteTent(tent)}
                                  className="py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all flex items-center justify-center"
                                  title={isTable ? "Xóa bàn này" : "Xóa ô đất này"}
                                >
                                  Xóa
                                </button>
                              </div>

                              <button 
                                onClick={() => downloadQR(tent.name)}
                                className="w-full py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all flex items-center justify-center"
                              >
                                Tải mã QR
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {tents.filter(t => !t.zone).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Map size={20} className="text-slate-400"/> Chưa phân khu
                  </h3>
                  <span className="text-sm font-semibold text-slate-500">{tents.filter(t => !t.zone).length} Ô Đất</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {tents.filter(t => !t.zone).map(tent => (
                    <div key={tent.id} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center group">
                      <div className="w-full flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            Ô Đất: {tent.slotCode ? `Ô ${tent.slotCode}` : tent.name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider mt-1 inline-block">
                            Chưa xếp khu
                          </span>
                          <div className="mt-2 text-xs font-extrabold text-emerald-600">
                            Quy mô: {tent.slotsOccupied || 1} ô (~{(tent.slotsOccupied || 1) * 3}m²)
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${isQrActive(tent) ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                          {isQrActive(tent) ? 'QR KÍCH HOẠT' : 'QR ĐANG KHÓA'}
                        </span>
                      </div>

                      {/* QR Code Section */}
                      <div className="bg-slate-50 p-4 rounded-2xl w-full flex flex-col items-center gap-3 relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                          <QRCodeSVG 
                            id={`qr-${tent.name}`}
                            value={`${window.location.origin}${tent.qrCodeData}`} 
                            size={120}
                            bgColor={"#ffffff"}
                            fgColor={"#0f172a"}
                            level={"H"}
                          />
                        </div>
                        <div className="text-center w-full flex flex-col items-center gap-2">
                          <a href={`${window.location.origin}${tent.qrCodeData}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-slate-400 break-all w-full mb-1 hover:text-emerald-500 hover:underline transition-colors block" title="Bấm vào để giả lập quét mã QR">
                            {`${window.location.origin}${tent.qrCodeData}`}
                          </a>

                          <button 
                            onClick={() => downloadQR(tent.name)}
                            className="w-full py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all flex items-center justify-center gap-2"
                          >
                            <Download size={14} /> Tải mã QR
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'inventory' ? (
        // KHO LỀU SỞ HỮU (PHYSICAL TENT INVENTORY)
        <div className="space-y-6">
          {/* Header & KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                <Box size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Lều Sở Hữu</p>
                <h3 className="text-2xl font-black text-slate-800">
                  {tentTypes.reduce((s, t) => s + (t.totalQuantity || 0), 0)} <span className="text-xs font-bold text-slate-500">lều</span>
                </h3>
                <span className="text-[11px] font-semibold text-emerald-600">{tentTypes.length} chủng loại lều</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
                <Tent size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đang Dựng Trên Bãi</p>
                <h3 className="text-2xl font-black text-amber-900">
                  {tentTypes.reduce((s, t) => s + (t.usedQuantity || 0), 0)} <span className="text-xs font-bold text-slate-500">lều</span>
                </h3>
                <span className="text-[11px] font-semibold text-amber-700">Đang phục vụ khách</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center font-black">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sẵn Sàng Trong Kho</p>
                <h3 className="text-2xl font-black text-sky-900">
                  {tentTypes.reduce((s, t) => s + (t.availableQuantity || 0), 0)} <span className="text-xs font-bold text-slate-500">lều</span>
                </h3>
                <span className="text-[11px] font-semibold text-sky-700">Sẵn sàng để lễ tân xếp</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-black">
                <LayoutGrid size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Độ Phủ Mặt Bằng</p>
                <h3 className="text-2xl font-black text-purple-900">
                  ~{tentTypes.reduce((s, t) => s + ((t.slotsOccupied || 1) * (t.totalQuantity || 0)), 0) * 3} <span className="text-xs font-bold text-slate-500">m²</span>
                </h3>
                <span className="text-[11px] font-semibold text-purple-700">Khi dựng tối đa 100% kho</span>
              </div>
            </div>
          </div>

          {/* Action Bar & Filter */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/80">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Box size={20} className="text-emerald-700" />
                Kho Lều Cắm Trại Campsite Sở Hữu
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Lễ tân khi xếp khách vào các ô đất sẽ dựa vào danh mục và số lượng lều sẵn có này để dựng lều theo yêu cầu của khách.
              </p>
            </div>
            <button 
              onClick={handleOpenAddTentTypeModal}
              className="bg-[#1B4D3E] hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Plus size={16} /> Thêm Loại Lều Mới
            </button>
          </div>

          {/* Tent Types Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tentTypes.map(tt => {
              const usedPercent = tt.totalQuantity > 0 ? Math.round((tt.usedQuantity / tt.totalQuantity) * 100) : 0;
              const isAvailable = tt.availableQuantity > 0;

              return (
                <div 
                  key={tt.id} 
                  className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:border-emerald-200 transition-all group"
                >
                  <div className="space-y-4">
                    {/* Top Row: Title & Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-800 transition-colors">
                          {tt.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            {tt.slotsOccupied} Ô Đất (~{tt.slotsOccupied * 3}m²)
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                            <Users size={11} /> {tt.capacity || '1 - 2 khách'}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isAvailable 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {isAvailable ? `Còn ${tt.availableQuantity} Lều` : 'Tạm Hết Kho'}
                      </span>
                    </div>

                    {/* Description */}
                    {tt.description && (
                      <p className="text-xs text-slate-500 font-medium line-clamp-2">
                        {tt.description}
                      </p>
                    )}

                    {/* Stock Status Bar */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-600">Trạng thái kho:</span>
                        <span className="text-slate-900 font-mono">
                          {tt.availableQuantity} / {tt.totalQuantity} lều sẵn sàng
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            usedPercent >= 100 ? 'bg-rose-500' : usedPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, usedPercent)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                        <span>Đang dựng: <strong>{tt.usedQuantity}</strong></span>
                        <span>Tồn kho: <strong>{tt.availableQuantity}</strong></span>
                        <span>Tổng: <strong>{tt.totalQuantity}</strong></span>
                      </div>
                    </div>

                    {/* Pricing Info */}
                    <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60 space-y-1 text-xs">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-600">Giá thuê qua đêm:</span>
                        <span className="font-black text-amber-950 font-mono text-sm">
                          {(tt.price || 0).toLocaleString('vi-VN')}đ<span className="text-[10px] font-normal text-slate-500">/đêm</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                        <span>Giá theo giờ:</span>
                        <span className="font-mono text-slate-700">
                          1h đầu: <strong>{(tt.hourlyFirstHourPrice || 0).toLocaleString('vi-VN')}đ</strong> • Giờ sau: <strong>{(tt.hourlyExtraHourPrice || 0).toLocaleString('vi-VN')}đ</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-4">
                    <button
                      onClick={() => handleOpenEditTentTypeModal(tt)}
                      className="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-all shadow-xs"
                    >
                      <Edit size={14} className="text-emerald-600" /> Sửa Loại Lều
                    </button>
                    <button
                      onClick={() => handleDeleteTentType(tt)}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs flex items-center justify-center transition-all shadow-xs"
                      title="Xóa loại lều này"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {tentTypes.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3">
              <Box size={40} className="text-slate-300 mx-auto" />
              <h4 className="text-base font-bold text-slate-700">Chưa có loại lều nào trong kho sở hữu</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Bấm vào nút "Thêm Loại Lều Mới" để thiết lập danh mục lều campsite sở hữu cùng số lượng và đơn giá.
              </p>
              <button
                onClick={handleOpenAddTentTypeModal}
                className="mt-2 bg-[#1B4D3E] text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-800 transition-colors inline-flex items-center gap-1.5"
              >
                <Plus size={15} /> Thêm Loại Lều Ngay
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Zone Modal */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowZoneModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-extrabold text-slate-800 mb-1">
              {editingZone ? "Cấu Hình Quy Mô & Ô Đất" : "Thêm Khu vực Mới (Zone)"}
            </h2>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              {editingZone ? "Điều chỉnh tổng số ô đất chuẩn ~3m² và số cột hiển thị ma trận" : "Tạo Khu Lều ở hoặc Khu Bàn Ăn tại nhà hàng"}
            </p>
            <form onSubmit={handleSaveZone} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Loại Khu Vực (Zone Type)</label>
                <select 
                  value={newZone.zoneType} 
                  onChange={e => setNewZone({...newZone, zoneType: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Camping">Khu Lều Cắm Trại (Lưu Trụ Qua Đêm - Cần Check-in)</option>
                  <option value="DiningTable">Khu Bàn Ăn / Nhà Hàng (Gọi Món Tại Chỗ - QR Mở 24/7)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên khu vực</label>
                <input required type="text" value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="VD: Khu A, Khu Bàn Ăn, Đồi Thông..." />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Mô tả</label>
                <textarea rows="2" value={newZone.description} onChange={e => setNewZone({...newZone, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none" placeholder="Mô tả khu vực..."></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Tổng số ô (~3m²/ô)
                  </label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    value={newZone.totalSlots} 
                    onChange={e => setNewZone({...newZone, totalSlots: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
                    placeholder="VD: 20" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Số cột ô lưới
                  </label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    max="10"
                    value={newZone.gridCols || '5'} 
                    onChange={e => setNewZone({...newZone, gridCols: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
                    placeholder="VD: 5" 
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                Quy mô bãi: <strong>{parseInt(newZone.totalSlots || 0) * 3}m²</strong> diện tích ({newZone.gridCols || 5} cột × {Math.ceil((parseInt(newZone.totalSlots) || 20) / (parseInt(newZone.gridCols) || 5))} hàng).
              </p>

              <div className="pt-2 flex items-center gap-2.5">
                {editingZone && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowZoneModal(false);
                      handleDeleteZone(editingZone);
                    }}
                    className="px-4 py-2.5 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    title="Xóa khu vực này"
                  >
                    <Trash2 size={16} />
                    <span>Xóa</span>
                  </button>
                )}
                <button type="button" onClick={() => setShowZoneModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Hủy
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
                  {editingZone ? "Lưu Cập Nhật" : "Lưu Khu Vực"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Land Slot / Dining Table Modal */}
      {showTentModal && (() => {
        const selectedZoneObj = zones.find(z => z.id.toString() === newTent.zoneId?.toString());
        const isTableZone = isZoneTable(selectedZoneObj);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowTentModal(false)}></div>
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isTableZone ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isTableZone ? <Utensils size={20} /> : <Compass size={20} />}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">
                    {editingTent 
                      ? (isTableZone ? "Chỉnh Sửa Bàn Ăn" : "Chỉnh Sửa Ô Đất") 
                      : (isTableZone ? "Thêm Bàn Ăn Mới" : "Thêm Ô Đất Mới")
                    }
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingTent 
                      ? (isTableZone ? "Cập nhật tên bàn và khu vực" : "Cập nhật mã ô đất và quy mô diện tích") 
                      : (isTableZone ? "Tạo bàn ăn tại nhà hàng & sinh mã QR gọi món tại chỗ" : "Khởi tạo ô đất trên bản đồ camping để xếp lều linh hoạt")
                    }
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveTent} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Thuộc Khu vực (*)</label>
                  <select 
                    required 
                    value={newTent.zoneId} 
                    onChange={e => setNewTent({...newTent, zoneId: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm"
                  >
                    <option value="">{zones.length === 0 ? "-- Chưa có khu vực (Tạo khu vực trước) --" : "-- Chọn khu vực --"}</option>
                    {zones.map(z => {
                      const isTable = isZoneTable(z);
                      return (
                        <option key={z.id} value={z.id}>
                          {isTable ? `${z.name} (Khu Bàn Ăn)` : `${z.name} (Khu Ô Đất Trại)`}
                        </option>
                      );
                    })}
                  </select>
                  {zones.length === 0 && (
                    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
                      <span>Chưa có phân khu nào được tạo.</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowTentModal(false);
                          setShowZoneModal(true);
                        }}
                        className="font-bold underline text-amber-900 hover:text-emerald-700"
                      >
                        + Tạo Khu Vực Ngay
                      </button>
                    </div>
                  )}
                </div>

                {isTableZone ? (
                  /* Bàn Ăn Fields */
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Tên Bàn (Ký hiệu) (*)
                    </label>
                    <input 
                      required 
                      type="text" 
                      value={newTent.name || ''} 
                      onChange={e => setNewTent({...newTent, name: e.target.value, slotCode: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-semibold text-sm" 
                      placeholder="VD: Bàn 01, Bàn 02, Bàn VIP..." 
                    />
                  </div>
                ) : (
                  /* Ô Đất Fields (Bỏ qua thêm lều) */
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Mã Định Danh Ô Đất (*)
                      </label>
                      <input 
                        required 
                        type="text" 
                        value={newTent.slotCode || newTent.name || ''} 
                        onChange={e => setNewTent({...newTent, slotCode: e.target.value, name: e.target.value})} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
                        placeholder="VD: A.01, A.02, B.05..." 
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Ký hiệu mã số ô đất thực tế tại bãi cắm trại (VD: A.01, B.02...).</span>
                    </div>

                    {/* Đơn vị quy chuẩn nhỏ nhất: 1 ô ~3m² */}
                    <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-emerald-950 block">Quy Mô Ô Đất Chuẩn</span>
                        <span className="text-[11px] text-emerald-700 font-medium">1 ô pixel tương đương ~3m² bãi cỏ thực tế</span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-extrabold text-xs shadow-xs">
                        1 Ô Đất (~3m²)
                      </span>
                    </div>

                    {/* Vị trí Tọa độ Flycam */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span className="flex items-center gap-1.5">
                          <Compass size={14} className="text-emerald-600" />
                          Tọa Độ Trên Bản Đồ Flycam:
                        </span>
                        {newTent.mapTop && newTent.mapLeft ? (
                          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Top: {parseFloat(newTent.mapTop).toFixed(1)}% | Left: {parseFloat(newTent.mapLeft).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Chưa gắn tọa độ</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
                        Có thể nhấp trực tiếp trên bản đồ Flycam hoặc kéo thả để tinh chỉnh vị trí chính xác.
                      </p>
                    </div>

                    {/* Info Note: Tents are flexible */}
                    <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/60 flex items-start gap-2.5">
                      <Layers size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                        Lều cắm trại được dựng và xếp linh hoạt theo từng booking thực tế của khách hàng vào ô đất này, không cố định định danh lều.
                      </p>
                    </div>
                  </>
                )}

                {isTableZone && (
                  <div className="p-3 rounded-2xl border text-xs font-medium bg-amber-50 border-amber-200 text-amber-900">
                    <QrCode size={14} className="inline mr-1.5" />
                    Mã QR Bàn Ăn sẽ TỰ ĐỘNG MỞ KHÓA 24/7. Khách ghé ngồi ăn chỉ cần quét QR là chọn món được ngay!
                  </div>
                )}

                <div className="pt-2 flex items-center gap-2.5">
                  {editingTent && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowTentModal(false);
                        handleDeleteTent(editingTent);
                      }}
                      className="px-4 py-2.5 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                      title={isTableZone ? "Xóa bàn ăn này" : "Xóa ô đất này"}
                    >
                      <Trash2 size={16} />
                      <span>Xóa</span>
                    </button>
                  )}
                  <button type="button" onClick={() => setShowTentModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                    Hủy
                  </button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
                    {editingTent ? "Lưu Cập Nhật" : (isTableZone ? "Tạo Bàn & In Mã QR" : "Tạo Ô Đất Mới")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Tent Type (Inventory) Modal */}
      {showTentTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowTentTypeModal(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-extrabold text-slate-800 mb-1">
              {editingTentType ? "Chỉnh Sửa Loại Lều Trong Kho" : "Thêm Loại Lều Cắm Trại Mới"}
            </h2>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Cấu hình số ô đất quy chuẩn chiếm dụng, số lượng campsite đang sở hữu và bảng giá thuê.
            </p>
            <form onSubmit={handleSaveTentType} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Tên Loại Lều (*)
                </label>
                <input 
                  required 
                  type="text" 
                  value={newTentType.name} 
                  onChange={e => setNewTentType({...newTentType, name: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm" 
                  placeholder="VD: Lều Đơn Nhỏ, Lều Đôi Vòm, Lều Glamping Gia Đình..." 
                />
              </div>

              {/* Quick Size Preset Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Chọn Nhanh Quy Cách Kích Thước
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setNewTentType({
                      ...newTentType,
                      size: 'Small',
                      slotsOccupied: '1',
                      capacity: '1 - 2 khách'
                    })}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      parseInt(newTentType.slotsOccupied) === 1
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-black shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>Lều Nhỏ</div>
                    <div className="text-[10px] text-slate-500 font-normal">1 ô (~3m²)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTentType({
                      ...newTentType,
                      size: 'Medium',
                      slotsOccupied: '2',
                      capacity: '2 - 4 khách'
                    })}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      parseInt(newTentType.slotsOccupied) === 2
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-black shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>Lều Trung (Đôi)</div>
                    <div className="text-[10px] text-slate-500 font-normal">2 ô (~6m²)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTentType({
                      ...newTentType,
                      size: 'Large',
                      slotsOccupied: '4',
                      capacity: '4 - 8 khách'
                    })}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      parseInt(newTentType.slotsOccupied) === 4
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-black shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>Lều Lớn (Gia Đình)</div>
                    <div className="text-[10px] text-slate-500 font-normal">4 ô (~12m²)</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Số Ô Đất Chiếm Dụng (*)
                  </label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    value={newTentType.slotsOccupied} 
                    onChange={e => setNewTentType({...newTentType, slotsOccupied: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm" 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Tương đương ~{(parseInt(newTentType.slotsOccupied) || 1) * 3}m²</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Sức Chứa Khách (*)
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={newTentType.capacity} 
                    onChange={e => setNewTentType({...newTentType, capacity: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm" 
                    placeholder="VD: 2 - 4 khách" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Tổng Số Lượng Lều Campsite Sở Hữu Trong Kho (*)
                </label>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  value={newTentType.totalQuantity} 
                  onChange={e => setNewTentType({...newTentType, totalQuantity: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-black text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
                  placeholder="VD: 10" 
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Hệ thống sẽ dựa vào số lượng này để kiểm soát tồn kho lều thực tế khi lễ tân nhận khách.</span>
              </div>

              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                  Bảng Giá Thuê Lều
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Giá Thuê Qua Đêm (VNĐ/đêm) (*)
                  </label>
                  <input 
                    required 
                    type="number" 
                    min="0" 
                    value={newTentType.price} 
                    onChange={e => setNewTentType({...newTentType, price: e.target.value})} 
                    className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-slate-900 font-black text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Giá Theo Giờ (Giờ đầu)
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      value={newTentType.hourlyFirstHourPrice} 
                      onChange={e => setNewTentType({...newTentType, hourlyFirstHourPrice: e.target.value})} 
                      className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold text-xs" 
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Giá Giờ Tiếp Theo
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      value={newTentType.hourlyExtraHourPrice} 
                      onChange={e => setNewTentType({...newTentType, hourlyExtraHourPrice: e.target.value})} 
                      className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold text-xs" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Mô Tả / Tiện Nghi Kèm Theo
                </label>
                <textarea 
                  rows="2" 
                  value={newTentType.description} 
                  onChange={e => setNewTentType({...newTentType, description: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-xs resize-none" 
                  placeholder="VD: Bao gồm đệm hơi cách nhiệt, túi ngủ, đèn pin sạc, tấm bạt che..." 
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                {editingTentType && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTentTypeModal(false);
                      handleDeleteTentType(editingTentType);
                    }}
                    className="px-4 py-2.5 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    title="Xóa loại lều này"
                  >
                    <Trash2 size={16} />
                    <span>Xóa</span>
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => setShowTentTypeModal(false)} 
                  className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                >
                  {editingTentType ? "Lưu Cập Nhật" : "Thêm Loại Lều"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
