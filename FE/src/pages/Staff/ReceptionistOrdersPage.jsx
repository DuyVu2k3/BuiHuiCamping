import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Flame, Info, ChefHat, BellRing, Eye, AlertTriangle, Image as ImageIcon, RefreshCw, X } from 'lucide-react';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalrService';

export default function ReceptionistOrdersPage() {
  const [auditBatches, setAuditBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, IN_PROGRESS, REJECTED, COMPLETED
  const [viewingProofImage, setViewingProofImage] = useState(null);

  const fetchAuditHistory = async () => {
    try {
      const res = await fetch(getApiUrl('/api/Orders/all-history'));
      const data = await res.json();
      setAuditBatches(data);
    } catch (err) {
      console.error("Lỗi lấy nhật ký đơn:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditHistory();

    const handleOrderUpdated = () => {
      fetchAuditHistory();
    };

    signalRService.on("NewFoodOrder", handleOrderUpdated);
    signalRService.on("OrderUpdated", handleOrderUpdated);
    signalRService.on("OrderStatusUpdated", handleOrderUpdated);
    signalRService.on("OrderRejected", handleOrderUpdated);
    signalRService.on("OrderCancelled", handleOrderUpdated);

    return () => {
      signalRService.off("NewFoodOrder", handleOrderUpdated);
      signalRService.off("OrderUpdated", handleOrderUpdated);
      signalRService.off("OrderStatusUpdated", handleOrderUpdated);
      signalRService.off("OrderRejected", handleOrderUpdated);
      signalRService.off("OrderCancelled", handleOrderUpdated);
    };
  }, []);

  const [locationFilter, setLocationFilter] = useState('ALL'); // ALL, TABLE, TENT

  const isTableBatch = (batch) => {
    const loc = (batch.locationName || "").toLowerCase();
    return loc.includes("bàn") || loc.includes("ẩm thực") || loc.includes("nhà hàng") || loc.includes("ăn uống");
  };

  const filteredBatches = auditBatches.filter(b => {
    if (filterStatus === 'IN_PROGRESS' && !(b.status === 'Pending' || b.status === 'Preparing' || b.status === 'Ready')) return false;
    if (filterStatus === 'REJECTED' && !(b.status === 'Cancelled' || b.status === 'Rejected')) return false;
    if (filterStatus === 'COMPLETED' && !(b.status === 'Delivered' || b.status === 'Completed')) return false;
    
    if (locationFilter === 'TABLE' && !isTableBatch(b)) return false;
    if (locationFilter === 'TENT' && isTableBatch(b)) return false;

    return true;
  });

  const getStatusBadge = (batch) => {
    if (batch.status === 'Cancelled' || batch.status === 'Rejected') {
      return (
        <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1">
          <AlertTriangle size={13} /> Bếp Từ Chối
        </span>
      );
    }
    if (batch.status === 'Delivered' || batch.status === 'Completed') {
      return (
        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1">
          <CheckCircle2 size={13} /> Đã Giao Món
        </span>
      );
    }
    if (batch.status === 'Ready') {
      return (
        <span className="bg-amber-400 text-slate-900 border border-amber-500 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 animate-pulse">
          <BellRing size={13} /> Gọi Chạy Bàn
        </span>
      );
    }
    if (batch.status === 'Pending') {
      return (
        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 animate-pulse">
          <Clock size={13} /> Đang Chờ Bếp Nhận Đơn
        </span>
      );
    }
    return (
      <span className="bg-sky-100 text-sky-800 border border-sky-300 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1">
        <ChefHat size={13} /> Bếp Đang Chế Biến
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[100dvh] flex flex-col relative bg-[#FAF7F2]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Giám Sát & Nhật Ký Đi Đơn</h1>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">Real-time Live</span>
          </div>
          <p className="text-slate-500 font-medium text-xs mt-1">Đơn đặt từ QR đến thẳng Bếp ➔ Bếp báo Chạy bàn ➔ Chạy bàn giao & chụp ảnh xác nhận</p>
        </div>

        <button
          onClick={fetchAuditHistory}
          className="p-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs"
        >
          <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : ""} />
          Tải lại dữ liệu
        </button>
      </div>

      {/* Filter Tabs (Status & Location) */}
      <div className="space-y-3 mb-6">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: 'ALL', label: 'Tất Cả Đơn' },
            { key: 'IN_PROGRESS', label: '⏳ Đang Chế Biến / Chờ Giao' },
            { key: 'COMPLETED', label: '✅ Đã Giao Xong (Có Ảnh)' },
            { key: 'REJECTED', label: '❌ Bếp Từ Chối' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex-shrink-0 ${
                filterStatus === tab.key
                  ? 'bg-[#1B4D3E] text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Location Filter Sub-tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Vị Trí:</span>
          {[
            { key: 'ALL', label: `Tất Cả Vị Trí (${auditBatches.length})` },
            { key: 'TABLE', label: `🍽️ Bàn Khu Ẩm Thực (${auditBatches.filter(isTableBatch).length})` },
            { key: 'TENT', label: `⛺ Lều Cắm Trại (${auditBatches.filter(b => !isTableBatch(b)).length})` }
          ].map(loc => (
            <button
              key={loc.key}
              onClick={() => setLocationFilter(loc.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex-shrink-0 ${
                locationFilter === loc.key
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Order Audit Timeline Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-slate-400 font-bold animate-pulse flex items-center gap-2">
            <RefreshCw className="animate-spin" size={20} /> Đang tải lịch sử đi đơn...
          </div>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
          <p className="text-4xl">📋</p>
          <p className="font-extrabold text-slate-700 text-base">Chưa có dữ liệu đợt gọi món nào trong mục này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBatches.map(batch => (
            <div
              key={batch.batchId}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                {/* Header: Location & Status */}
                <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-black text-[#7C5A38] uppercase tracking-wider block">Vị Trí</span>
                    <h3 className="text-lg font-black text-[#1B4D3E]">{batch.locationName}</h3>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">Khách: {batch.customerName}</p>
                  </div>
                  {getStatusBadge(batch)}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-3">
                  <Clock size={13} />
                  <span>{new Date(batch.createdAt.endsWith('Z') ? batch.createdAt : batch.createdAt + 'Z').toLocaleString('vi-VN')}</span>
                </div>

                {/* Items List */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl space-y-2 border border-slate-200/60 mb-4">
                  {batch.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-800">{item.name}</span>
                      <span className="font-black text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200">x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Rejection Reason Box */}
                {batch.rejectReason && (
                  <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200 text-xs text-rose-900 font-medium mb-4 space-y-1">
                    <p className="font-extrabold flex items-center gap-1 text-rose-700">
                      <AlertTriangle size={14} /> Lý Do Bếp Từ Chối:
                    </p>
                    <p className="italic bg-white p-2 rounded-xl border border-rose-100">{batch.rejectReason}</p>
                  </div>
                )}
              </div>

              {/* Delivery Proof Photo Footer */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {batch.deliveredBy && (
                  <p className="text-xs text-slate-600 font-bold">
                    👤 Người giao: <strong className="text-emerald-800 font-extrabold">{batch.deliveredBy}</strong>
                  </p>
                )}

                {batch.proofImage ? (
                  <button
                    onClick={() => setViewingProofImage(getApiUrl(batch.proofImage))}
                    className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-300 text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                  >
                    <ImageIcon size={16} />
                    <span>📸 Xem Ảnh Xác Nhận Giao Hàng</span>
                  </button>
                ) : (
                  (batch.status === 'Delivered' || batch.status === 'Completed') && (
                    <span className="text-[11px] text-slate-400 italic font-medium block text-center">
                      Đã xác nhận giao (Không tải ảnh)
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PROOF PHOTO FULL VIEWER MODAL */}
      {viewingProofImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#1B4D3E]">
                <ImageIcon size={20} />
                <h3 className="font-black text-base text-slate-900">📸 Ảnh Chụp Xác Nhận Giao Món</h3>
              </div>
              <button
                onClick={() => setViewingProofImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-500 text-sm flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
              <img
                src={viewingProofImage}
                alt="Proof Photo"
                className="max-h-[60vh] w-full object-contain"
              />
            </div>

            <div className="text-center pt-1">
              <button
                onClick={() => setViewingProofImage(null)}
                className="px-6 py-2.5 bg-[#1B4D3E] text-white font-black text-xs rounded-xl shadow-md"
              >
                Đóng Cửa Sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
