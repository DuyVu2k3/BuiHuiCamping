import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Clock, Flame, Info, BellRing, X, MapPin, User, LogOut, Lock, Unlock, Link, Unlink, Utensils, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import signalRService from '../../services/signalrService';
import { getApiUrl } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import MasterBillModal from './MasterBillModal';

export default function WaiterOrdersPage() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  // Table Management State
  const [tents, setTents] = useState([]);
  const [activeTab, setActiveTab] = useState('DELIVERY'); // 'DELIVERY' or 'TABLE_MANAGEMENT'
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSource, setMergeSource] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);
  const [selectedMasterBill, setSelectedMasterBill] = useState(null);

  // Reference for audio so we can stop it later
  const alarmAudio = useRef(null);

  const isTableEntity = (tent) => {
    if (!tent) return false;
    const zType = tent.zone?.zoneType;
    const zName = (tent.zone?.name || tent.zoneName || '').toLowerCase();
    const tName = (tent.name || '').toLowerCase();

    return (
      zType === 'DiningTable' ||
      zName.includes('bàn') ||
      zName.includes('ẩm thực') ||
      zName.includes('nhà hàng') ||
      zName.includes('ăn uống') ||
      tName.includes('bàn')
    );
  };

  const fetchTents = async () => {
    try {
      const res = await axios.get(getApiUrl('/api/Tents'));
      if (res.data) {
        setTents(res.data);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách bàn:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(getApiUrl('/api/Orders'));
      const data = await res.json();
      
      let readyOrders = data.filter(o => o.status === 'Ready');
      if (user?.assignedZoneId || user?.assignedZoneName) {
        readyOrders = readyOrders.filter(o => {
          if (!user.assignedZoneId && (!user.assignedZoneName || user.assignedZoneName === "Toàn bộ các khu" || user.assignedZoneName === "Tất cả các khu")) {
            return true;
          }
          const idMatch = user.assignedZoneId && o.tent?.zoneId === user.assignedZoneId;
          const nameMatch = user.assignedZoneName && o.tent?.zoneName && (
            o.tent.zoneName.toLowerCase().includes(user.assignedZoneName.toLowerCase()) ||
            user.assignedZoneName.toLowerCase().includes(o.tent.zoneName.toLowerCase())
          );
          return idMatch || nameMatch;
        });
      }
      setOrders(readyOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Actions for Dining Tables
  const handleOpenTable = async (tableId, tableName) => {
    try {
      await axios.post(getApiUrl(`/api/Tents/${tableId}/open-table`));
      toast.success(`Đã MỞ BÀN ${tableName}! Khách tại bàn có thể quét QR gọi món.`);
      fetchTents();
    } catch (err) {
      toast.error(err.response?.data || "Không thể mở bàn.");
    }
  };

  const handleCloseTable = async (tableId, tableName) => {
    try {
      await axios.post(getApiUrl(`/api/Tents/${tableId}/close-table`));
      toast.success(`Đã ĐÓNG BÀN ${tableName} & khóa mã QR!`);
      fetchTents();
    } catch (err) {
      toast.error(err.response?.data || "Không thể đóng bàn.");
    }
  };

  const handleUnmergeTable = async (tableId, tableName) => {
    try {
      await axios.post(getApiUrl(`/api/Tents/${tableId}/unmerge-table`));
      toast.success(`Đã TÁCH BÀN ${tableName}!`);
      fetchTents();
    } catch (err) {
      toast.error("Không thể tách bàn.");
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeSource || !mergeTargetId) return toast.error("Vui lòng chọn bàn cần ghép vào!");
    setMerging(true);
    try {
      await axios.post(getApiUrl('/api/Tents/merge-tables'), {
        sourceTentId: mergeSource.id,
        targetTentId: parseInt(mergeTargetId)
      });
      const targetTable = tents.find(t => t.id === parseInt(mergeTargetId));
      toast.success(`Đã ghép Bàn ${mergeSource.name} vào Bàn ${targetTable?.name || ''}!`);
      setShowMergeModal(false);
      setMergeSource(null);
      setMergeTargetId('');
      fetchTents();
    } catch (err) {
      toast.error(err.response?.data || "Ghép bàn thất bại.");
    } finally {
      setMerging(false);
    }
  };

  useEffect(() => {
    // Request Chrome Web Push Notification permission
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    fetchOrders();
    fetchTents();

    const handleOrderToWaiter = (notification) => {
      // Check zone matching before alerting
      const isGlobalWaiter = !user?.assignedZoneId && (!user?.assignedZoneName || user.assignedZoneName === "Toàn bộ các khu" || user.assignedZoneName === "Tất cả các khu");
      const isIdMatch = user?.assignedZoneId && notification?.zoneId && notification.zoneId === user.assignedZoneId;
      const isNameMatch = user?.assignedZoneName && notification?.zoneName && (
        notification.zoneName.toLowerCase().includes(user.assignedZoneName.toLowerCase()) ||
        user.assignedZoneName.toLowerCase().includes(notification.zoneName.toLowerCase())
      );

      const isZoneMatch = isGlobalWaiter || isIdMatch || isNameMatch;
      if (!isZoneMatch) return;

      setNewOrderAlert(notification);
      
      // Channel 1: Audio Ringtone
      try {
        if (!alarmAudio.current) {
          alarmAudio.current = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
          alarmAudio.current.volume = 0.6;
          alarmAudio.current.loop = true;
        }
        alarmAudio.current.play().catch(e => console.log("Audio play blocked by browser"));
      } catch (e) {}

      // Channel 2: Mobile Phone Vibration (Chrome Android)
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([300, 100, 300, 100, 300]);
        }
      } catch (e) {}

      // Channel 3: Chrome System Push Notification Banner
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification("🔔 MÓN ĂN SẴN SÀNG GIAO!", {
            body: notification?.message || "Có đơn món mới đã làm xong từ Bếp!",
            icon: '/favicon.ico'
          });
        }
      } catch (e) {}

      fetchOrders();
    };

    const handleOrderUpdated = () => {
      fetchOrders();
      fetchTents();
    };

    const handleTentStatusChanged = () => {
      fetchTents();
      fetchOrders();
    };

    signalRService.on("OrderToWaiter", handleOrderToWaiter);
    signalRService.on("OrderUpdated", handleOrderUpdated);
    signalRService.on("OrderStatusUpdated", handleOrderUpdated);
    signalRService.on("TentStatusChanged", handleTentStatusChanged);

    return () => {
      signalRService.off("OrderToWaiter", handleOrderToWaiter);
      signalRService.off("OrderUpdated", handleOrderUpdated);
      signalRService.off("OrderStatusUpdated", handleOrderUpdated);
      signalRService.off("TentStatusChanged", handleTentStatusChanged);
      if (alarmAudio.current) {
        alarmAudio.current.pause();
      }
    };
  }, [user?.assignedZoneId]);

  const dismissAlert = () => {
    setNewOrderAlert(null);
    if (alarmAudio.current) {
      alarmAudio.current.pause();
      alarmAudio.current.currentTime = 0;
    }
  };

  const completeOrder = async (orderId) => {
    try {
      const res = await fetch(getApiUrl(`/api/Orders/${orderId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify("Completed")
      });
      if (res.ok) {
        setOrders(orders.filter(o => o.id !== orderId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [selectedOrderForProof, setSelectedOrderForProof] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const handleOpenProofModal = (order) => {
    setSelectedOrderForProof(order);
    setProofFile(null);
    setProofPreview(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadProofAndComplete = async () => {
    if (!selectedOrderForProof) return;
    setUploadingProof(true);

    try {
      const formData = new FormData();
      if (proofFile) {
        formData.append("photo", proofFile);
      }
      formData.append("deliveredBy", user?.fullName || user?.username || "Nhân viên chạy bàn");

      const res = await fetch(getApiUrl(`/api/Orders/${selectedOrderForProof.id || selectedOrderForProof.batchId}/upload-proof`), {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        setOrders(orders.filter(o => o.id !== selectedOrderForProof.id));
        setSelectedOrderForProof(null);
      }
    } catch (err) {
      console.error("Lỗi tải ảnh xác nhận:", err);
    } finally {
      setUploadingProof(false);
    }
  };

  const getLocationFormatted = (order) => {
    const tent = order.tent;
    if (!tent) return "Vị Trí Chưa Xác Định";

    const zoneNameRaw = tent.zoneName || tent.zone?.name || "";
    const tentNameRaw = tent.name || "";

    const isTable = (tent.zone?.zoneType === 'DiningTable') || 
                    (tent.tentType && (tent.tentType.toLowerCase().includes('bàn') || tent.tentType.toLowerCase().includes('tiệc'))) ||
                    zoneNameRaw.toLowerCase().includes('bàn') ||
                    zoneNameRaw.toLowerCase().includes('ẩm thực') ||
                    zoneNameRaw.toLowerCase().includes('nhà hàng') ||
                    zoneNameRaw.toLowerCase().includes('ăn uống') ||
                    tentNameRaw.toLowerCase().includes('bàn');

    const zoneFormatted = zoneNameRaw ? (zoneNameRaw.startsWith("Khu") ? zoneNameRaw : `Khu ${zoneNameRaw}`) : "";
    const icon = isTable ? "🍽️" : "⛺";
    const entityTitle = isTable
      ? (tentNameRaw.startsWith("Bàn") ? tentNameRaw : `Bàn ${tentNameRaw}`)
      : (tentNameRaw.startsWith("Lều") ? tentNameRaw : `Lều ${tentNameRaw}`);

    if (zoneFormatted) {
      return { icon, text: `${zoneFormatted} • ${entityTitle}`, isTable };
    }
    return { icon, text: entityTitle, isTable };
  };

  const [locationFilter, setLocationFilter] = useState('ALL'); // 'ALL' | 'TABLE' | 'TENT'

  const filteredOrders = orders.filter(order => {
    const loc = getLocationFormatted(order);
    if (locationFilter === 'TABLE') return loc.isTable;
    if (locationFilter === 'TENT') return !loc.isTable;
    return true;
  });

  const canManageTables = () => {
    if (!user) return true;
    if (user.role === 'Manager' || user.role === 'Receptionist') return true;

    const zoneName = (user.assignedZoneName || '').toLowerCase();
    const isGlobalWaiter = !user.assignedZoneId && (!user.assignedZoneName || zoneName === "toàn bộ các khu" || zoneName === "tất cả các khu");
    if (isGlobalWaiter) return true;

    return zoneName.includes('bàn') || zoneName.includes('ẩm thực') || zoneName.includes('nhà hàng') || zoneName.includes('ăn uống');
  };

  const formatTableName = (name) => {
    if (!name) return "Bàn";
    const clean = name.trim();
    return clean.toLowerCase().startsWith("bàn") ? clean : `Bàn ${clean}`;
  };

  const diningTables = tents.filter(t => isTableEntity(t));
  const showTableTab = canManageTables();

  const isGlobalStaff = !user?.assignedZoneId && (!user?.assignedZoneName || user.assignedZoneName === "Toàn bộ các khu" || user.assignedZoneName === "Tất cả các khu") || user?.role === "Manager" || user?.role === "Receptionist";

  if (loading) return <div className="p-6 text-center text-slate-500 animate-pulse font-bold">Đang đồng bộ đơn hàng & danh sách bàn...</div>;

  return (
    <div className="p-4 space-y-4 pb-12 relative min-h-full">
      {/* Top Header Mode Toggle: Giao Món vs Quản Lý Bàn (Only visible for Dining Table / All-Zone staff) */}
      {showTableTab && (
        <div className="flex bg-slate-200/80 p-1 rounded-2xl border border-slate-300/60 shadow-xs">
          <button
            onClick={() => setActiveTab('DELIVERY')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'DELIVERY'
                ? 'bg-[#1B4D3E] text-white shadow-md'
                : 'text-slate-700 hover:bg-white/60'
            }`}
          >
            <BellRing size={16} />
            Giao Món ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('TABLE_MANAGEMENT')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'TABLE_MANAGEMENT'
                ? 'bg-[#1B4D3E] text-white shadow-md'
                : 'text-slate-700 hover:bg-white/60'
            }`}
          >
            <Utensils size={16} />
            Quản Lý Bàn ({diningTables.length})
          </button>
        </div>
      )}

      {showTableTab && activeTab === 'TABLE_MANAGEMENT' ? (
        /* TABLE MANAGEMENT VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Sơ Đồ Bàn Khu Ẩm Thực</h2>
              <p className="text-xs text-slate-500 font-bold">1-Chạm Mở Bàn, Đóng Bàn & Ghép Bàn Realtime</p>
            </div>
            <button
              onClick={fetchTents}
              className="p-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs flex items-center gap-1"
            >
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {diningTables.map((table) => {
              const isOpen = table.isQrUnlocked || table.status === "Occupied" || table.mergedParentTentId;
              const mergedParent = table.mergedParentTentId
                ? tents.find((t) => t.id === table.mergedParentTentId)
                : null;
              const isChildMerged = !!table.mergedParentTentId;
              const tableNameDisplay = formatTableName(table.name);

              return (
                <div
                  key={table.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border transition-all space-y-3 relative ${
                    isChildMerged
                      ? "border-purple-300 bg-purple-50/30"
                      : isOpen
                      ? "border-emerald-300 bg-emerald-50/20"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  {/* Row 1: Status Badge aligned to far top right */}
                  <div className="flex justify-end">
                    <span
                      className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase leading-none tracking-normal whitespace-nowrap ${
                        isChildMerged
                          ? "bg-purple-100 text-purple-800 border border-purple-300"
                          : isOpen
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-slate-200 text-slate-600 border border-slate-300"
                      }`}
                    >
                      {isChildMerged
                        ? `Ghép ➔ ${formatTableName(mergedParent?.name)}`
                        : isOpen
                        ? "Đang Mở"
                        : "Trống (QR Khóa)"}
                    </span>
                  </div>

                  {/* Row 2: Table Number & Zone Name */}
                  <div>
                    <h3 className="font-black text-slate-900 text-base tracking-tight">
                      {tableNameDisplay}{" "}
                      <span className="text-xs text-slate-500 font-bold ml-1">
                        ({table.zone?.name || "Khu ẩm thực"})
                      </span>
                    </h3>
                  </div>

                  {/* Actions Bar for Table */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {!isOpen ? (
                      <button
                        onClick={() => handleOpenTable(table.id, table.name)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Unlock size={14} /> Mở Bàn 1-Chạm
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCloseTable(table.id, table.name)}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Lock size={14} /> Đóng Bàn
                        </button>

                        {!isChildMerged ? (
                          <button
                            onClick={() => {
                              setMergeSource(table);
                              setShowMergeModal(true);
                            }}
                            className="py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Link size={14} /> Ghép Bàn
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnmergeTable(table.id, table.name)}
                            className="py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Unlink size={14} /> Tách Bàn
                          </button>
                        )}

                        <button
                          onClick={() =>
                            setSelectedMasterBill({
                              tentId: table.id,
                              tentName: table.name,
                            })
                          }
                          className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          💳 Master Bill
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DELIVERY VIEW */
        <>
          {/* Location Filter Sub-bar (Only shown for All-Zone staff) */}
          {isGlobalStaff && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-white p-2 rounded-2xl border border-slate-100 shadow-xs">
              {[
                { key: 'ALL', label: `Tất cả (${orders.length})` },
                { key: 'TABLE', label: `🍽️ Bàn ăn (${orders.filter(o => getLocationFormatted(o).isTable).length})` },
                { key: 'TENT', label: `⛺ Lều (${orders.filter(o => !getLocationFormatted(o).isTable).length})` }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setLocationFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex-shrink-0 ${
                    locationFilter === f.key
                      ? 'bg-[#1B4D3E] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          
          {/* Fullscreen Alert Modal for Waiter */}
          {newOrderAlert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                <div className="bg-emerald-500 w-full py-8 flex flex-col items-center justify-center text-white relative">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                  <BellRing size={64} className="animate-wiggle drop-shadow-lg mb-4" />
                  <h2 className="text-3xl font-black uppercase tracking-widest text-emerald-50">{newOrderAlert.tentName}</h2>
                </div>
                
                <div className="p-6 w-full">
                  <p className="text-lg font-bold text-slate-800 mb-1">Có món cần giao khẩn cấp!</p>
                  <p className="text-slate-500 font-medium mb-8">Khách hàng: {newOrderAlert.customerName}</p>
                  
                  <button 
                    onClick={dismissAlert}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl rounded-2xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex justify-center items-center gap-2"
                  >
                    ĐÃ NHẬN THÔNG TIN
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] opacity-50 space-y-2">
              <CheckCircle2 size={56} className="text-emerald-500" />
              <h2 className="text-lg font-bold text-slate-600">Không có đơn cần giao trong mục này</h2>
              <p className="text-xs text-slate-500 font-medium text-center px-4">Tất cả món đã được giao, hoặc Bếp chưa làm xong.</p>
            </div>
          ) : (
        <div className="space-y-5">
          <div className="flex justify-between items-end mb-2 px-2">
            <div>
              <h2 className="text-xl font-black text-slate-800">Cần Giao Gấp</h2>
              <p className="text-xs text-slate-500 font-bold">Bếp đã làm xong</p>
            </div>
            <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm shadow-rose-500/30">
              {filteredOrders.length} Đơn
            </span>
          </div>

          {filteredOrders.map(order => {
            const loc = getLocationFormatted(order);
            const customerName = order.booking?.customerName || order.customerName || "Khách tại bàn";

            return (
              <div key={order.id} className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden group active:scale-[0.98] transition-all">
                
                <div className={`absolute top-0 left-0 w-2.5 h-full ${loc.isTable ? 'bg-amber-500' : 'bg-emerald-500'} rounded-l-3xl`}></div>
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="space-y-1">
                    {/* Location Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{loc.icon}</span>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        {loc.text}
                      </h3>
                    </div>

                    {/* Customer Name */}
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold text-sm pt-0.5">
                      <User size={15} className="text-emerald-600" />
                      <span>Khách: <strong className="text-slate-800 font-black">{customerName}</strong></span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Clock size={13} />
                      <span className="text-xs font-bold">
                        {new Date(order.createdAt.endsWith('Z') ? order.createdAt : order.createdAt + 'Z').toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-3 bg-slate-50/90 p-4 rounded-2xl mb-4 ml-2 border border-slate-200/60">
                  {order.orderDetails?.map(detail => (
                    <div key={detail.id} className="flex justify-between items-center border-b border-slate-200/50 pb-3 last:border-0 last:pb-0">
                      <div className="flex-1 pr-3">
                        <p className="font-bold text-slate-800 text-sm leading-tight">{detail.menuItem?.name}</p>
                        {detail.note && (
                          <p className="text-xs text-rose-500 font-medium italic mt-1 bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                            {detail.note}
                          </p>
                        )}
                      </div>
                      <span className="font-black text-lg text-emerald-800 bg-emerald-100/90 w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border border-emerald-200">
                        x{detail.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => handleOpenProofModal(order)}
                  className="w-full ml-2 py-4 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-black text-lg rounded-2xl shadow-xl shadow-[#1B4D3E]/20 transition-all flex justify-center items-center gap-2 active:scale-95"
                >
                  <CheckCircle2 size={22} />
                  Chụp Ảnh & Giao Hàng
                </button>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* WAITER PHOTO PROOF UPLOAD MODAL */}
      {selectedOrderForProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">📸 Xác Nhận Giao Món</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">Chụp ảnh món ăn/thức uống đã đặt tại lều</p>
              </div>
              <button
                onClick={() => setSelectedOrderForProof(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-500 text-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Photo Capture Area */}
            <div className="space-y-3">
              {proofPreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-300 shadow-md">
                  <img src={proofPreview} alt="Proof" className="w-full h-48 object-cover" />
                  <button
                    onClick={() => { setProofFile(null); setProofPreview(null); }}
                    className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-full text-xs font-bold"
                  >
                    Chụp lại
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                  <span className="text-3xl mb-2">📷</span>
                  <span className="text-xs font-black text-[#1B4D3E]">Bấm để Mở Camera / Chọn Ảnh</span>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">Ảnh sẽ được lưu vết vào hồ sơ đơn Lễ tân</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedOrderForProof(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleUploadProofAndComplete}
                disabled={uploadingProof}
                className="flex-1 py-3 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-black rounded-xl text-xs shadow-md shadow-[#1B4D3E]/20 disabled:opacity-50"
              >
                {uploadingProof ? "Đang tải ảnh..." : "Xác Nhận Đã Giao"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TABLE MERGE MODAL */}
      {showMergeModal && mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-purple-950 flex items-center gap-1.5">
                  <Link size={18} className="text-purple-600" /> Ghép Bàn & Gộp Hóa Đơn
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  Ghép Bàn <strong className="text-purple-700">{mergeSource.name}</strong> vào một Bàn chính
                </p>
              </div>
              <button
                onClick={() => { setShowMergeModal(false); setMergeSource(null); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-500 text-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-700">
                Chọn Bàn Chính (Master Table) cần gộp hóa đơn:
              </label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="">-- Chọn Bàn Chính --</option>
                {diningTables
                  .filter((t) => t.id !== mergeSource.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Bàn {t.name} ({t.zone?.name || "Khu Ẩm Thực"})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-purple-600/90 font-medium leading-relaxed bg-purple-50 p-3 rounded-xl border border-purple-100">
                💡 <strong>Lưu ý:</strong> Sau khi ghép, bất kỳ món ăn nào được gọi từ mã QR của Bàn {mergeSource.name} sẽ tự động gộp chung vào 1 Master Bill của Bàn chính.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowMergeModal(false); setMergeSource(null); }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={merging || !mergeTargetId}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs shadow-md shadow-purple-600/20 disabled:opacity-50"
              >
                {merging ? "Đang ghép bàn..." : "Xác Nhận Ghép Bàn"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASTER BILL MODAL FOR DINING TABLES */}
      {selectedMasterBill && (
        <MasterBillModal
          isOpen={!!selectedMasterBill}
          onClose={() => setSelectedMasterBill(null)}
          tentId={selectedMasterBill.tentId}
          tentName={selectedMasterBill.tentName}
          onCheckoutSuccess={() => {
            setSelectedMasterBill(null);
            fetchTents();
          }}
        />
      )}

      {/* Physical Spacer to guarantee bottom floating footer navbar clearance */}
      <div className="h-24 w-full block pointer-events-none" aria-hidden="true" />
    </div>
  );
}
