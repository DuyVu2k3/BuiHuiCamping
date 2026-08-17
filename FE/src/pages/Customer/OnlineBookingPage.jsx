import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Calendar,
  Users,
  Map,
  Grid,
  CheckCircle,
  X,
  ShieldCheck,
  QrCode,
  Tent,
  ArrowRight,
  Sparkles,
  Send,
  PhoneCall,
  Search,
  Clock,
} from "lucide-react";
import CampsiteMap from "../../components/CampsiteMap";
import { getApiUrl } from "../../apiConfig";
import signalRService from "../../services/signalrService";

const HOURS_24 = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const MINUTES_5M = ["00", "15", "30", "45"];

export default function OnlineBookingPage() {
  const [zones, setZones] = useState([]);
  const [tents, setTents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("map"); // 'map' or 'grid'

  // Booking Form State
  const [stayType, setStayType] = useState("overnight"); // 'overnight' or 'dayuse'
  const [checkInDate, setCheckInDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [checkOutDate, setCheckOutDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0],
  );
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOutTime, setCheckOutTime] = useState("12:00");
  const [guestCount, setGuestCount] = useState(2);

  const handleStayTypeChange = (type) => {
    setStayType(type);
    if (type === "overnight") {
      setCheckInTime("14:00");
      setCheckOutTime("12:00");
      if (checkOutDate <= checkInDate) {
        const nextDay = new Date(new Date(checkInDate).getTime() + 86400000)
          .toISOString()
          .split("T")[0];
        setCheckOutDate(nextDay);
      }
    } else {
      setCheckInTime("14:00");
      setCheckOutTime("20:00");
      setCheckOutDate(checkInDate); // Enforce same day for day-use
    }
  };

  // Multi-selected Tents & Drawer
  const [selectedTents, setSelectedTents] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [zonesRes, tentsRes] = await Promise.all([
        axios.get(getApiUrl("/api/Zones")),
        axios.get(getApiUrl("/api/Tents")),
      ]);
      setZones(zonesRes.data);
      setTents(tentsRes.data);
    } catch (err) {
      console.error("Lỗi khi tải sơ đồ lều:", err);
      toast.error("Không thể kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const handleCheckInChange = (val) => {
    setCheckInDate(val);
    if (stayType === "dayuse") {
      // Trong ngày: Ngày Check-out phải luôn bằng ngày Check-in
      setCheckOutDate(val);
    } else if (stayType === "overnight") {
      // Qua đêm: Nếu chọn ngày Check-in trùng với Check-out -> Tự động đổi sang tab Trong ngày
      if (val === checkOutDate) {
        setStayType("dayuse");
        setCheckOutDate(val);
        setCheckInTime("14:00");
        setCheckOutTime("20:00");
        toast.success(
          "Tự động chuyển sang chế độ Trong ngày (do ngày Nhận & Trả lều trùng nhau).",
        );
      } else if (val > checkOutDate) {
        const nextDay = new Date(new Date(val).getTime() + 86400000)
          .toISOString()
          .split("T")[0];
        setCheckOutDate(nextDay);
      }
    }
  };

  const handleCheckOutChange = (val) => {
    if (stayType === "dayuse") {
      // Trong ngày: Đổi Check-out tự động đổi Check-in bằng Check-out
      setCheckOutDate(val);
      setCheckInDate(val);
    } else if (stayType === "overnight") {
      if (val < checkInDate) {
        toast.error("Ngày Check-out phải lớn hơn ngày Check-in!");
        const nextDay = new Date(new Date(checkInDate).getTime() + 86400000)
          .toISOString()
          .split("T")[0];
        setCheckOutDate(nextDay);
        return;
      }
      // Qua đêm: Nếu chọn ngày Check-out trùng với Check-in -> Tự động đổi sang tab Trong ngày
      if (val === checkInDate) {
        setStayType("dayuse");
        setCheckInDate(val);
        setCheckOutDate(val);
        setCheckInTime("14:00");
        setCheckOutTime("20:00");
        toast.success(
          "Tự động chuyển sang chế độ Trong ngày (do ngày Nhận & Trả lều trùng nhau).",
        );
      } else {
        setCheckOutDate(val);
      }
    }
  };

  const handleSearchAvailability = () => {
    fetchData(true);
    const formattedIn = new Date(
      `${checkInDate}T${checkInTime}`,
    ).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
    const formattedOut = new Date(
      `${checkOutDate}T${checkOutTime}`,
    ).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
    toast.success(
      `Đã cập nhật lều trống cho khung giờ ${formattedIn} ➔ ${formattedOut}`,
    );
  };

  useEffect(() => {
    fetchData(true);

    const handleTentStatusChanged = () => {
      console.log(
        "⚡ SignalR event received -> Refreshing Guest tent map in real-time...",
      );
      fetchData(false);
    };

    signalRService.on("TentStatusChanged", handleTentStatusChanged);
    signalRService.on("BookingQrStatusChanged", handleTentStatusChanged);
    signalRService.on("OrderUpdated", handleTentStatusChanged);

    return () => {
      signalRService.off("TentStatusChanged", handleTentStatusChanged);
      signalRService.off("BookingQrStatusChanged", handleTentStatusChanged);
      signalRService.off("OrderUpdated", handleTentStatusChanged);
    };
  }, []);

  // Calculate date & time-effective tent availability for selected CheckIn & CheckOut exact timestamps
  const effectiveTents = tents.map((tent) => {
    const activeBooking = tent.bookings?.find((b) => {
      if (
        b.status === "CheckedOut" ||
        b.status === "Cancelled" ||
        b.status === "Rejected"
      )
        return false;
      if (!b.checkInDate || !b.checkOutDate) return true;

      // Parse existing booking timestamps
      let bIn = new Date(b.checkInDate);
      let bOut = new Date(b.checkOutDate);

      // Legacy fallback: If DB row stored midnight 00:00:00, normalize to standard resort hours (14:00 & 12:00)
      if (bIn.getHours() === 0 && bIn.getMinutes() === 0) {
        const datePart =
          typeof b.checkInDate === "string"
            ? b.checkInDate.split("T")[0]
            : bIn.toISOString().split("T")[0];
        bIn = new Date(`${datePart}T14:00:00`);
      }
      if (bOut.getHours() === 0 && bOut.getMinutes() === 0) {
        const datePart =
          typeof b.checkOutDate === "string"
            ? b.checkOutDate.split("T")[0]
            : bOut.toISOString().split("T")[0];
        bOut = new Date(`${datePart}T12:00:00`);
      }

      // Target search timestamps with exact hours & minutes
      const targetIn = new Date(`${checkInDate}T${checkInTime}:00`);
      const targetOut = new Date(`${checkOutDate}T${checkOutTime}:00`);

      // Overlap condition: bIn < targetOut && bOut > targetIn
      return bIn < targetOut && bOut > targetIn;
    });

    const status = activeBooking
      ? activeBooking.status || tent.status
      : "Available";

    return {
      ...tent,
      status,
      activeBooking,
    };
  });

  const effectiveZones = zones.map((z) => ({
    ...z,
    tents: (z.tents || []).map((t) => {
      const et = effectiveTents.find((item) => item.id === t.id);
      return et || t;
    }),
  }));

  const handleSelectTent = (tent) => {
    if (tent.status !== "Available") {
      toast.error(
        `Lều ${tent.name} hiện đã được đặt trong khoảng thời gian này.`,
      );
      return;
    }
    const exists = selectedTents.find((t) => t.id === tent.id);
    if (exists) {
      const updated = selectedTents.filter((t) => t.id !== tent.id);
      setSelectedTents(updated);
      if (updated.length === 0) setIsDrawerOpen(false);
    } else {
      setSelectedTents([...selectedTents, tent]);
      // Do NOT auto-open drawer so user can freely click multiple tents on map!
      toast.success(
        `Đã chọn Lều ${tent.name}! Click thêm lều khác hoặc bấm "Tiếp tục" bên dưới.`,
        { id: "select-tent-toast" },
      );
    }
  };

  // Calculate nights & total
  const calculateNights = () => {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.max(end - start, 86400000);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();
  const totalPricePerNight = selectedTents.reduce(
    (sum, t) => sum + (t.price || 0),
    0,
  );
  const grandTotal = totalPricePerNight * nights;

  // Strict Full Name & 10-digit Phone Validation
  const validateNameAndPhone = (name, phone) => {
    const cleanName = (name || "").trim();
    const cleanPhone = (phone || "").trim();

    if (!cleanName) {
      toast.error("Vui lòng nhập Họ & Tên người đặt!");
      return false;
    }

    // Name must be letters and spaces, no digits, at least 2 characters
    const nameRegex =
      /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầnẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừÝỲỸỶỊýỳỹỷị\s]{2,50}$/;
    if (
      /\d/.test(cleanName) ||
      cleanName.length < 2 ||
      !nameRegex.test(cleanName)
    ) {
      toast.error(
        "Họ & Tên không hợp lệ! Vui lòng nhập bằng chữ cái đàng hoàng (từ 2 ký tự trở lên, không chứa số).",
      );
      return false;
    }

    if (!cleanPhone) {
      toast.error("Vui lòng nhập Số điện thoại liên hệ!");
      return false;
    }

    // Phone must be exactly 10 digits starting with 0
    const phoneRegex = /^0[0-9]{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      toast.error(
        "Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số (bắt đầu bằng số 0).",
      );
      return false;
    }

    return true;
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (selectedTents.length === 0)
      return toast.error("Vui lòng chọn ít nhất 1 lều!");

    if (!validateNameAndPhone(customerName, phoneNumber)) {
      return;
    }

    const fullCheckIn = `${checkInDate}T${checkInTime}:00`;
    const fullCheckOut = `${checkOutDate}T${checkOutTime}:00`;

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        getApiUrl("/api/Bookings/online-booking-request"),
        {
          customerName: customerName.trim(),
          phoneNumber: phoneNumber.trim(),
          tentIds: selectedTents.map((t) => t.id),
          checkInDate: fullCheckIn,
          checkOutDate: fullCheckOut,
        },
      );

      if (res.status === 200) {
        toast.success("Gửi yêu cầu đặt lều thành công!");
        setBookingSuccess({
          ...res.data,
          tentsList: selectedTents.map((t) => t.name).join(", "),
          checkInDate: `${checkInDate} (${checkInTime})`,
          checkOutDate: `${checkOutDate} (${checkOutTime})`,
        });
        setIsDrawerOpen(false);
        setSelectedTents([]);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error("Gửi yêu cầu thất bại, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTentWithZone = (t) => {
    const zoneName = t.zone?.name || "";
    return zoneName ? `${zoneName} (Lều ${t.name})` : `Lều ${t.name}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-28 font-sans">
      {/* Search Header Banner */}
      <div className="bg-[#1B4D3E] text-white pt-10 pb-16 px-4 sm:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-widest mb-2">
              <Sparkles size={16} /> Đặt Lều Giữ Chỗ Trực Tuyến
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Sơ Đồ Bãi Cắm Trại Bùi Hui
            </h1>
            <p className="text-emerald-100 text-sm mt-1 max-w-xl">
              Chọn khoảng thời gian lưu trú và nhấp trực tiếp vào điểm lều trên
              bản đồ 2D để xem giá và đặt cọc nhanh chóng.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 z-10">
            <button
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${viewMode === "map" ? "bg-white text-[#1B4D3E] shadow-lg" : "text-white/80 hover:text-white"}`}
            >
              <Map size={16} /> Bản Đồ Map
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${viewMode === "grid" ? "bg-white text-[#1B4D3E] shadow-lg" : "text-white/80 hover:text-white"}`}
            >
              <Grid size={16} /> Danh Sách Lều
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 space-y-8">
        {/* Filter Toolbar with Stay Type Toggle & Time Pickers */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            {/* Stay Type Toggle Pills */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleStayTypeChange("overnight")}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  stayType === "overnight"
                    ? "bg-[#1B4D3E] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🌙 Ở Qua Đêm (Resort Standard)
              </button>
              <button
                type="button"
                onClick={() => handleStayTypeChange("dayuse")}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  stayType === "dayuse"
                    ? "bg-amber-500 text-slate-900 shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ☀️ Ở Trong Ngày / Theo Giờ
              </button>
            </div>

            <div className="text-xs font-bold text-slate-500">
              {stayType === "overnight" ? (
                <span>
                  ⏰ Nhận lều <strong>14:00</strong> & Trả lều trước{" "}
                  <strong>12:00 (Trưa hôm sau)</strong>
                </span>
              ) : (
                <span>
                  ⏱️ Thuê linh hoạt trong ngày ➔ Chọn khoảng giờ nhận & trả bên
                  dưới
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-emerald-600" />{" "}
                {stayType === "overnight" ? "Ngày Check-in" : "Ngày Ở"}
              </label>
              <input
                type="date"
                value={checkInDate}
                min={today}
                onChange={(e) => handleCheckInChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-emerald-600" />{" "}
                {stayType === "overnight" ? "Ngày Check-out" : "Ngày Trả Lều"}
              </label>
              <input
                type="date"
                value={checkOutDate}
                min={checkInDate}
                onChange={(e) => handleCheckOutChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-600" /> Giờ Check-in
              </label>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <select
                  value={checkInTime.split(":")[0] || "14"}
                  onChange={(e) =>
                    setCheckInTime(
                      `${e.target.value}:${checkInTime.split(":")[1] || "00"}`,
                    )
                  }
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {HOURS_24.map((h) => (
                    <option key={h} value={h}>
                      {h} giờ
                    </option>
                  ))}
                </select>
                <span className="font-extrabold text-slate-400 text-xs">:</span>
                <select
                  value={checkInTime.split(":")[1] || "00"}
                  onChange={(e) =>
                    setCheckInTime(
                      `${checkInTime.split(":")[0] || "14"}:${e.target.value}`,
                    )
                  }
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {MINUTES_5M.map((m) => (
                    <option key={m} value={m}>
                      {m} phút
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-600" /> Giờ Check-out
              </label>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <select
                  value={checkOutTime.split(":")[0] || "12"}
                  onChange={(e) =>
                    setCheckOutTime(
                      `${e.target.value}:${checkOutTime.split(":")[1] || "00"}`,
                    )
                  }
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {HOURS_24.map((h) => (
                    <option key={h} value={h}>
                      {h} giờ
                    </option>
                  ))}
                </select>
                <span className="font-extrabold text-slate-400 text-xs">:</span>
                <select
                  value={checkOutTime.split(":")[1] || "00"}
                  onChange={(e) =>
                    setCheckOutTime(
                      `${checkOutTime.split(":")[0] || "12"}:${e.target.value}`,
                    )
                  }
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {MINUTES_5M.map((m) => (
                    <option key={m} value={m}>
                      {m} phút
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleSearchAvailability}
                className="w-full bg-[#1B4D3E] text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#1B4D3E]/90 transition-all font-bold text-sm shadow-md h-[42px]"
              >
                <Search size={16} />
                Tìm Lều Trống
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: Map or Grid View */}
        {loading ? (
          <div className="text-center py-24 text-emerald-700 font-bold animate-pulse">
            Đang tải bản đồ sơ đồ Bùi Hui Camping...
          </div>
        ) : viewMode === "map" ? (
          <CampsiteMap
            tents={effectiveTents}
            zones={effectiveZones}
            selectedTentIds={selectedTents.map((t) => t.id)}
            onSelectTent={handleSelectTent}
          />
        ) : (
          /* Zone-Grouped Grid View */
          <div className="space-y-10">
            {effectiveZones.map((zone) => {
              const zoneTents = (zone.tents || []).map((t) => {
                const liveTent =
                  effectiveTents.find((et) => et.id === t.id) || t;
                return liveTent;
              });

              if (zoneTents.length === 0) return null;

              return (
                <div key={zone.id} className="space-y-4">
                  {/* Zone Header Bar */}
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-8 bg-[#1B4D3E] rounded-full"></div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">
                          {zone.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {zone.description ||
                            "Khu cắm trại góc nhìn đẹp, thiên nhiên thoáng mát"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                      {zoneTents.filter((t) => t.status === "Available").length}{" "}
                      / {zoneTents.length} lều trống
                    </span>
                  </div>

                  {/* Tents Grid under Zone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {zoneTents.map((tent) => {
                      const isAvailable = tent.status === "Available";
                      const isPending = tent.status === "Pending";
                      const isSelected = selectedTents.some(
                        (t) => t.id === tent.id,
                      );

                      return (
                        <div
                          key={tent.id}
                          onClick={() => handleSelectTent(tent)}
                          className={`bg-white rounded-3xl p-6 shadow-sm border transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl ${
                            isSelected
                              ? "border-amber-500 ring-2 ring-amber-400 bg-amber-50/20"
                              : isAvailable
                                ? "border-slate-200 hover:border-emerald-500"
                                : isPending
                                  ? "border-amber-200 bg-amber-50/30"
                                  : "border-slate-100 opacity-60"
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 uppercase tracking-wider">
                                {zone.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                                  isSelected
                                    ? "bg-amber-500 text-white shadow-sm"
                                    : isAvailable
                                      ? "bg-emerald-100 text-emerald-700"
                                      : isPending
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {isSelected
                                  ? "Đang chọn"
                                  : isAvailable
                                    ? "Trống"
                                    : isPending
                                      ? "Chờ Xác Nhận"
                                      : "Đã Đặt"}
                              </span>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-800 mb-1">
                              Lều {tent.name}
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                              Săn mây, view núi rừng thoáng mát
                            </p>
                          </div>
                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                                Giá thuê/đêm
                              </span>
                              <span className="text-lg font-black text-emerald-600">
                                {tent.price
                                  ? tent.price.toLocaleString("vi-VN") + "đ"
                                  : "0đ"}
                              </span>
                            </div>
                            <button
                              className={`p-2.5 rounded-xl shadow-md transition-all ${isSelected ? "bg-amber-500 text-white" : "bg-[#1B4D3E] text-white hover:bg-emerald-800"}`}
                            >
                              <ArrowRight size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Floating Selected Tents Bar when tents are selected */}
        {selectedTents.length > 0 && !isDrawerOpen && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1B4D3E]/95 backdrop-blur-xl text-white px-6 py-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 flex items-center gap-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-900 flex items-center justify-center font-black text-sm shadow-md">
                {selectedTents.length}
              </div>
              <div>
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Đã chọn {selectedTents.length} lều
                </p>
                <p className="text-sm font-extrabold truncate max-w-[200px] sm:max-w-[340px]">
                  {selectedTents.map((t) => formatTentWithZone(t)).join(", ")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-white/20">
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-emerald-200 block uppercase font-medium">
                  Dự kiến ({nights} đêm)
                </span>
                <span className="text-sm font-black text-amber-300">
                  {grandTotal.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 active:scale-95"
              >
                Tiếp Tục Đặt Lều <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Selected Tent Drawer / Modal */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm pt-16 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg h-[calc(100vh-64px)] rounded-tl-3xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto border-l border-t border-slate-200 animate-in slide-in-from-right duration-300">
              <div>
                {/* Drawer Header */}
                <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
                      ĐÃ CHỌN {selectedTents.length} LỀU
                    </span>
                    <h2 className="text-2xl font-black text-slate-800 mt-2.5 tracking-tight">
                      Xác Nhận Yêu Cầu Giữ Lều
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      + Chọn thêm lều
                    </button>
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Tent Image Preview */}
                <div className="relative aspect-video rounded-2xl overflow-hidden mb-6 shadow-md border border-slate-100">
                  <img
                    src="https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmmwlohal5Ljr4cYstGs6k81HvmZbvhBXtN1zTl1QFLf0-HyX0HuaViTpbfIaABLgPGKK9s8u3nmha3RNeo9csLgXt1ZcHqfgy5-_8B6yYHEO1-uw2yXLzJXOx3mjnAaA6og8F_ab7i9kK6=s1360-w1360-h1020-rw"
                    alt="Bùi Hui Camping Tents"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4 text-white">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                        Săn Mây & View Núi Rừng
                      </span>
                      <p className="text-base font-black mt-1">
                        Bùi Hui Camping Peak
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer Details Form */}
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Họ & Tên Người Đặt (*)
                    </label>
                    <input
                      required
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Anh / Chị ..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Số Điện Thoại Zalo/Liên Hệ (*)
                    </label>
                    <input
                      required
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0xxxxxxxxx"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>

                  {/* Modal Date & Time Selection Box */}
                  <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#1B4D3E] uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={15} /> Thời gian nhận & trả lều (*)
                      </span>
                      <span className="text-[10px] font-extrabold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                        {stayType === "dayuse" ? "Trong ngày" : `${nights} đêm`}
                      </span>
                    </div>

                    {/* Stay Type Tabs: qua dem / trong ngay */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-emerald-200/60 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => handleStayTypeChange("overnight")}
                        className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${stayType === "overnight" ? "bg-[#1B4D3E] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}
                      >
                        ⛺ Qua đêm (14:00 - 12:00)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStayTypeChange("dayuse")}
                        className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${stayType === "dayuse" ? "bg-[#1B4D3E] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}
                      >
                        ⏱️ Trong ngày (Linh hoạt)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                          Ngày Check-in
                        </label>
                        <input
                          type="date"
                          value={checkInDate}
                          min={today}
                          onChange={(e) => handleCheckInChange(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                          Ngày Check-out
                        </label>
                        <input
                          type="date"
                          value={checkOutDate}
                          min={checkInDate}
                          onChange={(e) => handleCheckOutChange(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                          Giờ Check-in
                        </label>
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                          <select
                            value={checkInTime.split(":")[0] || "14"}
                            onChange={(e) =>
                              setCheckInTime(
                                `${e.target.value}:${checkInTime.split(":")[1] || "00"}`,
                              )
                            }
                            className="w-full bg-slate-50 border-none text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer rounded-lg p-1"
                          >
                            {HOURS_24.map((h) => (
                              <option key={h} value={h}>
                                {h} giờ
                              </option>
                            ))}
                          </select>
                          <span className="font-extrabold text-slate-400 text-xs">
                            :
                          </span>
                          <select
                            value={checkInTime.split(":")[1] || "00"}
                            onChange={(e) =>
                              setCheckInTime(
                                `${checkInTime.split(":")[0] || "14"}:${e.target.value}`,
                              )
                            }
                            className="w-full bg-slate-50 border-none text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer rounded-lg p-1"
                          >
                            {MINUTES_5M.map((m) => (
                              <option key={m} value={m}>
                                {m} phút
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                          Giờ Check-out
                        </label>
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                          <select
                            value={checkOutTime.split(":")[0] || "12"}
                            onChange={(e) =>
                              setCheckOutTime(
                                `${e.target.value}:${checkOutTime.split(":")[1] || "00"}`,
                              )
                            }
                            className="w-full bg-slate-50 border-none text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer rounded-lg p-1"
                          >
                            {HOURS_24.map((h) => (
                              <option key={h} value={h}>
                                {h} giờ
                              </option>
                            ))}
                          </select>
                          <span className="font-extrabold text-slate-400 text-xs">
                            :
                          </span>
                          <select
                            value={checkOutTime.split(":")[1] || "00"}
                            onChange={(e) =>
                              setCheckOutTime(
                                `${checkOutTime.split(":")[0] || "12"}:${e.target.value}`,
                              )
                            }
                            className="w-full bg-slate-50 border-none text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer rounded-lg p-1"
                          >
                            {MINUTES_5M.map((m) => (
                              <option key={m} value={m}>
                                {m} phút
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Selected Tents List & Zone Info */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                    <div className="flex justify-between text-xs font-medium text-slate-600">
                      <span>Thời gian lưu trú:</span>
                      <span className="font-bold text-slate-800">
                        {checkInDate} ➔ {checkOutDate} ({nights} đêm)
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">
                        Chi Tiết Khu Vực & Lều Đã Chọn ({selectedTents.length}):
                      </span>
                      {selectedTents.map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-sm"
                        >
                          <div>
                            <span className="text-emerald-700 font-extrabold block text-[11px]">
                              {t.zone?.name || "Khu Cắm Trại"}
                            </span>
                            <span className="text-slate-800 font-black text-sm">
                              Lều {t.name}
                            </span>
                          </div>
                          <span className="font-extrabold text-[#1B4D3E] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                            {t.price
                              ? t.price.toLocaleString("vi-VN") + "đ"
                              : "0đ"}{" "}
                            / đêm
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-800">
                      <span>Dự kiến tổng tiền ({nights} đêm):</span>
                      <span className="text-[#1B4D3E] text-base">
                        {grandTotal.toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-xs text-emerald-900 font-medium leading-relaxed">
                    💡 <strong>Quy trình giữ lều:</strong> Sau khi gửi yêu cầu,
                    Lễ tân Bùi Hui sẽ liên hệ SĐT/Zalo{" "}
                    <strong>{phoneNumber || "của bạn"}</strong> để tư vấn chi
                    tiết và hỗ trợ nhận cọc chốt giữ lều.
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#1B4D3E] hover:bg-emerald-800 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50"
                  >
                    <Send size={20} />
                    {isSubmitting
                      ? "Đang gửi yêu cầu..."
                      : `Gửi Yêu Cầu Đặt ${selectedTents.length} Lều`}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Success Ticket Screen */}
        {bookingSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md pt-16 animate-in fade-in">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-100 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle size={40} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  Đã Gửi Yêu Cầu Đặt Lều!
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Yêu cầu giữ lều của bạn đã được gửi đến Lễ Tân Bùi Hui
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2 font-medium">
                <p>
                  <span className="text-slate-400">Các lều chọn:</span>{" "}
                  <strong className="text-emerald-700 font-bold">
                    Lều {bookingSuccess.tentsList}
                  </strong>
                </p>
                <p>
                  <span className="text-slate-400">Thời gian:</span>{" "}
                  <strong className="text-slate-800">
                    {bookingSuccess.checkInDate} ➔ {bookingSuccess.checkOutDate}
                  </strong>
                </p>
                <p>
                  <span className="text-slate-400">Khách hàng:</span>{" "}
                  <strong className="text-slate-800">
                    {bookingSuccess.customerName}
                  </strong>
                </p>
                <p>
                  <span className="text-slate-400">Số điện thoại:</span>{" "}
                  <strong className="text-slate-800">
                    {bookingSuccess.phoneNumber}
                  </strong>
                </p>
                <p className="pt-2 text-amber-700 font-bold border-t border-slate-200">
                  📞 Lễ tân sẽ sớm liên hệ với bạn để hỗ trợ gửi mã QR nhận cọc
                  & chốt đơn!
                </p>
              </div>
              <button
                onClick={() => {
                  setBookingSuccess(null);
                  setSelectedTents([]);
                }}
                className="w-full bg-[#1B4D3E] text-white font-extrabold py-3.5 rounded-2xl shadow-lg hover:bg-emerald-800 transition-all"
              >
                Hoàn Tất & Về Trang Chủ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
