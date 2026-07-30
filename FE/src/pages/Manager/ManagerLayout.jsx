import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Utensils, Tent, Settings, LogOut, Map, ConciergeBell, History } from 'lucide-react';

export default function ManagerLayout() {
  const navItems = [
    { path: '/manager/dashboard', icon: <LayoutDashboard size={20} />, label: 'Tổng quan' },
    { path: '/manager/menu', icon: <Utensils size={20} />, label: 'Quản lý Menu' },
    { path: '/manager/facilities', icon: <Map size={20} />, label: 'Khu vực & Lều' },
    { path: '/manager/history', icon: <History size={20} />, label: 'Lịch sử Booking' },
  ];

  return (
    <div className="flex h-screen bg-[#F5F5F0] font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-[#232B28] text-slate-300 flex flex-col shadow-xl z-10">
        <div className="p-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold shadow-inner">
            <Tent size={26} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white leading-none" style={{ fontFamily: "'Dancing Script', cursive" }}>Bùi Hui</h1>
            <p className="text-[10px] font-bold text-emerald-400 tracking-[0.2em] uppercase mt-1">Manager</p>
          </div>
        </div>

        <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#1B4D3E] text-white shadow-md shadow-[#1B4D3E]/30' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-400 font-semibold hover:bg-rose-500/10 transition-colors">
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#F5F5F0]">
        <header className="bg-white/80 backdrop-blur-md border-b border-[#E6E2D8] sticky top-0 z-20 px-8 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-extrabold text-[#1B4D3E]">Cổng Quản Lý Bùi Hui</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B4D3E]/10 flex items-center justify-center text-[#1B4D3E] font-bold">
                AD
              </div>
            </div>
          </div>
        </header>
        
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
