import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { CheckCircle2, Clock, Flame, Info, BellRing, X } from 'lucide-react';

export default function WaiterOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  
  // Reference for audio so we can stop it later
  const alarmAudio = useRef(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch('https://localhost:7248/api/Orders');
      const data = await res.json();
      setOrders(data.filter(o => o.status === 'Ready'));
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
      .then(() => console.log("Connected to OrderHub (Waiter)"))
      .catch(err => console.error("SignalR Connection Error: ", err));

    connection.on("OrderToWaiter", (notification) => {
      setNewOrderAlert(notification);
      
      try {
        if (!alarmAudio.current) {
          // Changed to a softer bell sound and lower volume
          alarmAudio.current = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
          alarmAudio.current.volume = 0.4;
          alarmAudio.current.loop = true; // Keep ringing until waiter acknowledges
        }
        alarmAudio.current.play().catch(e => console.log("Audio play blocked by browser"));
      } catch (e) {}

      fetchOrders();
    });
    
    connection.on("OrderStatusUpdated", () => {
      fetchOrders();
    });

    return () => {
      connection.stop();
      if (alarmAudio.current) {
        alarmAudio.current.pause();
      }
    };
  }, []);

  const dismissAlert = () => {
    setNewOrderAlert(null);
    if (alarmAudio.current) {
      alarmAudio.current.pause();
      alarmAudio.current.currentTime = 0;
    }
  };

  const completeOrder = async (orderId) => {
    try {
      const res = await fetch(`https://localhost:7248/api/Orders/${orderId}/status`, {
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

  if (loading) return <div className="p-6 text-center text-slate-500 animate-pulse">Đang đồng bộ đơn hàng...</div>;

  return (
    <div className="p-4 space-y-4 pb-12 relative h-full">
      
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

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[70vh] opacity-50">
          <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-600">Tuyệt vời!</h2>
          <p className="text-slate-500 font-medium text-center px-4">Tất cả món đã được giao, hoặc Bếp chưa làm xong.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-between items-end mb-2 px-2">
            <div>
              <h2 className="text-xl font-black text-slate-800">Cần Giao Gấp</h2>
              <p className="text-xs text-slate-500 font-bold">Lễ tân vừa gọi</p>
            </div>
            <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm shadow-rose-500/30">
              {orders.length} Đơn
            </span>
          </div>

          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden group active:scale-[0.98] transition-all">
              
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-l-3xl"></div>
              
              <div className="flex justify-between items-start mb-4 pl-2">
                <div>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight">{order.tent?.name}</h3>
                  <p className="text-sm text-slate-500 font-semibold mt-1">Khách: {order.booking?.customerName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                    <Clock size={12} />
                    <span className="text-xs font-bold">
                      {new Date(order.createdAt.endsWith('Z') ? order.createdAt : order.createdAt + 'Z').toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl mb-5 ml-2 border border-slate-200/50">
                {order.orderDetails?.map(detail => (
                  <div key={detail.id} className="flex justify-between items-center border-b border-slate-200/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex-1 pr-3">
                      <p className="font-bold text-slate-700 text-sm leading-tight">{detail.menuItem?.name}</p>
                      {detail.note && (
                        <p className="text-xs text-rose-500 font-medium italic mt-1 bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                          {detail.note}
                        </p>
                      )}
                    </div>
                    <span className="font-black text-lg text-emerald-700 bg-emerald-100/80 w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border border-emerald-200/50">
                      x{detail.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => completeOrder(order.id)}
                className="w-full ml-2 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg rounded-2xl shadow-xl shadow-slate-900/30 transition-all flex justify-center items-center gap-2"
              >
                <CheckCircle2 size={24} />
                Đã Giao Xong
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
