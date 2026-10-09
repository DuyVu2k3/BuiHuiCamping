import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  Printer,
  CheckCircle2,
  Tent,
  User,
  Phone,
  Calendar,
  CreditCard,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { getApiUrl } from "../../apiConfig";

export function formatVnDateTime(rawDate) {
  if (!rawDate) return "";

  if (typeof rawDate === "string") {
    const cleanStr = rawDate.replace(/Z$/i, "");
    const parts = cleanStr.split("T");
    if (parts.length === 2) {
      const [datePart, timePart] = parts;
      const dateComps = datePart.split("-");
      const timeComps = timePart.split(":");
      if (dateComps.length === 3 && timeComps.length >= 2) {
        const [year, month, day] = dateComps;
        const hh = timeComps[0].padStart(2, "0");
        const mm = timeComps[1].padStart(2, "0");
        return `${hh}:${mm} ${parseInt(day)}/${parseInt(month)}/${year}`;
      }
    }
  }

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return String(rawDate);
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
}

export default function MasterBillModal({
  isOpen,
  onClose,
  bookingId,
  tentId,
  tentName,
  onCheckoutSuccess,
}) {
  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCheckoutSuccess(false);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    let url = "";
    if (bookingId) {
      url = getApiUrl(`/api/Bookings/${bookingId}/master-bill`);
    } else if (tentId || tentName) {
      url = getApiUrl(
        `/api/Bookings/master-bill-by-tent?tentId=${tentId || 0}&tentName=${encodeURIComponent(tentName || "")}`,
      );
    }

    if (!url) {
      setLoading(false);
      return;
    }

    axios
      .get(url)
      .then((res) => {
        setBillData(res.data);
      })
      .catch((err) => {
        console.error("Lỗi lấy Master Bill:", err);
        toast.error(err.response?.data || "Không thể tải hóa đơn Master Bill.");
      })
      .finally(() => setLoading(false));
  }, [isOpen, bookingId, tentId, tentName]);

  if (!isOpen) return null;

  const handleConfirmCheckout = async () => {
    if (!billData) return;
    setCheckingOut(true);

    try {
      const checkoutTimeIso = new Date().toISOString();
      if (billData.bookingId) {
        await axios.put(
          getApiUrl(`/api/Bookings/${billData.bookingId}/checkout`),
        );
      }
      toast.success(
        isTable
          ? "Đã hoàn tất thanh toán Master Bill & Trả bàn thành công!"
          : "Đã hoàn tất thanh toán Master Bill & Trả lều thành công!",
      );

      // Update local state to reflect completed checkout without abruptly closing modal
      setBillData((prev) => ({
        ...prev,
        status: "CheckedOut",
        actualCheckOutDate: checkoutTimeIso,
        effectiveCheckOutDate: checkoutTimeIso,
      }));
      setCheckoutSuccess(true);

      if (onCheckoutSuccess) onCheckoutSuccess(billData.bookingId);
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

  const rawLocName =
    billData?.locationName || billData?.tent?.locationName || tentName || "";
  const isTable =
    rawLocName.toLowerCase().includes("bàn") ||
    rawLocName.toLowerCase().includes("ẩm thực") ||
    (billData?.tent?.tentType &&
      billData.tent.tentType.toLowerCase().includes("bàn")) ||
    (billData?.customerName &&
      billData.customerName.toLowerCase().includes("bàn"));

  let displayCustomerName = billData?.customerName || "Khách hàng";
  if (isTable && displayCustomerName.startsWith("Khách Khu ẩm thực.")) {
    displayCustomerName = displayCustomerName.replace(
      "Khách Khu ẩm thực.",
      "Khách Ăn Tại ",
    );
  }

  const isCompleted =
    billData?.status === "CheckedOut" ||
    billData?.status === "Completed" ||
    checkoutSuccess;
  const actualCheckIn =
    billData?.actualCheckInDate ||
    billData?.checkInDate ||
    billData?.bookingTime;
  const effectiveReturnTime = isCompleted
    ? billData?.actualCheckOutDate ||
      billData?.effectiveCheckOutDate ||
      currentTime
    : billData?.effectiveCheckOutDate || currentTime;

  let actualDurationString = "";
  let billedHours = billData?.hourlyDurationHours || 1;
  let roundingExplanation = "";
  let scheduleComparisonNote = "";

  if (actualCheckIn && effectiveReturnTime) {
    const startMs = new Date(actualCheckIn).getTime();
    const endMs = new Date(effectiveReturnTime).getTime();
    const totalMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
    const fullHours = Math.floor(totalMinutes / 60);
    const extraMinutes = totalMinutes % 60;

    actualDurationString =
      fullHours > 0
        ? `${fullHours} tiếng ${extraMinutes} phút`
        : `${extraMinutes} phút`;

    if (totalMinutes <= 60) {
      roundingExplanation = `Thời gian ở thực tế <= 60 phút: Tính mức tối thiểu 1 giờ đầu theo quy chế.`;
    } else if (extraMinutes <= 30) {
      roundingExplanation = `Phút lẻ ${extraMinutes}p <= 30p: Miễn phí phụ thu lố giờ, giữ nguyên ${fullHours} giờ.`;
    } else {
      roundingExplanation = `Phút lẻ ${extraMinutes}p > 30p: Làm tròn tính lên ${fullHours + 1} giờ.`;
    }

    if (billData?.checkOutDate) {
      const scheduledEndMs = new Date(billData.checkOutDate).getTime();
      const diffSchedMins = Math.round((endMs - scheduledEndMs) / 60000);
      if (diffSchedMins > 5) {
        const diffH = Math.floor(diffSchedMins / 60);
        const diffM = diffSchedMins % 60;
        scheduleComparisonNote = `Trả trễ ${diffH > 0 ? `${diffH} tiếng ` : ""}${diffM} phút so với lịch đăng ký.`;
      } else if (diffSchedMins < -15) {
        const diffH = Math.floor(Math.abs(diffSchedMins) / 60);
        const diffM = Math.abs(diffSchedMins) % 60;
        scheduleComparisonNote = `Trả sớm ${diffH > 0 ? `${diffH} tiếng ` : ""}${diffM} phút (Đã tự động giảm tiền theo giờ thực tế).`;
      } else {
        scheduleComparisonNote = `Trả đúng khung giờ đăng ký ban đầu.`;
      }
    }
  }

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
              <h3 className="font-extrabold text-base tracking-tight">
                HÓA ĐƠN MASTER BILL
              </h3>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                {isTable
                  ? "Tổng hợp chi phí Đồ ăn, Dịch vụ & Phí bàn"
                  : "Tổng hợp chi phí Thuê lều & Dịch vụ"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#F9F8F6]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 size={36} className="text-[#1B4D3E] animate-spin" />
              <p className="text-xs font-bold text-slate-500">
                Đang tính toán tổng chi phí Master Bill...
              </p>
            </div>
          ) : !billData ? (
            <div className="p-8 text-center text-slate-500 font-bold">
              Không tìm thấy thông tin hóa đơn.
            </div>
          ) : (
            <>
              {/* Header Info */}
              <div className="text-center space-y-1">
                <p className="text-[11px] font-black tracking-widest text-[#7C5A38] uppercase">
                  BÙI HUI CAMPING & RESORT
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  {isTable
                    ? "HÓA ĐƠN DỊCH VỤ BÀN ĂN"
                    : "XÁC NHẬN ĐẶT LỀU & DỊCH VỤ"}
                </h2>
                <p className="text-xs font-bold text-slate-500">
                  {billData.bookingId
                    ? `Mã Đơn: #${billData.bookingId}`
                    : `Mã Bàn: ${billData.locationName}`}
                </p>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1B4D3E]/10 text-[#1B4D3E] rounded-full text-xs font-black mt-2">
                  <span>
                    {billData.locationName || billData.tent?.locationName}{" "}
                    {billData.tentsCount > 1
                      ? `(${billData.tentsCount} Lều)`
                      : ""}
                  </span>
                </div>
              </div>

              {/* Checkout Success Banner */}
              {checkoutSuccess && (
                <div className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center gap-3.5 shadow-md animate-in fade-in zoom-in-95 duration-200">
                  <CheckCircle2
                    size={26}
                    className="shrink-0 text-emerald-200"
                  />
                  <div className="text-xs">
                    <p className="font-black text-sm">
                      {isTable
                        ? "ĐÃ HOÀN TẤT THANH TOÁN & TRẢ BÀN THÀNH CÔNG!"
                        : "ĐÃ HOÀN TẤT THANH TOÁN & TRẢ LỀU THÀNH CÔNG!"}
                    </p>
                    <p className="text-emerald-100 text-[11px] mt-0.5">
                      Thời gian trả thực tế:{" "}
                      <strong>{formatVnDateTime(effectiveReturnTime)}</strong>.
                      Hóa đơn đã được lưu và cập nhật doanh thu.
                    </p>
                  </div>
                </div>
              )}

              {/* Customer Info Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <User size={14} className="text-[#1B4D3E]" />{" "}
                    {isTable ? "Khách dùng bàn:" : "Khách đại diện:"}
                  </span>
                  <span className="font-extrabold text-slate-800">
                    {displayCustomerName}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <Phone size={14} className="text-[#1B4D3E]" /> Số điện
                    thoại:
                  </span>
                  <span className="font-bold text-slate-800">
                    {billData.phoneNumber || "N/A"}
                  </span>
                </div>

                {!isTable && (
                  <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-100">
                    <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                      <Tent size={14} className="text-[#1B4D3E]" /> Hình thức
                      lưu trú:
                    </span>
                    <span
                      className={`font-black px-2.5 py-0.5 rounded-lg text-[11px] ${
                        billData.bookingType === "Hourly" ||
                        (billData.checkInDate &&
                          billData.checkOutDate &&
                          billData.checkInDate.split("T")[0] ===
                            billData.checkOutDate.split("T")[0])
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      }`}
                    >
                      {billData.bookingType === "Hourly" ||
                      (billData.checkInDate &&
                        billData.checkOutDate &&
                        billData.checkInDate.split("T")[0] ===
                          billData.checkOutDate.split("T")[0])
                        ? "Theo Giờ / Trong Ngày (Hourly)"
                        : "Ở Qua Đêm (Overnight)"}
                    </span>
                  </div>
                )}

                {/* Table vs Tent Specific Time Info */}
                {isTable ? (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                        <Clock size={14} className="text-emerald-600" /> Thực tế
                        vào bàn / nhận dịch vụ:
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {actualCheckIn
                          ? formatVnDateTime(actualCheckIn)
                          : "Vừa vào bàn"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                        <Clock size={14} className="text-rose-600" /> Thực tế
                        trả bàn / trả dịch vụ:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900">
                          {formatVnDateTime(effectiveReturnTime)}
                        </span>
                        {isCompleted ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                            Đã trả bàn
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                            Chốt lúc trả
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Scheduled Check-in / Check-out */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                          <Calendar size={14} className="text-emerald-600" />{" "}
                          Lịch Check-in đăng ký:
                        </span>
                        <span className="font-extrabold text-slate-800">
                          {billData.checkInDate
                            ? formatVnDateTime(billData.checkInDate)
                            : "N/A"}
                        </span>
                      </div>

                      {billData.checkOutDate && (
                        <div className="flex justify-between items-center text-slate-700">
                          <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                            <Calendar size={14} className="text-emerald-600" />{" "}
                            Lịch Check-out đăng ký:
                          </span>
                          <span className="font-extrabold text-slate-800">
                            {formatVnDateTime(billData.checkOutDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actual Check-in / Check-out */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                          <Clock size={14} className="text-[#1B4D3E]" /> Thực tế
                          nhận lều:
                        </span>
                        <span className="font-extrabold text-[#1B4D3E]">
                          {actualCheckIn
                            ? formatVnDateTime(actualCheckIn)
                            : "Đã nhận lều"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                          <Clock size={14} className="text-rose-600" /> Thực tế
                          trả lều:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-900">
                            {formatVnDateTime(effectiveReturnTime)}
                          </span>
                          {isCompleted ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                              Đã trả lều
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                              Chốt lúc trả
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Actual Usage & Time Reconciliation Card */}
              {actualDurationString && (
                <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-amber-50/90 p-4 rounded-2xl border border-emerald-200 text-xs space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between font-extrabold">
                    <span className="text-[#1B4D3E] flex items-center gap-1.5">
                      <Clock size={15} className="text-emerald-700" />
                      {isTable
                        ? "Thời gian dùng dịch vụ / bàn ăn thực tế:"
                        : "Thời gian ở thực tế:"}
                    </span>
                    <span className="text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs font-black text-xs">
                      {actualDurationString}
                    </span>
                  </div>

                  {(billData.bookingType === "Hourly" ||
                    (!isTable &&
                      billData.checkInDate &&
                      billData.checkOutDate &&
                      billData.checkInDate.split("T")[0] ===
                        billData.checkOutDate.split("T")[0])) && (
                    <div className="space-y-1.5 pt-2 border-t border-emerald-200/60 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">
                          Số giờ tính tiền (quy tắc làm tròn 30p):
                        </span>
                        <span className="font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                          {billedHours} Giờ
                        </span>
                      </div>
                      {roundingExplanation && (
                        <p className="text-[10px] font-medium text-slate-500 italic pl-1">
                          • {roundingExplanation}
                        </p>
                      )}
                      {scheduleComparisonNote && (
                        <p className="text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-md border border-amber-300 mt-1">
                          {scheduleComparisonNote}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Itemized Table Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex justify-between font-bold text-xs text-slate-700">
                  <span>Hạng Mục Dịch Vụ</span>
                  <span>Thành Tiền</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {/* 1. Tent / Table Fee Breakdown */}
                  <div className="p-4 bg-emerald-50/30 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {isTable ? (
                          <ShoppingBag size={16} className="text-amber-700" />
                        ) : (
                          <Tent size={16} className="text-[#1B4D3E]" />
                        )}
                        <div>
                          <p className="font-bold text-slate-800">
                            {isTable
                              ? "Dịch Vụ & Sử Dụng Bàn Ăn"
                              : `Tiền Thuê Lều Trải Nghiệm ${billData.tentsCount > 1 ? `(${billData.tentsCount} Lều)` : ""} ${billData.bookingType === "Hourly" && billedHours > 0 ? `- ${billedHours} Giờ` : ""}`}
                          </p>
                        </div>
                      </div>
                      <span className="font-extrabold text-[#1B4D3E]">
                        {billData.tentRentalFee?.toLocaleString("vi-VN")}đ
                      </span>
                    </div>

                    {/* Tent Setup Summary if available */}
                    {billData.tentSetupSummary && (
                      <div className="pl-6 pt-0.5">
                        <span className="text-[11px] font-extrabold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 inline-flex items-center gap-1">
                          Quy cách dựng: {billData.tentSetupSummary}
                        </span>
                      </div>
                    )}

                    {/* Detailed List of Tents / Tables in Booking */}
                    {billData.tents && billData.tents.length > 0 ? (
                      <div className="pl-6 pt-1 space-y-1 border-t border-emerald-100/60 text-[11px] text-slate-600">
                        {billData.tents.map((t, index) => (
                          <div
                            key={t.id || index}
                            className="flex justify-between items-center"
                          >
                            <span>
                              • {t.locationName}{" "}
                              {billData.bookingType === "Hourly" &&
                              billedHours > 0
                                ? `(${billedHours} giờ)`
                                : ""}
                            </span>
                            <span className="font-semibold text-slate-700">
                              {t.price?.toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 pl-6">
                        {billData.tent?.locationName}
                      </p>
                    )}
                  </div>

                  {/* 2. Food & Beverage Items */}
                  {billData.foodAndServices &&
                  billData.foodAndServices.length > 0 ? (
                    billData.foodAndServices.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 flex justify-between items-center"
                      >
                        <div className="flex items-center gap-2 pl-2">
                          <ShoppingBag size={14} className="text-amber-600" />
                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {item.quantity} x{" "}
                              {item.unitPrice?.toLocaleString("vi-VN")}đ
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-700">
                          {item.totalPrice?.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-[11px] text-slate-400 italic">
                      Chưa gọi thêm đồ ăn / uống.
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Totals Summary */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>
                    {isTable ? "Phí Sử Dụng Bàn Ăn:" : "Tiền Thuê Lều:"}
                  </span>
                  <span className="font-bold">
                    {billData.tentRentalFee?.toLocaleString("vi-VN")}đ
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Tiền Đồ Ăn, Uống & Dịch Vụ:</span>
                  <span className="font-bold">
                    {billData.foodAndServicesTotal?.toLocaleString("vi-VN")}đ
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-slate-800 border-t border-slate-100 pt-2.5">
                  <span>Tổng Tiền Hóa Đơn (Grand Total):</span>
                  <span>{billData.grandTotal?.toLocaleString("vi-VN")}đ</span>
                </div>

                {billData.depositPaid > 0 && (
                  <div className="flex justify-between items-center text-xs text-rose-600 font-semibold bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                    <span>Trừ Tiền Đặt Cọc Trước Đó:</span>
                    <span className="font-black">
                      -{billData.depositPaid?.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center bg-[#1B4D3E] text-white p-4 rounded-xl shadow-lg">
                  <div>
                    <p className="text-[10px] text-emerald-200/80 uppercase font-bold tracking-wider">
                      TỔNG CẦN THANH TOÁN CÒN LẠI
                    </p>
                    <p className="text-xl font-black">
                      {billData.remainingBalance?.toLocaleString("vi-VN")}đ
                    </p>
                  </div>
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
              className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-xs cursor-pointer"
            >
              <Printer size={16} />
              <span>In Hóa Đơn</span>
            </button>

            {checkoutSuccess ? (
              <button
                onClick={onClose}
                className="flex-[2] py-3 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-black rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all text-xs cursor-pointer"
              >
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span>Hoàn Tất & Đóng</span>
              </button>
            ) : billData.status === "CheckedOut" ||
              billData.status === "Completed" ? (
              <div className="flex-[2] py-3 bg-emerald-100/90 text-emerald-800 font-extrabold rounded-xl border border-emerald-300 flex items-center justify-center gap-2 text-xs">
                <CheckCircle2 size={16} className="text-emerald-700" />
                <span>
                  {isTable
                    ? "Đã Thanh Toán & Trả Bàn"
                    : "Đã Thanh Toán & Hoàn Tất Trả Lều"}
                </span>
              </div>
            ) : billData.status === "Cancelled" ? (
              <div className="flex-[2] py-3 bg-rose-100 text-rose-800 font-extrabold rounded-xl border border-rose-300 flex items-center justify-center gap-2 text-xs">
                <AlertCircle size={16} className="text-rose-600" />
                <span>Đơn Này Đã Hủy</span>
              </div>
            ) : (
              <button
                onClick={handleConfirmCheckout}
                disabled={checkingOut}
                className="flex-[2] py-3 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-bold rounded-xl shadow-lg shadow-[#1B4D3E]/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-xs disabled:opacity-50 cursor-pointer"
              >
                {checkingOut ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-300" />
                    <span>
                      {isTable
                        ? "Xác Nhận Thanh Toán & Trả Bàn"
                        : "Xác Nhận Thanh Toán & Trả Lều"}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
