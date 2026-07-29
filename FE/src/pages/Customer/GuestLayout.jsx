import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Tent, Info, Compass, Utensils, Phone, MapPin } from 'lucide-react';

export default function GuestLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#F5F5F0] font-sans text-slate-800 selection:bg-emerald-500 selection:text-white">
      {/* Header for Guest Portal */}
      <header className="sticky top-0 z-40 bg-[#F5F5F0]/90 backdrop-blur-md border-b border-slate-200/60 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-4">
          {/* Logo */}
          <div 
            onClick={() => navigate('/guest/intro')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold shadow-md group-hover:scale-105 transition-transform">
              <Tent size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#1B4D3E] leading-none tracking-tight" style={{ fontFamily: "'Dancing Script', cursive" }}>
                Bùi Hui
              </h1>
              <p className="text-[10px] font-bold text-[#1B4D3E]/80 tracking-[0.25em] uppercase mt-0.5">Camping Portal</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="flex items-center gap-2">
            <NavLink 
              to="/guest/intro" 
              className={({ isActive }) => 
                `px-5 py-2.5 rounded-full font-extrabold text-xs flex items-center gap-2 transition-all ${
                  isActive ? 'bg-[#1B4D3E] text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <Info size={16} />
              Giới Thiệu
            </NavLink>

            <NavLink 
              to="/guest/booking" 
              className={({ isActive }) => 
                `px-5 py-2.5 rounded-full font-extrabold text-xs flex items-center gap-2 transition-all ${
                  isActive ? 'bg-[#1B4D3E] text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <Compass size={16} />
              Đặt Lều Online (Map)
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
}
