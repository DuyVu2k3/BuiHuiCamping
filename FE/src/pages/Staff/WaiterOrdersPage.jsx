import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Clock, Flame, Info, BellRing, X, MapPin, User, LogOut } from 'lucide-react';
import signalRService from '../../services/signalrService';
import { getApiUrl } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';

export default function WaiterOrdersPage() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  
  // Reference for audio so we can stop it later
  const alarmAudio = useRef(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch(getApiUrl('/api/Orders'));
      const data = await res.json();
      
      // Filter orders by assigned zone if applicable
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

  useEffect(() => {
    // Request Chrome Web Push Notification permission
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    fetchOrders();

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
    };

    signalRService.on("OrderToWaiter", handleOrderToWaiter);
    signalRService.on("OrderUpdated", handleOrderUpdated);
    signalRService.on("OrderStatusUpdated", handleOrderUpdated);

    return () => {
      signalRService.off("OrderToWaiter", handleOrderToWaiter);
      signalRService.off("OrderUpdated", handleOrderUpdated);
      signalRService.off("OrderStatusUpdated", handleOrderUpdated);
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
              <p className="text-xs text-slate-500 font-bold">Bếp đã làm xong</p>
            </div>
            <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm shadow-rose-500/30">
              {orders.length} Đơn
            </span>
          </div>

          {orders.map(order => {
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
                  onClick={() => completeOrder(order.id)}
                  className="w-full ml-2 py-4 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-black text-lg rounded-2xl shadow-xl shadow-[#1B4D3E]/20 transition-all flex justify-center items-center gap-2 active:scale-95"
                >
                  <CheckCircle2 size={22} />
                  Xác Nhận Đã Giao Xong
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
