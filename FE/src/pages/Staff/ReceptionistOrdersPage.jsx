import React, { useState, useEffect } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { CheckCircle2, Clock, Flame, Info, ChefHat, BellRing } from 'lucide-react';

export default function ReceptionistOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch('https://localhost:7248/api/Orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const connection = new HubConnectionBuilder()
      .withUrl("https://localhost:7248/orderHub")
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    connection.start()
      .then(() => console.log("Connected to OrderHub (Receptionist)"))
      .catch(err => console.error("SignalR Connection Error: ", err));

    connection.on("ReceiveOrder", (notification) => {
      setNewOrderAlert(notification);
      try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log("Audio play blocked"));
      } catch (e) {}

      fetchOrders();
      setTimeout(() => setNewOrderAlert(null), 8000);
    });

    connection.on("OrderStatusUpdated", () => {
      // Refresh list if other receptionists or waiters update an order
      fetchOrders();
    });

    return () => {
      connection.stop();
    };
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`https://localhost:7248/api/Orders/${orderId}/status`, {
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
    const tentNameFormatted = rawTentName.startsWith("Lều") ? rawTentName : `Lều ${rawTentName}`;
    const zoneFormatted = (rawZone && !rawZone.startsWith("Khu")) ? `Khu ${rawZone}` : rawZone;
    
    // Combine Zone and Tent (e.g. "Khu B - Lều 2" or "Lều 2")
    const tentLocation = zoneFormatted ? `${zoneFormatted} - ${tentNameFormatted}` : tentNameFormatted;
    
    const rawCustomerName = order.booking?.customerName || "";
    let customerNameClean = rawCustomerName;
    if (customerNameClean.startsWith("Khách lều")) {
      const parts = customerNameClean.replace("Khách lều", "").trim(); // e.g. "Khu B.2"
      if (parts) {
        const dotParts = parts.split('.');
        const zoneStr = dotParts[0];
        const tentStr = dotParts.length > 1 ? dotParts[1] : dotParts[0];
        const formattedZone = zoneStr.startsWith("Khu") ? zoneStr : `Khu ${zoneStr}`;
        const formattedTent = tentStr.startsWith("Lều") ? tentStr : `Lều ${tentStr}`;
        customerNameClean = `${formattedZone} - ${formattedTent}`;
      }
    }

    let titleText = `Khách: ${tentLocation}`;
    if (customerNameClean && customerNameClean !== tentLocation && customerNameClean !== rawTentName && !customerNameClean.includes(rawTentName)) {
      titleText = `Khách: ${customerNameClean} (${tentLocation})`;
    } else if (customerNameClean && customerNameClean.includes("Khu")) {
      titleText = `Khách: ${customerNameClean}`;
    }

    return (
      <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all group relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${isPending ? 'bg-rose-500' : 'bg-amber-500'} rounded-l-3xl`}></div>
        
        <div className="flex justify-between items-start mb-3 pl-2">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2 py-1 rounded-lg mb-2">
              <Clock size={12} />
              <span className="text-xs font-bold">
                {new Date(order.createdAt.endsWith('Z') ? order.createdAt : order.createdAt + 'Z').toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
            <h3 className="text-base font-black text-[#1B4D3E] tracking-tight">{titleText}</h3>
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
        {isPending ? (
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
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex justify-center items-center gap-2"
          >
            <BellRing size={18} className="animate-wiggle" />
            Gọi Chạy Bàn
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
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden pb-10">
          
          {/* Column 1: Mới Đặt */}
          <div className="bg-[#FAF7F2] rounded-3xl p-6 flex flex-col border border-[#E6E2D8] overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center shadow-sm">
                  <Flame size={20} />
                </div>
                <h2 className="text-xl font-black text-slate-800">Đơn Mới</h2>
              </div>
              <span className="bg-rose-500 text-white font-bold px-3 py-1 rounded-full shadow-sm">{pendingOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {pendingOrders.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 rounded-3xl">
                  Chưa có đơn mới
                </div>
              ) : (
                pendingOrders.map(order => <OrderCard key={order.id} order={order} isPending={true} />)
              )}
            </div>
          </div>

          {/* Column 2: Đang Nấu */}
          <div className="bg-amber-50/50 rounded-3xl p-6 flex flex-col border border-amber-100/50 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                  <ChefHat size={20} />
                </div>
                <h2 className="text-xl font-black text-slate-800">Đang làm Bếp</h2>
              </div>
              <span className="bg-amber-500 text-white font-bold px-3 py-1 rounded-full shadow-sm">{preparingOrders.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {preparingOrders.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 rounded-3xl">
                  Bếp đang rảnh
                </div>
              ) : (
                preparingOrders.map(order => <OrderCard key={order.id} order={order} isPending={false} />)
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
