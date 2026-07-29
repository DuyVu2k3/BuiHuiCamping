import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Users, Tent, DollarSign, Activity, Utensils, Coffee, Map } from 'lucide-react';

export default function ManagerDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('https://localhost:7248/api/Dashboard/stats');
        setStats(res.data);
      } catch (error) {
        console.error("Lỗi khi tải thống kê:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center animate-pulse text-emerald-600 mt-20">
          <Activity size={48} className="mb-4 animate-bounce" />
          <p className="font-bold">Đang tải dữ liệu hệ thống...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-center text-rose-500 font-bold mt-20">Không thể kết nối đến máy chủ.</div>;
  }

  const { totalBookings, activeTents, totalRevenue, totalOrders, categoryRevenue, recentOrders } = stats;

  const totalCatRevenue = categoryRevenue.food + categoryRevenue.drink + categoryRevenue.service;
  const foodPct = totalCatRevenue ? (categoryRevenue.food / totalCatRevenue) * 100 : 0;
  const drinkPct = totalCatRevenue ? (categoryRevenue.drink / totalCatRevenue) * 100 : 0;
  const servicePct = totalCatRevenue ? (categoryRevenue.service / totalCatRevenue) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Tổng Quan Hệ Thống</h1>
        <p className="text-slate-500 mt-1 font-medium">Theo dõi các chỉ số quan trọng của khu cắm trại Bùi Hui.</p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <DollarSign size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingUp size={12} /> Live
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tổng Doanh Thu</p>
            <h2 className="text-3xl font-black text-slate-800 mt-1">{totalRevenue.toLocaleString('vi-VN')} đ</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users size={24} strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tổng Lượt Khách</p>
            <h2 className="text-3xl font-black text-slate-800 mt-1">{totalBookings}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Tent size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Live
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Lều Đang Hoạt Động</p>
            <h2 className="text-3xl font-black text-slate-800 mt-1">{activeTents}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Activity size={24} strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tổng Hóa Đơn</p>
            <h2 className="text-3xl font-black text-slate-800 mt-1">{totalOrders}</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Percentage Chart (Native UI) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Cơ Cấu Doanh Thu</h3>
          
          <div className="h-12 w-full rounded-full flex overflow-hidden shadow-inner mb-6">
            <div style={{ width: `${foodPct}%` }} className="bg-rose-400 hover:brightness-110 transition-all flex items-center justify-center"></div>
            <div style={{ width: `${drinkPct}%` }} className="bg-sky-400 hover:brightness-110 transition-all flex items-center justify-center"></div>
            <div style={{ width: `${servicePct}%` }} className="bg-amber-400 hover:brightness-110 transition-all flex items-center justify-center"></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-rose-400"></span>
                <span className="font-bold text-slate-600 text-sm">Đồ Ăn</span>
              </div>
              <Utensils size={24} className="text-slate-300 mb-2" />
              <p className="text-lg font-black text-slate-800">{foodPct.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 font-semibold">{categoryRevenue.food.toLocaleString()}đ</p>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-sky-400"></span>
                <span className="font-bold text-slate-600 text-sm">Đồ Uống</span>
              </div>
              <Coffee size={24} className="text-slate-300 mb-2" />
              <p className="text-lg font-black text-slate-800">{drinkPct.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 font-semibold">{categoryRevenue.drink.toLocaleString()}đ</p>
            </div>

            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                <span className="font-bold text-slate-600 text-sm">Dịch Vụ</span>
              </div>
              <Map size={24} className="text-slate-300 mb-2" />
              <p className="text-lg font-black text-slate-800">{servicePct.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 font-semibold">{categoryRevenue.service.toLocaleString()}đ</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-8 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Hoạt Động Gần Đây</h3>
          <div className="flex-1 space-y-4">
            {recentOrders && recentOrders.length > 0 ? recentOrders.map(order => (
              <div key={order.id} className="flex justify-between items-center p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 cursor-default">
                <div>
                  <p className="font-bold text-slate-800 text-sm">Hóa đơn #{order.id}</p>
                  <p className="text-xs text-slate-500 font-medium">{order.customerName} - Lều: {order.tentName}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-emerald-600 text-sm">{order.totalAmount.toLocaleString()}đ</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${order.status === 'Completed' || order.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400 text-center mt-10 italic">Chưa có giao dịch nào.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
