import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Flame, Info, ChefHat, BellRing, CreditCard } from 'lucide-react';
import MasterBillModal from './MasterBillModal';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalrService';

export default function ReceptionistOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [selectedBillBooking, setSelectedBillBooking] = useState(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch(getApiUrl('/api/Orders'));
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const playSoundChime = () => {
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

  useEffect(() => {
    fetchOrders();

    const handleNewFoodOrder = (notification) => {
      setNewOrderAlert(notification);
      playSoundChime();
      fetchOrders();
      setTimeout(() => setNewOrderAlert(null), 8000);
    };

    const handleOrderUpdated = () => {
      fetchOrders();
    };

    signalRService.on("NewFoodOrder", handleNewFoodOrder);
    signalRService.on("OrderUpdated", handleOrderUpdated);
    signalRService.on("OrderStatusUpdated", handleOrderUpdated);

    return () => {
      signalRService.off("NewFoodOrder", handleNewFoodOrder);
      signalRService.off("OrderUpdated", handleOrderUpdated);
      signalRService.off("OrderStatusUpdated", handleOrderUpdated);
    };
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(getApiUrl(`/api/Orders/${orderId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStatus)
      });
      if (res.ok) {
        // Optimistic update
        setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'Pending');
  const preparingOrders = orders.filter(o => o.status === 'Preparing');

  const OrderCard = ({ order, isPending }) => {
    const rawZone = order.tent?.zoneName || order.tent?.zone?.name || "";
    const rawTentName = order.tent?.name || "";

    const zoneLower = rawZone.toLowerCase();
    const nameLower = rawTentName.toLowerCase();
    const isTable = zoneLower.includes("bàn") || zoneLower.includes("ẩm thực") || zoneLower.includes("nhà hàng") || zoneLower.includes("ăn uống") || nameLower.includes("bàn");

    let tentNameFormatted = rawTentName;
    if (isTable) {
      if (!nameLower.startsWith("bàn")) {
        tentNameFormatted = `Bàn ${rawTentName}`;
      }
    } else {
      if (!nameLower.startsWith("lều")) {
        tentNameFormatted = `Lều ${rawTentName}`;
      }
    }

    const zoneFormatted = (rawZone && !rawZone.startsWith("Khu")) ? `Khu ${rawZone}` : rawZone;
    const tentLocation = zoneFormatted ? `${zoneFormatted} - ${tentNameFormatted}` : tentNameFormatted;
    
    let customerName = order.booking?.customerName || "Khách hàng";
    if (customerName.startsWith("Khách lều") || customerName.startsWith("Khách Lều")) {
      customerName = "Khách hàng";
    }

    // Helper: Check if order requires Kitchen preparation (Food / Drink vs Services)
    const hasKitchenItems = (order.orderDetails || []).some(detail => {
      const cat = (detail.menuItem?.category || "").toLowerCase();
      if (cat === 'food' || cat === 'drink' || cat === 'đồ ăn' || cat === 'đồ uống') return true;
      if (cat === 'service' || cat === 'dịch vụ') return false;
      const name = (detail.menuItem?.name || "").toLowerCase();
      if (name.includes("bếp than") || name.includes("dịch vụ") || name.includes("thuê") || name.includes("lều") || name.includes("lửa trại")) return false;
      return true;
    });

    return (
      <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all group relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${isPending ? 'bg-rose-500' : 'bg-amber-500'} rounded-l-3xl`}></div>
        
        <div className="flex justify-between items-start mb-3 pl-2">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                <Clock size={12} />
                <span className="text-xs font-bold">
                  {new Date(order.createdAt.endsWith('Z') ? order.createdAt : order.createdAt + 'Z').toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              {hasKitchenItems ? (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                  🍖 Đồ Ăn / Uống
                </span>
              ) : (
                <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                  ✨ Dịch Vụ (Không Qua Bếp)
                </span>
              )}
            </div>
            {/* Line 1: Customer Representative Name */}
            <h3 className="text-base font-black text-[#1B4D3E] tracking-tight">Khách: {customerName}</h3>
            {/* Line 2: Zone & Tent Number */}
            <p className="text-xs font-extrabold text-slate-600 mt-0.5 flex items-center gap-1">
              <span>📍 {tentLocation}</span>
            </p>
          </div>
        </div>

      <div className="flex-1 space-y-2.5 bg-slate-50/50 p-3.5 rounded-2xl mb-4 ml-2 border border-slate-100/60">
        {order.orderDetails?.map(detail => (
          <div key={detail.id} className="flex justify-between items-start border-b border-slate-200/60 pb-2.5 last:border-0 last:pb-0">
            <div className="flex-1 pr-3">
              <p className="font-bold text-slate-700 text-sm leading-tight">{detail.menuItem?.name}</p>
              {detail.note && (
                <p className="text-xs text-rose-500 font-medium italic flex items-center gap-1 mt-1 bg-rose-50/50 p-1 rounded-md border border-rose-100/50">
                  <Info size={12} /> {detail.note}
                </p>
              )}
            </div>
            <span className="font-black text-sm text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-sm">
              x{detail.quantity}
            </span>
          </div>
        ))}
      </div>

      <div className="ml-2 mt-auto">
        {hasKitchenItems ? (
          /* Orders with Food/Drink require sending to Kitchen first */
          isPending ? (
            <button 
              onClick={() => updateStatus(order.id, 'Preparing')}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/20 transition-all active:scale-95 flex justify-center items-center gap-2"
            >
              <ChefHat size={18} />
              Đã Báo Bếp
            </button>
          ) : (
            <button 
              onClick={() => updateStatus(order.id, 'Ready')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex justify-center items-center gap-2"
            >
              <BellRing size={18} className="animate-wiggle" />
              Gọi Chạy Bàn / Ra Món
            </button>
          )
        ) : (
          /* Service-only Orders (e.g. Bếp Than, Thuê Lều) skip Kitchen and directly call Waiter */
          <button 
            onClick={() => updateStatus(order.id, 'Ready')}
            className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-2xl shadow-lg shadow-sky-700/20 transition-all active:scale-95 flex justify-center items-center gap-2"
          >
            <BellRing size={18} />
            Gọi Chạy Bàn (Giao Dịch Vụ)
          </button>
        )}
      </div>
    </div>
  );
};

  return (
    <div className="p-8 max-w-7xl mx-auto h-[100dvh] flex flex-col relative">
      
      {/* Toast Alert */}
      {newOrderAlert && (
        <div className="absolute top-8 right-8 bg-rose-500 text-white p-5 rounded-2xl shadow-2xl shadow-rose-500/40 flex items-center gap-4 z-50 animate-in slide-in-from-right-10 fade-in duration-300 min-w-[300px]">
          <Flame size={32} className="animate-pulse flex-shrink-0" />
          <div>
            <p className="font-bold text-lg leading-tight">{newOrderAlert.tentName} ĐẶT MÓN!</p>
            <p className="text-sm opacity-90">{newOrderAlert.customerName}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Điều phối Bếp</h1>
          <p className="text-slate-500 font-medium mt-1">Tiếp nhận đơn và điều phối nhà bếp - chạy bàn</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-bold text-slate-700">Đang trực Order</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-400 font-bold animate-pulse">Đang tải dữ liệu...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden pb-4">
          
          {/* Column 1: Đơn Mới (Pending) */}
          <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-200/60 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Flame size={18} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Đơn Mới</h2>
              </div>
              <span className="bg-rose-500 text-white font-extrabold text-xs px-2.5 py-1 rounded-full">
                {pendingOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {pendingOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 rounded-3xl">
                  Chưa có đơn hàng mới nào
                </div>
              ) : (
                pendingOrders.map(order => (
                  <OrderCard key={order.id} order={order} isPending={true} />
                ))
              )}
            </div>
          </div>

          {/* Column 2: Đang Làm Bếp (Preparing) */}
          <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-200/60 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                  <ChefHat size={18} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Đang làm Bếp</h2>
              </div>
              <span className="bg-amber-500 text-white font-extrabold text-xs px-2.5 py-1 rounded-full">
                {preparingOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {preparingOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 rounded-3xl">
                  Bếp đang rảnh
                </div>
              ) : (
                preparingOrders.map(order => (
                  <OrderCard key={order.id} order={order} isPending={false} />
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
