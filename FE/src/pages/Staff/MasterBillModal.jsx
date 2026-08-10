import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Printer, CheckCircle2, Tent, User, Phone, Calendar, CreditCard, ShoppingBag, Loader2, Sparkles, AlertCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl } from '../../apiConfig';

export default function MasterBillModal({ isOpen, onClose, bookingId, tentId, tentName, onCheckoutSuccess }) {
  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    let url = "";
    if (bookingId) {
      url = getApiUrl(`/api/Bookings/${bookingId}/master-bill`);
    } else if (tentId || tentName) {
      url = getApiUrl(`/api/Bookings/master-bill-by-tent?tentId=${tentId || 0}&tentName=${encodeURIComponent(tentName || '')}`);
    }

    if (!url) {
      setLoading(false);
      return;
    }

    axios.get(url)
      .then(res => {
        setBillData(res.data);
      })
      .catch(err => {
        console.error("Lỗi lấy Master Bill:", err);
        toast.error(err.response?.data || "Không thể tải hóa đơn Master Bill.");
      })
      .finally(() => setLoading(false));
  }, [isOpen, bookingId, tentId, tentName]);

  if (!isOpen) return null;

  const handleConfirmCheckout = async () => {
    if (!billData || !billData.bookingId) return;
    setCheckingOut(true);

    try {
      await axios.put(getApiUrl(`/api/Bookings/${billData.bookingId}/checkout`));
      toast.success("Đã hoàn tất thanh toán Master Bill & Trả lều thành công!");
      if (onCheckoutSuccess) onCheckoutSuccess(billData.bookingId);
      onClose();
    } catch (err) {
      console.error("Lỗi khi checkout:", err);
      toast.error("Không thể xử lý checkout. Vui lòng thử lại!");
    } finally {
      setCheckingOut(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
        
        {/* Modal Header */}
        <div className="bg-[#1B4D3E] text-white p-5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 font-bold">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">HÓA ĐƠN MASTER BILL</h3>
              <p className="text-[11px] text-emerald-200/80 font-medium">Tổng hợp chi phí Thuê lều & Dịch vụ</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 print:p-0 print:bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 size={36} className="text-[#1B4D3E] animate-spin" />
              <p className="text-xs font-bold text-slate-500">Đang tính toán Master Bill...</p>
            </div>
          ) : !billData ? (
            <div className="text-center py-12 space-y-3">
              <AlertCircle size={40} className="mx-auto text-amber-500" />
              <p className="text-sm font-bold text-slate-700">Chưa có thông tin hóa đơn cho lều này.</p>
            </div>
          ) : (
            <>
              {/* Receipt Branding / Printable Header */}
              <div className="text-center border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-black text-[#1B4D3E]" style={{ fontFamily: "'Dancing Script', cursive" }}>Bùi Hui Camping</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Hóa Đơn Thanh Toán / Master Invoice</p>
                
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1B4D3E]/10 text-[#1B4D3E] rounded-full text-xs font-black mt-2">
                  <span>📍 {billData.locationName || billData.tent?.locationName} {billData.tentsCount > 1 ? `(${billData.tentsCount} Lều)` : ''}</span>
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <User size={14} className="text-[#1B4D3E]" /> Khách đại diện:
                  </span>
                  <span className="font-extrabold text-slate-800">{billData.customerName}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <Phone size={14} className="text-[#1B4D3E]" /> Số điện thoại:
                  </span>
                  <span className="font-bold text-slate-800">{billData.phoneNumber || "N/A"}</span>
                </div>

                {/* Scheduled Check-in / Check-out */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                      <Calendar size={14} className="text-emerald-600" /> Lịch Check-in đăng ký:
                    </span>
                    <span className="font-extrabold text-slate-800">
                      {billData.checkInDate ? new Date(billData.checkInDate.endsWith('Z') ? billData.checkInDate : billData.checkInDate + 'Z').toLocaleString('vi-VN') : 'N/A'}
                    </span>
                  </div>

                  {billData.checkOutDate && (
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                        <Calendar size={14} className="text-emerald-600" /> Lịch Check-out đăng ký:
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {new Date(billData.checkOutDate.endsWith('Z') ? billData.checkOutDate : billData.checkOutDate + 'Z').toLocaleString('vi-VN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actual Check-in / Check-out */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                      <Clock size={14} className="text-[#1B4D3E]" /> Thực tế nhận lều:
                    </span>
                    <span className="font-extrabold text-[#1B4D3E]">
                      {billData.actualCheckInDate ? new Date(billData.actualCheckInDate.endsWith('Z') ? billData.actualCheckInDate : billData.actualCheckInDate + 'Z').toLocaleString('vi-VN') : "Đã nhận khi Check-in"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                      <Clock size={14} className="text-rose-600" /> Thực tế trả lều:
                    </span>
                    <span className="font-extrabold text-rose-700">
                      {billData.actualCheckOutDate ? new Date(billData.actualCheckOutDate.endsWith('Z') ? billData.actualCheckOutDate : billData.actualCheckOutDate + 'Z').toLocaleString('vi-VN') : (billData.status === 'CheckedOut' ? 'Đã trả lều' : 'Đang sử dụng / Chưa trả')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Table Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex justify-between font-bold text-xs text-slate-700">
                  <span>Hạng Mục Dịch Vụ</span>
                  <span>Thành Tiền</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {/* 1. Tent Rental Fee Breakdown */}
                  <div className="p-4 bg-emerald-50/30 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Tent size={16} className="text-[#1B4D3E]" />
                        <div>
                          <p className="font-bold text-slate-800">
                            Tiền Thuê Lều Trải Nghiệm {billData.tentsCount > 1 ? `(${billData.tentsCount} Lều)` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="font-extrabold text-[#1B4D3E]">{billData.tentRentalFee?.toLocaleString('vi-VN')}đ</span>
                    </div>

                    {/* Detailed List of Tents in Booking */}
                    {billData.tents && billData.tents.length > 0 ? (
                      <div className="pl-6 pt-1 space-y-1 border-t border-emerald-100/60 text-[11px] text-slate-600">
                        {billData.tents.map((t, index) => (
                          <div key={t.id || index} className="flex justify-between items-center">
                            <span>• {t.locationName}</span>
                            <span className="font-semibold text-slate-700">{t.price?.toLocaleString('vi-VN')}đ</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 pl-6">{billData.tent?.locationName}</p>
                    )}
                  </div>

                  {/* 2. Food & Beverage Items */}
                  {billData.foodAndServices && billData.foodAndServices.length > 0 ? (
                    billData.foodAndServices.map((item, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center">
                        <div className="flex items-center gap-2 pl-2">
                          <ShoppingBag size={14} className="text-amber-600" />
                          <div>
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            <p className="text-[10px] text-slate-400">{item.quantity} x {item.unitPrice?.toLocaleString('vi-VN')}đ</p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-700">{item.totalPrice?.toLocaleString('vi-VN')}đ</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-[11px] text-slate-400 italic">Chưa gọi thêm đồ ăn / uống.</div>
                  )}
                </div>
              </div>

              {/* Financial Totals Summary */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Tiền Thuê Lều:</span>
                  <span className="font-bold">{billData.tentRentalFee?.toLocaleString('vi-VN')}đ</span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Tiền Đồ Ăn, Uống & Dịch Vụ:</span>
                  <span className="font-bold">{billData.foodAndServicesTotal?.toLocaleString('vi-VN')}đ</span>
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-slate-800 border-t border-slate-100 pt-2.5">
                  <span>Tổng Tiền Hóa Đơn (Grand Total):</span>
                  <span>{billData.grandTotal?.toLocaleString('vi-VN')}đ</span>
                </div>

                <div className="flex justify-between items-center text-xs text-rose-600 font-semibold bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                  <span>Trừ Tiền Đặt Cọc Trước Đó:</span>
                  <span className="font-black">-{billData.depositPaid?.toLocaleString('vi-VN')}đ</span>
                </div>

                <div className="flex justify-between items-center bg-[#1B4D3E] text-white p-4 rounded-xl shadow-lg">
                  <div>
                    <p className="text-[10px] text-emerald-200/80 uppercase font-bold tracking-wider">TỔNG CẦN THANH TOÁN CÒN LẠI</p>
                    <p className="text-xl font-black">{billData.remainingBalance?.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <Sparkles size={24} className="text-emerald-300" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer / Action Buttons */}
        {billData && (
          <div className="bg-slate-100 p-4 border-t border-slate-200 flex gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
            >
              <Printer size={16} />
              <span>In Hóa Đơn</span>
            </button>

            <button
              onClick={handleConfirmCheckout}
              disabled={checkingOut}
              className="flex-[2] py-3 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-bold rounded-xl shadow-lg shadow-[#1B4D3E]/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-xs disabled:opacity-50"
            >
              {checkingOut ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang xử lý Checkout...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="text-emerald-300" />
                  <span>Xác Nhận Thanh Toán & Trả Lều</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
