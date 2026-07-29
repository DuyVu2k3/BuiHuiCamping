import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Tent, ClipboardList, Bell, X, CheckCheck, Trash2, Info, Sparkles, Calendar, CreditCard } from 'lucide-react';
import signalRService from '../../services/signalrService';
import MasterBillModal from './MasterBillModal';

export default function ReceptionistLayout() {
  const navigate = useNavigate();
  const [selectedBillTent, setSelectedBillTent] = useState(null);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Hệ Thống Bùi Hui Sẵn Sàng",
      message: "Hệ thống Lễ tân đang lắng nghe thông báo đơn đặt lều & trả lều real-time.",
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isRead: true,
      type: "system"
    }
  ]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    signalRService.startConnection();

    const handleNewBookingRequest = (data) => {
      const customer = data?.customerName || data?.CustomerName || 'Khách hàng';
      const phone = data?.phoneNumber || data?.PhoneNumber || '';
      const tents = data?.tentsList || data?.TentsList || 'Lều';
      const checkIn = data?.checkInDate || data?.CheckInDate;
      const checkOut = data?.checkOutDate || data?.CheckOutDate;

      let dateRangeStr = '';
      if (checkIn && checkOut) {
        const inStr = new Date(checkIn).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
        const outStr = new Date(checkOut).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
        dateRangeStr = `\n📅 Lịch ở: ${inStr} ➔ ${outStr}`;
      }

      const newNotif = {
        id: Date.now(),
        title: "⚡ YÊU CẦU ĐẶT LỀU MỚI",
        message: `Khách: ${customer} (${phone})\nLều chọn: ${tents}${dateRangeStr}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        type: "booking",
        rawCheckIn: checkIn,
        rawCheckOut: checkOut
      };

      setNotifications(prev => [newNotif, ...prev]);
    };

    const handleCheckoutRequested = (tentName) => {
      const newNotif = {
        id: Date.now(),
        title: "💳 YÊU CẦU TRẢ LỀU & THANH TOÁN",
        message: `Khách tại ${tentName} vừa báo trả lều và thanh toán master bill!`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        type: "checkout",
        tentName: tentName
      };

      setNotifications(prev => [newNotif, ...prev]);
    };

    const handleNewFoodOrder = (data) => {
      const tent = data?.tentName || data?.TentName || "Lều";
      const customer = data?.customerName || data?.CustomerName || "Khách";
      const summary = data?.itemsSummary || data?.Message || "Đã gọi đồ ăn/uống";

      const newNotif = {
        id: Date.now(),
        title: "🍔 ĐƠN GỌI MÓN MỚI TẠI LỀU!",
        message: `Lều ${tent} (${customer})\nMón gọi: ${summary}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        type: "order"
      };

      setNotifications(prev => [newNotif, ...prev]);
    };

    signalRService.on("NewBookingRequest", handleNewBookingRequest);
    signalRService.on("CheckoutRequested", handleCheckoutRequested);
    signalRService.on("NewFoodOrder", handleNewFoodOrder);

    return () => {
      signalRService.off("NewBookingRequest", handleNewBookingRequest);
      signalRService.off("CheckoutRequested", handleCheckoutRequested);
      signalRService.off("NewFoodOrder", handleNewFoodOrder);
    };
  }, []);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const handleNotifClick = (notif) => {
    markAsRead(notif.id);
    if (notif.type === 'booking' && notif.rawCheckIn && notif.rawCheckOut) {
      const inDate = new Date(notif.rawCheckIn).toISOString().split('T')[0];
      const outDate = new Date(notif.rawCheckOut).toISOString().split('T')[0];
      const inTime = new Date(notif.rawCheckIn).toTimeString().substring(0, 5);
      const outTime = new Date(notif.rawCheckOut).toTimeString().substring(0, 5);

      navigate(`/receptionist/booking?checkIn=${inDate}&checkOut=${outDate}&checkInTime=${inTime}&checkOutTime=${outTime}`);
    } else if (notif.type === 'checkout') {
      navigate('/receptionist/booking');
    }
    setIsNotifOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#F5F5F0] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#232B28] text-slate-300 flex flex-col shadow-xl z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold shadow-inner">
            <Tent size={26} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white leading-none" style={{ fontFamily: "'Dancing Script', cursive" }}>Bùi Hui</h1>
            <p className="text-[10px] font-bold text-emerald-400 tracking-[0.2em] uppercase mt-1">Reception</p>
          </div>
        </div>
        <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
          <NavLink to="/receptionist/booking" className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 ${
              isActive 
                ? 'bg-[#1B4D3E] text-white shadow-md shadow-[#1B4D3E]/30' 
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }>
            <Tent size={20} />
            <span>Sơ đồ lều (Booking)</span>
          </NavLink>
          <NavLink to="/receptionist/orders" className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 ${
              isActive 
                ? 'bg-[#1B4D3E] text-white shadow-md shadow-[#1B4D3E]/30' 
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }>
            <ClipboardList size={20} />
            <span>Điều phối đơn hàng</span>
          </NavLink>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold text-sm">L</div>
            <div>
              <p className="text-sm font-semibold text-white">Lễ Tân Bùi Hui</p>
              <p className="text-xs text-emerald-400 font-bold">🟢 Đang trực</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F5F5F0]">
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-[#E6E2D8] flex items-center justify-between px-8 shadow-sm z-30 relative">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-[#1B4D3E]">Lễ Tân Bùi Hui Camping</h1>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-3 py-0.5 rounded-full border border-emerald-300/60">
              Live Real-time
            </span>
          </div>

          {/* Interactive Bell Notification Button & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative p-2.5 rounded-2xl transition-all ${
                isNotifOpen ? 'bg-slate-100 text-[#1B4D3E]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Panel Header */}
                <div className="bg-[#1B4D3E] text-white p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={18} className="text-amber-300" />
                    <h3 className="font-extrabold text-sm tracking-wide">
                      Thông Báo Mới {unreadCount > 0 && `(${unreadCount} chưa đọc)`}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-emerald-200 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors"
                        title="Đánh dấu tất cả là đã đọc"
                      >
                        <CheckCheck size={14} /> Đã đọc hết
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button 
                        onClick={clearAllNotifications}
                        className="text-slate-300 hover:text-rose-300 p-1 rounded-lg transition-colors"
                        title="Xóa tất cả"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <Bell size={32} className="mx-auto text-slate-300" />
                      <p className="text-xs font-bold">Chưa có thông báo mới nào</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const isBookingRequest = notif.type === 'booking';
                      const isCheckout = notif.type === 'checkout';

                      return (
                        <div 
                          key={notif.id}
                          onClick={() => {
                            markAsRead(notif.id);
                            if (notif.type === "checkout" || notif.type === "order") {
                              setSelectedBillTent(notif.tentName || "");
                              setIsNotifOpen(false);
                            }
                          }}
                          className={`p-3.5 rounded-2xl transition-all cursor-pointer border relative ${
                            !notif.isRead 
                              ? isBookingRequest
                                ? 'bg-amber-50/70 border-amber-200/80 shadow-sm'
                                : isCheckout
                                ? 'bg-rose-50/70 border-rose-200/80 shadow-sm'
                                : 'bg-emerald-50/50 border-emerald-200/60 shadow-sm' 
                              : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isBookingRequest ? (
                                <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
                              ) : isCheckout ? (
                                <CreditCard size={16} className="text-rose-600 shrink-0 mt-0.5" />
                              ) : (
                                <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                              )}
                              <h4 className={`text-xs font-extrabold ${
                                !notif.isRead ? 'text-slate-900' : 'text-slate-600'
                              }`}>
                                {notif.title}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                              {notif.time}
                            </span>
                          </div>

                          <p className="text-xs font-medium text-slate-700 mt-1.5 whitespace-pre-line leading-relaxed pl-6">
                            {notif.message}
                          </p>

                          {!notif.isRead && (
                            <span className="absolute right-3 bottom-3 w-2 h-2 rounded-full bg-amber-500"></span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Bấm thông báo để tự động xem Master Bill & Thanh toán
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-[#F5F5F0] p-8">
          <Outlet />
        </div>
      </main>

      <MasterBillModal 
        isOpen={!!selectedBillTent}
        onClose={() => setSelectedBillTent(null)}
        tentName={selectedBillTent}
      />
    </div>
  );
}
