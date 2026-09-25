import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import {
  Tent,
  Users,
  Check,
  X,
  Phone,
  User,
  CalendarDays,
  Search,
  Filter,
  ShieldCheck,
  MapPin,
  ArrowRight,
  Home,
  Utensils,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  QrCode,
  Lock,
  Unlock,
  CreditCard,
  Calendar,
  LayoutGrid,
  Layers,
  Minus,
  Info,
  Sliders,
  Box
} from "lucide-react";
import MasterBillModal from "./MasterBillModal";
import toast from "react-hot-toast";
import { getApiUrl } from "../../apiConfig";
import signalRService from "../../services/signalrService";
import LandGridMatrix from "../../components/LandGridMatrix";
import CampsiteMap from "../../components/CampsiteMap";

const formatBookingDateTime = (raw) => {
  if (!raw) return { time: '--:--', date: '--/--/----', full: 'N/A' };
  if (typeof raw === 'string') {
    const cleanStr = raw.trim();
    if (cleanStr.includes('T')) {
      const parts = cleanStr.split('T');
      const datePart = parts[0];
      const timePart = parts[1].replace('Z', '').split('.')[0];
      
      const dParts = datePart.split('-');
      if (dParts.length === 3) {
        const year = dParts[0];
        const month = dParts[1];
        const day = dParts[2];
        const tParts = timePart.split(':');
        const hour = tParts[0] ? tParts[0].padStart(2, '0') : '00';
        const minute = tParts[1] ? tParts[1].padStart(2, '0') : '00';

        const timeFormatted = `${hour}:${minute}`;
        const dateFormatted = `${day}/${month}/${year}`;
        return {
          time: timeFormatted,
          date: dateFormatted,
          full: `${timeFormatted} - ${dateFormatted}`
        };
      }
    }
  }
  let d = new Date(raw);
  if (isNaN(d.getTime())) return { time: '--:--', date: '--/--/----', full: 'N/A' };
  const timeFormatted = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateFormatted = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return { time: timeFormatted, date: dateFormatted, full: `${timeFormatted} - ${dateFormatted}` };
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const MINUTES_5M = ["00", "15", "30", "45"];

export default function ReceptionistBookingPage() {
  const [receptionViewMode, setReceptionViewMode] = useState('flycam'); // 'flycam', 'grid' (Matrix) or 'cards'
  const [zones, setZones] = useState([]);
  const [selectedTents, setSelectedTents] = useState([]);
  const [activeActionBooking, setActiveActionBooking] = useState(null);
  const [hoveredBookingId, setHoveredBookingId] = useState(null);
  const [pitchModal, setPitchModal] = useState(null); // { zone, slot, size: 'Small' }
  const [pitchingLoading, setPitchingLoading] = useState(false);
  
  // Physical Tent Inventory Catalog & Receptionist Dynamic Setup on Pitches
  const [tentTypes, setTentTypes] = useState([]);
  const [tentSetupConfig, setTentSetupConfig] = useState({}); // { [tentTypeId]: quantity }
  
  const [bookingForm, setBookingForm] = useState({
    customerName: "",
    phoneNumber: "",
    depositAmount: "",
    note: "",
    bookingType: "Hourly", // "Hourly" or "Overnight"
    hourlyFirstHourPrice: "100000",
    hourlyExtraHourPrice: "50000",
    estimatedHours: "1",
    checkInDate: "",
    checkOutDate: "",
    checkInTime: "14:00",
    checkOutTime: "12:00",
  });
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingBookingAlerts, setPendingBookingAlerts] = useState([]);

  const handleConfirmPitchTent = async () => {
    if (!pitchModal) return;
    setPitchingLoading(true);
    try {
      const size = pitchModal.size || 'Small';
      const slots = size === 'Large' ? 4 : (size === 'Medium' ? 2 : 1);
      const prices = {
        Small: { night: 500000, firstHour: 100000, extraHour: 50000 },
        Medium: { night: 800000, firstHour: 150000, extraHour: 80000 },
        Large: { night: 1200000, firstHour: 250000, extraHour: 120000 }
      };
      const p = prices[size];
      const payload = {
        name: pitchModal.slot.slotCode,
        zoneId: pitchModal.zone.id,
        price: p.night,
        hourlyPriceFirstHour: p.firstHour,
        hourlyPriceExtraHour: p.extraHour,
        size: size,
        slotsOccupied: slots,
        slotCode: pitchModal.slot.slotCode,
        status: 'Available'
      };
      const res = await axios.post(getApiUrl('/api/Tents'), payload);
      toast.success(`Đã dựng Lều ${res.data.name} tại ô ${pitchModal.slot.slotCode}!`);
      const newTent = res.data;
      setPitchModal(null);
      await fetchZones();
      handleTentClick(newTent);
    } catch (err) {
      console.error("Lỗi khi dựng lều:", err);
      toast.error("Không thể dựng lều tại vị trí này.");
    } finally {
      setPitchingLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await fetch(getApiUrl("/api/Zones"));
      const data = await res.json();
      setZones(data);
    } catch (error) {
      console.error("Error fetching zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTentTypes = async () => {
    try {
      const res = await axios.get(getApiUrl("/api/TentTypes"));
      if (Array.isArray(res.data)) {
        setTentTypes(res.data);
      }
    } catch (error) {
      console.error("Error fetching tent types:", error);
    }
  };

  const fetchPendingBookingAlerts = async () => {
    try {
      const res = await fetch(getApiUrl("/api/Bookings/pending-requests"));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const alerts = data.map((b) => ({
            id: b.bookingId,
            bookingId: b.bookingId,
            customerName: b.customerName || "Khách hàng",
            phoneNumber: b.phoneNumber || "",
            tentsList: b.tentsList || "lều",
            checkInDate: b.checkInDate,
            checkOutDate: b.checkOutDate,
            receivedTime: b.bookingTime
              ? new Date(b.bookingTime).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : new Date().toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
          }));
          setPendingBookingAlerts(alerts);
        }
      }
    } catch (err) {
      console.error("Error fetching pending booking alerts:", err);
    }
  };

  const playChimeSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        880,
        audioCtx.currentTime + 0.2,
      );
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn("Audio notification disabled:", e);
    }
  };

  const handleAlertClick = async (alert) => {
    // 1. Dismiss this alert card from pending queue locally
    setPendingBookingAlerts((prev) => prev.filter((a) => a.id !== alert.id && a.bookingId !== alert.bookingId));

    // 2. Extract checkInDate & checkOutDate
    let targetIn = alert.checkInDate ? (typeof alert.checkInDate === "string" ? alert.checkInDate.split("T")[0] : "") : "";
    let targetOut = alert.checkOutDate ? (typeof alert.checkOutDate === "string" ? alert.checkOutDate.split("T")[0] : "") : "";

    if (targetIn) {
      setFilterCheckIn(targetIn);
      if (targetOut) {
        setFilterCheckOut(targetOut);
      } else {
        const nextDay = new Date(new Date(targetIn).getTime() + 86400000).toISOString().split("T")[0];
        setFilterCheckOut(nextDay);
      }
    }

    // Clear search filter so map displays normally without getting hidden by search query
    setStatusFilter("All");
    setSearchQuery("");

    // 3. Fetch fresh zones data
    await fetchZones();

    // 4. Auto-open sidebar for this booking
    if (alert.bookingId) {
      try {
        const res = await fetch(getApiUrl(`/api/Bookings/${alert.bookingId}`));
        if (res.ok) {
          const bookingData = await res.json();
          if (bookingData) {
            const primaryTent = bookingData.tents?.[0] || bookingData.tent;
            setActiveActionBooking({
              id: bookingData.id,
              status: bookingData.status,
              customerName: bookingData.customerName,
              phoneNumber: bookingData.phoneNumber,
              depositAmount: bookingData.depositAmount,
              checkInDate: bookingData.checkInDate,
              checkOutDate: bookingData.checkOutDate,
              bookingType: bookingData.bookingType,
              tentName: primaryTent?.name || "",
              zoneName: primaryTent?.zone?.name || "",
              tentPrice: primaryTent?.price || 0,
              bookingTents: bookingData.tents || []
            });
            toast.success(`Đã tự động chuyển đến ngày ${targetIn || 'bản đồ'} & mở đơn của ${bookingData.customerName}!`);
          }
        }
      } catch (err) {
        console.error("Error auto-opening booking details:", err);
      }
    }
  };

  useEffect(() => {
    fetchZones();
    fetchTentTypes();
    fetchPendingBookingAlerts();

    // Real-time SignalR listening
    signalRService.startConnection();

    const handleTentStatusChanged = () => {
      console.log(
        "⚡ SignalR TentStatusChanged received -> Fetching fresh zones data...",
      );
      fetchZones();
      fetchTentTypes();
      fetchPendingBookingAlerts();
    };

    const handleNewBookingRequest = (data) => {
      console.log("⚡ SignalR NewBookingRequest received:", data);
      playChimeSound();
      fetchPendingBookingAlerts();
      fetchZones();
      fetchTentTypes();
    };

    const handleTentTypesChanged = () => {
      console.log("⚡ SignalR TentTypesUpdated received -> Refreshing inventory...");
      fetchTentTypes();
    };

    signalRService.on("TentStatusChanged", handleTentStatusChanged);
    signalRService.on("TentTypesUpdated", handleTentTypesChanged);
    signalRService.on("BookingQrStatusChanged", handleTentStatusChanged);
    signalRService.on("OrderUpdated", handleTentStatusChanged);
    signalRService.on("NewBookingRequest", handleNewBookingRequest);

    return () => {
      signalRService.off("TentStatusChanged", handleTentStatusChanged);
      signalRService.off("TentTypesUpdated", handleTentTypesChanged);
      signalRService.off("BookingQrStatusChanged", handleTentStatusChanged);
      signalRService.off("OrderUpdated", handleTentStatusChanged);
      signalRService.off("NewBookingRequest", handleNewBookingRequest);
    };
  }, []);

  // Smart auto-config when selected land slots change
  useEffect(() => {
    const slotsCount = selectedTents.length;
    if (slotsCount === 0) {
      setTentSetupConfig({});
      return;
    }

    if (tentTypes.length === 0) return;

    // Check if existing config already matches slotsCount
    const currentTotalSlots = Object.entries(tentSetupConfig).reduce((sum, [typeId, qty]) => {
      const t = tentTypes.find(x => x.id === parseInt(typeId));
      return sum + (t?.slotsOccupied || 1) * qty;
    }, 0);

    if (currentTotalSlots === slotsCount && currentTotalSlots > 0) {
      // Configuration already accurately matches selected slots
      return;
    }

    // Pick best default match for the slot count
    const smallType = tentTypes.find(t => t.slotsOccupied === 1);
    const medType = tentTypes.find(t => t.slotsOccupied === 2);
    const largeType = tentTypes.find(t => t.slotsOccupied === 4);

    if (slotsCount === 1) {
      if (smallType) setTentSetupConfig({ [smallType.id]: 1 });
    } else if (slotsCount === 2) {
      if (medType && medType.availableQuantity > 0) {
        setTentSetupConfig({ [medType.id]: 1 });
      } else if (smallType) {
        setTentSetupConfig({ [smallType.id]: 2 });
      }
    } else if (slotsCount === 4) {
      if (largeType && largeType.availableQuantity > 0) {
        setTentSetupConfig({ [largeType.id]: 1 });
      } else if (medType && medType.availableQuantity >= 2) {
        setTentSetupConfig({ [medType.id]: 2 });
      } else if (smallType) {
        setTentSetupConfig({ [smallType.id]: 4 });
      }
    } else if (slotsCount === 3) {
      if (medType && smallType && medType.availableQuantity >= 1 && smallType.availableQuantity >= 1) {
        setTentSetupConfig({ [medType.id]: 1, [smallType.id]: 1 });
      } else if (smallType) {
        setTentSetupConfig({ [smallType.id]: 3 });
      }
    } else {
      if (smallType) {
        setTentSetupConfig({ [smallType.id]: slotsCount });
      }
    }
  }, [selectedTents.length, tentTypes]);

  const handleQuickSetupTentTypeInZone = (zone, targetTentType, chosenSlots) => {
    if (!chosenSlots || chosenSlots.length === 0) return;

    // Append newly chosen slots to selectedTents
    const existingIds = new Set(selectedTents.map(t => t.id));
    const newUniqueSlots = chosenSlots.filter(cs => !existingIds.has(cs.id));
    const updatedSelected = [...selectedTents, ...newUniqueSlots];
    
    setSelectedTents(updatedSelected);
    setActiveActionBooking(null);

    // Update tentSetupConfig with +1 of this tent type
    setTentSetupConfig(prev => {
      const cur = prev[targetTentType.id] || 0;
      return {
        ...prev,
        [targetTentType.id]: cur + 1
      };
    });

    // Update bookingForm prices if needed
    setBookingForm(prev => ({
      ...prev,
      hourlyFirstHourPrice: (targetTentType.hourlyFirstHourPrice || 100000).toString(),
      hourlyExtraHourPrice: (targetTentType.hourlyExtraHourPrice || 50000).toString(),
    }));

    const slotCodes = chosenSlots.map(s => s.slotCode || s.name.replace(/^Lều\s+/i, '')).join(' + ');
    toast.success(`Đã chọn ${chosenSlots.length} ô đất (${slotCodes}) tại ${zone.name} để dựng ${targetTentType.name}!`);
  };

  // Breakdown of physical tents currently configured for this booking
  const tentSetupDetailsList = Object.entries(tentSetupConfig)
    .filter(([_, qty]) => qty > 0)
    .map(([typeId, qty]) => {
      const t = tentTypes.find(x => x.id === parseInt(typeId));
      return {
        tentTypeId: parseInt(typeId),
        tentTypeName: t?.name || 'Lều',
        quantity: qty,
        slotsOccupied: t?.slotsOccupied || 1,
        price: t?.price || 500000,
        hourlyFirstHourPrice: t?.hourlyFirstHourPrice || 100000,
        hourlyExtraHourPrice: t?.hourlyExtraHourPrice || 50000
      };
    });

  const totalSlotsOccupiedByTents = tentSetupDetailsList.reduce(
    (sum, item) => sum + item.slotsOccupied * item.quantity, 
    0
  );

  const tentSetupSummary = tentSetupDetailsList.length > 0
    ? tentSetupDetailsList.map(item => `${item.quantity} ${item.tentTypeName}`).join(' + ')
    : '';

  const totalConfiguredOvernight = tentSetupDetailsList.reduce(
    (sum, item) => sum + item.price * item.quantity, 
    0
  );
  const totalConfiguredFirstHour = tentSetupDetailsList.reduce(
    (sum, item) => sum + item.hourlyFirstHourPrice * item.quantity, 
    0
  );
  const totalConfiguredExtraHour = tentSetupDetailsList.reduce(
    (sum, item) => sum + item.hourlyExtraHourPrice * item.quantity, 
    0
  );

  // Sync pricing into bookingForm when tent setup changes
  useEffect(() => {
    if (totalConfiguredFirstHour > 0) {
      setBookingForm((prev) => ({
        ...prev,
        hourlyFirstHourPrice: totalConfiguredFirstHour.toString(),
        hourlyExtraHourPrice: totalConfiguredExtraHour.toString(),
      }));
    }
  }, [totalConfiguredFirstHour, totalConfiguredExtraHour]);

  const updateTentQty = (typeId, delta) => {
    setTentSetupConfig((prev) => {
      const cur = prev[typeId] || 0;
      const next = Math.max(0, cur + delta);
      const newConfig = { ...prev, [typeId]: next };
      if (next === 0) delete newConfig[typeId];
      return newConfig;
    });
  };

  const getQuickPresetsForSlots = (slotsCount) => {
    if (!slotsCount || tentTypes.length === 0) return [];
    const small = tentTypes.find(t => t.slotsOccupied === 1);
    const med = tentTypes.find(t => t.slotsOccupied === 2);
    const large = tentTypes.find(t => t.slotsOccupied === 4);

    const presets = [];
    if (slotsCount === 1) {
      if (small) presets.push({ label: '1 Lều Nhỏ (~3m²)', config: { [small.id]: 1 } });
    } else if (slotsCount === 2) {
      if (med) presets.push({ label: '1 Lều Trung (~6m²)', config: { [med.id]: 1 } });
      if (small) presets.push({ label: '2 Lều Nhỏ (2x~3m²)', config: { [small.id]: 2 } });
    } else if (slotsCount === 4) {
      if (large) presets.push({ label: '1 Lều Lớn (~12m²)', config: { [large.id]: 1 } });
      if (med) presets.push({ label: '2 Lều Trung (2x~6m²)', config: { [med.id]: 2 } });
      if (med && small) presets.push({ label: '1 Trung + 2 Nhỏ', config: { [med.id]: 1, [small.id]: 2 } });
      if (small) presets.push({ label: '4 Lều Nhỏ (4x~3m²)', config: { [small.id]: 4 } });
    } else if (slotsCount === 3) {
      if (med && small) presets.push({ label: '1 Trung + 1 Nhỏ', config: { [med.id]: 1, [small.id]: 1 } });
      if (small) presets.push({ label: '3 Lều Nhỏ (3x~3m²)', config: { [small.id]: 3 } });
    } else if (slotsCount >= 5) {
      if (large) {
        const numLarge = Math.floor(slotsCount / 4);
        const rem = slotsCount % 4;
        const cfg = { [large.id]: numLarge };
        if (rem === 2 && med) cfg[med.id] = 1;
        else if (rem > 0 && small) cfg[small.id] = rem;
        presets.push({ label: `Kết hợp (${slotsCount} ô)`, config: cfg });
      }
      if (small) presets.push({ label: `${slotsCount} Lều Nhỏ`, config: { [small.id]: slotsCount } });
    }
    return presets;
  };

  const isPresetActive = (presetConfig) => {
    const pKeys = Object.keys(presetConfig);
    const cKeys = Object.keys(tentSetupConfig);
    if (pKeys.length !== cKeys.length) return false;
    return pKeys.every(k => presetConfig[k] === tentSetupConfig[k]);
  };

  const submitBooking = async () => {
    const cleanName = (bookingForm.customerName || '').trim();
    const cleanPhone = (bookingForm.phoneNumber || '').trim();

    const nameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầnẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừÝỲỸỶỊýỳỹỷị\s]{2,50}$/;
    if (!cleanName || /\d/.test(cleanName) || cleanName.length < 2 || !nameRegex.test(cleanName)) {
      return toast.error("Họ & Tên không hợp lệ! Vui lòng nhập bằng chữ cái đàng hoàng (từ 2 ký tự trở lên, không chứa số).");
    }

    const phoneRegex = /^0[0-9]{9}$/;
    if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
      return toast.error("Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số (bắt đầu bằng số 0).");
    }

    if (totalSlotsOccupiedByTents > selectedTents.length) {
      return toast.error(`Số lượng lều vượt quá diện tích ${selectedTents.length} ô đất đã chọn (đang cần ${totalSlotsOccupiedByTents} ô)! Vui lòng bớt lều.`);
    }
    if (totalSlotsOccupiedByTents === 0) {
      return toast.error("Vui lòng chọn ít nhất 1 lều để dựng trên các ô đất!");
    }

    try {
      const inStr = `${bookingForm.checkInDate || filterCheckIn}T${bookingForm.checkInTime || "14:00"}:00`;
      const outStr =
        bookingForm.bookingType === "Hourly"
          ? null
          : `${bookingForm.checkOutDate || filterCheckOut}T${bookingForm.checkOutTime || "12:00"}:00`;

      const res = await fetch(getApiUrl("/api/Bookings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: bookingForm.customerName,
          phoneNumber: bookingForm.phoneNumber,
          tentIds: selectedTents.map((t) => t.id),
          bookingType: bookingForm.bookingType,
          checkInDate: inStr,
          checkOutDate: outStr,
          depositAmount: parseFloat(bookingForm.depositAmount) || 0,
          hourlyFirstHourPrice:
            parseFloat(bookingForm.hourlyFirstHourPrice) || 100000,
          hourlyExtraHourPrice:
            parseFloat(bookingForm.hourlyExtraHourPrice) || 50000,
          estimatedHours: parseInt(bookingForm.estimatedHours) || 1,
          note: bookingForm.note || "",
          tentSetupDetails: JSON.stringify(tentSetupDetailsList),
          tentSetupSummary: tentSetupSummary,
        }),
      });

      if (res.ok) {
        toast.success(
          bookingForm.bookingType === "Hourly"
            ? "Tạo đơn thuê lều theo giờ thành công!"
            : "Tạo đơn đặt lều qua đêm thành công!",
        );
        setSelectedTents([]);
        setTentSetupConfig({});
        setBookingForm({
          customerName: "",
          phoneNumber: "",
          depositAmount: "",
          note: "",
          bookingType: "Hourly",
          hourlyFirstHourPrice: "100000",
          hourlyExtraHourPrice: "50000",
          estimatedHours: "1",
          checkInDate: "",
          checkOutDate: "",
          checkInTime: "14:00",
          checkOutTime: "12:00",
        });
        fetchZones();
        fetchTentTypes();
      }
    } catch (err) {
      console.error("Error booking:", err);
      toast.error("Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  const [customDeposit, setCustomDeposit] = useState("");

  const handleBookingAction = async (action) => {
    if (!activeActionBooking || !activeActionBooking.id) {
      toast.error("Không tìm thấy thông tin đơn đặt, vui lòng thử lại.");
      return;
    }
    try {
      const finalTentIds =
        activeActionBooking.bookingTents?.map((t) => t.id) || [];
      const body =
        action === "confirm-deposit"
          ? JSON.stringify({
              depositAmount: parseFloat(customDeposit) || 0,
              finalTentIds,
            })
          : null;

      const res = await fetch(
        getApiUrl(`/api/Bookings/${activeActionBooking.id}/${action}`),
        {
          method: "PUT",
          headers: body ? { "Content-Type": "application/json" } : {},
          body,
        },
      );
      if (res.ok) {
        if (action === "confirm-deposit") {
          toast.success(
            `Đã xác nhận cọc & chốt ${finalTentIds.length} lều thành công!`,
          );
        } else if (action === "reject-request") {
          toast.success("Đã hủy yêu cầu đặt lều.");
        } else if (action === "checkin") {
          toast.success("Nhận lều thành công!");
        } else {
          toast.success("Check-out thành công!");
        }
        setActiveActionBooking(null);
        setCustomDeposit("");
        fetchZones();
        fetchPendingBookingAlerts();
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  const handleToggleQrLock = async (bookingId) => {
    try {
      const res = await axios.post(
        getApiUrl(`/api/Bookings/${bookingId}/toggle-qr-lock`),
      );
      if (res.data) {
        const isUnlocked = res.data.isQrUnlocked;
        toast.success(
          res.data.message ||
            (isUnlocked ? "Đã MỞ KHÓA mã QR!" : "Đã KHÓA mã QR!"),
        );
        if (activeActionBooking && activeActionBooking.id === bookingId) {
          setActiveActionBooking({
            ...activeActionBooking,
            isQrUnlocked: isUnlocked,
          });
        }
        fetchZones();
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể thay đổi trạng thái mở/khóa QR");
    }
  };

  const handleToggleTentQrLock = async (tentId) => {
    try {
      const res = await axios.post(
        getApiUrl(`/api/Tents/${tentId}/toggle-qr-lock`),
      );
      if (res.data) {
        toast.success(res.data.message || "Đã cập nhật trạng thái QR lều!");
        const newUnlockedState = res.data.isQrUnlocked;
        if (activeActionBooking && activeActionBooking.bookingTents) {
          const updatedBookingTents = activeActionBooking.bookingTents.map(
            (t) =>
              t.id === tentId ? { ...t, isQrUnlocked: newUnlockedState } : t,
          );
          setActiveActionBooking({
            ...activeActionBooking,
            bookingTents: updatedBookingTents,
          });
        }
        fetchZones();
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể thay đổi trạng thái QR cho lều này");
    }
  };

  const handleRemoveTentFromBooking = (tentId) => {
    if (!activeActionBooking || !activeActionBooking.bookingTents) return;
    if (activeActionBooking.bookingTents.length <= 1) {
      toast.error(
        "Đơn đặt phải có ít nhất 1 lều. Nếu khách không muốn đặt nữa, hãy bấm nút 'Từ Chối / Hủy Yêu Cầu'.",
      );
      return;
    }
    const updatedTents = activeActionBooking.bookingTents.filter(
      (t) => t.id !== tentId,
    );
    setActiveActionBooking({
      ...activeActionBooking,
      bookingTents: updatedTents,
    });
    toast.success("Đã bỏ 1 lều khỏi danh sách chốt!");
  };

  const [selectedMasterBill, setSelectedMasterBill] = useState(null);

  // Date Range Filter States (default: today -> tomorrow)
  const [searchParams] = useSearchParams();
  const [filterCheckIn, setFilterCheckIn] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [filterCheckOut, setFilterCheckOut] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0],
  );
  const [filterCheckInTime, setFilterCheckInTime] = useState("14:00");
  const [filterCheckOutTime, setFilterCheckOutTime] = useState("12:00");

  useEffect(() => {
    const qInDate = searchParams.get("checkIn");
    const qOutDate = searchParams.get("checkOut");
    const qInTime = searchParams.get("checkInTime");
    const qOutTime = searchParams.get("checkOutTime");

    if (qInDate) setFilterCheckIn(qInDate);
    if (qOutDate) setFilterCheckOut(qOutDate);
    if (qInTime) setFilterCheckInTime(qInTime);
    if (qOutTime) setFilterCheckOutTime(qOutTime);
  }, [searchParams]);

  // Compute date & time-effective zones & tents for selected filter timestamps
  const effectiveZones = zones.map((zone) => ({
    ...zone,
    tents: (zone.tents || []).map((tent) => {
      const activeBooking = tent.bookings?.find((b) => {
        if (
          b.status === "CheckedOut" ||
          b.status === "Cancelled" ||
          b.status === "Rejected"
        )
          return false;
        if (!b.checkInDate || !b.checkOutDate) return true;

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

        const targetIn = new Date(
          `${filterCheckIn}T${filterCheckInTime || "14:00"}:00`,
        );
        const targetOut = new Date(
          `${filterCheckOut}T${filterCheckOutTime || "12:00"}:00`,
        );

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
    }),
  }));

  const handleTentClick = (tent) => {
    const parentZone =
      effectiveZones.find((z) => z.tents?.some((t) => t.id === tent.id)) ||
      tent.zone;
    const zoneName = parentZone?.name || "";
    const activeBooking = tent.activeBooking;

    if (tent.status === "Available" && !activeBooking) {
      setActiveActionBooking(null);
      let updatedSelected = [];
      if (selectedTents.find((t) => t.id === tent.id)) {
        updatedSelected = selectedTents.filter((t) => t.id !== tent.id);
      } else {
        updatedSelected = [...selectedTents, tent];
      }
      setSelectedTents(updatedSelected);

      if (updatedSelected.length > 0) {
        const lastTent = updatedSelected[updatedSelected.length - 1];
        setBookingForm((prev) => ({
          ...prev,
          hourlyFirstHourPrice: (
            lastTent.hourlyPriceFirstHour ||
            lastTent.HourlyPriceFirstHour ||
            100000
          ).toString(),
          hourlyExtraHourPrice: (
            lastTent.hourlyPriceExtraHour ||
            lastTent.HourlyPriceExtraHour ||
            50000
          ).toString(),
        }));
      }
    } else {
      setSelectedTents([]);
      if (activeBooking) {
        // Collect ALL tents belonging to this booking request across all zones
        const bookingTents = effectiveZones
          .flatMap((z) =>
            (z.tents || []).map((tItem) => ({
              ...tItem,
              zoneName: z.name,
            })),
          )
          .filter((tItem) =>
            tItem.bookings?.some((b) => b.id === activeBooking.id) || tItem.activeBooking?.id === activeBooking.id,
          );

        setActiveActionBooking({
          ...activeBooking,
          tentName: tent.name,
          zoneName: zoneName,
          bookingTents:
            bookingTents.length > 0 ? bookingTents : [{ ...tent, zoneName }],
          status: activeBooking.status || tent.status,
          tentPrice: tent.price,
        });
        if (activeBooking.depositAmount) {
          setCustomDeposit(activeBooking.depositAmount.toString());
        } else {
          setCustomDeposit("");
        }
      } else {
        setActiveActionBooking({
          tentName: tent.name,
          zoneName: zoneName,
          bookingTents: [{ ...tent, zoneName }],
          status: tent.status,
          customerName: "Khách hàng",
          tentPrice: tent.price,
        });
      }
    }
  };

  const allTents = effectiveZones.flatMap((z) => z.tents || []);
  const availableCount = allTents.filter(
    (t) => t.status === "Available",
  ).length;
  const pendingCount = allTents.filter(
    (t) => t.status === "Pending" || t.activeBooking?.status === "Pending",
  ).length;
  const bookedCount = allTents.filter(
    (t) => t.status === "Booked" || t.activeBooking?.status === "Booked",
  ).length;
  const occupiedCount = allTents.filter(
    (t) => t.status === "Occupied" || t.activeBooking?.status === "Occupied",
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary font-bold animate-pulse">
          Đang tải sơ đồ lều...
        </div>
      </div>
    );
  }

  const handleFilterCheckInChange = (val) => {
    setFilterCheckIn(val);
    if (filterCheckOut && val > filterCheckOut) {
      const nextDay = new Date(new Date(val).getTime() + 86400000)
        .toISOString()
        .split("T")[0];
      setFilterCheckOut(nextDay);
    }
  };

  const handleFilterCheckOutChange = (val) => {
    if (val < filterCheckIn) {
      toast.error("Ngày Check-out phải lớn hơn hoặc bằng ngày Check-in!");
      setFilterCheckOut(filterCheckIn);
      return;
    }
    setFilterCheckOut(val);
  };

  const handleSearchByDate = () => {
    fetchZones();
    const formattedIn = new Date(filterCheckIn).toLocaleDateString("vi-VN");
    const formattedOut = new Date(filterCheckOut).toLocaleDateString("vi-VN");
    toast.success(
      `Đã lọc tình trạng lều cho ngày ${formattedIn} ➔ ${formattedOut}`,
    );
  };

  const isSidebarOpen =
    selectedTents.length > 0 || activeActionBooking !== null;

  return (
    <div
      className={`transition-all duration-300 ${isSidebarOpen ? "mr-[400px]" : ""}`}
    >
      {/* Header & Status Filter Pills */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <span className="font-label-caps text-label-caps text-primary opacity-60 mb-1 block">
            TỔNG QUAN KHU VỰC
          </span>
          <h2 className="font-headline-lg text-2xl sm:text-3xl font-black text-primary">
            Sơ Đồ Lều Trại
          </h2>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div
            onClick={() =>
              setStatusFilter(statusFilter === "Pending" ? "All" : "Pending")
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-bold transition-all ${
              statusFilter === "Pending"
                ? "bg-amber-500 text-white shadow-md border-amber-600"
                : "bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            Chờ xử lý ({pendingCount})
          </div>
          <div
            onClick={() =>
              setStatusFilter(statusFilter === "Occupied" ? "All" : "Occupied")
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-bold transition-all ${
              statusFilter === "Occupied"
                ? "bg-emerald-700 text-white shadow-md border-emerald-800"
                : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Đang ở ({occupiedCount})
          </div>
          <div
            onClick={() =>
              setStatusFilter(
                statusFilter === "Available" ? "All" : "Available",
              )
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-bold transition-all ${
              statusFilter === "Available"
                ? "bg-slate-800 text-white shadow-md border-slate-900"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            Trống ({availableCount})
          </div>
          <div
            onClick={() =>
              setStatusFilter(statusFilter === "Booked" ? "All" : "Booked")
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-bold transition-all ${
              statusFilter === "Booked"
                ? "bg-teal-700 text-white shadow-md border-teal-800"
                : "bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
            Đã đặt ({bookedCount})
          </div>
        </div>
      </header>

      {/* Horizontal Control Toolbar: Search Bar + Single-line Date/Time Filter Bar */}
      <div className="mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên lều, tên khách..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        {/* Date & Time Picker Bar (Horizontal Single-Line) */}
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 overflow-x-auto whitespace-nowrap custom-scrollbar">
          <CalendarDays size={16} className="text-emerald-700 shrink-0" />
          <span className="shrink-0">Nhận:</span>
          <input
            type="date"
            value={filterCheckIn}
            onChange={(e) => handleFilterCheckInChange(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none text-emerald-900 font-extrabold shrink-0"
          />
          {/* CheckIn Time */}
          <div className="inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl px-1.5 py-1 shrink-0">
            <select
              value={filterCheckInTime.split(":")[0] || "14"}
              onChange={(e) =>
                setFilterCheckInTime(
                  `${e.target.value}:${filterCheckInTime.split(":")[1] || "00"}`,
                )
              }
              className="bg-transparent focus:outline-none text-emerald-900 font-extrabold cursor-pointer text-xs"
            >
              {HOURS_24.map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
            <span className="font-extrabold text-slate-400 text-xs">:</span>
            <select
              value={filterCheckInTime.split(":")[1] || "00"}
              onChange={(e) =>
                setFilterCheckInTime(
                  `${filterCheckInTime.split(":")[0] || "14"}:${e.target.value}`,
                )
              }
              className="bg-transparent focus:outline-none text-emerald-900 font-extrabold cursor-pointer text-xs"
            >
              {MINUTES_5M.map((m) => (
                <option key={m} value={m}>
                  {m}p
                </option>
              ))}
            </select>
          </div>

          <span className="mx-1 text-slate-400 font-extrabold shrink-0">
            &rarr;
          </span>
          <span className="shrink-0">Trả:</span>
          <input
            type="date"
            value={filterCheckOut}
            min={filterCheckIn}
            onChange={(e) => handleFilterCheckOutChange(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none text-emerald-900 font-extrabold shrink-0"
          />

          {/* CheckOut Time */}
          <div className="inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl px-1.5 py-1 shrink-0">
            <select
              value={filterCheckOutTime.split(":")[0] || "12"}
              onChange={(e) =>
                setFilterCheckOutTime(
                  `${e.target.value}:${filterCheckOutTime.split(":")[1] || "00"}`,
                )
              }
              className="bg-transparent focus:outline-none text-emerald-900 font-extrabold cursor-pointer text-xs"
            >
              {HOURS_24.map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
            <span className="font-extrabold text-slate-400 text-xs">:</span>
            <select
              value={filterCheckOutTime.split(":")[1] || "00"}
              onChange={(e) =>
                setFilterCheckOutTime(
                  `${filterCheckOutTime.split(":")[0] || "12"}:${e.target.value}`,
                )
              }
              className="bg-transparent focus:outline-none text-emerald-900 font-extrabold cursor-pointer text-xs"
            >
              {MINUTES_5M.map((m) => (
                <option key={m} value={m}>
                  {m}p
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:px-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chế độ hiển thị:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap">
            <button
              onClick={() => setReceptionViewMode('flycam')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                receptionViewMode === 'flycam' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Compass size={15} /> Bản Đồ Flycam Ô Đất
            </button>
            <button
              onClick={() => setReceptionViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                receptionViewMode === 'grid' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid size={15} /> Ma Trận Ô Đất (~3m²)
            </button>
            <button
              onClick={() => setReceptionViewMode('cards')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                receptionViewMode === 'cards' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers size={15} /> Thẻ Lều Chi Tiết
            </button>
          </div>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">
          * Nhấp vào ô lều trên ma trận để chọn đặt cọc / check-in hoặc xem thông tin khách
        </span>
      </div>

      {receptionViewMode === 'flycam' ? (
        <div className="space-y-6">
          <CampsiteMap
            tents={effectiveZones.flatMap((z) => z.tents || [])}
            zones={effectiveZones}
            selectedTentIds={selectedTents.map((t) => t.id)}
            onSelectTent={handleTentClick}
            onQuickSetupTentType={handleQuickSetupTentTypeInZone}
            tentTypes={tentTypes}
            onAddTentAtSlot={(zone, slot) => setPitchModal({ zone, slot, size: 'Small' })}
            mode="staff"
          />
        </div>
      ) : (
        /* Zones & Bento Grid */
        <div className="space-y-12">
          {effectiveZones.map((zone) => {
            const filteredTents = (zone.tents || []).filter((tent) => {
            const activeBooking = tent.activeBooking;
            const tentStatus = tent.status;
            const matchesStatus =
              statusFilter === "All" || tentStatus === statusFilter;
            const matchesSearch =
              !searchQuery ||
              tent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (activeBooking?.customerName || "")
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              (activeBooking?.phoneNumber || "").includes(searchQuery);
            return matchesStatus && matchesSearch;
          });

          if (filteredTents.length === 0 && searchQuery) return null;

          const totalSlots = zone.totalSlots || 20;
          const usedSlots = (zone.tents || []).reduce((sum, t) => {
            const isBusy = t.status === "Booked" || t.status === "Occupied" || t.status === "Pending";
            const slots = t.slotsOccupied || (t.size === "Large" ? 4 : (t.size === "Medium" ? 2 : 1));
            return isBusy ? sum + slots : sum;
          }, 0);
          const availableSlots = Math.max(0, totalSlots - usedSlots);
          const percentUsed = Math.min(100, Math.round((usedSlots / totalSlots) * 100));
          const isDining = zone.zoneType === "DiningTable";

          if (receptionViewMode === "grid" && !isDining) {
            return (
              <div key={zone.id}>
                <LandGridMatrix
                  zone={zone}
                  tents={filteredTents}
                  mode="receptionist"
                  selectedTentIds={selectedTents.map((t) => t.id)}
                  onSelectTent={handleTentClick}
                  onAddTentAtSlot={(z, s) => setPitchModal({ zone: z, slot: s, size: 'Small' })}
                />
              </div>
            );
          }

          return (
            <div key={zone.id} className="space-y-6">
              {/* Zone Header with Land Capacity Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-headline-md text-xl font-extrabold text-primary">
                      {zone.name}
                    </h3>
                    {!isDining && (
                      <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${
                        percentUsed >= 90 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        percentUsed >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        Công suất: {percentUsed}% ({usedSlots}/{totalSlots} ô)
                      </span>
                    )}
                  </div>
                  {!isDining && (
                    <p className="text-xs text-slate-500 mt-1">
                      Tổng bãi: <strong>{totalSlots} ô (~{totalSlots * 3}m²)</strong> • Đang dựng: <strong>{usedSlots} ô (~{usedSlots * 3}m²)</strong> • Còn trống: <strong>{availableSlots} ô (~{availableSlots * 3}m²)</strong>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {!isDining && (
                    <div className="w-36 bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200 hidden sm:block">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          percentUsed >= 90 ? 'bg-rose-500' :
                          percentUsed >= 70 ? 'bg-amber-500' :
                          'bg-emerald-600'
                        }`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                  )}
                  <span className="font-label-caps text-xs text-on-surface-variant font-bold bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    {filteredTents.length} {isDining ? 'BÀN' : 'VỊ TRÍ Ô'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredTents.map((tent) => {
                  const activeBooking = tent.activeBooking;
                  const isPending = tent.status === "Pending";
                  const isBooked = tent.status === "Booked";
                  const isOccupied = tent.status === "Occupied";

                  const tentBookingId = activeBooking?.id;
                  const siblingTentsInBooking = tentBookingId
                    ? allTents.filter(t => (t.activeBooking?.id || t.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected')?.id) === tentBookingId)
                    : [];
                  const isGrouped = siblingTentsInBooking.length > 1;

                  const isLinkedToHoveredBooking = Boolean(hoveredBookingId && tentBookingId === hoveredBookingId);
                  const isDimmed = Boolean(hoveredBookingId && !isLinkedToHoveredBooking);

                  const guestName = activeBooking
                    ? activeBooking.customerName
                    : "-";
                  const isSelected = selectedTents.find(
                    (t) => t.id === tent.id,
                  );
                  const isActionActive =
                    activeActionBooking?.tentName === tent.name;

                  const sizeTag = isDining ? "Bàn Ăn" : (
                    isGrouped ? `Lều Gộp (${siblingTentsInBooking.length} ô ~${siblingTentsInBooking.length * 3}m²)` : "Ô Chuẩn (~3m²)"
                  );
                  const slotDisplay = tent.slotCode 
                    ? (tent.slotCode.toLowerCase().startsWith('ô') || tent.slotCode.toLowerCase().startsWith('bàn') ? tent.slotCode : `Ô ${tent.slotCode}`)
                    : (tent.name.toLowerCase().startsWith('lều') || tent.name.toLowerCase().startsWith('bàn') ? tent.name : `Ô ${tent.name}`);

                  let badgeColor =
                    "bg-secondary-container text-on-secondary-container";
                  let badgeText = "Trống";
                  let cardBorder = "border-outline-variant/10 hover:shadow-md";
                  let bgHighlight = "";

                  if (isSelected) {
                    badgeColor = "bg-[#1B4D3E] text-white font-bold";
                    badgeText = "Đang Chọn";
                    cardBorder =
                      "border-[#1B4D3E] ring-2 ring-[#1B4D3E]/40 shadow-lg";
                  } else if (isPending) {
                    badgeColor =
                      "bg-amber-500 text-white font-black animate-pulse";
                    badgeText = "KHÁCH ĐẶT MỚI";
                    cardBorder =
                      "border-amber-400 ring-2 ring-amber-400/50 shadow-xl";
                    bgHighlight = "bg-amber-50/70";
                  } else if (isOccupied) {
                    badgeColor =
                      "bg-primary-container text-on-primary-container font-bold";
                    badgeText = isGrouped ? `Đang Ở (${siblingTentsInBooking.length} ô)` : "Đang Ở";
                    cardBorder = "border-emerald-300";
                  } else if (isBooked) {
                    badgeColor =
                      "bg-tertiary-fixed-dim text-on-tertiary-fixed-variant font-bold";
                    badgeText = isGrouped ? `Đã Cọc (${siblingTentsInBooking.length} ô)` : "Đã Đặt (Đã Cọc)";
                    cardBorder = "border-teal-300";
                  }

                  return (
                    <div
                      key={tent.id}
                      onClick={() => handleTentClick(tent)}
                      onMouseEnter={() => {
                        if (tentBookingId) setHoveredBookingId(tentBookingId);
                      }}
                      onMouseLeave={() => {
                        setHoveredBookingId(null);
                      }}
                      className={`glass-panel group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 cursor-pointer ${
                        isLinkedToHoveredBooking
                          ? "border-amber-400 ring-4 ring-amber-400 shadow-2xl scale-[1.03] z-20 bg-amber-50/80"
                          : isDimmed
                            ? "opacity-35 scale-95 transition-all"
                            : `${cardBorder} ${bgHighlight} ${isActionActive ? "border-primary shadow-lg scale-[1.02]" : ""}`
                      }`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <span className="font-black text-sm text-slate-900 block">
                            {slotDisplay}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-0.5">
                            {sizeTag}
                          </span>
                        </div>
                        <Tent
                          size={20}
                          className={
                            isPending
                              ? "text-amber-600 animate-bounce"
                              : "text-primary-fixed-dim group-hover:text-primary transition-colors"
                          }
                        />
                      </div>
                      <div>
                        <p className="text-on-surface-variant font-medium text-xs mb-1">
                          {guestName !== "-" ? "Khách Hàng" : "Tình Trạng"}
                        </p>
                        <p className="font-headline-sm text-headline-sm text-primary truncate font-extrabold">
                          {guestName !== "-" ? guestName : badgeText}
                        </p>
                      </div>
                      <div className="mt-6 flex items-center justify-between">
                        <div
                          className={`px-3 py-1 rounded-full ${badgeColor} text-[10px] uppercase tracking-widest`}
                        >
                          {badgeText}
                        </div>
                        <ArrowRight
                          size={16}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant"
                        />
                      </div>
                      {(isSelected || isActionActive) && (
                        <div className="absolute inset-0 border-2 border-primary/20 rounded-2xl pointer-events-none"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Floating Ergonomic Multi-Slot Action Bar for Receptionist */}
      {selectedTents.length > 0 && !activeActionBooking && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300 w-[95%] max-w-2xl bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] border border-amber-400/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-white">
                  Đã chọn {selectedTents.length} ô đất
                </span>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  ~{selectedTents.length * 3}m²
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                  {tentSetupSummary ? `Setup: ${tentSetupSummary}` : `Chưa chọn lều`}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5 truncate max-w-xs sm:max-w-md">
                Các ô: {selectedTents.map(t => t.slotCode || t.name.replace(/^Lều\s+/i, '')).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTents([])}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1"
            >
              <X size={14} /> Bỏ chọn
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("booking-drawer-scroll");
                if (el) el.scrollTop = 0;
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              <Sparkles size={15} />
              Setup Lều & Đặt Chỗ ({selectedTents.length} Ô)
            </button>
          </div>
        </div>
      )}

      {/* MASTER SIDEBAR */}
      <aside
        className={`fixed right-0 top-0 h-screen w-[420px] glass-panel border-l border-outline-variant/10 z-40 p-6 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Sticky Header */}
        <div className="mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-label-caps text-xs text-secondary uppercase font-extrabold tracking-wider">
              {activeActionBooking ? "QUẢN LÝ THÔNG TIN LỀU" : "TẠO ĐƠN MỚI"}
            </span>
            <button
              onClick={() => {
                setSelectedTents([]);
                setActiveActionBooking(null);
              }}
              className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
            >
              <X size={22} />
            </button>
          </div>

          {activeActionBooking ? (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider block">
                    {activeActionBooking.zoneName || "Khu cắm trại"}
                  </span>
                  <h3 className="text-xl font-black text-slate-800">
                    {activeActionBooking.tentSetupSummary || `Lều ${activeActionBooking.tentName}`}
                  </h3>
                  {activeActionBooking.bookingTents && activeActionBooking.bookingTents.length > 0 && (
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Vị trí ô đất: <strong className="text-slate-700 font-mono">{activeActionBooking.bookingTents.map(t => t.slotCode || t.name.replace(/^Lều\s+/i, '')).join(', ')}</strong> ({activeActionBooking.bookingTents.length} ô ~{activeActionBooking.bookingTents.length * 3}m²)
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                      activeActionBooking.status === "Pending"
                        ? "bg-amber-400 text-slate-900 shadow-sm animate-pulse"
                        : activeActionBooking.status === "Booked"
                          ? "bg-teal-100 text-teal-800"
                          : activeActionBooking.status === "Occupied"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {activeActionBooking.status === "Pending"
                      ? "CÓ YÊU CẦU ĐẶT"
                      : activeActionBooking.status === "Booked"
                        ? "ĐÃ ĐẶT CỌC"
                        : activeActionBooking.status === "Occupied"
                          ? "ĐANG Ở"
                          : activeActionBooking.status}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Khu Đất {selectedTents.length} Ô Chuẩn
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  ~{selectedTents.length * 3}m²
                </span>
              </div>
              <h3 className="font-headline-md text-xl font-extrabold text-primary mt-1">
                {tentSetupSummary || `Setup Lều Cho ${selectedTents.length} Ô Đất`}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Vị trí ô: <strong className="text-slate-700">{selectedTents.map(t => t.slotCode || t.name.replace(/^Lều\s+/i, '')).join(', ')}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Scrollable Body Content */}
        <div id="booking-drawer-scroll" className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar pb-6">
          {/* New Manual Booking Form */}
          {selectedTents.length > 0 &&
            !activeActionBooking &&
            (() => {
              const isHourly = bookingForm.bookingType === "Hourly";
              const currentCheckIn = bookingForm.checkInDate || filterCheckIn;
              const currentCheckOut =
                bookingForm.checkOutDate || filterCheckOut;
              const currentInTime = bookingForm.checkInTime || "14:00";
              const currentOutTime = bookingForm.checkOutTime || "12:00";

              let totalTentPrice = 0;
              let diffNights = 1;

              const count = selectedTents.length;
              const overnightPriceDisplay = totalConfiguredOvernight > 0
                ? totalConfiguredOvernight
                : (count === 1 ? 500000 : (count === 2 ? 800000 : (count === 4 ? 1200000 : count * 350000)));

              const firstHpDisplay = parseFloat(bookingForm.hourlyFirstHourPrice) || (totalConfiguredFirstHour > 0 ? totalConfiguredFirstHour : 100000);
              const extraHpDisplay = parseFloat(bookingForm.hourlyExtraHourPrice) || (totalConfiguredExtraHour > 0 ? totalConfiguredExtraHour : 50000);

              if (isHourly) {
                const hoursEst = parseInt(bookingForm.estimatedHours) || 1;
                totalTentPrice = firstHpDisplay + (hoursEst > 1 ? (hoursEst - 1) * extraHpDisplay : 0);
              } else {
                const inDate = new Date(
                  `${currentCheckIn}T${currentInTime}:00`,
                );
                const outDate = new Date(
                  `${currentCheckOut}T${currentOutTime}:00`,
                );
                const diffTime = outDate - inDate;
                diffNights = Math.max(
                  1,
                  Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
                );
                totalTentPrice = overnightPriceDisplay * diffNights;
              }

              return (
                <section className="space-y-5">
                  {/* 1. Loại hình thuê */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <h4 className="text-xs font-black text-[#1B4D3E] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                      <Compass size={15} /> 1. LOẠI HÌNH THUÊ LỀU
                    </h4>

                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/60 rounded-xl">
                      <button
                        type="button"
                        onClick={() =>
                          setBookingForm({
                            ...bookingForm,
                            bookingType: "Hourly",
                          })
                        }
                        className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${isHourly ? "bg-white text-emerald-800 shadow-sm border border-emerald-200 font-extrabold" : "text-slate-600 hover:text-slate-800"}`}
                      >
                        <Clock
                          size={14}
                          className={isHourly ? "text-emerald-600" : ""}
                        />
                        Thuê Theo Giờ
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBookingForm({
                            ...bookingForm,
                            bookingType: "Overnight",
                          })
                        }
                        className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${!isHourly ? "bg-white text-emerald-800 shadow-sm border border-emerald-200 font-extrabold" : "text-slate-600 hover:text-slate-800"}`}
                      >
                        <CalendarDays
                          size={14}
                          className={!isHourly ? "text-emerald-600" : ""}
                        />
                        Thuê Qua Đêm
                      </button>
                    </div>

                    {isHourly ? (
                      <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-medium space-y-1">
                        <p className="font-bold flex items-center gap-1">
                          Thuê Theo Giờ (Linh Hoạt):
                        </p>
                        <p>• Không gò bó thời gian Check-out cố định.</p>
                        <p>
                          • Bảng giá cấu hình lều:{" "}
                          <strong>
                            {firstHpDisplay.toLocaleString("vi-VN")}đ (Giờ đầu)
                          </strong>{" "}
                          +{" "}
                          <strong>
                            {extraHpDisplay.toLocaleString("vi-VN")}đ (Mỗi giờ
                            tiếp theo)
                          </strong>
                          .
                        </p>
                        <p>
                          • Giờ trả thực tế sẽ được tự động tính khi Lễ tân bấm
                          Check-out!
                        </p>
                      </div>
                    ) : (
                      <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-200 text-xs text-sky-900 font-medium space-y-1">
                        <p className="font-bold">Thuê Qua Đêm (Cố Định):</p>
                        <p>
                          • Giá lều qua đêm:{" "}
                          <strong>
                            {overnightPriceDisplay.toLocaleString("vi-VN")}đ /
                            đêm
                          </strong>
                          .
                        </p>
                        <p>
                          • Nhận lều từ 14:00 ➔ Trả lều trước 12:00 trưa hôm
                          sau.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 2. BỐ TRÍ & SETUP LỀU TRÊN VÙNG ĐẤT ĐÃ CHỌN */}
                  <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/60 to-emerald-500/10 p-4 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3.5">
                    <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Tent size={16} className="text-amber-600" /> 2. BỐ TRÍ LỀU TRÊN {selectedTents.length} Ô ĐẤT
                      </h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono">
                        ~{selectedTents.length * 3}m²
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-700 font-medium">
                      Khách muốn setup lều như thế nào trên {selectedTents.length} ô đất này? Chọn nhanh combo hoặc tùy chỉnh số lượng lều:
                    </p>

                    {/* Quick Combo Presets (1-Click) */}
                    {(() => {
                      const presets = getQuickPresetsForSlots(selectedTents.length);
                      if (presets.length === 0) return null;
                      return (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                            ⚡ Gợi ý combo vừa khít mặt bằng:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {presets.map((preset, idx) => {
                              const isSelected = isPresetActive(preset.config);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setTentSetupConfig(preset.config)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border shadow-2xs active:scale-95 ${
                                    isSelected
                                      ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300 font-black'
                                      : 'bg-white text-slate-700 hover:bg-amber-50 border-slate-200 hover:border-amber-300'
                                  }`}
                                >
                                  <Sparkles size={11} className={isSelected ? 'text-slate-950' : 'text-amber-500'} />
                                  <span>{preset.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Manual Stepper Per Tent Type */}
                    <div className="space-y-2 pt-1 border-t border-amber-200/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                          Kho lều camping sở hữu:
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (1 ô đất = ~3m²)
                        </span>
                      </div>

                      <div className="space-y-2">
                        {tentTypes.map(tType => {
                          const currentQty = tentSetupConfig[tType.id] || 0;
                          const isOutOfStock = tType.availableQuantity <= 0;
                          const canAddMore = !isOutOfStock && 
                                             (currentQty < tType.availableQuantity) && 
                                             (totalSlotsOccupiedByTents + tType.slotsOccupied <= selectedTents.length);

                          return (
                            <div 
                              key={tType.id}
                              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                                currentQty > 0 
                                  ? 'bg-white border-amber-400 shadow-sm ring-1 ring-amber-300' 
                                  : isOutOfStock 
                                    ? 'bg-slate-100/80 border-slate-200 opacity-60' 
                                    : 'bg-white/90 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-slate-900 truncate">
                                    {tType.name}
                                  </span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                    Chiếm {tType.slotsOccupied} ô (~{tType.slotsOccupied * 3}m²)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                  <span>{tType.capacity}</span>
                                  <span>•</span>
                                  <span className={`font-bold ${
                                    tType.availableQuantity === 0 
                                      ? 'text-rose-600' 
                                      : tType.availableQuantity <= 2 
                                        ? 'text-amber-600' 
                                        : 'text-emerald-700'
                                  }`}>
                                    Kho còn: {tType.availableQuantity}/{tType.totalQuantity} chiếc
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-800 font-extrabold mt-0.5">
                                  {isHourly 
                                    ? `${tType.hourlyFirstHourPrice.toLocaleString('vi-VN')}đ (giờ đầu)`
                                    : `${tType.price.toLocaleString('vi-VN')}đ/đêm`}
                                </div>
                              </div>

                              {/* Stepper +/- */}
                              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  disabled={currentQty <= 0}
                                  onClick={() => updateTentQty(tType.id, -1)}
                                  className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-white text-slate-700 flex items-center justify-center font-black transition-all shadow-2xs"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-5 text-center text-xs font-black text-slate-900 font-mono">
                                  {currentQty}
                                </span>
                                <button
                                  type="button"
                                  disabled={!canAddMore}
                                  onClick={() => updateTentQty(tType.id, 1)}
                                  className="w-6 h-6 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black transition-all shadow-2xs"
                                  title={!canAddMore ? (isOutOfStock ? "Hết lều trong kho" : "Không đủ ô đất trống") : "Thêm 1 lều"}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Land Fit Progress Bar */}
                    <div className="bg-white/95 p-3 rounded-xl border border-amber-200/90 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-600">Mặt bằng đã lấp:</span>
                        <span className="font-mono text-xs font-black text-slate-800">
                          {totalSlotsOccupiedByTents} / {selectedTents.length} ô ({Math.round((totalSlotsOccupiedByTents / (selectedTents.length || 1)) * 100)}%)
                        </span>
                      </div>

                      {/* Progress line */}
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            totalSlotsOccupiedByTents === selectedTents.length 
                              ? 'bg-emerald-500' 
                              : totalSlotsOccupiedByTents < selectedTents.length 
                                ? 'bg-amber-400' 
                                : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, (totalSlotsOccupiedByTents / (selectedTents.length || 1)) * 100)}%` }}
                        />
                      </div>

                      {/* Notice text */}
                      <div className="text-[10px] font-bold">
                        {totalSlotsOccupiedByTents === selectedTents.length ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 size={12} /> ✅ Vừa vặn hoàn hảo {selectedTents.length} ô đất đã chọn!
                          </span>
                        ) : totalSlotsOccupiedByTents < selectedTents.length && totalSlotsOccupiedByTents > 0 ? (
                          <span className="text-amber-700 flex items-center gap-1">
                            <Info size={12} /> Đang dựng {totalSlotsOccupiedByTents}/{selectedTents.length} ô (Còn {selectedTents.length - totalSlotsOccupiedByTents} ô làm sân BBQ).
                          </span>
                        ) : totalSlotsOccupiedByTents === 0 ? (
                          <span className="text-rose-600 flex items-center gap-1">
                            <AlertTriangle size={12} /> Chưa chọn lều nào để dựng.
                          </span>
                        ) : (
                          <span className="text-rose-600 flex items-center gap-1">
                            <AlertTriangle size={12} /> Vượt quá diện tích {selectedTents.length} ô đất đã chọn!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Thông tin khách */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <h4 className="text-xs font-black text-[#1B4D3E] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                      <User size={15} /> 3. Thông Tin Khách Hàng
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Tên Khách Đại Diện (*)
                        </label>
                        <input
                          type="text"
                          value={bookingForm.customerName}
                          onChange={(e) =>
                            setBookingForm({
                              ...bookingForm,
                              customerName: e.target.value,
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 text-slate-800 text-sm font-semibold"
                          placeholder="Tên khách hàng ..."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Số Điện Thoại (*)
                        </label>
                        <input
                          type="tel"
                          value={bookingForm.phoneNumber}
                          onChange={(e) =>
                            setBookingForm({
                              ...bookingForm,
                              phoneNumber: e.target.value,
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 text-slate-800 text-sm font-semibold"
                          placeholder="Số điện thoại khách hàng ..."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Ghi Chú Yêu Cầu (Tùy chọn)
                        </label>
                        <textarea
                          rows="2"
                          value={bookingForm.note || ""}
                          onChange={(e) =>
                            setBookingForm({
                              ...bookingForm,
                              note: e.target.value,
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 text-slate-800 text-xs font-medium resize-none"
                          placeholder="Ghi chú dịch vụ..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Ngày giờ lưu trú */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                      <h4 className="text-xs font-black text-[#1B4D3E] uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarDays size={15} /> 4. THỜI GIAN LƯU TRÚ
                      </h4>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full uppercase">
                        {isHourly ? `TÍNH GIỜ REAL-TIME` : `${diffNights} Đêm`}
                      </span>
                    </div>

                    {isHourly ? (
                      /* Hourly Real-time Checkin Fields */
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              Ngày Nhận (In)
                            </label>
                            <input
                              type="date"
                              value={currentCheckIn}
                              onChange={(e) =>
                                setBookingForm({
                                  ...bookingForm,
                                  checkInDate: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              Giờ Vào Lều
                            </label>
                            <input
                              type="time"
                              value={currentInTime}
                              onChange={(e) =>
                                setBookingForm({
                                  ...bookingForm,
                                  checkInTime: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-semibold">
                          Hệ thống tự ghi nhận giờ Check-in. Số giờ ở sẽ tự
                          động tính từ lúc Check-in đến khi Check-out (Ví dụ: 3
                          tiếng 20 phút ➔ làm tròn thành 4 tiếng).
                        </div>
                      </div>
                    ) : (
                      /* Overnight Rental Fields */
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Ngày Nhận (In)
                          </label>
                          <input
                            type="date"
                            value={currentCheckIn}
                            onChange={(e) =>
                              setBookingForm({
                                ...bookingForm,
                                checkInDate: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Giờ Nhận
                          </label>
                          <input
                            type="time"
                            value={currentInTime}
                            onChange={(e) =>
                              setBookingForm({
                                ...bookingForm,
                                checkInTime: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Ngày Trả (Out)
                          </label>
                          <input
                            type="date"
                            value={currentCheckOut}
                            onChange={(e) =>
                              setBookingForm({
                                ...bookingForm,
                                checkOutDate: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Giờ Trả
                          </label>
                          <input
                            type="time"
                            value={currentOutTime}
                            onChange={(e) =>
                              setBookingForm({
                                ...bookingForm,
                                checkOutTime: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. Chi tiết Các Ô Đất Đang Gộp */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                      <h4 className="text-xs font-black text-[#1B4D3E] uppercase tracking-wider flex items-center gap-1.5">
                        <Home size={15} /> 5. CÁC Ô ĐẤT ĐANG GỘP ({selectedTents.length} Ô)
                      </h4>
                      <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                        Tổng ~{selectedTents.length * 3}m²
                      </span>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {selectedTents.map((tent) => {
                        const zoneObj =
                          effectiveZones.find((z) =>
                            z.tents?.some((t) => t.id === tent.id),
                          ) || tent.zone;
                        const rawZone =
                          zoneObj?.name || tent.zoneName || "Khu cắm trại";
                        const zoneNameFormatted = rawZone.startsWith("Khu")
                          ? rawZone
                          : `Khu ${rawZone}`;

                        const displayCode = tent.slotCode || tent.name.replace(/^Lều\s+/i, '');

                        return (
                          <div
                            key={tent.id}
                            className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-slate-800 text-xs px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                                Ô {displayCode}
                              </span>
                              <div>
                                <span className="text-[11px] font-bold text-slate-700 block">
                                  {zoneNameFormatted}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Ô chuẩn đơn vị ~3m²
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTentClick(tent)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Bỏ ô này khỏi danh sách gộp"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 6. Tiền Cọc & Bảng Giá */}
                  <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-amber-200/60 pb-2">
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard size={15} /> 6. TIỀN CỌC & BẢNG GIÁ
                      </h4>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                      <span>
                        {isHourly
                          ? "Tạm Tính Thuê Giờ (Dự Kiến):"
                          : "Tổng Tiền Lều Dự Kiến:"}
                      </span>
                      <span className="text-lg font-black text-[#1B4D3E]">
                        {totalTentPrice.toLocaleString("vi-VN")}đ
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-amber-900 block mb-1">
                        Tiền Cọc Thu Tại Quầy (VNĐ)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={bookingForm.depositAmount || ""}
                        onChange={(e) =>
                          setBookingForm({
                            ...bookingForm,
                            depositAmount: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-amber-900 font-extrabold text-base"
                        placeholder="0đ (Nhập số tiền cọc thu tại quầy)"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={submitBooking}
                    className="w-full bg-[#1B4D3E] hover:bg-[#153d31] text-white py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-base shadow-xl shadow-[#1B4D3E]/20 active:scale-95"
                  >
                    <CheckCircle2 size={22} />
                    {isHourly
                      ? `Xác Nhận Thuê Lều Theo Giờ (${selectedTents.length} ô)`
                      : `Xác Nhận Gộp & Đặt ${selectedTents.length} Ô Đất`}
                  </button>
                </section>
              );
            })()}

          {/* ACTIVE BOOKING REQUEST CARD (Supports Đơn Gộp & Đơn Lẻ) */}
          {activeActionBooking &&
            (() => {
              const isHourlyBooking = activeActionBooking.bookingType === 'Hourly' || (activeActionBooking.checkInDate && activeActionBooking.checkOutDate && activeActionBooking.checkInDate.split('T')[0] === activeActionBooking.checkOutDate.split('T')[0]);

              let totalTentPrice = 0;
              if (activeActionBooking.totalPrice > 0) {
                totalTentPrice = activeActionBooking.totalPrice;
              } else if (isHourlyBooking) {
                const start = new Date(activeActionBooking.actualCheckInDate || activeActionBooking.checkInDate || activeActionBooking.bookingTime);
                const end = activeActionBooking.actualCheckOutDate || activeActionBooking.checkOutDate ? new Date(activeActionBooking.actualCheckOutDate || activeActionBooking.checkOutDate) : new Date();
                const diffHrs = Math.max(1, Math.ceil(Math.max(end - start, 0) / 3600000));
                const tents = activeActionBooking.bookingTents || (activeActionBooking.tentName ? [{ name: activeActionBooking.tentName, price: activeActionBooking.tentPrice }] : []);
                totalTentPrice = tents.reduce((sum, t) => {
                  const f = t.hourlyPriceFirstHour ?? t.HourlyPriceFirstHour ?? (activeActionBooking.hourlyFirstHourPrice || 100000);
                  const e = t.hourlyPriceExtraHour ?? t.HourlyPriceExtraHour ?? (activeActionBooking.hourlyExtraHourPrice || 50000);
                  return sum + (f + (diffHrs > 1 ? (diffHrs - 1) * e : 0));
                }, 0);
              } else {
                const tents = activeActionBooking.bookingTents || (activeActionBooking.tentName ? [{ name: activeActionBooking.tentName, price: activeActionBooking.tentPrice }] : []);
                const inDate = new Date(activeActionBooking.checkInDate || Date.now());
                const outDate = new Date(activeActionBooking.checkOutDate || Date.now());
                const nights = Math.max(1, Math.ceil((outDate - inDate) / 86400000));
                totalTentPrice = tents.reduce((sum, t) => sum + (t.price || 0), 0) * nights;
              }

              const depositPaid = activeActionBooking.depositAmount || 0;
              const remainingAmount = Math.max(totalTentPrice - depositPaid, 0);

              return (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md space-y-4">
                  {/* Order Header & Type Badge */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span
                      className={`text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                        (activeActionBooking.bookingTents?.length || 1) > 1
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      }`}
                    >
                      {(activeActionBooking.bookingTents?.length || 1) > 1
                        ? `ĐƠN ĐẶT GỘP (${activeActionBooking.bookingTents.length} LỀU)`
                        : `ĐƠN ĐẶT LẺ (1 LỀU)`}
                    </span>
                    {activeActionBooking.checkInDate && (
                      <span className="text-xs text-slate-500 font-extrabold bg-slate-100 px-2.5 py-1 rounded-lg">
                        {new Date(
                          typeof activeActionBooking.checkInDate === "string" &&
                            activeActionBooking.checkInDate.endsWith("Z")
                            ? activeActionBooking.checkInDate
                            : activeActionBooking.checkInDate + "Z",
                        ).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                  </div>

                  {/* Customer Contact & Booking Schedule Details Card */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-3 shadow-xs">
                    {/* Avatar + Name + Phone */}
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <div className="w-10 h-10 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-black text-base flex-shrink-0 shadow-sm">
                        {activeActionBooking.customerName
                          ? activeActionBooking.customerName
                              .charAt(0)
                              .toUpperCase()
                          : "K"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate">
                          {activeActionBooking.customerName}
                        </p>
                        <a
                          href={`tel:${activeActionBooking.phoneNumber}`}
                          className="text-xs text-rose-700 font-mono font-bold flex items-center gap-1 mt-0.5 hover:underline"
                        >
                          📞 {activeActionBooking.phoneNumber || "Chưa có SĐT"}
                        </a>
                      </div>
                    </div>

                    {/* Detailed Check-in / Check-out Schedule Grid */}
                    {(() => {
                      const inObj = formatBookingDateTime(activeActionBooking.checkInDate);
                      const outObj = formatBookingDateTime(activeActionBooking.checkOutDate);
                      return (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Check-in Card */}
                          <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                              <Calendar size={12} className="text-emerald-700" />
                              <span>Check-in</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-900 leading-none">
                                {inObj.time}
                              </span>
                              <span className="text-[11px] font-bold text-slate-600">
                                {inObj.date}
                              </span>
                            </div>
                          </div>

                          {/* Check-out Card */}
                          <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-black text-amber-900 uppercase tracking-wider">
                              <Calendar size={12} className="text-amber-700" />
                              <span>Check-out</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-900 leading-none">
                                {activeActionBooking.bookingType === 'Hourly' ? 'Đang ở theo giờ' : outObj.time}
                              </span>
                              <span className="text-[11px] font-bold text-slate-600">
                                {activeActionBooking.bookingType === 'Hourly' ? 'Tính giờ realtime' : outObj.date}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actual Check-in / Check-out (If Available) */}
                    {(activeActionBooking.actualCheckInDate ||
                      activeActionBooking.actualCheckOutDate) && (
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="bg-white p-2 rounded-xl border border-emerald-200/60 space-y-0.5">
                          <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
                            <Clock size={11} /> Thực tế nhận
                          </span>
                          <span className="font-extrabold text-slate-800 block text-[11px]">
                            {activeActionBooking.actualCheckInDate
                              ? `${new Date(activeActionBooking.actualCheckInDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${new Date(activeActionBooking.actualCheckInDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
                              : "Đã nhận lều"}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-xl border border-rose-200/60 space-y-0.5">
                          <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block flex items-center gap-1">
                            <Clock size={11} /> Thực tế trả
                          </span>
                          <span className="font-extrabold text-slate-800 block text-[11px]">
                            {activeActionBooking.actualCheckOutDate
                              ? `${new Date(activeActionBooking.actualCheckOutDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${new Date(activeActionBooking.actualCheckOutDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
                              : activeActionBooking.status === "CheckedOut"
                                ? "Đã trả lều"
                                : "Đang ở"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Booking Request Submission Timestamp */}
                    {activeActionBooking.bookingTime && (
                      <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium pt-1 px-1">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock size={12} className="text-slate-400" /> Đặt
                          lúc:
                        </span>
                        <span className="font-bold text-slate-700">
                          {new Date(
                            activeActionBooking.bookingTime,
                          ).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}{" "}
                          -{" "}
                          {new Date(
                            activeActionBooking.bookingTime,
                          ).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* MULTI-TENT LIST & INDIVIDUAL PER-TENT QR ACCESS CONTROL */}
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <QrCode size={15} className="text-emerald-700" />
                        Danh Sách Lều & Quyền Mã QR (
                        {activeActionBooking.bookingTents?.length || 1} lều):
                      </span>
                    </label>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {(activeActionBooking.bookingTents || []).map((t) => {
                        const isTentUnlocked = !!t.isQrUnlocked;

                        return (
                          <div
                            key={t.id}
                            className="flex justify-between items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shadow-xs text-xs"
                          >
                            <div>
                              <span className="text-emerald-800 font-extrabold text-[10px] block uppercase tracking-wider">
                                {t.zoneName || "Khu Cắm Trại"}
                              </span>
                              <span className="text-slate-900 font-black text-sm">
                                Lều {t.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* PER-TENT QR TOGGLE BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleToggleTentQrLock(t.id)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                                  isTentUnlocked
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm ring-1 ring-emerald-600"
                                    : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                                }`}
                                title={`Bật/Tắt QR riêng cho Lều ${t.name}`}
                              >
                                {isTentUnlocked ? (
                                  <>
                                    <Unlock size={13} /> QR: MỞ
                                  </>
                                ) : (
                                  <>
                                    <Lock size={13} /> QR: KHÓA
                                  </>
                                )}
                              </button>

                              {activeActionBooking.status === "Pending" &&
                                (activeActionBooking.bookingTents?.length ||
                                  0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveTentFromBooking(t.id)
                                    }
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                                    title="Bỏ lều này nếu khách không lấy nữa"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PENDING STATUS HANDLING: Deposit Input */}
                  {activeActionBooking.status === "Pending" && (
                    <div className="space-y-4 pt-2">
                      <p className="text-[10px] text-amber-700 font-semibold mt-1.5 italic">
                        * Bấm thùng rác{" "}
                        <Trash2 size={11} className="inline text-rose-600" /> để
                        bỏ bớt lều nếu khách đổi ý khi gọi điện.
                      </p>

                      {/* TOTAL TENT PRICE SUMMARY & DEPOSIT RECOMMENDATION */}
                      <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-slate-700 font-bold block">
                            Tổng tiền lều (
                            {activeActionBooking.bookingTents?.length || 1}{" "}
                            lều):
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold">
                            Gợi ý cọc 30-50%:{" "}
                            {Math.round(totalTentPrice * 0.3).toLocaleString(
                              "vi-VN",
                            )}
                            đ -{" "}
                            {Math.round(totalTentPrice * 0.5).toLocaleString(
                              "vi-VN",
                            )}
                            đ
                          </span>
                        </div>
                        <span className="text-base font-black text-emerald-900">
                          {totalTentPrice.toLocaleString("vi-VN")}đ
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-amber-900 uppercase mb-1">
                          Số tiền cọc thực tế đã nhận (VNĐ):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={customDeposit}
                          onChange={(e) => setCustomDeposit(e.target.value)}
                          placeholder={`VD: ${Math.round(totalTentPrice * 0.3)}`}
                          className="w-full bg-white border border-amber-300 rounded-xl px-4 py-2.5 text-sm font-extrabold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                        <p className="text-[10px] text-amber-700 font-medium mt-1">
                          * Số tiền cọc này sẽ được khấu trừ vào hóa đơn khi trả
                          lều.
                        </p>
                      </div>

                      <button
                        onClick={() => handleBookingAction("confirm-deposit")}
                        className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-bold text-sm shadow-md"
                      >
                        <ShieldCheck size={20} />
                        Xác Nhận Đã Cọc & Chốt (
                        {activeActionBooking.bookingTents?.length || 1} Lều -{" "}
                        {totalTentPrice.toLocaleString("vi-VN")}đ)
                      </button>

                      <button
                        onClick={() => handleBookingAction("reject-request")}
                        className="w-full bg-rose-50 text-rose-700 border border-rose-200 py-2.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-all font-bold text-xs"
                      >
                        <X size={16} />
                        Từ Chối / Hủy Đơn Đặt này
                      </button>
                    </div>
                  )}

                  {/* BOOKED STATUS HANDLING */}
                  {activeActionBooking.status === "Booked" && (
                    <div className="space-y-3 pt-2">
                      <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 text-xs space-y-2">
                        <div className="flex justify-between font-bold text-slate-700 pb-1 border-b border-emerald-200/60">
                          <span>Tổng phí thuê lều ({activeActionBooking.bookingTents?.length || 1} lều):</span>
                          <span className="font-extrabold text-slate-900">{totalTentPrice.toLocaleString("vi-VN")}đ</span>
                        </div>

                        {depositPaid > 0 && (
                          <div className="flex justify-between text-emerald-800 font-bold bg-white p-2 rounded-xl border border-emerald-200/60 shadow-2xs">
                            <span>✓ Đã nhận tiền cọc:</span>
                            <span className="text-emerald-700">+{depositPaid.toLocaleString("vi-VN")}đ</span>
                          </div>
                        )}

                        <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-emerald-200/60">
                          <span>Còn lại cần thanh toán:</span>
                          <span className="text-emerald-800 text-base">
                            {remainingAmount.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                      </div>

                      {/* View Master Bill Button for Screenshotting / Print Confirmation */}
                      <button
                        onClick={() =>
                          setSelectedMasterBill({
                            bookingId: activeActionBooking.id,
                            tentId:
                              activeActionBooking.tentId ||
                              activeActionBooking.bookingTents?.[0]?.id,
                            tentName:
                              activeActionBooking.tentName ||
                              activeActionBooking.bookingTents?.[0]?.name,
                          })
                        }
                        className="w-full bg-[#1B4D3E] text-white py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#153d31] transition-all font-bold text-xs shadow-md active:scale-95 cursor-pointer"
                      >
                        <CreditCard size={16} className="text-emerald-300" />
                        Xem Master Bill (Gửi Khách Xác Nhận)
                      </button>

                      <button
                        onClick={() => handleBookingAction("checkin")}
                        className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-extrabold text-base shadow-lg cursor-pointer"
                      >
                        <ShieldCheck size={20} />
                        Nhận Lều (Check-in)
                      </button>
                    </div>
                  )}

                  {/* OCCUPIED STATUS HANDLING: Checkout & Deduct Deposit */}
                  {activeActionBooking.status === "Occupied" && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="flex justify-between text-slate-600 text-xs font-medium">
                          <span>
                            Tổng phí thuê lều (
                            {activeActionBooking.bookingTents?.length || 1}{" "}
                            lều):
                          </span>
                          <span className="font-bold text-slate-800">
                            {totalTentPrice.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        {depositPaid > 0 && (
                          <div className="flex justify-between text-emerald-700 text-xs font-bold bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                            <span>Đã cọc trước (Trừ cọc):</span>
                            <span>-{depositPaid.toLocaleString("vi-VN")}đ</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                          <span>Còn lại cần thanh toán:</span>
                          <span className="text-emerald-700 text-base">
                            {remainingAmount.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setSelectedMasterBill({
                            bookingId: activeActionBooking.id,
                            tentId:
                              activeActionBooking.tentId ||
                              activeActionBooking.bookingTents?.[0]?.id,
                            tentName:
                              activeActionBooking.tentName ||
                              activeActionBooking.bookingTents?.[0]?.name,
                          })
                        }
                        className="w-full bg-[#1B4D3E] text-white py-3.5 rounded-2xl flex items-center justify-center gap-2.5 hover:bg-[#153d31] transition-all font-bold text-sm shadow-md active:scale-95 mb-2"
                      >
                        <CreditCard size={18} className="text-emerald-300" />
                        Xem Master Bill (Lều + Đồ Ăn/Uống)
                      </button>
                      <button
                        onClick={() => handleBookingAction("checkout")}
                        className="w-full bg-secondary text-on-secondary py-3.5 rounded-2xl flex items-center justify-center gap-2.5 hover:bg-secondary/90 transition-all font-bold text-sm shadow-lg"
                      >
                        <CheckCircle2 size={20} />
                        Thanh toán Nhanh (
                        {remainingAmount.toLocaleString("vi-VN")}đ) & Trả lều
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          <p className="text-center text-[10px] text-on-surface-variant/40 mt-4 uppercase tracking-[0.2em]">
            Bùi Hui Staff Portal
          </p>
        </div>
      </aside>

      <MasterBillModal
        isOpen={!!selectedMasterBill}
        onClose={() => setSelectedMasterBill(null)}
        bookingId={selectedMasterBill?.bookingId}
        tentId={selectedMasterBill?.tentId}
        tentName={selectedMasterBill?.tentName}
        onCheckoutSuccess={() => {
          setSelectedMasterBill(null);
          setActiveActionBooking(null);
          fetchZones();
        }}
      />

      {/* Quick Pitch Tent on Land Slot Modal */}
      {pitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                  <Tent size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Dựng Lều Mới Tại Ô {pitchModal.slot?.slotCode}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {pitchModal.zone?.name} • Mặt bằng thực tế ~3m²/ô
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPitchModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                Chọn Quy Mô Lều Dựng:
              </label>

              <div className="space-y-2.5">
                {[
                  {
                    key: 'Small',
                    title: 'Lều Nhỏ',
                    slots: 1,
                    sqm: 3,
                    capacity: '1 - 2 khách',
                    price: '500.000đ/đêm',
                    hourly: '100k/giờ đầu, 50k/giờ sau'
                  },
                  {
                    key: 'Medium',
                    title: 'Lều Trung',
                    slots: 2,
                    sqm: 6,
                    capacity: '3 - 4 khách',
                    price: '800.000đ/đêm',
                    hourly: '150k/giờ đầu, 80k/giờ sau'
                  },
                  {
                    key: 'Large',
                    title: 'Lều Lớn',
                    slots: 4,
                    sqm: 12,
                    capacity: '6 - 8 khách',
                    price: '1.200.000đ/đêm',
                    hourly: '250k/giờ đầu, 120k/giờ sau'
                  },
                ].map((opt) => {
                  const isCur = (pitchModal.size || 'Small') === opt.key;
                  return (
                    <div
                      key={opt.key}
                      onClick={() => setPitchModal({ ...pitchModal, size: opt.key })}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-between ${
                        isCur
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800">{opt.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {opt.slots} ô (~{opt.sqm}m²)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {opt.capacity} • {opt.hourly}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-700 block">{opt.price}</span>
                        {isCur && (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                            <Check size={12} strokeWidth={3} /> Đang chọn
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPitchModal(null)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={pitchingLoading}
                onClick={handleConfirmPitchTent}
                className="flex-1 py-3 px-4 rounded-xl font-extrabold text-xs bg-[#1B4D3E] hover:bg-emerald-800 text-white transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pitchingLoading ? 'Đang dựng...' : 'Xác Nhận Dựng & Đặt Lều'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom-Right Booking Notification Alert Stack */}
      {pendingBookingAlerts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-auto print:hidden">
          {pendingBookingAlerts.map((alert) => {
            const cInDate = alert.checkInDate ? (typeof alert.checkInDate === 'string' ? alert.checkInDate.split('T')[0] : '') : '';
            return (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className="bg-[#1B4D3E] text-white border-2 border-emerald-400 shadow-2xl rounded-2xl p-4 cursor-pointer hover:scale-102 transition-all relative overflow-hidden group animate-bounce"
              >
                {/* Top pulse header */}
                <div className="flex items-center justify-between border-b border-emerald-600/60 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Yêu Cầu Đặt Lều Mới!
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-200 font-mono font-bold">
                    {alert.receivedTime}
                  </span>
                </div>

                {/* Customer & Tent info */}
                <div className="space-y-1 text-xs">
                  <p className="font-extrabold text-sm text-white">
                    {alert.customerName} {alert.phoneNumber ? `(${alert.phoneNumber})` : ''}
                  </p>
                  <p className="text-emerald-100 font-medium">
                    Vị trí: <strong className="text-amber-300 font-bold">{alert.tentsList}</strong>
                  </p>
                  {cInDate && (
                    <p className="text-emerald-200 text-[11px]">
                      Ngày nhận lều: <strong className="text-white font-bold">{cInDate}</strong>
                    </p>
                  )}
                </div>

                {/* Action prompt footer */}
                <div className="mt-3 pt-2 border-t border-emerald-600/60 flex items-center justify-between text-[11px] font-black text-amber-300 group-hover:underline">
                  <span>Bấm vào đây để mở đúng ngày & lều</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c1c8c2; border-radius: 10px; }
      `}</style>
    </div>
  );
}
