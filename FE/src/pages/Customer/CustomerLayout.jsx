import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useSearchParams } from 'react-router-dom';
import { Utensils, Clock, ShoppingBag, Tent, Lock, Info, Loader2 } from 'lucide-react';
import axios from 'axios';

import { getApiUrl } from '../../apiConfig';

export default function CustomerLayout() {
  const [searchParams] = useSearchParams();
  const [tentName, setTentName] = useState('');
  
  // Validation state
  const [isValidating, setIsValidating] = useState(true);
  const [isActivated, setIsActivated] = useState(true);

  // Lifted Cart State
  const [cart, setCart] = useState([]);
  const [tentId, setTentId] = useState(null);

  // Handle URL parameter and session storage for Tent
  useEffect(() => {
    const tentFromUrl = searchParams.get('tent');
    let targetTent = '';
    if (tentFromUrl) {
      targetTent = tentFromUrl;
      setTentName(tentFromUrl);
      sessionStorage.setItem('customerTent', tentFromUrl);
    } else {
      const storedTent = sessionStorage.getItem('customerTent');
      if (storedTent) {
        targetTent = storedTent;
        setTentName(storedTent);
      }
    }

    // Validate QR Activation status with BE
    if (targetTent) {
      setIsValidating(true);
      axios.get(getApiUrl(`/api/Tents/validate?tent=${encodeURIComponent(targetTent)}`))
        .then(res => {
          setIsActivated(res.data.active === true);
          if (res.data.id) {
            setTentId(res.data.id);
            sessionStorage.setItem('customerTentId', res.data.id.toString());
          }
        })
        .catch(err => {
          console.error("Lỗi xác thực QR:", err);
          // If error or not active, default to false
          setIsActivated(false);
        })
        .finally(() => setIsValidating(false));
    } else {
      setIsValidating(false);
    }
  }, [searchParams]);

  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isValidating) {
    return (
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[#F5F5F0] items-center justify-center space-y-3">
        <Loader2 size={36} className="text-[#1B4D3E] animate-spin" />
        <p className="text-xs font-bold text-slate-500">Đang kiểm tra mã QR...</p>
      </div>
    );
  }

  if (!isActivated) {
    const isTableEntity = tentName.toLowerCase().includes("bàn") || tentName.toLowerCase().includes("ẩm thực");
    return (
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[#F5F5F0] p-6 text-center items-center justify-center space-y-6 shadow-2xl border-x border-slate-200/50">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center shadow-xl animate-bounce border-2 border-rose-200">
          <Lock size={38} />
        </div>
        
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold bg-rose-500/10 text-rose-700 px-3 py-1 rounded-full uppercase tracking-wider">
            {isTableEntity ? "Mã QR Bàn Chưa Mở" : "Mã QR Lều Khóa"}
          </span>
          <h2 className="text-2xl font-black text-slate-800">
            {isTableEntity ? "Bàn Chưa Được Mở" : "Lều Chưa Kích Hoạt"}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
            Mã QR của <span className="font-extrabold text-[#1B4D3E]">{tentName}</span> hiện chưa được mở quyền gọi món online.
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-2 shadow-sm text-left w-full">
          <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Info size={16} className="text-amber-500" /> Hướng dẫn mở bàn:
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-600">
            {isTableEntity ? (
              <>
                <li>Vui lòng liên hệ Nhân viên chạy bàn hoặc Lễ Tân để mở bàn.</li>
                <li>Nhân viên sẽ bấm <strong>Mở Bàn {tentName}</strong> trên hệ thống.</li>
                <li>Tải lại trang để bắt đầu gọi món trực tiếp về Bếp.</li>
              </>
            ) : (
              <>
                <li>Vui lòng liên hệ Lễ Tân để làm thủ tục nhận lều.</li>
                <li>Lễ tân sẽ bấm <strong>Kích hoạt (Check-in)</strong> trên hệ thống.</li>
                <li>Quét lại mã QR sau khi được kích hoạt.</li>
              </>
            )}
          </ul>
        </div>

        <button 
          onClick={() => window.location.reload()} 
          className="w-full py-3.5 bg-[#1B4D3E] text-white font-bold rounded-xl shadow-lg shadow-[#1B4D3E]/20 hover:bg-[#153d31] active:scale-95 transition-all"
        >
          Thử Tải Lại Trang
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[#F5F5F0] shadow-2xl relative overflow-hidden font-sans text-slate-800 border-x border-slate-200/50">
      
      {/* Header - Tent QR Scan Mobile Header */}
      <header className="px-5 py-4 bg-[#F5F5F0] z-30 flex items-center justify-between border-b border-slate-200/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1B4D3E]/10 text-[#1B4D3E] flex items-center justify-center font-bold">
            <Tent size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1B4D3E] leading-none" style={{ fontFamily: "'Dancing Script', cursive" }}>Bùi Hui</h1>
            <p className="text-[10px] font-bold text-[#1B4D3E]/80 tracking-[0.2em] uppercase mt-0.5">Camping</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Table / Location Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0E6D8] text-[#6B4E2E] text-xs font-bold shadow-sm border border-[#E6D4BE]">
            <span className="text-sm font-black">{tentName}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-scroll-area" className="flex-1 overflow-y-auto pb-24 bg-[#F5F5F0]">
        <Outlet context={{ cart, setCart, tentName, tentId }} />
      </main>

      {/* Bottom Navigation Bar */}
      <div className="absolute bottom-5 left-0 right-0 px-4 z-40 flex justify-center pointer-events-none">
        <nav className="bg-white/95 backdrop-blur-md px-2.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)] rounded-full border border-slate-200/80 flex items-center gap-2 pointer-events-auto">
          
          <NavLink 
            to="/customer/menu" 
            className={({ isActive }) => 
              `flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 ${
                isActive ? 'bg-[#154133] text-white font-extrabold shadow-md' : 'px-3 text-slate-600 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Utensils size={20} className={isActive ? 'text-white' : 'text-slate-600'} />
                {isActive ? (
                  <span className="text-sm font-bold tracking-wide">Menu</span>
                ) : (
                  <span className="text-xs font-semibold text-slate-600">Menu</span>
                )}
              </>
            )}
          </NavLink>

          <NavLink 
            to="/customer/history" 
            className={({ isActive }) => 
              `flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 ${
                isActive ? 'bg-[#154133] text-white font-extrabold shadow-md' : 'px-4 text-slate-600 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Clock size={20} className={isActive ? 'text-white' : 'text-slate-600'} />
                {isActive ? (
                  <span className="text-sm font-bold tracking-wide">Đã Gọi</span>
                ) : (
                  <span className="text-xs font-semibold text-slate-600">Đã Gọi</span>
                )}
              </>
            )}
          </NavLink>

        </nav>
      </div>

    </div>
  );
}
