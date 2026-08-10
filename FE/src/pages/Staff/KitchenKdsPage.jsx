import React, { useState, useEffect } from 'react';
import { ChefHat, Flame, Clock, RefreshCw, Volume2, VolumeX, Maximize2, Layers, Grid, LogOut, CheckCircle2, AlertTriangle, BellRing } from 'lucide-react';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalrService';
import { useAuth } from '../../context/AuthContext';

export default function KitchenKdsPage() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('orders'); // 'orders' | 'summary'
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

  const fetchKitchenOrders = async () => {
    try {
      const res = await fetch(getApiUrl('/api/Orders'));
      const data = await res.json();
      // Filter ONLY orders that are sent to kitchen ('Preparing')
      // Oldest orders first, newest appended at the bottom!
      const kitchenQueue = data
        .filter(o => o.status === 'Preparing')
        .sort((a, b) => new Date(a.orderTime || a.createdAt || 0) - new Date(b.orderTime || b.createdAt || 0));
      setOrders(kitchenQueue);
    } catch (err) {
      console.error("Error fetching kitchen orders:", err);
    } finally {
      setLoading(false);
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

    // Handle UTC string ending with Z or local ISO string
    let d = new Date(typeof rawTime === 'string' && rawTime.endsWith('Z') ? rawTime : rawTime + 'Z');
    if (isNaN(d.getTime())) d = new Date(rawTime);
    if (isNaN(d.getTime())) return null;

    // Calculate diff in minutes
    let diffMins = (now - d) / 60000;
    // If diff is around 420 mins (7 hours), it means date was parsed as UTC instead of local or vice-versa
    if (diffMins > 360 && diffMins < 480) {
      d = new Date(d.getTime() + 7 * 3600 * 1000);
    } else if (diffMins < -360 && diffMins > -480) {
      d = new Date(d.getTime() - 7 * 3600 * 1000);
    }

    return d;
  };

  // Aggregate dish items across all pending kitchen orders
  const aggregatedItems = orders.reduce((acc, order) => {
    const itemList = order.orderDetails || order.items || order.details || [];
    itemList.forEach(item => {
      const itemName = item.menuItem?.name || item.itemName || item.name || "Món ăn";
      if (!acc[itemName]) {
        acc[itemName] = {
          name: itemName,
          category: item.menuItem?.category || "Food",
          totalQuantity: 0,
          tents: []
        };
      }
      acc[itemName].totalQuantity += (item.quantity || 1);
      
      const rawZone = order.tent?.zoneName || order.tent?.zone?.name || "";
      const rawTentName = order.tent?.name || "";
      const zoneLower = rawZone.toLowerCase();
      const nameLower = rawTentName.toLowerCase();
      const isTable = zoneLower.includes("bàn") || zoneLower.includes("ẩm thực") || zoneLower.includes("nhà hàng") || zoneLower.includes("ăn uống") || nameLower.includes("bàn");

      let tentFormatted = rawTentName;
      if (isTable) {
        if (!nameLower.startsWith("bàn")) tentFormatted = `Bàn ${rawTentName}`;
      } else {
        if (!nameLower.startsWith("lều")) tentFormatted = `Lều ${rawTentName}`;
      }

      const zoneFormatted = (rawZone && !rawZone.startsWith("Khu")) ? `Khu ${rawZone}` : rawZone;
      const tentLocation = zoneFormatted ? `${zoneFormatted} - ${tentFormatted}` : tentFormatted;

      acc[itemName].tents.push({
        tent: tentLocation,
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
    if (!orderDate) return { minutes: 0, badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300', text: '⏱️ Mới nhận' };

    const diffMs = Math.max(0, now - orderDate);
    const mins = Math.floor(diffMs / 60000);

    if (mins >= 15) {
      return { minutes: mins, badgeColor: 'bg-rose-500 text-white font-black animate-pulse border-rose-600 shadow-md', text: `⏱️ ${mins} phút (CẢNH BÁO TRỄ)` };
    }
    if (mins >= 10) {
      return { minutes: mins, badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 font-bold', text: `⏱️ ${mins} phút` };
    }
    return { minutes: mins, badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold', text: `⏱️ ${mins} phút` };
  };

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
            <p className="text-xs text-slate-500 font-medium mt-0.5">Bếp rảnh tay 100% • Tự động xếp đơn theo thứ tự thời gian báo bếp</p>
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
              Theo Đơn Hàng ({orders.length})
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
          <span>🔔 {typeof newOrderChime === 'string' ? newOrderChime : "CÓ ĐƠN MỚI CẦN CHẾ BIẾN!"}</span>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-[#1B4D3E] font-bold animate-pulse text-lg flex items-center gap-3">
              <RefreshCw className="animate-spin" size={24} /> Đang tải danh sách món cần làm...
            </div>
          </div>
        ) : orders.length === 0 ? (
          /* EMPTY KITCHEN STATE */
          <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-[#FAF7F2] border-2 border-[#EBE3D5] flex items-center justify-center text-[#1B4D3E] shadow-xs">
              <ChefHat size={48} strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-extrabold text-[#1B4D3E]">Bếp Đang Rảnh Rỗi 🎉</h3>
              <p className="text-sm text-slate-500 max-w-md">Hiện chưa có đơn món mới được báo sang từ Lễ Tân. Đơn mới sẽ tự động nổ chuông và hiện lên tại đây ngay lập tức!</p>
            </div>
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: ORDER CARDS GRID (Xếp theo thứ tự từ cũ đến mới) */}
            {viewMode === 'orders' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {orders.map((order, index) => {
                  const rawZone = order.tent?.zoneName || order.tent?.zone?.name || "";
                  const rawTentName = order.tent?.name || "";
                  const zoneLower = rawZone.toLowerCase();
                  const nameLower = rawTentName.toLowerCase();
                  const isTable = zoneLower.includes("bàn") || zoneLower.includes("ẩm thực") || zoneLower.includes("nhà hàng") || zoneLower.includes("ăn uống") || nameLower.includes("bàn");

                  let tentFormatted = rawTentName;
                  if (isTable) {
                    if (!nameLower.startsWith("bàn")) tentFormatted = `Bàn ${rawTentName}`;
                  } else {
                    if (!nameLower.startsWith("lều")) tentFormatted = `Lều ${rawTentName}`;
                  }

                  const zoneFormatted = (rawZone && !rawZone.startsWith("Khu")) ? `Khu ${rawZone}` : rawZone;
                  const tentLocation = zoneFormatted ? `${zoneFormatted} - ${tentFormatted}` : tentFormatted;

                  const elapsedTime = getElapsedTimeInfo(order);
                  const itemList = order.orderDetails || order.items || order.details || [];
                  const orderDateObj = getOrderDate(order);

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl border border-[#EBE3D5] overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[#1B4D3E]/40 transition-all duration-300 relative group"
                    >
                      {/* Order Header & Queue Index */}
                      <div className="bg-[#FAF7F2] p-4 border-b border-[#EBE3D5] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-[#1B4D3E] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            #{index + 1}
                          </span>
                          <div>
                            <span className="text-[10px] font-black uppercase text-[#7C5A38] tracking-wider block">Vị Trí Giao</span>
                            <h3 className="text-lg font-black text-[#1B4D3E] leading-tight">{tentLocation}</h3>
                          </div>
                        </div>

                        {/* Live Timer Badge */}
                        <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${elapsedTime.badgeColor}`}>
                          {elapsedTime.text}
                        </div>
                      </div>

                      {/* Customer Info Subheader */}
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>Khách: <strong className="text-slate-800 font-bold">{order.customerName || order.booking?.customerName || "Khách tại lều"}</strong></span>
                        <span className="font-mono text-[11px] font-bold">
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

                      {/* Footer Status Indicator */}
                      <div className="p-3 bg-[#FAF7F2] border-t border-[#EBE3D5] text-center">
                        <span className="text-[11px] font-extrabold text-[#7C5A38] flex items-center justify-center gap-1.5 uppercase tracking-wider">
                          <Flame size={14} className="animate-pulse text-amber-600" /> Đang Chờ Bếp Làm • Lễ tân sẽ bấm ra món
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 2: AGGREGATED DISH COOKING SUMMARY (Gom tổng số lượng từng món) */}
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

                      {/* Tents Breakdown */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Phân bổ theo Lều:</span>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {dish.tents.map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs bg-[#FAF7F2] p-2 rounded-xl border border-slate-200/60 font-extrabold text-slate-800">
                              <span>{t.tent}</span>
                              <span className="text-[#1B4D3E] font-black">x{t.qty}</span>
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
    </div>
  );
}
