import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Tent, Map, QrCode, Download, Power, CheckCircle2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalrService';

export default function FacilityManagementPage() {
  const [activeTab, setActiveTab] = useState('zones'); // 'zones' or 'tents'
  const [zones, setZones] = useState([]);
  const [tents, setTents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showTentModal, setShowTentModal] = useState(false);
  
  const [newZone, setNewZone] = useState({ name: '', description: '', zoneType: 'Camping' });
  const [newTent, setNewTent] = useState({ name: '', zoneId: '', price: '', hourlyPriceFirstHour: '100000', hourlyPriceExtraHour: '50000' });

  // Map editor state
  const [selectedTentForMap, setSelectedTentForMap] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zonesRes, tentsRes] = await Promise.all([
        axios.get(getApiUrl('/api/Zones')),
        axios.get(getApiUrl('/api/Tents'))
      ]);
      setZones(zonesRes.data);
      setTents(tentsRes.data);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    signalRService.startConnection();

    const handleRefresh = () => {
      fetchData();
    };

    signalRService.on("TentStatusChanged", handleRefresh);
    signalRService.on("BookingQrStatusChanged", handleRefresh);

    return () => {
      signalRService.off("TentStatusChanged", handleRefresh);
      signalRService.off("BookingQrStatusChanged", handleRefresh);
    };
  }, []);

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

  const handleAddZone = (e) => {
    e.preventDefault();
    axios.post(getApiUrl('/api/Zones'), newZone)
      .then(() => {
        toast.success("Thêm khu vực thành công!");
        setShowZoneModal(false);
        setNewZone({ name: '', description: '', zoneType: 'Camping' });
        fetchData();
      })
      .catch(err => toast.error("Lỗi khi thêm Khu vực"));
  };

  const [editingTent, setEditingTent] = useState(null); // null = creating new tent, object = editing existing tent

  const handleOpenAddTentModal = () => {
    setEditingTent(null);
    setNewTent({ name: '', zoneId: '', price: '', hourlyPriceFirstHour: '100000', hourlyPriceExtraHour: '50000' });
    setShowTentModal(true);
  };

  const handleOpenEditTentModal = (tent) => {
    setEditingTent(tent);
    setNewTent({
      name: tent.name || '',
      zoneId: tent.zoneId ? tent.zoneId.toString() : (tent.zone?.id ? tent.zone.id.toString() : ''),
      price: tent.price ? tent.price.toString() : '0',
      hourlyPriceFirstHour: (tent.hourlyPriceFirstHour || tent.HourlyPriceFirstHour || 100000).toString(),
      hourlyPriceExtraHour: (tent.hourlyPriceExtraHour || tent.HourlyPriceExtraHour || 50000).toString()
    });
    setShowTentModal(true);
  };

  const handleDeleteTent = (tent) => {
    const isTable = isTableEntity(tent);
    const itemType = isTable ? "Bàn" : "Lều";
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${itemType} "${tent.name}" không?`)) {
      axios.delete(getApiUrl(`/api/Tents/${tent.id}`))
        .then(() => {
          toast.success(`Đã xóa ${itemType} "${tent.name}" thành công!`);
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
    const payload = {
      name: newTent.name,
      zoneId: newTent.zoneId ? parseInt(newTent.zoneId) : null,
      status: editingTent ? editingTent.status : 'Available',
      price: newTent.price ? parseFloat(newTent.price) : 0,
      hourlyPriceFirstHour: newTent.hourlyPriceFirstHour ? parseFloat(newTent.hourlyPriceFirstHour) : 100000,
      hourlyPriceExtraHour: newTent.hourlyPriceExtraHour ? parseFloat(newTent.hourlyPriceExtraHour) : 50000
    };

    if (editingTent) {
      axios.put(getApiUrl(`/api/Tents/${editingTent.id}`), payload)
        .then(() => {
          toast.success("Cập nhật thông tin thành công!");
          setShowTentModal(false);
          setEditingTent(null);
          fetchData();
        })
        .catch(err => toast.error("Lỗi khi cập nhật thông tin"));
    } else {
      axios.post(getApiUrl('/api/Tents'), payload)
        .then(() => {
          toast.success("Tạo mới thành công!");
          setShowTentModal(false);
          setNewTent({ name: '', zoneId: '', price: '', hourlyPriceFirstHour: '100000', hourlyPriceExtraHour: '50000' });
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

  const handleMapClick = (e) => {
    if (!selectedTentForMap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const leftPercent = ((x / rect.width) * 100).toFixed(2) + '%';
    const topPercent = ((y / rect.height) * 100).toFixed(2) + '%';
    
    axios.put(getApiUrl(`/api/Tents/${selectedTentForMap.id}/coordinates`), { mapTop: topPercent, mapLeft: leftPercent })
      .then(() => {
        toast.success(`Đã cập nhật vị trí cho lều ${selectedTentForMap.name}`);
        setSelectedTentForMap(null);
        fetchData(); 
      })
      .catch(() => toast.error("Cập nhật vị trí thất bại"));
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
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('zones')}
            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'zones' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Map size={18} /> Khu vực
          </button>
          <button 
            onClick={() => setActiveTab('tents')}
            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'tents' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Tent size={18} /> Lều & Bàn Ăn
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 ${activeTab === 'map' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <QrCode size={18} /> Sơ đồ ghim vị trí
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-medium animate-pulse">Đang nạp dữ liệu...</div>
      ) : activeTab === 'zones' ? (
        // ZONES VIEW
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowZoneModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
              <Plus size={18} /> Thêm Khu Vực
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {zones.map(zone => {
              const isTableZone = zone.zoneType === 'DiningTable' || zone.name.toLowerCase().includes('bàn') || zone.name.toLowerCase().includes('ẩm thực') || zone.name.toLowerCase().includes('nhà hàng');

              return (
                <div key={zone.id} className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${isTableZone ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-600'}`}>
                      {isTableZone ? "🍽️" : <Map size={20} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{zone.name}</h3>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isTableZone ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                        {isTableZone ? 'Khu Bàn Ăn (QR Mở 24/7)' : 'Khu Lều Qua Đêm'}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm mb-4 mt-2">{zone.description || 'Chưa có mô tả'}</p>
                  <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {isTableZone ? 'Số lượng bàn ăn' : 'Số lượng lều'}
                    </span>
                    <span className="text-lg font-extrabold text-emerald-600">{zone.tents?.length || 0}</span>
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
                      {isTableZone ? <span className="text-xl">🍽️</span> : <Map size={20} className="text-emerald-600"/>} {zone.name}
                    </h3>
                    <span className="text-sm font-semibold text-slate-500">
                      {zoneTents.length} {isTableZone ? 'Bàn ăn' : 'Lều'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {zoneTents.map(tent => {
                      const isTable = isTableEntity(tent);
                      const fPrice = tent.hourlyPriceFirstHour || tent.HourlyPriceFirstHour || 100000;
                      const ePrice = tent.hourlyPriceExtraHour || tent.HourlyPriceExtraHour || 50000;

                      return (
                        <div key={tent.id} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center group relative">
                          <div className="w-full flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                {isTable ? `Bàn: ${tent.name}` : `Lều: ${tent.name}`}
                              </h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider mt-1 inline-block">
                                {tent.zone?.name || 'Chưa xếp khu'}
                              </span>
                            </div>

                            {isTable ? (
                              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                QR MỞ 24/7
                              </span>
                            ) : (
                              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${isQrActive(tent) ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                                {isQrActive(tent) ? 'QR KÍCH HOẠT' : 'QR ĐANG KHÓA'}
                              </span>
                            )}
                          </div>

                          {/* Pricing Badge */}
                          <div className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 mb-4 text-xs font-semibold space-y-1">
                            {isTable ? (
                              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md text-xs font-bold border border-amber-200 block text-center">Mã QR Đặt Món Tại Bàn</span>
                            ) : (
                              <>
                                <div className="flex justify-between items-center text-emerald-700">
                                  <span>Qua đêm:</span>
                                  <span className="font-extrabold text-sm">{tent.price ? tent.price.toLocaleString('vi-VN') + 'đ' : '0đ'}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-600 text-[11px]">
                                  <span>Theo giờ:</span>
                                  <span className="font-bold">{fPrice.toLocaleString('vi-VN')}đ (1h đầu) + {ePrice.toLocaleString('vi-VN')}đ (h sau)</span>
                                </div>
                              </>
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
                                  title="Sửa tên lều & giá tiền"
                                >
                                  Sửa Giá
                                </button>
                                <button 
                                  onClick={() => handleDeleteTent(tent)}
                                  className="py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all flex items-center justify-center"
                                  title="Xóa lều này"
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
                  <span className="text-sm font-semibold text-slate-500">{tents.filter(t => !t.zone).length} Lều</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {tents.filter(t => !t.zone).map(tent => (
                    <div key={tent.id} className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center group">
                      <div className="w-full flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            Lều: {tent.name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider mt-1 inline-block">
                            Chưa xếp khu
                          </span>
                          <div className="mt-2 text-sm font-extrabold text-emerald-600">
                            {tent.price ? tent.price.toLocaleString('vi-VN') + 'đ' : '0đ'}
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${isQrActive(tent) ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                          {isQrActive(tent) ? '🟢 QR KÍCH HOẠT' : '🔴 QR ĐANG KHÓA'}
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
      ) : (
        // MAP EDITOR VIEW
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/4 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col h-[600px]">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Chọn lều để ghim</h2>
            <p className="text-xs text-slate-500 mb-4">Click chọn 1 lều dưới đây, sau đó click lên bản đồ để ghim vị trí.</p>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-4">
              {zones.map(zone => {
                const zoneTents = tents.filter(t => t.zone?.id === zone.id);
                if (zoneTents.length === 0) return null;
                
                return (
                  <div key={`map-zone-${zone.id}`} className="space-y-2">
                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider sticky top-0 bg-white py-1 z-10 border-b border-slate-100">{zone.name}</h3>
                    {zoneTents.map(tent => (
                      <button
                        key={tent.id}
                        onClick={() => setSelectedTentForMap(tent)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all flex justify-between items-center ${selectedTentForMap?.id === tent.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                      >
                        <div>
                          <div className="font-bold text-slate-700">Lều {formatTentName(tent)}</div>
                        </div>
                        {tent.mapTop && tent.mapLeft && (
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" title="Đã có tọa độ"></div>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}

              {tents.filter(t => !t.zone).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider sticky top-0 bg-white py-1 z-10 border-b border-slate-100">Chưa phân khu</h3>
                  {tents.filter(t => !t.zone).map(tent => (
                    <button
                      key={tent.id}
                      onClick={() => setSelectedTentForMap(tent)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all flex justify-between items-center ${selectedTentForMap?.id === tent.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div>
                        <div className="font-bold text-slate-700">Lều {formatTentName(tent)}</div>
                      </div>
                      {tent.mapTop && tent.mapLeft && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" title="Đã có tọa độ"></div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="w-full lg:w-3/4">
            <div className={`relative w-full aspect-[16/9] bg-slate-100 rounded-3xl overflow-hidden shadow-sm border-2 ${selectedTentForMap ? 'border-emerald-500 cursor-crosshair ring-4 ring-emerald-100' : 'border-slate-200'}`}>
              
              {!selectedTentForMap && (
                <div className="absolute inset-0 z-30 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                  <div className="bg-white px-6 py-3 rounded-full font-bold text-slate-800 shadow-xl flex items-center gap-2">
                    <Map size={20} className="text-emerald-600" /> Hãy chọn 1 lều ở danh sách bên trái để ghim
                  </div>
                </div>
              )}

              <img 
                src="/campsite-map-new.jpg" 
                alt="Map Editor" 
                className="w-full h-full object-cover object-center pointer-events-none"
              />
              <div 
                className="absolute inset-0 z-20" 
                onClick={handleMapClick}
              ></div>

              {/* Render existing pins */}
              {tents.map(tent => {
                if (!tent.mapTop || !tent.mapLeft) return null;
                const isSelected = selectedTentForMap?.id === tent.id;
                
                return (
                  <div 
                    key={`pin-${tent.id}`}
                    style={{ top: tent.mapTop, left: tent.mapLeft }}
                    className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none`}
                  >
                    <div className={`relative px-2 py-1 rounded-full font-black text-[10px] shadow-lg border-2 flex items-center gap-1 transition-all ${isSelected ? 'bg-amber-500 text-white border-white scale-125 z-50 animate-pulse' : 'bg-emerald-500 text-white border-white'}`}>
                      <Tent size={10} />
                      {formatTentName(tent)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Zone Modal */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowZoneModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-extrabold text-slate-800 mb-1">Thêm Khu vực Mới (Zone)</h2>
            <p className="text-xs text-slate-500 mb-4 font-medium">Tạo Khu Lều ở hoặc Khu Bàn Ăn tại nhà hàng</p>
            <form onSubmit={handleAddZone} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Loại Khu Vực (Zone Type)</label>
                <select 
                  value={newZone.zoneType} 
                  onChange={e => setNewZone({...newZone, zoneType: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Camping">⛺ Khu Lều Cắm Trại (Lưu Trụ Qua Đêm - Cần Check-in)</option>
                  <option value="DiningTable">🍽️ Khu Bàn Ăn / Nhà Hàng (Gọi Món Tại Chỗ - QR Mở 24/7)</option>
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

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowZoneModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Hủy</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700">Lưu Khu Vực</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tent / Table Modal */}
      {showTentModal && (() => {
        const isZoneTable = (z) => {
          if (!z) return false;
          if (z.zoneType === 'DiningTable') return true;
          const nameLower = (z.name || '').toLowerCase();
          return nameLower.includes('bàn') || nameLower.includes('ẩm thực') || nameLower.includes('nhà hàng') || nameLower.includes('ăn uống');
        };

        const selectedZoneObj = zones.find(z => z.id.toString() === newTent.zoneId.toString());
        const isTableZone = isZoneTable(selectedZoneObj);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowTentModal(false)}></div>
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
              <h2 className="text-xl font-extrabold text-slate-800 mb-1">
                {editingTent 
                  ? (isTableZone ? "✏️ Chỉnh Sửa Bàn Ăn" : "✏️ Chỉnh Sửa Lều") 
                  : (isTableZone ? "🍽️ Thêm Bàn Ăn Mới" : "⛺ Thêm Lều Mới (Tent)")
                }
              </h2>
              <p className="text-xs text-slate-500 mb-4 font-medium">
                {editingTent 
                  ? "Cập nhật tên lều/bàn và các định mức giá thuê" 
                  : (isTableZone ? "Tạo bàn ăn tại nhà hàng & sinh mã QR gọi món tại chỗ" : "Tạo lều cắm trại & sinh mã QR lều")
                }
              </p>

              <form onSubmit={handleSaveTent} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Thuộc Khu vực</label>
                  <select required value={newTent.zoneId} onChange={e => setNewTent({...newTent, zoneId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                    <option value="">-- Chọn khu vực --</option>
                    {zones.map(z => {
                      const isTable = isZoneTable(z);
                      return (
                        <option key={z.id} value={z.id}>
                          {isTable ? `🍽️ ${z.name} (Khu Bàn Ăn)` : `⛺ ${z.name} (Khu Lều)`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {isTableZone ? "Tên Bàn (Ký hiệu)" : "Tên Lều (Ký hiệu)"}
                  </label>
                  <input required type="text" value={newTent.name} onChange={e => setNewTent({...newTent, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder={isTableZone ? "VD: Bàn 01, Bàn 02, Bàn VIP 1..." : "VD: A.1, B.2, Lều 01..."} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {isTableZone ? "Giá Thuê Bàn (VNĐ - Mặc định 0đ)" : "Giá Thuê Qua Đêm (VNĐ)"}
                  </label>
                  <input required type="number" min="0" value={newTent.price} onChange={e => setNewTent({...newTent, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder={isTableZone ? "0" : "VD: 500000"} />
                </div>

                {!isTableZone && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        🥇 Giá 1 Giờ Đầu (VNĐ)
                      </label>
                      <input required type="number" min="0" value={newTent.hourlyPriceFirstHour || '100000'} onChange={e => setNewTent({...newTent, hourlyPriceFirstHour: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="100000" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ➕ Giờ Tiếp Theo (VNĐ)
                      </label>
                      <input required type="number" min="0" value={newTent.hourlyPriceExtraHour || '50000'} onChange={e => setNewTent({...newTent, hourlyPriceExtraHour: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="50000" />
                    </div>
                  </div>
                )}

                <div className={`p-3 rounded-2xl border text-xs font-medium ${isTableZone ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                  <QrCode size={14} className="inline mr-1.5" />
                  {isTableZone
                    ? "✨ Mã QR Bàn Ăn sẽ TỰ ĐỘNG MỞ KHÓA 24/7. Khách ghé ngồi ăn chỉ cần quét QR là chọn món được ngay!"
                    : "🔒 Mã QR Lều Trại được bảo mật. Khi khách cọc và Lễ tân bấm Check-in lều thì mã QR mới mở khóa."}
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowTentModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Hủy</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700">
                    {editingTent ? "Cập Nhật Thông Tin" : (isTableZone ? "Tạo Bàn & In Mã QR" : "Tạo Lều Mới")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
