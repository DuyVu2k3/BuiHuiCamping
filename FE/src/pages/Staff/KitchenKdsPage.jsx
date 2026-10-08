import React, { useState, useEffect } from 'react';
import { ChefHat, Flame, Clock, RefreshCw, Volume2, VolumeX, Maximize2, Layers, Grid, LogOut, CheckCircle2, AlertTriangle, BellRing, Tent, Utensils, MapPin, User, Phone } from 'lucide-react';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalrService';
import { useAuth } from '../../context/AuthContext';

export default function KitchenKdsPage() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('orders'); // 'orders' | 'summary'
  const [locationFilter, setLocationFilter] = useState('ALL'); // 'ALL' | 'TABLE' | 'TENT'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState(new Date());
  const [newOrderChime, setNewOrderChime] = useState(null);

  // Live timer tick every 10s
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio API Synthesizer Chime (100% local, no network/CORS issues)
  const playKdsChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15);
      
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio play blocked", e);
    }
  };

  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  const presetReasons = [
    "Món ăn / Nước uống hiện đã hết hàng",
    "Bếp đang quá tải, không thể phục vụ kịp",
    "Bếp tạm ngưng nhận đơn món mới",
    "Lý do khác (Nhập chi tiết bên dưới)"
  ];

  const fetchKitchenOrders = async () => {
    try {
      const res = await fetch(getApiUrl('/api/Orders'));
      const data = await res.json();
      // Show Pending & Preparing orders for kitchen
      const kitchenQueue = data
        .filter(o => o.status === 'Pending' || o.status === 'Preparing')
        .sort((a, b) => new Date(a.orderTime || a.createdAt || 0) - new Date(b.orderTime || b.createdAt || 0));
      setOrders(kitchenQueue);
    } catch (err) {
      console.error("Error fetching kitchen orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStartCooking = async (batchId) => {
    try {
      const res = await fetch(getApiUrl(`/api/Orders/${batchId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify("Preparing")
      });
      if (res.ok) {
        fetchKitchenOrders();
      }
    } catch (err) {
      console.error("Lỗi xác nhận nhận đơn:", err);
    }
  };

  const handleCallWaiter = async (batchId) => {
    try {
      const res = await fetch(getApiUrl(`/api/Orders/${batchId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify("Ready")
      });
      if (res.ok) {
        fetchKitchenOrders();
      }
    } catch (err) {
      console.error("Lỗi gọi chạy bàn:", err);
    }
  };

  const handleOpenRejectModal = (order) => {
    setRejectingOrder(order);
    setRejectReason(presetReasons[0]);
    setCustomReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrder) return;
    setSubmittingReject(true);

    const finalReason = rejectReason.includes("Lý do khác")
      ? (customReason.trim() || "Bếp chưa thể phục vụ đợt món này")
      : rejectReason;

    try {
      const res = await fetch(getApiUrl(`/api/Orders/${rejectingOrder.id || rejectingOrder.batchId}/reject`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason })
      });

      if (res.ok) {
        setRejectingOrder(null);
        fetchKitchenOrders();
      }
    } catch (err) {
      console.error("Lỗi từ chối đơn:", err);
    } finally {
      setSubmittingReject(false);
    }
  };

  useEffect(() => {
    fetchKitchenOrders();

    const handleNewFoodOrder = (notification) => {
      if (soundEnabled) {
        playKdsChime();
      }
      setNewOrderChime(notification || "Có đơn mới cần chế biến!");
      fetchKitchenOrders();
      setTimeout(() => setNewOrderChime(null), 6000);
    };

    const handleOrderUpdated = () => {
      fetchKitchenOrders();
    };

    signalRService.on("NewFoodOrder", handleNewFoodOrder);
    signalRService.on("OrderUpdated", handleOrderUpdated);
    signalRService.on("OrderStatusUpdated", handleOrderUpdated);

    return () => {
      signalRService.off("NewFoodOrder", handleNewFoodOrder);
      signalRService.off("OrderUpdated", handleOrderUpdated);
      signalRService.off("OrderStatusUpdated", handleOrderUpdated);
    };
  }, [soundEnabled]);

  // Parse local or ISO date safely without 7-hour timezone offset skew
  const getOrderDate = (order) => {
    const rawTime = order.createdAt || order.orderTime || order.updatedAt;
    if (!rawTime) return null;

    const cleanStr = typeof rawTime === 'string' ? rawTime.replace(/Z$/i, '') : rawTime;
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return null;

    return d;
  };

  // Helper function to format order location accurately for Kitchen & Waiter
  // Handles Ô Đất (Camping Slots), Tent setups (e.g. 2 Lều Nhỏ), and Dining Tables
  const formatOrderLocation = (order) => {
    const tent = order?.tent;
    const booking = order?.booking;
    
    const rawZone = tent?.zoneName || tent?.zone?.Name || tent?.zone?.name || "";
    const rawTentName = tent?.name || "";
    const slotCode = tent?.slotCode || rawTentName;
    const zoneType = tent?.zoneType || tent?.zone?.zoneType || "";

    const zoneLower = rawZone.toLowerCase();
    const nameLower = rawTentName.toLowerCase();
    
    const isTable = zoneType === 'DiningTable' ||
      (tent?.tentType && (tent.tentType.toLowerCase().includes('bàn') || tent.tentType.toLowerCase().includes('tiệc'))) ||
      zoneLower.includes("bàn") || zoneLower.includes("ẩm thực") || 
      zoneLower.includes("nhà hàng") || zoneLower.includes("ăn uống") || 
      nameLower.includes("bàn");

    const zoneTitle = rawZone 
      ? (rawZone.startsWith("Khu") ? rawZone : `Khu ${rawZone}`) 
      : (isTable ? "Khu Ẩm Thực" : "Khu Cắm Trại");

    if (isTable) {
      const tableNumber = rawTentName.replace(/^Bàn\s*/i, '');
      const tableTitle = `Bàn ${tableNumber || rawTentName}`;
      return {
        isTable: true,
        zoneTitle,
        primaryTitle: tableTitle,
        secondaryDetail: null,
        badgeText: "BÀN ĂN",
        shortSummary: `${tableTitle} (${zoneTitle})`,
        slotNumber: tableNumber,
        icon: "🍽️"
      };
    }

    // Camping Slot Logic:
    const cleanSlot = (slotCode || rawTentName).replace(/^Ô\s*/i, '').replace(/^Lều\s*/i, '');
    let slotsDisplay = `Ô ${cleanSlot}`;

    // Determine Tent Setup detail:
    let tentSetup = booking?.tentSetupSummary?.trim() || "";
    if (!tentSetup) {
      if (tent?.size === 'Small') tentSetup = "Lều Nhỏ (~3m²)";
      else if (tent?.size === 'Medium') tentSetup = "Lều Trung (~6m²)";
      else if (tent?.size === 'Large') tentSetup = "Lều Lớn (~12m²)";
      else if (tent?.tentType && tent.tentType !== 'Standard') tentSetup = `Lều ${tent.tentType}`;
    }

    return {
      isTable: false,
      zoneTitle,
      primaryTitle: slotsDisplay, // e.g. "Ô 03"
      secondaryDetail: tentSetup || null, // e.g. "2 Lều Nhỏ (1-2 khách)"
      badgeText: "LỀU TRẠI",
      shortSummary: `${slotsDisplay}${tentSetup ? ` • ${tentSetup}` : ''}`,
      icon: "⛺"
    };
  };

  // Aggregate dish items across all pending kitchen orders
  const aggregatedItems = orders.reduce((acc, order) => {
    const itemList = order.orderDetails || order.items || order.details || [];
    const loc = formatOrderLocation(order);

    itemList.forEach(item => {
      const itemName = item.menuItem?.name || item.itemName || item.name || "Món ăn";
      if (!acc[itemName]) {
        acc[itemName] = {
          name: itemName,
          category: item.menuItem?.category || "Food",
          totalQuantity: 0,
          locations: []
        };
      }
      acc[itemName].totalQuantity += (item.quantity || 1);
      
      acc[itemName].locations.push({
        loc,
        qty: item.quantity || 1
      });
    });
    return acc;
  }, {});

  const aggregatedList = Object.values(aggregatedItems).sort((a, b) => b.totalQuantity - a.totalQuantity);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const getElapsedTimeInfo = (order) => {
    const orderDate = getOrderDate(order);
    if (!orderDate) return { minutes: 0, badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold', text: 'Mới nhận' };

    const diffMs = now - orderDate;
    let mins = Math.floor(diffMs / 60000);

    // Auto-correct 7-hour (420 mins) UTC/Local timezone mismatch for orders
    if (mins >= 360 && mins <= 480) {
      mins = Math.max(0, mins - 420);
    } else if (mins < 0) {
      mins = 0;
    }

    if (mins >= 15) {
      return { minutes: mins, badgeColor: 'bg-rose-500 text-white font-black animate-pulse border-rose-600 shadow-md', text: `${mins} phút (CẢNH BÁO TRỄ)` };
    }
    if (mins >= 10) {
      return { minutes: mins, badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 font-bold', text: `${mins} phút` };
    }
    return { minutes: mins, badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold', text: `${mins} phút` };
  };

  // Helper to check if an order belongs to a Table or a Tent
  const isTableOrder = (order) => {
    return formatOrderLocation(order).isTable;
  };

  const filteredOrders = orders.filter(o => {
    if (locationFilter === 'TABLE') return isTableOrder(o);
    if (locationFilter === 'TENT') return !isTableOrder(o);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-800 font-sans flex flex-col selection:bg-[#1B4D3E] selection:text-white">
      {/* KDS TOP NAVIGATION BAR - BRAND COLORED */}
      <header className="bg-white/95 border-b border-[#EBE3D5] px-6 py-4 flex items-center justify-between shadow-xs backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#1B4D3E] text-white flex items-center justify-center font-black shadow-md shadow-[#1B4D3E]/20">
            <ChefHat size={26} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-[#1B4D3E]">Màn Hình Điều Phối Bếp (KDS)</h1>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">Live Real-time</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Tự động phân biệt đơn Khách Bàn Ăn vs Khách Lều</p>
          </div>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center gap-3">
          {/* Mode Switcher Buttons */}
          <div className="bg-[#FAF7F2] p-1 rounded-2xl border border-[#EBE3D5] flex items-center gap-1">
            <button
              onClick={() => setViewMode('orders')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                viewMode === 'orders'
                  ? 'bg-[#1B4D3E] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Grid size={15} />
              Theo Đơn Hàng ({filteredOrders.length})
            </button>

            <button
              onClick={() => setViewMode('summary')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                viewMode === 'summary'
                  ? 'bg-[#1B4D3E] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Layers size={15} />
              Gom Tổng Món ({aggregatedList.length})
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                : 'bg-slate-100 border-slate-300 text-slate-400'
            }`}
            title={soundEnabled ? "Tắt chuông báo" : "Bật chuông báo"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white border border-[#EBE3D5] text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-xs"
            title="Toàn màn hình Tivi"
          >
            <Maximize2 size={18} />
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchKitchenOrders}
            className="p-2.5 rounded-xl bg-white border border-[#EBE3D5] text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-xs"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>

          {/* User Logout */}
          <div className="h-6 w-[1px] bg-slate-300 mx-1"></div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-rose-700 font-bold bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 hover:bg-rose-100 transition-all"
          >
            <LogOut size={15} />
            Đăng xuất
          </button>
        </div>
      </header>

      {/* NEW ORDER REAL-TIME CHIME ALERT BANNER */}
      {newOrderChime && (
        <div className="bg-[#1B4D3E] text-white px-6 py-3 font-black text-center text-sm shadow-md flex items-center justify-center gap-2 animate-bounce">
          <BellRing size={18} className="animate-spin text-amber-300" />
          <span>{typeof newOrderChime === 'string' ? newOrderChime : "CÓ ĐƠN MỚI CẦN CHẾ BIẾN!"}</span>
        </div>
      )}

      {/* LOCATION FILTER SUB-BAR (LỌC THEO BÀN ẨM THỰC VS LỀU CẮM TRẠI) */}
      <div className="bg-white border-b border-[#EBE3D5] px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Lọc Vị Trí:</span>
          {[
            { key: 'ALL', label: `Tất Cả Đơn (${orders.length})` },
            { key: 'TABLE', label: `Bàn Khu Ẩm Thực (${orders.filter(isTableOrder).length})` },
            { key: 'TENT', label: `Ô Đất Cắm Trại (${orders.filter(o => !isTableOrder(o)).length})` }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setLocationFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                locationFilter === f.key
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-bold hidden sm:block">
          Bàn Ăn: <span className="text-amber-700 font-extrabold">{orders.filter(isTableOrder).length}</span> • Ô Cắm Trại: <span className="text-emerald-700 font-extrabold">{orders.filter(o => !isTableOrder(o)).length}</span>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-[#1B4D3E] font-bold animate-pulse text-lg flex items-center gap-3">
              <RefreshCw className="animate-spin" size={24} /> Đang tải danh sách món cần làm...
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          /* EMPTY KITCHEN STATE */
          <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-[#FAF7F2] border-2 border-[#EBE3D5] flex items-center justify-center text-[#1B4D3E] shadow-xs">
              <ChefHat size={48} strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-extrabold text-[#1B4D3E]">Không có đơn hàng nào trong mục này</h3>
              <p className="text-sm text-slate-500 max-w-md">Tất cả món đã chế biến xong hoặc không có đơn theo bộ lọc này.</p>
            </div>
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: ORDER CARDS GRID */}
            {viewMode === 'orders' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredOrders.map((order, index) => {
                  const loc = formatOrderLocation(order);
                  const elapsedTime = getElapsedTimeInfo(order);
                  const itemList = order.orderDetails || order.items || order.details || [];
                  const orderDateObj = getOrderDate(order);
                  const customerName = order.customerName || order.booking?.customerName || "Khách hàng";
                  const phoneNumber = order.phoneNumber || order.booking?.phoneNumber;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl border border-[#EBE3D5] overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[#1B4D3E]/40 transition-all duration-300 relative group"
                    >
                      {/* Order Header & Queue Index */}
                      <div className="bg-[#FAF7F2] p-4 border-b border-[#EBE3D5] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="w-7 h-7 rounded-lg bg-[#1B4D3E] text-white font-black text-xs flex items-center justify-center shadow-2xs">
                              #{index + 1}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              loc.isTable 
                                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}>
                              {loc.icon} {loc.zoneTitle}
                            </span>
                          </div>

                          {/* Live Timer Badge */}
                          <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex-shrink-0 ${elapsedTime.badgeColor}`}>
                            {elapsedTime.text}
                          </div>
                        </div>

                        {/* Large Primary Slot / Table Title */}
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[10px] font-black uppercase text-[#7C5A38] tracking-wider">VỊ TRÍ:</span>
                            <h3 className="text-2xl font-black text-[#1B4D3E] tracking-tight leading-none">
                              {loc.primaryTitle}
                            </h3>
                          </div>

                          {/* Secondary Detail: Tent Setup (e.g. 2 Lều Nhỏ (1-2 khách)) */}
                          {loc.secondaryDetail && (
                            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 text-xs font-black shadow-2xs">
                              <span className="text-base leading-none">⛺</span>
                              <div className="leading-tight">
                                <span className="text-[10px] text-[#7C5A38] block font-bold uppercase tracking-wider">Loại lều:</span>
                                <span className="font-extrabold text-[#1B4D3E] text-xs">{loc.secondaryDetail}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Customer Info Subheader */}
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5 truncate pr-2">
                          <User size={13} className="text-[#1B4D3E] flex-shrink-0" />
                          <span className="truncate">Khách: <strong className="text-slate-800 font-bold">{customerName}</strong> {phoneNumber ? `(${phoneNumber})` : ''}</span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-500 flex-shrink-0">
                          {orderDateObj ? orderDateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                      </div>

                      {/* Order Items List (Font chữ siêu to rõ ràng cho bếp) */}
                      <div className="p-4 flex-1 space-y-3">
                        {itemList.map((item, i) => (
                          <div
                            key={i}
                            className="bg-[#FAF7F2]/80 p-3 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <span className="font-extrabold text-slate-800 text-base leading-snug">
                              {item.menuItem?.name || item.itemName || item.name}
                            </span>
                            <span className="font-black text-xl text-white bg-[#1B4D3E] px-3 py-1 rounded-xl shadow-xs flex-shrink-0">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}

                        {/* Customer Notes */}
                        {order.notes && (
                          <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-900 italic font-medium">
                            📝 Ghi chú: {order.notes}
                          </div>
                        )}
                      </div>

                      {/* Footer Action Buttons for Kitchen */}
                      <div className="p-3 bg-[#FAF7F2] border-t border-[#EBE3D5] space-y-2">
                        {order.status === 'Pending' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleConfirmStartCooking(order.id || order.batchId)}
                              className="py-2.5 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-black text-xs rounded-xl shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-all"
                            >
                              <CheckCircle2 size={15} />
                              Xác Nhận Đơn
                            </button>
                            <button
                              onClick={() => handleOpenRejectModal(order)}
                              className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-1 active:scale-95 transition-all"
                            >
                              <AlertTriangle size={15} />
                              Từ Chối Đơn
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCallWaiter(order.id || order.batchId)}
                            className="w-full py-3 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                          >
                            <BellRing size={16} className="animate-bounce text-amber-300" />
                            Gọi Nhân Viên Chạy Bàn
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 2: AGGREGATED DISH COOKING SUMMARY */}
            {viewMode === 'summary' && (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] flex justify-between items-center shadow-xs">
                  <div>
                    <h3 className="text-lg font-black text-[#1B4D3E] flex items-center gap-2">
                      <Flame className="text-amber-600" size={20} />
                      Bảng Gom Tổng Số Lượng Món Cần Chế Biến
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Tổng hợp từ toàn bộ {orders.length} đơn đang chờ để đầu bếp chế biến theo mẻ lớn</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-[#1B4D3E]">{aggregatedList.length}</span>
                    <span className="text-xs text-slate-500 block uppercase font-bold">Loại Món</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {aggregatedList.map((dish, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-3xl border border-[#EBE3D5] p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-[#7C5A38] tracking-wider block bg-[#F0E6D8] px-2.5 py-0.5 rounded-full border border-amber-200/60 w-max mb-1">
                            {dish.category === 'Food' ? '🍖 Đồ Ăn' : dish.category === 'Drink' ? '🥤 Đồ Uống' : '✨ Dịch Vụ'}
                          </span>
                          <h4 className="text-xl font-extrabold text-slate-800">{dish.name}</h4>
                        </div>
                        <div className="bg-[#1B4D3E] text-amber-300 px-4 py-2 rounded-2xl font-black text-2xl shadow-sm">
                          x{dish.totalQuantity}
                        </div>
                      </div>

                      {/* Location Breakdown */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Phân bổ theo Vị Trí:</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {dish.locations?.map((itemLoc, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs bg-[#FAF7F2] p-2.5 rounded-xl border border-slate-200/60 font-extrabold text-slate-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[#1B4D3E] font-black">{itemLoc.loc.primaryTitle}</span>
                                {itemLoc.loc.secondaryDetail && (
                                  <span className="text-[10px] text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-amber-200/60">
                                    <span>⛺</span>
                                    <span>{itemLoc.loc.secondaryDetail}</span>
                                  </span>
                                )}
                                <span className="text-slate-400 font-semibold text-[10px]">({itemLoc.loc.zoneTitle})</span>
                              </div>
                              <span className="text-[#1B4D3E] font-black text-sm ml-2 flex-shrink-0">x{itemLoc.qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* KITCHEN PRESET REJECTION MODAL */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle size={22} />
                <h3 className="font-extrabold text-base text-slate-800">Từ Chối Đợt Món Này</h3>
              </div>
              <button
                onClick={() => setRejectingOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-500 text-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-semibold">Vui lòng chọn lý do từ chối để phản hồi đến Khách hàng & Lễ tân:</p>

              <div className="space-y-2">
                {presetReasons.map((reason, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      rejectReason === reason
                        ? 'bg-rose-50 border-rose-300 font-bold text-rose-900'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rejectReason"
                      value={reason}
                      checked={rejectReason === reason}
                      onChange={() => setRejectReason(reason)}
                      className="mt-0.5 accent-rose-600"
                    />
                    <span className="text-xs leading-relaxed">{reason}</span>
                  </label>
                ))}
              </div>

              {rejectReason.includes("Lý do khác") && (
                <div>
                  <textarea
                    rows="2"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Nhập lý do chi tiết từ Bếp..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setRejectingOrder(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={submittingReject}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {submittingReject ? "Đang xử lý..." : "Xác Nhận Từ Chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
