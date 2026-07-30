import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, Calendar, MapPin, Tent, User, Phone, CreditCard, RefreshCw, CheckCircle2, Clock, XCircle, AlertCircle, FileSpreadsheet, ShieldCheck, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl } from '../../apiConfig';
import MasterBillModal from '../Staff/MasterBillModal';

export default function BookingHistoryPage({ userRole = 'receptionist' }) {
  const [historyData, setHistoryData] = useState([]);
  const [zones, setZones] = useState([]);
  const [tents, setTents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchKw, setSearchKw] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedTent, setSelectedTent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Master Bill Modal State
  const [selectedBillBooking, setSelectedBillBooking] = useState(null);

  const fetchFiltersOptions = async () => {
    try {
      const [zRes, tRes] = await Promise.all([
        axios.get(getApiUrl('/api/Zones')),
        axios.get(getApiUrl('/api/Tents'))
      ]);
      setZones(zRes.data);
      setTents(tRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKw) params.append('search', searchKw);
      if (selectedZone) params.append('zoneId', selectedZone);
      if (selectedTent) params.append('tentId', selectedTent);
      if (selectedStatus && selectedStatus !== 'All') params.append('status', selectedStatus);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const res = await axios.get(getApiUrl(`/api/Bookings/history?${params.toString()}`));
      setHistoryData(res.data);
    } catch (err) {
      console.error("Lỗi tải lịch sử booking:", err);
      toast.error("Không thể tải lịch sử đơn đặt lều.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersOptions();
    fetchHistory();
  }, []);

  const handleResetFilters = () => {
    setSearchKw('');
    setSelectedZone('');
    setSelectedTent('');
    setSelectedStatus('All');
    setFromDate('');
    setToDate('');
    setTimeout(() => {
      axios.get(getApiUrl('/api/Bookings/history')).then(res => setHistoryData(res.data));
    }, 100);
  };

  // Stats calculation
  const totalBookings = historyData.length;
  const completedCount = historyData.filter(b => b.status === 'CheckedOut').length;
  const occupiedCount = historyData.filter(b => b.status === 'Occupied').length;
  const totalRevenue = historyData.filter(b => b.status === 'CheckedOut' || b.status === 'Occupied').reduce((sum, b) => sum + (b.grandTotal || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CheckedOut':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs border border-emerald-300">✓ Đã Trả Lều & Thanh Toán</span>;
      case 'Occupied':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-sky-100 text-sky-800 rounded-full font-bold text-xs border border-sky-300">🟢 Đang Ở</span>;
      case 'Booked':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-bold text-xs border border-purple-300">📅 Đã Chốt Đặt</span>;
      case 'Pending':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-xs border border-amber-300">⏳ Chờ Xử Lý</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-xs border border-rose-300">❌ Đã Hủy</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-bold text-xs border border-slate-300">{status}</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="text-[#1B4D3E]" size={32} />
            Lịch Sử Booking Trải Nghiệm
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Tra cứu và quản lý lịch sử đơn đặt lều, chi phí & hóa đơn Master Bill
          </p>
        </div>

        <button
          onClick={fetchHistory}
          className="self-start md:self-auto px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl shadow-xs flex items-center gap-2 text-xs transition-all active:scale-95"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Làm Mới Dữ Liệu
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TỔNG SỐ ĐƠN</p>
          <p className="text-2xl font-black text-slate-800">{totalBookings}</p>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-sm space-y-1">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">ĐÃ TRẢ LỀU (DONE)</p>
          <p className="text-2xl font-black text-emerald-800">{completedCount}</p>
        </div>

        <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200/80 shadow-sm space-y-1">
          <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">ĐANG Ở TẠI LỀU</p>
          <p className="text-2xl font-black text-sky-800">{occupiedCount}</p>
        </div>

        <div className="bg-[#1B4D3E] text-white p-4 rounded-2xl shadow-md space-y-1">
          <p className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">TỔNG DOANH THU</p>
          <p className="text-xl font-black">{totalRevenue.toLocaleString('vi-VN')}đ</p>
        </div>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
            <Filter size={16} className="text-[#1B4D3E]" /> Bộ Lọc Tìm Kiếm Nâng Cao
          </span>
          <button
            onClick={handleResetFilters}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
          >
            Xóa Bộ Lọc
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Search Box */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tên khách, SĐT, tên lều..."
              value={searchKw}
              onChange={(e) => setSearchKw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          {/* Zone Select */}
          <div>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-[#1B4D3E]"
            >
              <option value="">Tất cả Khu Vực</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>

          {/* Tent Select */}
          <div>
            <select
              value={selectedTent}
              onChange={(e) => setSelectedTent(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-[#1B4D3E]"
            >
              <option value="">Tất cả Lều</option>
              {tents.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.zone?.name || 'Khu cắm trại'})</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-[#1B4D3E]"
            >
              <option value="All">Tất cả Trạng Thái</option>
              <option value="CheckedOut">✓ Đã Trả Lều (CheckedOut)</option>
              <option value="Occupied">🟢 Đang Ở (Occupied)</option>
              <option value="Booked">📅 Đã Đặt (Booked)</option>
              <option value="Pending">⏳ Chờ Xử Lý (Pending)</option>
              <option value="Cancelled">❌ Đã Hủy (Cancelled)</option>
            </select>
          </div>

          {/* From Date */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">Từ ngày:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">Đến ngày:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          {/* Apply Button */}
          <div className="sm:col-span-2 lg:col-span-2">
            <button
              onClick={fetchHistory}
              className="w-full py-2.5 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-bold rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <Search size={15} />
              Áp Dụng Lọc Tìm Kiếm
            </button>
          </div>

        </div>
      </div>

      {/* Bookings List Cards & Table */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white py-16 rounded-3xl border border-slate-200 text-center space-y-3">
            <RefreshCw size={32} className="mx-auto text-[#1B4D3E] animate-spin" />
            <p className="text-xs font-bold text-slate-500">Đang tải lịch sử Booking...</p>
          </div>
        ) : historyData.length === 0 ? (
          <div className="bg-white py-16 rounded-3xl border border-slate-200 text-center space-y-3">
            <AlertCircle size={40} className="mx-auto text-amber-500" />
            <p className="text-sm font-bold text-slate-700">Không tìm thấy đơn đặt lều nào phù hợp với bộ lọc.</p>
          </div>
        ) : (
          historyData.map(item => (
            <div key={item.id} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all space-y-4">
              
              {/* Card Top Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                    #BK-{item.id}
                  </span>
                  {getStatusBadge(item.status)}
                </div>

                <span className="text-[11px] font-bold text-slate-400">
                  🕒 Thời gian tạo: {new Date(item.bookingTime || item.checkInDate).toLocaleString('vi-VN')}
                </span>
              </div>

              {/* Card Main Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                
                {/* Col 1: Customer */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thông Tin Khách Hàng</p>
                  <p className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                    <User size={15} className="text-[#1B4D3E]" /> {item.customerName || "Khách Vãng Lai"}
                  </p>
                  <p className="font-bold text-slate-600 flex items-center gap-1.5">
                    <Phone size={14} className="text-[#1B4D3E]" /> {item.phoneNumber || "Chưa có SĐT"}
                  </p>
                </div>

                {/* Col 2: Tent & Stay */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lều & Lịch Trải Nghiệm</p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-[#1B4D3E] font-bold rounded-lg border border-emerald-200/60">
                    <MapPin size={13} /> {item.locationName} {item.tentsCount > 1 ? `(${item.tentsCount} Lều)` : ''}
                  </div>

                  {item.checkInDate && (
                    <p className="font-semibold text-slate-600 flex items-center gap-1.5">
                      <Calendar size={14} className="text-[#1B4D3E]" /> Check-in: {new Date(item.checkInDate).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>

                {/* Col 3: Financial Summary & Actions */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Tiền thuê lều:</span>
                      <span className="font-bold">{item.tentRentalFee?.toLocaleString('vi-VN')}đ</span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Tiền đồ ăn / dịch vụ:</span>
                      <span className="font-bold">{item.foodAndServicesTotal?.toLocaleString('vi-VN')}đ</span>
                    </div>

                    <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200 pt-1 text-sm">
                      <span>Tổng Master Bill:</span>
                      <span className="text-[#1B4D3E]">{item.grandTotal?.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedBillBooking({ bookingId: item.id })}
                    className="w-full py-2 bg-white hover:bg-emerald-50 text-[#1B4D3E] font-extrabold rounded-xl border border-[#1B4D3E]/30 shadow-2xs flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 mt-1"
                  >
                    <CreditCard size={14} />
                    Xem Chi Tiết Master Bill
                  </button>
                </div>

              </div>

            </div>
          ))
        )}
      </div>

      {/* Master Bill Modal Popup */}
      <MasterBillModal
        isOpen={!!selectedBillBooking}
        onClose={() => setSelectedBillBooking(null)}
        bookingId={selectedBillBooking?.bookingId}
        onCheckoutSuccess={fetchHistory}
      />
    </div>
  );
}
