import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { ClipboardList, LifeBuoy, History, Bell, Tent, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function WaiterLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[#F5F5F0] shadow-2xl relative overflow-hidden font-sans text-slate-800 border-x border-[#E6E2D8]">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 px-4 py-3 bg-white/90 backdrop-blur-md shadow-sm border-b border-[#E6E2D8] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold shadow-sm">
            <Tent size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#1B4D3E] leading-tight">
              {user?.fullName || "Nhân Viên Chạy Bàn"}
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 uppercase tracking-wider">
              <MapPin size={10} /> Phụ trách: {user?.assignedZoneName || "Toàn khu"}
            </span>
          </div>
        </div>

        <button 
          onClick={logout}
          className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 hover:bg-rose-100 transition-colors flex items-center gap-1 text-xs font-bold"
          title="Đăng xuất"
        >
          <LogOut size={16} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pt-24 pb-28 bg-[#F5F5F0]">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <div className="absolute bottom-6 w-full px-6 z-40 pointer-events-none">
        <nav className="pointer-events-auto bg-[#232B28] text-slate-400 backdrop-blur-xl flex justify-around items-center py-4 px-2 shadow-xl shadow-slate-900/20 rounded-3xl border border-white/10">
          <NavLink 
            to="/waiter/orders" 
            className={({ isActive }) => `flex flex-col items-center gap-1.5 transition-all duration-300 w-20 ${isActive ? 'text-amber-400 scale-110' : 'hover:text-slate-200'}`}
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <ClipboardList size={22} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">!</span>
                </div>
                <span className="text-[10px] font-semibold tracking-wide">Đơn hàng</span>
              </>
            )}
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
