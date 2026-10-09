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
  Box,
  Loader2
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

const parseTentSetup = (booking) => {
  if (!booking) return [];
  if (booking.tentSetupDetails) {
    try {
      const parsed = typeof booking.tentSetupDetails === "string" 
        ? JSON.parse(booking.tentSetupDetails) 
        : booking.tentSetupDetails;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter(item => (item.quantity || 0) > 0)
          .map(item => ({
            ...item,
            name: item.tentTypeName || item.name || `Lều loại ${item.tentTypeId || ""}`,
            slotsOccupied: item.slotsOccupied || 1,
            areaRequired: (item.slotsOccupied || 1) * (item.quantity || 1),
          }));
      }
    } catch (e) {
      console.warn("Could not parse tentSetupDetails:", e);
    }
  }
  if (booking.tentSetupSummary) {
    return [{ name: booking.tentSetupSummary, quantity: 1, isSummaryOnly: true }];
  }
  const slotCount = booking.bookingTents?.length || 1;
  return [{ name: `Lều cắm trại (${slotCount} ô đất)`, quantity: 1, isSummaryOnly: true }];
};

const parseAssignedCards = (booking) => {
  if (!booking || !booking.assignedQrCards) return [];
  try {
    const parsed = typeof booking.assignedQrCards === "string"
      ? JSON.parse(booking.assignedQrCards)
      : booking.assignedQrCards;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export default function ReceptionistBookingPage() {
  const [receptionViewMode, setReceptionViewMode] = useState('flycam'); // 'flycam', 'grid' (Matrix) or 'cards'
  const [zones, setZones] = useState([]);
  const [selectedTents, setSelectedTents] = useState([]);
  const [activeActionBooking, setActiveActionBooking] = useState(null);
  const [hoveredBookingId, setHoveredBookingId] = useState(null);
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Physical Tent Inventory Catalog & Receptionist Dynamic Setup on Pitches
  const [tentTypes, setTentTypes] = useState([]);
  const [tentSetupConfig, setTentSetupConfig] = useState({}); // { [tentTypeId]: quantity }
  
  // Pre-printed physical QR business cards
  const [activeQrCards, setActiveQrCards] = useState([]);
  const [inventoryQrCards, setInventoryQrCards] = useState([]);
  const [assignCardModal, setAssignCardModal] = useState({
    isOpen: false,
    cardCode: "",
    assignedTo: "",
    note: "",
    isUnlocked: true,
    loading: false,
  });

  // Dynamic Tent Setup Adjustment for existing bookings (Flexibility for Receptionist)
  const [changeTentModal, setChangeTentModal] = useState({
    isOpen: false,
    booking: null,
    config: {}, // { [tentTypeId]: quantity }
    reason: "",
    autoCheckIn: false,
    loading: false,
  });
  
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

  const fetchActiveQrCards = async () => {
    try {
      const [resActive, resInv] = await Promise.allSettled([
        axios.get(getApiUrl("/api/Bookings/active-qr-cards")),
        axios.get(getApiUrl("/api/QrCards"))
      ]);
      if (resActive.status === "fulfilled" && Array.isArray(resActive.value.data)) {
        setActiveQrCards(resActive.value.data);
      }
      if (resInv.status === "fulfilled" && resInv.value.data?.items) {
        setInventoryQrCards(resInv.value.data.items);
      }
    } catch (error) {
      console.error("Error fetching active QR cards:", error);
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
              bookingTents: bookingData.tents || [],
              assignedQrCards: bookingData.assignedQrCards,
              tentSetupDetails: bookingData.tentSetupDetails,
              tentSetupSummary: bookingData.tentSetupSummary,
              isQrUnlocked: bookingData.isQrUnlocked,
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
    fetchActiveQrCards();

    // Real-time SignalR listening
    signalRService.startConnection();

    const handleTentStatusChanged = () => {
      console.log(
        "⚡ SignalR TentStatusChanged received -> Fetching fresh zones data...",
      );
      fetchZones();
      fetchTentTypes();
      fetchPendingBookingAlerts();
      fetchActiveQrCards();
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
    signalRService.on("QrCardsUpdated", fetchActiveQrCards);

    return () => {
      signalRService.off("TentStatusChanged", handleTentStatusChanged);
      signalRService.off("TentTypesUpdated", handleTentTypesChanged);
      signalRService.off("BookingQrStatusChanged", handleTentStatusChanged);
      signalRService.off("OrderUpdated", handleTentStatusChanged);
      signalRService.off("NewBookingRequest", handleNewBookingRequest);
      signalRService.off("QrCardsUpdated", fetchActiveQrCards);
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

    const isAnySelectedFlexible = selectedTents.some(t => {
      const z = effectiveZones.find(ez => ez.id === t.zoneId || ez.id === t.zone?.id);
      return z?.isFlexibleMode;
    });

    if (!isAnySelectedFlexible && totalSlotsOccupiedByTents > selectedTents.length) {
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
    toast.success("Đã bỏ 1 ô đất khỏi danh sách chốt!");
  };

  const handleAssignQrCard = async () => {
    if (!activeActionBooking?.id || !assignCardModal.cardCode.trim()) {
      toast.error("Vui lòng nhập hoặc chọn mã thẻ QR!");
      return;
    }
    setAssignCardModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await axios.post(
        getApiUrl(`/api/Bookings/${activeActionBooking.id}/assign-qr-card`),
        {
          cardCode: assignCardModal.cardCode.trim(),
          assignedTo: assignCardModal.assignedTo.trim(),
          note: assignCardModal.note.trim(),
          isUnlocked: assignCardModal.isUnlocked,
        },
      );
      toast.success(res.data.message || "Đã gán thẻ QR thành công!");
      setActiveActionBooking((prev) => ({
        ...prev,
        assignedQrCards: JSON.stringify(res.data.cards),
        isQrUnlocked: res.data.isQrUnlocked,
      }));
      setAssignCardModal({
        isOpen: false,
        cardCode: "",
        assignedTo: "",
        note: "",
        isUnlocked: true,
        loading: false,
      });
      fetchActiveQrCards();
      fetchZones();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data || "Không thể gán thẻ QR này!");
      setAssignCardModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleToggleQrCard = async (cardCode) => {
    if (!activeActionBooking?.id) return;
    try {
      const res = await axios.post(
        getApiUrl(`/api/Bookings/${activeActionBooking.id}/toggle-qr-card`),
        { cardCode },
      );
      toast.success(res.data.message);
      setActiveActionBooking((prev) => ({
        ...prev,
        assignedQrCards: JSON.stringify(res.data.cards),
        isQrUnlocked: res.data.isQrUnlocked,
      }));
      fetchActiveQrCards();
      fetchZones();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi cập nhật quyền thẻ QR!");
    }
  };

  const handleRemoveQrCard = async (cardCode) => {
    if (!activeActionBooking?.id) return;
    if (
      !window.confirm(
        `Bạn có chắc muốn thu hồi thẻ "${cardCode}" về quầy lễ tân không? Thẻ sẽ được gỡ khỏi đơn này.`,
      )
    ) {
      return;
    }
    try {
      const res = await axios.delete(
        getApiUrl(
          `/api/Bookings/${activeActionBooking.id}/remove-qr-card/${encodeURIComponent(cardCode)}`,
        ),
      );
      toast.success(res.data.message);
      setActiveActionBooking((prev) => ({
        ...prev,
        assignedQrCards: JSON.stringify(res.data.cards),
        isQrUnlocked: res.data.isQrUnlocked,
      }));
      fetchActiveQrCards();
      fetchZones();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi thu hồi thẻ QR!");
    }
  };

  const handleOpenChangeTentModal = (booking) => {
    if (!booking) return;
    if (booking.status === "Occupied") {
      toast.warning("Khách đang ở (Occupied) không thể đổi quy cách lều!");
      return;
    }
    const slotsCount = booking.bookingTents?.length || 1;
    
    // Parse existing configuration
    let initialConfig = {};
    if (booking.tentSetupDetails) {
      try {
        const parsed = typeof booking.tentSetupDetails === "string"
          ? JSON.parse(booking.tentSetupDetails)
          : booking.tentSetupDetails;
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((item) => {
            if (item.tentTypeId && item.quantity) {
              initialConfig[item.tentTypeId] = item.quantity;
            } else if (item.tentTypeName && item.quantity) {
              const matched = tentTypes.find((t) => t.name.toLowerCase() === item.tentTypeName.toLowerCase());
              if (matched) initialConfig[matched.id] = item.quantity;
            }
          });
        }
      } catch (e) {
        console.warn("Could not parse existing tentSetupDetails:", e);
      }
    }

    // Fallback if no valid config found:
    if (Object.keys(initialConfig).length === 0) {
      const smallType = tentTypes.find((t) => t.slotsOccupied === 1);
      const medType = tentTypes.find((t) => t.slotsOccupied === 2);
      const largeType = tentTypes.find((t) => t.slotsOccupied === 4);

      if (slotsCount === 1) {
        if (smallType) initialConfig[smallType.id] = 1;
      } else if (slotsCount === 2) {
        if (medType) initialConfig[medType.id] = 1;
        else if (smallType) initialConfig[smallType.id] = 2;
      } else if (slotsCount === 3) {
        if (medType && smallType) {
          initialConfig[medType.id] = 1;
          initialConfig[smallType.id] = 1;
        } else if (smallType) {
          initialConfig[smallType.id] = 3;
        }
      } else if (slotsCount === 4) {
        if (largeType) initialConfig[largeType.id] = 1;
        else if (medType) initialConfig[medType.id] = 2;
        else if (smallType) initialConfig[smallType.id] = 4;
      } else if (smallType) {
        initialConfig[smallType.id] = slotsCount;
      }
    }

    setChangeTentModal({
      isOpen: true,
      booking: booking,
      config: initialConfig,
      reason: "",
      autoCheckIn: false,
      loading: false,
    });
  };

  const updateChangeTentQty = (typeId, delta) => {
    setChangeTentModal((prev) => {
      const cur = prev.config[typeId] || 0;
      const next = Math.max(0, cur + delta);
      const newConfig = { ...prev.config };
      if (next === 0) {
        delete newConfig[typeId];
      } else {
        newConfig[typeId] = next;
      }
      return {
        ...prev,
        config: newConfig,
      };
    });
  };

  const calculateChangeTentPrice = (booking, config) => {
    if (!booking) return 0;
    const isHourly = booking.bookingType === "Hourly";
    
    if (isHourly) {
      let sumFirst = 0;
      let sumExtra = 0;
      Object.entries(config || {}).forEach(([typeId, qty]) => {
        const t = tentTypes.find((x) => x.id === parseInt(typeId));
        if (t && qty > 0) {
          sumFirst += (t.hourlyFirstHourPrice || 100000) * qty;
          sumExtra += (t.hourlyExtraHourPrice || 50000) * qty;
        }
      });
      const hours = booking.estimatedHours || 1;
      return sumFirst + (hours > 1 ? (hours - 1) * sumExtra : 0);
    } else {
      let sumPerNight = 0;
      Object.entries(config || {}).forEach(([typeId, qty]) => {
        const t = tentTypes.find((x) => x.id === parseInt(typeId));
        if (t && qty > 0) {
          sumPerNight += (t.price || 500000) * qty;
        }
      });
      let nights = 1;
      if (booking.checkInDate && booking.checkOutDate) {
        const inD = new Date(booking.checkInDate);
        const outD = new Date(booking.checkOutDate);
        if (!isNaN(inD.getTime()) && !isNaN(outD.getTime())) {
          nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
      return sumPerNight * nights;
    }
  };

  const handleSaveTentSetupChange = async () => {
    if (!changeTentModal.booking) return;
    const totalSlots = changeTentModal.booking.bookingTents?.length || 1;
    const slotsOccupied = Object.entries(changeTentModal.config || {}).reduce((sum, [typeId, qty]) => {
      const t = tentTypes.find((x) => x.id === parseInt(typeId));
      return sum + (t?.slotsOccupied || 1) * (qty || 0);
    }, 0);

    if (slotsOccupied > totalSlots) {
      toast.error(`Số lượng lều vượt quá diện tích ${totalSlots} ô đất (đang xếp ${slotsOccupied} ô)! Vui lòng bớt lều.`);
      return;
    }
    if (slotsOccupied === 0) {
      toast.error("Vui lòng chọn ít nhất 1 lều dựng trên các ô đất!");
      return;
    }

    setChangeTentModal((prev) => ({ ...prev, loading: true }));
    try {
      const details = Object.entries(changeTentModal.config)
        .filter(([_, qty]) => qty > 0)
        .map(([typeId, qty]) => {
          const tType = tentTypes.find((t) => t.id === parseInt(typeId));
          return {
            tentTypeId: parseInt(typeId),
            tentTypeName: tType?.name || `Lều loại ${typeId}`,
            quantity: qty,
            slotsOccupied: tType?.slotsOccupied || 1,
            price: tType?.price || 0,
            hourlyFirstHourPrice: tType?.hourlyFirstHourPrice || 0,
            hourlyExtraHourPrice: tType?.hourlyExtraHourPrice || 0,
            capacity: tType?.capacity || "",
            areaRequired: (tType?.slotsOccupied || 1) * qty,
          };
        });

      const summary = details.map((d) => `${d.quantity}x ${d.tentTypeName}`).join(" + ");
      const newPrice = calculateChangeTentPrice(changeTentModal.booking, changeTentModal.config);

      const payload = {
        tentSetupDetails: JSON.stringify(details),
        tentSetupSummary: summary,
        newTotalPrice: newPrice,
        reason: changeTentModal.reason || "Khách yêu cầu thay đổi tại quầy",
        autoCheckIn: changeTentModal.autoCheckIn,
      };

      const res = await axios.put(
        getApiUrl(`/api/Bookings/${changeTentModal.booking.id}/update-tent-setup`),
        payload,
      );

      if (res.data) {
        toast.success(res.data.message || "Đã đổi quy cách lều thành công!");
        
        const updatedBooking = res.data.booking;
        if (updatedBooking) {
          setActiveActionBooking((prev) =>
            prev && prev.id === updatedBooking.id
              ? {
                  ...prev,
                  tentSetupDetails: updatedBooking.tentSetupDetails,
                  tentSetupSummary: updatedBooking.tentSetupSummary,
                  totalPrice: updatedBooking.totalPrice,
                  status: updatedBooking.status,
                  actualCheckInDate: updatedBooking.actualCheckInDate,
                  note: updatedBooking.note,
                }
              : prev,
          );
        }

        setChangeTentModal({
          isOpen: false,
          booking: null,
          config: {},
          reason: "",
          autoCheckIn: false,
          loading: false,
        });

        await fetchZones();
        await fetchTentTypes();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Không thể cập nhật quy cách lều!");
      setChangeTentModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const [selectedMasterBill, setSelectedMasterBill] = useState(null);

  // Safe Local Date Helpers & Parsers
  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseDateTimeSafe = (dtStr, defaultTime = "12:00") => {
    if (!dtStr) return null;
    let cleanStr = typeof dtStr === "string" ? dtStr.trim() : new Date(dtStr).toISOString();
    if (cleanStr.length === 10) {
      cleanStr = `${cleanStr}T${defaultTime}:00`;
    }
    if (cleanStr.endsWith("Z")) {
      cleanStr = cleanStr.slice(0, -1);
    }
    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Date Range Filter States (default: today -> tomorrow)
  const [searchParams] = useSearchParams();
  const [filterCheckIn, setFilterCheckIn] = useState(getLocalDateString());
  const [filterCheckOut, setFilterCheckOut] = useState(
    getLocalDateString(new Date(Date.now() + 86400000)),
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
      let targetIn = parseDateTimeSafe(`${filterCheckIn}T${filterCheckInTime || "14:00"}:00`);
      let targetOut = parseDateTimeSafe(`${filterCheckOut}T${filterCheckOutTime || "12:00"}:00`);

      if (!targetIn) targetIn = new Date();
      if (!targetOut || targetOut <= targetIn) {
        targetOut = new Date(targetIn.getTime() + 3600000);
      }

      const allActiveBookings = (tent.bookings || []).filter((b) => {
        if (
          b.status === "CheckedOut" ||
          b.status === "Cancelled" ||
          b.status === "Rejected"
        )
          return false;
        if (!b.checkInDate) return false;

        let bIn = parseDateTimeSafe(b.checkInDate, "14:00");
        let bOut = parseDateTimeSafe(b.checkOutDate, "12:00");
        if (!bIn) return false;

        if (!bOut) {
          if (b.bookingType === 'Hourly') {
            const hrs = b.estimatedHours > 0 ? b.estimatedHours : 2;
            bOut = new Date(bIn.getTime() + hrs * 3600000);
          } else {
            bOut = new Date(bIn.getTime() + 86400000);
            bOut.setHours(12, 0, 0, 0);
          }
        }

        // Legacy fallback: If DB row stored midnight 00:00:00, normalize to standard resort hours (14:00 & 12:00)
        if (b.bookingType !== 'Hourly' && bIn.getHours() === 0 && bIn.getMinutes() === 0) {
          const datePart = typeof b.checkInDate === "string" ? b.checkInDate.split("T")[0] : bIn.toISOString().split("T")[0];
          bIn = new Date(`${datePart}T14:00:00`);
        }
        if (b.bookingType !== 'Hourly' && bOut.getHours() === 0 && bOut.getMinutes() === 0) {
          const datePart = typeof b.checkOutDate === "string" ? b.checkOutDate.split("T")[0] : bOut.toISOString().split("T")[0];
          bOut = new Date(`${datePart}T12:00:00`);
        }

        // Real-time interval overlap condition:
        // bIn < targetOut && bOut > targetIn
        return bIn < targetOut && bOut > targetIn;
      });

      let status = "Available";
      if (allActiveBookings.some((b) => b.status === "Occupied")) {
        status = "Occupied";
      } else if (allActiveBookings.some((b) => b.status === "Booked")) {
        status = "Booked";
      } else if (allActiveBookings.some((b) => b.status === "Pending")) {
        status = "Pending";
      }

      const activeBooking = allActiveBookings[0] || null;

      return {
        ...tent,
        status,
        activeBooking: activeBooking,
        activeBookings: allActiveBookings,
        bookings: allActiveBookings,
      };
    }),
  }));

  const handleTentClick = (tent, specificBooking = null) => {
    const parentZone =
      effectiveZones.find((z) => z.tents?.some((t) => t.id === tent.id)) ||
      tent.zone;
    const isFlexible = parentZone?.isFlexibleMode;
    const zoneName = parentZone?.name || "";
    const activeBooking = specificBooking || tent.activeBooking;
    const activeBookings = tent.activeBookings || (tent.bookings || []);

    // 1. If receptionist is currently selecting tents (in create-booking flow):
    if (selectedTents.length > 0) {
      if (tent.status === "Available" || isFlexible) {
        let updatedSelected = [];
        if (selectedTents.find((t) => t.id === tent.id)) {
          updatedSelected = selectedTents.filter((t) => t.id !== tent.id);
        } else {
          updatedSelected = [...selectedTents, tent];
        }
        setSelectedTents(updatedSelected);
        if (tent.status !== "Available") {
          toast.success(`Đã chọn thêm Ô ${tent.slotCode || tent.name} vào đơn ghép (Chế độ Lễ hội)!`);
        }
        return;
      }
    }

    // 2. Available tent click:
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
      // 3. Occupied / Booked tent click -> Open Drawer
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
          slotTent: tent,
          parentZone: parentZone,
          slotActiveBookings: activeBookings,
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

        // Fetch latest booking detail to ensure newly assigned QR cards and setup are fresh
        if (activeBooking.id) {
          fetch(getApiUrl(`/api/Bookings/${activeBooking.id}`))
            .then((r) => (r.ok ? r.json() : null))
            .then((fresh) => {
              if (fresh) {
                setActiveActionBooking((prev) =>
                  prev && prev.id === fresh.id
                    ? {
                        ...prev,
                        ...fresh,
                        bookingTents: prev.bookingTents,
                        slotTent: prev.slotTent,
                        parentZone: prev.parentZone,
                        slotActiveBookings: prev.slotActiveBookings,
                      }
                    : prev,
                );
              }
            })
            .catch(() => {});
        }
      } else {
        setActiveActionBooking({
          tentName: tent.name,
          slotTent: tent,
          parentZone: parentZone,
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
    if (!filterCheckOut || val > filterCheckOut) {
      setFilterCheckOut(val);
      const inH = parseInt(filterCheckInTime.split(":")[0] || "14", 10);
      const outH = parseInt(filterCheckOutTime.split(":")[0] || "12", 10);
      if (outH <= inH) {
        const nextH = Math.min(23, inH + 4).toString().padStart(2, "0");
        setFilterCheckOutTime(`${nextH}:00`);
      }
    } else if (val === filterCheckOut) {
      const inH = parseInt(filterCheckInTime.split(":")[0] || "14", 10);
      const outH = parseInt(filterCheckOutTime.split(":")[0] || "12", 10);
      if (outH <= inH) {
        const nextH = Math.min(23, inH + 4).toString().padStart(2, "0");
        setFilterCheckOutTime(`${nextH}:00`);
      }
    }
  };

  const handleFilterCheckOutChange = (val) => {
    if (val < filterCheckIn) {
      toast.error("Ngày Check-out phải lớn hơn hoặc bằng ngày Check-in!");
      setFilterCheckOut(filterCheckIn);
      return;
    }
    setFilterCheckOut(val);
    if (val === filterCheckIn) {
      const inH = parseInt(filterCheckInTime.split(":")[0] || "14", 10);
      const outH = parseInt(filterCheckOutTime.split(":")[0] || "12", 10);
      if (outH <= inH) {
        const nextH = Math.min(23, inH + 4).toString().padStart(2, "0");
        setFilterCheckOutTime(`${nextH}:00`);
      }
    }
  };

  const handleSetDatePreset = (preset) => {
    const today = new Date();
    let inDate = new Date();
    let outDate = new Date();
    
    if (preset === 'today') {
      outDate.setDate(today.getDate() + 1);
    } else if (preset === 'tomorrow') {
      inDate.setDate(today.getDate() + 1);
      outDate.setDate(today.getDate() + 2);
    } else if (preset === 'weekend') {
      const day = today.getDay(); // 0: Sun, 5: Fri, 6: Sat
      const diffToFriday = (5 - day + 7) % 7 || 7;
      inDate.setDate(today.getDate() + diffToFriday);
      outDate.setDate(inDate.getDate() + 2);
    }
    const yyyy = inDate.getFullYear();
    const mm = String(inDate.getMonth() + 1).padStart(2, "0");
    const dd = String(inDate.getDate()).padStart(2, "0");
    const yyyyOut = outDate.getFullYear();
    const mmOut = String(outDate.getMonth() + 1).padStart(2, "0");
    const ddOut = String(outDate.getDate()).padStart(2, "0");
    setFilterCheckIn(`${yyyy}-${mm}-${dd}`);
    setFilterCheckOut(`${yyyyOut}-${mmOut}-${ddOut}`);
  };

  const isSidebarOpen =
    selectedTents.length > 0 || activeActionBooking !== null;

  return (
    <div
      className={`transition-all duration-300 ${isSidebarOpen ? "2xl:mr-[420px] xl:mr-[400px]" : ""}`}
    >
      {/* Festival Flexible Mode Announcement Banner for Receptionists */}
      {zones.some(z => z.isFlexibleMode) && (
        <div className="mb-6 bg-purple-900 text-white px-5 py-3 rounded-2xl border border-purple-700 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="font-bold text-sm">Chế độ lễ hội đang bật</span>
            <span className="text-xs text-purple-200">
              (Khu: <strong className="text-white">{zones.filter(z => z.isFlexibleMode).map(z => z.name).join(', ')}</strong>)
            </span>
          </div>
          <span className="text-xs text-purple-200 font-medium">
            Quản lý đã mở quyền ghép thêm lều linh hoạt vào các ô đất dịp cao điểm
          </span>
        </div>
      )}

      {/* Header & Status Filter Pills */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
              BÙI HUI CAMPING • LỄ TÂN
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Realtime
            </span>
            {zones.some(z => z.isFlexibleMode) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" /> Chế độ lễ hội đang bật
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-heading">
            Sơ Đồ & Quản Lý Đặt Lều
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Theo dõi hiện trạng bãi, bố trí mặt bằng ô đất, đón tiếp khách check-in và đặt chỗ
          </p>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter("All")}
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all ${
              statusFilter === "All"
                ? "bg-slate-900 text-white shadow-md border-slate-950 font-black"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Tất cả</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "All" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {allTents.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "Pending" ? "All" : "Pending")
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all ${
              statusFilter === "Pending"
                ? "bg-amber-500 text-white shadow-md border-amber-600 font-black"
                : "bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Chờ xử lý</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "Pending" ? "bg-white/25 text-white" : "bg-amber-100 text-amber-900"
            }`}>
              {pendingCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "Occupied" ? "All" : "Occupied")
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all ${
              statusFilter === "Occupied"
                ? "bg-emerald-800 text-white shadow-md border-emerald-900 font-black"
                : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Đang ở</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "Occupied" ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-900"
            }`}>
              {occupiedCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "Booked" ? "All" : "Booked")
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all ${
              statusFilter === "Booked"
                ? "bg-teal-700 text-white shadow-md border-teal-800 font-black"
                : "bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
            <span>Đã cọc</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "Booked" ? "bg-white/25 text-white" : "bg-teal-100 text-teal-900"
            }`}>
              {bookedCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === "Available" ? "All" : "Available",
              )
            }
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all ${
              statusFilter === "Available"
                ? "bg-slate-800 text-white shadow-md border-slate-900 font-black"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span>Trống</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "Available" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {availableCount}
            </span>
          </button>
        </div>
      </header>

      {/* Horizontal Control Toolbar: Search Bar + Date/Time Filter Bar with Quick Presets */}
      <div className="mb-4 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-64 lg:w-72 shrink-0">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm số ô, tên lều, tên khách..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-9 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date & Time Picker Bar with Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/70 shrink-0">
            <button
              type="button"
              onClick={() => handleSetDatePreset('today')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-xl text-slate-700 hover:bg-white hover:text-emerald-800 hover:shadow-2xs transition-all"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handleSetDatePreset('tomorrow')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-xl text-slate-700 hover:bg-white hover:text-emerald-800 hover:shadow-2xs transition-all"
            >
              Ngày mai
            </button>
            <button
              type="button"
              onClick={() => handleSetDatePreset('weekend')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-xl text-slate-700 hover:bg-white hover:text-emerald-800 hover:shadow-2xs transition-all"
            >
              Cuối tuần
            </button>
          </div>

          {/* Date & Time Segmented Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 flex-wrap sm:flex-nowrap">
            {/* Check-in Group */}
            <div className="inline-flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-extrabold text-emerald-800 flex items-center gap-1 shrink-0">
                <CalendarDays size={13} className="text-emerald-700" />
                Nhận:
              </span>
              <input
                type="date"
                value={filterCheckIn}
                onChange={(e) => handleFilterCheckInChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-emerald-950 font-black focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0 cursor-pointer"
              />
              <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl px-1.5 py-0.5 shrink-0">
                <select
                  value={filterCheckInTime.split(":")[0] || "14"}
                  onChange={(e) => {
                    const newH = e.target.value;
                    const newInTime = `${newH}:${filterCheckInTime.split(":")[1] || "00"}`;
                    setFilterCheckInTime(newInTime);
                    if (filterCheckIn === filterCheckOut) {
                      const outH = parseInt(filterCheckOutTime.split(":")[0] || "12", 10);
                      if (outH <= parseInt(newH, 10)) {
                        setFilterCheckOutTime(`${Math.min(23, parseInt(newH, 10) + 4).toString().padStart(2, "0")}:00`);
                      }
                    }
                  }}
                  className="bg-transparent focus:outline-none text-emerald-950 font-black cursor-pointer text-xs"
                >
                  {HOURS_24.map((h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
                <span className="font-black text-slate-400 text-xs mx-0.5">:</span>
                <select
                  value={filterCheckInTime.split(":")[1] || "00"}
                  onChange={(e) =>
                    setFilterCheckInTime(
                      `${filterCheckInTime.split(":")[0] || "14"}:${e.target.value}`,
                    )
                  }
                  className="bg-transparent focus:outline-none text-emerald-950 font-black cursor-pointer text-xs"
                >
                  {MINUTES_5M.map((m) => (
                    <option key={m} value={m}>
                      {m}p
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <span className="text-slate-400 font-black shrink-0 px-0.5">&rarr;</span>

            {/* Check-out Group */}
            <div className="inline-flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1 shrink-0">
                <Clock size={13} className="text-slate-500" />
                Trả:
              </span>
              <input
                type="date"
                value={filterCheckOut}
                min={filterCheckIn}
                onChange={(e) => handleFilterCheckOutChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-900 font-black focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0 cursor-pointer"
              />
              <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl px-1.5 py-0.5 shrink-0">
                <select
                  value={filterCheckOutTime.split(":")[0] || "12"}
                  onChange={(e) =>
                    setFilterCheckOutTime(
                      `${e.target.value}:${filterCheckOutTime.split(":")[1] || "00"}`,
                    )
                  }
                  className="bg-transparent focus:outline-none text-slate-900 font-black cursor-pointer text-xs"
                >
                  {HOURS_24.map((h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
                <span className="font-black text-slate-400 text-xs mx-0.5">:</span>
                <select
                  value={filterCheckOutTime.split(":")[1] || "00"}
                  onChange={(e) =>
                    setFilterCheckOutTime(
                      `${filterCheckOutTime.split(":")[0] || "12"}:${e.target.value}`,
                    )
                  }
                  className="bg-transparent focus:outline-none text-slate-900 font-black cursor-pointer text-xs"
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
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:px-6 rounded-2xl border border-slate-200/90 shadow-2xs mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Chế độ xem:</span>
          <div className="flex bg-slate-100 p-1 rounded-2xl flex-wrap gap-1 border border-slate-200/70">
            <button
              onClick={() => setReceptionViewMode('flycam')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                receptionViewMode === 'flycam' ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bản Đồ Flycam
            </button>
            <button
              onClick={() => setReceptionViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                receptionViewMode === 'grid' ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ma Trận Mặt Bằng
            </button>
            <button
              onClick={() => setReceptionViewMode('cards')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                receptionViewMode === 'cards' ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Danh Sách Thẻ
            </button>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
          <span className="bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
            Tổng: <strong>{allTents.length} vị trí ô</strong>
          </span>
          <span className="bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
            <strong>{effectiveZones.length} phân khu</strong>
          </span>
        </div>
      </div>

      {receptionViewMode === 'flycam' ? (
        <div className="space-y-6">
          <CampsiteMap
            tents={effectiveZones.flatMap((z) => z.tents || [])}
            zones={effectiveZones}
            selectedTentIds={selectedTents.map((t) => t.id)}
            onSelectTent={handleTentClick}
            tentTypes={tentTypes}
            allowSetup={false}
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
                />
              </div>
            );
          }

          return (
            <div key={zone.id} className="space-y-6">
              {/* Zone Header with Land Capacity Stats */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-8 bg-emerald-800 rounded-full" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading text-xl font-black text-slate-900">
                          {zone.name}
                        </h3>
                        {zone.isFlexibleMode && (
                          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                            Chế độ lễ hội
                          </span>
                        )}
                        {!isDining && (
                          <span className={`text-[11px] font-black px-3 py-1 rounded-full border shadow-2xs ${
                            percentUsed >= 90 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            percentUsed >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            Công suất: {percentUsed}% ({usedSlots}/{totalSlots} ô)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {zone.description || (isDining ? 'Khu vực bàn ẩm thực & tiệc nướng' : 'Khu vực bãi cắm trại view đồi cỏ thoáng mát')}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-slate-700 font-black bg-slate-100 px-3.5 py-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto">
                    {filteredTents.length} {isDining ? 'BÀN' : 'VỊ TRÍ Ô'}
                  </span>
                </div>

                {!isDining && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-slate-100">
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200/70 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">Tổng mặt bằng</span>
                      <span className="text-xs font-black text-slate-800 font-mono">{totalSlots} ô (~{totalSlots * 3}m²)</span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200/70 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">Đã dựng lều</span>
                      <span className="text-xs font-black text-slate-800 font-mono">{usedSlots} ô</span>
                    </div>
                    <div className="bg-amber-50/70 rounded-2xl p-2.5 border border-amber-200/70 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-800">Đang hoạt động</span>
                      <span className="text-xs font-black text-amber-900 font-mono">{usedSlots} ô</span>
                    </div>
                    <div className="bg-emerald-50/80 rounded-2xl p-2.5 border border-emerald-200/80 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-800">Còn trống</span>
                      <span className="text-xs font-black text-emerald-900 font-mono">{availableSlots} ô</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                {filteredTents.map((tent) => {
                  const activeBooking = tent.activeBooking;
                  const isPending = tent.status === "Pending";
                  const isBooked = tent.status === "Booked";
                  const isOccupied = tent.status === "Occupied";
                  const isAvailable = tent.status === "Available";

                  const tentBookingId = activeBooking?.id;
                  const siblingTentsInBooking = tentBookingId
                    ? allTents.filter(t => (t.activeBooking?.id || t.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected')?.id) === tentBookingId)
                    : [];
                  const isGrouped = siblingTentsInBooking.length > 1;

                  const isLinkedToHoveredBooking = Boolean(hoveredBookingId && tentBookingId === hoveredBookingId);
                  const isDimmed = Boolean(hoveredBookingId && !isLinkedToHoveredBooking);

                  const guestName = activeBooking?.customerName || "";
                  const isSelected = selectedTents.find((t) => t.id === tent.id);
                  const isActionActive = activeActionBooking?.tentName === tent.name;

                  const sizeTag = isDining ? "Bàn Ăn" : (
                    isGrouped ? `Lều Gộp (${siblingTentsInBooking.length} ô)` : "Ô Chuẩn (3m²)"
                  );
                  const slotDisplay = tent.slotCode 
                    ? (tent.slotCode.toLowerCase().startsWith('ô') || tent.slotCode.toLowerCase().startsWith('bàn') ? tent.slotCode : `Ô ${tent.slotCode}`)
                    : (tent.name.toLowerCase().startsWith('lều') || tent.name.toLowerCase().startsWith('bàn') ? tent.name : `Ô ${tent.name}`);

                  let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                  let badgeText = "Trống";
                  let dotColor = "bg-slate-400";
                  let cardBorder = "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md";

                  if (isSelected) {
                    badgeColor = "bg-amber-500 text-slate-950 border-amber-600 font-black";
                    badgeText = "Đang Chọn";
                    dotColor = "bg-slate-950";
                    cardBorder = "border-amber-400 ring-2 ring-amber-300/80 shadow-lg bg-amber-50/40";
                  } else if (isPending) {
                    badgeColor = "bg-amber-100 text-amber-900 border-amber-300 font-black animate-pulse";
                    badgeText = "Chờ Xác Nhận";
                    dotColor = "bg-amber-500";
                    cardBorder = "border-amber-400 ring-2 ring-amber-300/50 shadow-md bg-amber-50/70";
                  } else if (isOccupied) {
                    badgeColor = "bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold";
                    badgeText = isGrouped ? `Đang Ở (${siblingTentsInBooking.length} ô)` : "Đang Ở";
                    dotColor = "bg-emerald-600";
                    cardBorder = "border-emerald-300 hover:border-emerald-400 hover:shadow-md bg-white";
                  } else if (isBooked) {
                    badgeColor = "bg-teal-100 text-teal-900 border-teal-300 font-extrabold";
                    badgeText = isGrouped ? `Đã Cọc (${siblingTentsInBooking.length} ô)` : "Đã Cọc";
                    dotColor = "bg-teal-600";
                    cardBorder = "border-teal-300 hover:border-teal-400 hover:shadow-md bg-white";
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
                      className={`group relative overflow-hidden rounded-3xl p-5 transition-all duration-200 cursor-pointer border ${
                        isLinkedToHoveredBooking
                          ? "border-amber-400 ring-4 ring-amber-400 shadow-2xl scale-[1.03] z-20 bg-amber-50/90"
                          : isDimmed
                            ? "opacity-35 scale-95 transition-all"
                            : `${cardBorder} ${isActionActive ? "border-emerald-700 ring-2 ring-emerald-500/40 shadow-lg scale-[1.02]" : ""}`
                      }`}
                    >
                      {/* Top Row: Slot Code + Type & Icon */}
                      <div className="flex justify-between items-start mb-3.5">
                        <div>
                          <span className="font-heading font-black text-base text-slate-900 block tracking-tight">
                            {slotDisplay}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mt-0.5">
                            {sizeTag}
                          </span>
                        </div>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isOccupied ? "bg-emerald-100 text-emerald-800" :
                          isBooked ? "bg-teal-100 text-teal-800" :
                          isPending ? "bg-amber-100 text-amber-800 animate-bounce" :
                          "bg-slate-100 text-slate-500 group-hover:text-emerald-800 group-hover:bg-emerald-50"
                        }`}>
                          <Tent size={16} />
                        </div>
                      </div>

                      {/* Middle Body: Customer Info or Available Hint */}
                      <div className="min-h-[50px] flex flex-col justify-center py-1">
                        {guestName ? (
                          <>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Khách Hàng
                            </p>
                            <p className="text-sm font-black text-slate-900 truncate">
                              {guestName}
                            </p>
                            {activeBooking?.tentSetupSummary && (
                              <p className="text-[10px] text-emerald-800 font-bold truncate mt-0.5">
                                {activeBooking.tentSetupSummary}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-slate-600">
                              Chưa có khách
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Sẵn sàng nhận khách
                            </p>
                          </>
                        )}
                      </div>

                      {/* Bottom Row: Status Badge + Arrow */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border font-bold ${badgeColor}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          {badgeText}
                        </span>
                        <ArrowRight
                          size={15}
                          className="text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                        />
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

      {/* Floating Ergonomic Multi-Slot Action Bar for Receptionist (Visible on mobile/tablet) */}
      {selectedTents.length > 0 && !activeActionBooking && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300 w-[95%] max-w-2xl bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] border border-amber-400/60 flex flex-wrap items-center justify-between gap-3 xl:hidden">
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

      {/* MOBILE / TABLET BACKDROP FOR DRAWER */}
      {isSidebarOpen && (
        <div 
          onClick={() => {
            setSelectedTents([]);
            setActiveActionBooking(null);
          }}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-30 xl:hidden animate-fade-in"
        />
      )}

      {/* MASTER SIDEBAR */}
      <aside
        className={`fixed right-0 top-0 h-screen w-full sm:w-[420px] 2xl:w-[440px] bg-white shadow-[-16px_0_48px_rgba(0,0,0,0.12)] border-l border-slate-200/90 z-40 p-5 sm:p-6 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Sticky Header */}
        <div className="mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              activeActionBooking 
                ? "bg-amber-100 text-amber-950 border border-amber-300"
                : "bg-emerald-100 text-emerald-950 border border-emerald-300"
            }`}>
              {activeActionBooking ? <Sparkles size={12} className="text-amber-600" /> : <Tent size={12} className="text-emerald-700" />}
              {activeActionBooking ? "QUẢN LÝ ĐƠN ĐẶT" : "TẠO ĐƠN ĐẶT MỚI"}
            </span>
            <button
              onClick={() => {
                setSelectedTents([]);
                setActiveActionBooking(null);
              }}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-full transition-all"
              title="Đóng bảng thao tác"
            >
              <X size={20} />
            </button>
          </div>

          {activeActionBooking ? (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                    {activeActionBooking.zoneName || "Khu cắm trại"}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 font-heading">
                    {activeActionBooking.tentSetupSummary || `Lều ${activeActionBooking.tentName}`}
                  </h3>
                  {activeActionBooking.bookingTents && activeActionBooking.bookingTents.length > 0 && (
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Vị trí ô đất: <strong className="text-slate-800 font-mono">{activeActionBooking.bookingTents.map(t => t.slotCode || t.name.replace(/^Lều\s+/i, '')).join(', ')}</strong> ({activeActionBooking.bookingTents.length} ô ~{activeActionBooking.bookingTents.length * 3}m²)
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider inline-block shadow-2xs ${
                      activeActionBooking.status === "Pending"
                        ? "bg-amber-400 text-slate-950 border border-amber-500 animate-pulse"
                        : activeActionBooking.status === "Booked"
                          ? "bg-teal-100 text-teal-900 border border-teal-300"
                          : activeActionBooking.status === "Occupied"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
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
            <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200/70">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  Khu Đất {selectedTents.length} Ô Chuẩn
                </span>
                <span className="text-[11px] font-bold text-emerald-800 font-mono">
                  ~{selectedTents.length * 3}m²
                </span>
              </div>
              <h3 className="font-heading text-lg font-black text-slate-900 mt-1">
                {tentSetupSummary || `Setup Lều Cho ${selectedTents.length} Ô Đất`}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Vị trí ô: <strong className="text-slate-800 font-mono">{selectedTents.map(t => t.slotCode || t.name.replace(/^Lều\s+/i, '')).join(', ')}</strong>
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

              const getEstimatedOutTime = (inTimeStr, hours) => {
                if (!inTimeStr) return "";
                const parts = inTimeStr.split(":");
                const h = parseInt(parts[0] || "14", 10);
                const m = parseInt(parts[1] || "0", 10);
                const totalH = (h + (hours || 1)) % 24;
                return `${String(totalH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
              };

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
                  {/* 1. Loại hình & Thời gian thuê */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <h4 className="text-xs font-black text-[#1B4D3E] uppercase tracking-wider border-b border-slate-200/60 pb-2">
                      Hình thức & thời gian thuê
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
                        className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${isHourly ? "bg-white text-emerald-800 shadow-sm border border-emerald-200 font-extrabold" : "text-slate-600 hover:text-slate-800"}`}
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
                        className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${!isHourly ? "bg-white text-emerald-800 shadow-sm border border-emerald-200 font-extrabold" : "text-slate-600 hover:text-slate-800"}`}
                      >
                        <CalendarDays
                          size={14}
                          className={!isHourly ? "text-emerald-600" : ""}
                        />
                        Thuê Qua Đêm
                      </button>
                    </div>

                    {isHourly ? (
                      /* Setup Thời gian thuê theo giờ */
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200/90 shadow-2xs space-y-3">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Ngày Vào Lều:
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
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Giờ Vào Lều:
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
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                            />
                          </div>
                        </div>

                        {/* Chọn số giờ thuê dự kiến */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <label className="font-bold text-slate-700">
                              Thời Gian Thuê Dự Kiến:
                            </label>
                            <span className="font-extrabold text-emerald-800">
                              {bookingForm.estimatedHours || 1} giờ (Đến ~{getEstimatedOutTime(currentInTime, parseInt(bookingForm.estimatedHours) || 1)})
                            </span>
                          </div>

                          <div className="grid grid-cols-5 gap-1">
                            {[1, 2, 3, 4, 5].map((hr) => {
                              const isSelected = (parseInt(bookingForm.estimatedHours) || 1) === hr;
                              return (
                                <button
                                  key={hr}
                                  type="button"
                                  onClick={() =>
                                    setBookingForm({
                                      ...bookingForm,
                                      estimatedHours: String(hr),
                                    })
                                  }
                                  className={`py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                    isSelected
                                      ? "bg-emerald-700 text-white border-emerald-800 shadow-2xs font-extrabold"
                                      : "bg-slate-50 text-slate-700 hover:bg-emerald-50 border-slate-200 hover:border-emerald-300"
                                  }`}
                                >
                                  {hr}h
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
                          <span>Đơn giá giờ:</span>
                          <span className="font-bold text-emerald-800">
                            {firstHpDisplay.toLocaleString("vi-VN")}đ (h đầu) + {extraHpDisplay.toLocaleString("vi-VN")}đ/h sau
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Setup Thời gian thuê qua đêm */
                      <div className="bg-white p-3.5 rounded-xl border border-sky-200/90 shadow-2xs space-y-3">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Ngày Nhận (In):
                            </label>
                            <input
                              type="date"
                              value={currentCheckIn}
                              onChange={(e) => {
                                const newIn = e.target.value;
                                const currentOut = bookingForm.checkOutDate || filterCheckOut;
                                let newOut = currentOut;
                                if (newOut <= newIn) {
                                  const nextDay = new Date(newIn);
                                  nextDay.setDate(nextDay.getDate() + 1);
                                  newOut = nextDay.toISOString().split("T")[0];
                                }
                                setBookingForm({
                                  ...bookingForm,
                                  checkInDate: newIn,
                                  checkOutDate: newOut,
                                });
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Ngày Trả (Out):
                            </label>
                            <input
                              type="date"
                              min={currentCheckIn}
                              value={currentCheckOut}
                              onChange={(e) =>
                                setBookingForm({
                                  ...bookingForm,
                                  checkOutDate: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Giờ Nhận:
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
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Giờ Trả:
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
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                            />
                          </div>
                        </div>

                        {/* Quick Night Select */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <label className="font-bold text-slate-700">
                              Số Đêm Lưu Trú:
                            </label>
                            <span className="font-extrabold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                              {diffNights} đêm
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((nights) => {
                              const isSelected = diffNights === nights;
                              return (
                                <button
                                  key={nights}
                                  type="button"
                                  onClick={() => {
                                    const base = new Date(currentCheckIn || new Date());
                                    base.setDate(base.getDate() + nights);
                                    const yyyy = base.getFullYear();
                                    const mm = String(base.getMonth() + 1).padStart(2, "0");
                                    const dd = String(base.getDate()).padStart(2, "0");
                                    setBookingForm({
                                      ...bookingForm,
                                      checkOutDate: `${yyyy}-${mm}-${dd}`,
                                    });
                                  }}
                                  className={`py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                    isSelected
                                      ? "bg-sky-700 text-white border-sky-800 shadow-2xs font-extrabold"
                                      : "bg-slate-50 text-slate-700 hover:bg-sky-50 border-slate-200 hover:border-sky-300"
                                  }`}
                                >
                                  {nights} Đêm
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
                          <span>Giá lều qua đêm:</span>
                          <span className="font-bold text-sky-800">
                            {overnightPriceDisplay.toLocaleString("vi-VN")}đ / đêm
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BỐ TRÍ & SETUP LỀU TRÊN VÙNG ĐẤT ĐÃ CHỌN */}
                  <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/60 to-emerald-500/10 p-4 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3.5">
                    <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                        Bố trí lều trên {selectedTents.length} ô đất
                      </h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono">
                        ~{selectedTents.length * 3}m²
                      </span>
                    </div>

                    {/* Quick Combo Presets */}
                    {(() => {
                      const presets = getQuickPresetsForSlots(selectedTents.length);
                      if (presets.length === 0) return null;
                      return (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                            Combo nhanh:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {presets.map((preset, idx) => {
                              const isSelected = isPresetActive(preset.config);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setTentSetupConfig(preset.config)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center border shadow-2xs active:scale-95 ${
                                    isSelected
                                      ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300 font-black'
                                      : 'bg-white text-slate-700 hover:bg-amber-50 border-slate-200 hover:border-amber-300'
                                  }`}
                                >
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
                          Kho lều camping:
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

                  {/* Thông tin khách */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <h4 className="text-xs font-black text-[#1B4D3E] uppercase tracking-wider border-b border-slate-200/60 pb-2">
                      Thông Tin Khách Hàng
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

                  {/* Chi tiết Các Ô Đất Đang Gộp */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                      <h4 className="text-xs font-black text-[#1B4D3E] uppercase tracking-wider">
                        Các ô đất đang chọn ({selectedTents.length} ô)
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
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400">
                                    Ô chuẩn đơn vị ~3m²
                                  </span>
                                  {tent.status !== "Available" && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                                      Ghép Lễ Hội
                                    </span>
                                  )}
                                </div>
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

                  {/* Tiền Cọc & Bảng Giá */}
                  <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                    <div className="flex justify-between items-center border-b border-amber-200/60 pb-2">
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                        Tiền cọc & bảng giá
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
              let billedHours = 1;
              let actualTimeFormatted = "";

              if (isHourlyBooking) {
                const setupTents = parseTentSetup(activeActionBooking);
                let firstHourTotal = 0;
                let extraHourTotal = 0;

                if (setupTents.length > 0 && !setupTents[0].isSummaryOnly) {
                  firstHourTotal = setupTents.reduce(
                    (sum, item) => sum + ((item.hourlyFirstHourPrice || item.HourlyFirstHourPrice || 100000) * (item.quantity || 1)),
                    0
                  );
                  extraHourTotal = setupTents.reduce(
                    (sum, item) => sum + ((item.hourlyExtraHourPrice || item.HourlyExtraHourPrice || 50000) * (item.quantity || 1)),
                    0
                  );
                }

                if (firstHourTotal <= 0) {
                  const tents = activeActionBooking.bookingTents || (activeActionBooking.tentName ? [{ name: activeActionBooking.tentName, price: activeActionBooking.tentPrice }] : []);
                  firstHourTotal = activeActionBooking.hourlyFirstHourPrice || (tents.length > 0 ? tents.reduce((sum, t) => sum + (t.hourlyPriceFirstHour ?? t.HourlyPriceFirstHour ?? 100000), 0) : 100000);
                }

                if (extraHourTotal <= 0) {
                  const tents = activeActionBooking.bookingTents || (activeActionBooking.tentName ? [{ name: activeActionBooking.tentName, price: activeActionBooking.tentPrice }] : []);
                  extraHourTotal = activeActionBooking.hourlyExtraHourPrice || (tents.length > 0 ? tents.reduce((sum, t) => sum + (t.hourlyPriceExtraHour ?? t.HourlyPriceExtraHour ?? 50000), 0) : 50000);
                }

                if (activeActionBooking.status === "Occupied") {
                  const start = new Date(activeActionBooking.actualCheckInDate || activeActionBooking.checkInDate || activeActionBooking.bookingTime).getTime();
                  const end = currentTime;
                  const diffMs = Math.max(0, end - start);
                  const totalMinutes = Math.floor(diffMs / 60000);

                  const aH = Math.floor(totalMinutes / 60);
                  const aM = totalMinutes % 60;
                  actualTimeFormatted = aH > 0 ? `${aH} tiếng ${aM} phút` : `${aM} phút`;

                  if (totalMinutes <= 60) {
                    billedHours = 1;
                  } else {
                    const fullHours = Math.floor(totalMinutes / 60);
                    const extraMinutes = totalMinutes % 60;
                    billedHours = extraMinutes > 30 ? fullHours + 1 : fullHours;
                  }
                  billedHours = Math.max(1, billedHours);
                  totalTentPrice = firstHourTotal + (billedHours > 1 ? (billedHours - 1) * extraHourTotal : 0);
                } else if (activeActionBooking.status === "CheckedOut") {
                  if (activeActionBooking.totalPrice > 0) {
                    totalTentPrice = activeActionBooking.totalPrice;
                    billedHours = activeActionBooking.estimatedHours || 1;
                  } else {
                    const start = new Date(activeActionBooking.actualCheckInDate || activeActionBooking.checkInDate || activeActionBooking.bookingTime).getTime();
                    const end = new Date(activeActionBooking.actualCheckOutDate || activeActionBooking.checkOutDate || activeActionBooking.bookingTime).getTime();
                    const diffMs = Math.max(0, end - start);
                    const totalMinutes = Math.floor(diffMs / 60000);
                    if (totalMinutes <= 60) {
                      billedHours = 1;
                    } else {
                      const fullHours = Math.floor(totalMinutes / 60);
                      const extraMinutes = totalMinutes % 60;
                      billedHours = extraMinutes > 30 ? fullHours + 1 : fullHours;
                    }
                    billedHours = Math.max(1, billedHours);
                    totalTentPrice = firstHourTotal + (billedHours > 1 ? (billedHours - 1) * extraHourTotal : 0);
                  }
                } else {
                  billedHours = activeActionBooking.estimatedHours || 1;
                  totalTentPrice = activeActionBooking.totalPrice > 0 
                    ? activeActionBooking.totalPrice 
                    : (firstHourTotal + (billedHours > 1 ? (billedHours - 1) * extraHourTotal : 0));
                }
              } else {
                const inDate = new Date(activeActionBooking.checkInDate || Date.now());
                const outDate = new Date(activeActionBooking.checkOutDate || Date.now());
                const nights = Math.max(1, Math.ceil((outDate - inDate) / 86400000));
                if (activeActionBooking.totalPrice > 0) {
                  totalTentPrice = activeActionBooking.totalPrice;
                } else {
                  const tents = activeActionBooking.bookingTents || (activeActionBooking.tentName ? [{ name: activeActionBooking.tentName, price: activeActionBooking.tentPrice }] : []);
                  totalTentPrice = tents.reduce((sum, t) => sum + (t.price || 0), 0) * nights;
                }
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
                        ? `ĐƠN ĐẶT GỘP (${activeActionBooking.bookingTents.length} Ô ĐẤT)`
                        : `ĐƠN ĐẶT (1 Ô ĐẤT)`}
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

                  {/* Festival Freestyle Action Button */}
                  {activeActionBooking.parentZone?.isFlexibleMode && (
                    <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200/80 shadow-xs space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          const targetSlotTent = activeActionBooking.slotTent || activeActionBooking.bookingTents?.[0];
                          if (targetSlotTent) {
                            setActiveActionBooking(null);
                            setSelectedTents([targetSlotTent]);
                            toast.success(`Đã chọn Ô ${targetSlotTent.slotCode || targetSlotTent.name} để ghép thêm đơn mới!`);
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center transition-all cursor-pointer"
                      >
                        Ghép thêm lều vào ô này
                      </button>
                    </div>
                  )}

                  {/* Multiple Active Bookings Switcher for this slot */}
                  {activeActionBooking.slotActiveBookings && activeActionBooking.slotActiveBookings.length > 1 && (
                    <div className="bg-slate-100/90 p-3 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Users size={13} className="text-purple-600" />
                          Ô Đất Này Đang Ghép {activeActionBooking.slotActiveBookings.length} Đơn Khách:
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {activeActionBooking.slotActiveBookings.map((b, idx) => {
                          const isCurrent = activeActionBooking.id === b.id;
                          return (
                            <button
                              key={b.id || idx}
                              type="button"
                              onClick={() => handleTentClick(activeActionBooking.slotTent, b)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                                isCurrent
                                  ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300'
                                  : 'bg-white text-slate-700 hover:bg-purple-50 border border-slate-200'
                              }`}
                            >
                              <span>#{idx + 1}: {b.customerName || 'Khách'}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${
                                b.status === 'Occupied' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'
                              }`}>
                                {b.status === 'Occupied' ? 'Đang ở' : 'Đã cọc'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                          {activeActionBooking.phoneNumber || "Chưa có SĐT"}
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
                      activeActionBooking.actualCheckOutDate ||
                      activeActionBooking.status === "Occupied") && (
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="bg-white p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                            <Clock size={12} className="text-emerald-700" />
                            <span>Thực tế nhận</span>
                          </div>
                          {activeActionBooking.actualCheckInDate ? (
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-900 leading-none">
                                {formatBookingDateTime(activeActionBooking.actualCheckInDate).time}
                              </span>
                              <span className="text-[11px] font-bold text-slate-600">
                                {formatBookingDateTime(activeActionBooking.actualCheckInDate).date}
                              </span>
                            </div>
                          ) : (
                            <span className="font-extrabold text-slate-800 text-[11px]">Đã nhận lều</span>
                          )}
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-rose-200/80 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-black text-rose-800 uppercase tracking-wider">
                            <Clock size={12} className="text-rose-700" />
                            <span>Thực tế trả</span>
                          </div>
                          {activeActionBooking.actualCheckOutDate ? (
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-900 leading-none">
                                {formatBookingDateTime(activeActionBooking.actualCheckOutDate).time}
                              </span>
                              <span className="text-[11px] font-bold text-slate-600">
                                {formatBookingDateTime(activeActionBooking.actualCheckOutDate).date}
                              </span>
                            </div>
                          ) : activeActionBooking.status === "CheckedOut" ? (
                            <span className="font-extrabold text-slate-800 text-[11px]">Đã trả lều</span>
                          ) : (
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-rose-700 leading-none">
                                {new Date(currentTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                              </span>
                              <span className="text-[10px] font-bold text-rose-600">
                                (Đang ở)
                              </span>
                            </div>
                          )}
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

                  {/* ============================================================== */}
                  {/* 1. MẶT BẰNG Ô ĐẤT SỬ DỤNG */}
                  {/* ============================================================== */}
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={15} className="text-emerald-700" />
                        Mặt Bằng Ô Đất ({activeActionBooking.bookingTents?.length || 1} Ô):
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(activeActionBooking.bookingTents || []).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/90 shadow-2xs group hover:border-emerald-400 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-[11px]">
                            {t.name}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-800">
                              Ô đất {t.name}
                            </div>
                            <div className="text-[10px] font-semibold text-emerald-700">
                              {t.zoneName || "Khu Cắm Trại"}
                            </div>
                          </div>

                          {activeActionBooking.status === "Pending" &&
                            (activeActionBooking.bookingTents?.length || 0) >
                              1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveTentFromBooking(t.id)
                                }
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                                title="Bỏ ô đất này khỏi danh sách chốt"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ============================================================== */}
                  {/* 2. CÁC LOẠI LỀU SETUP TRÊN MẶT BẰNG */}
                  {/* ============================================================== */}
                  {(() => {
                    const setupTents = parseTentSetup(activeActionBooking);
                    return (
                      <div className="space-y-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Tent size={15} className="text-emerald-700" />
                            Quy Cách Lều Khách Đặt Trước:
                          </label>
                          <div className="flex items-center gap-1.5">
                            {(activeActionBooking.status === "Pending" || activeActionBooking.status === "Booked") && (
                              <button
                                type="button"
                                onClick={() => handleOpenChangeTentModal(activeActionBooking)}
                                className="text-[11px] font-black text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                title="Lễ tân linh hoạt thay đổi loại lều dựng trên các ô đất của khách"
                              >
                                <RefreshCw size={12} className="text-amber-800" />
                                Đổi Lều
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Chi tiết từng loại lều khách đăng ký ban đầu */}
                        <div className="space-y-1.5">
                          {setupTents.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/70 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-white text-emerald-800 flex items-center justify-center shadow-2xs border border-emerald-200/80 font-black text-sm flex-shrink-0">
                                  <Tent size={16} />
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                                    <span className="text-emerald-950 font-black">
                                      {item.quantity ? `${item.quantity}x ` : "1x "}
                                      {item.name || item.tentTypeName || "Lều cắm trại"}
                                    </span>
                                    {item.capacity && (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200/60">
                                        {item.capacity}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-semibold mt-0.5">
                                    {item.slotsOccupied
                                      ? `Dựng trên ${item.slotsOccupied} ô đất (~${item.slotsOccupied * 3}m²)`
                                      : item.areaRequired
                                        ? `Chiếm ${item.areaRequired} ô đất (~${item.areaRequired * 3}m²)`
                                        : "Dựng theo thỏa thuận trên các ô đất"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ============================================================== */}
                  {/* 3. THẺ QR DANH THIẾP GỌI MÓN (GỌN GÀNG, LỄ TÂN GÁN KHI CẦN) */}
                  {/* ============================================================== */}
                  {(() => {
                    const assignedCards = parseAssignedCards(activeActionBooking);
                    return (
                      <div className="space-y-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <QrCode size={15} className="text-emerald-700" />
                            Thẻ QR Gọi Món (Danh Thiếp):
                          </label>
                          {assignedCards.length > 0 && (
                            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                              Đã gán {assignedCards.length} thẻ
                            </span>
                          )}
                        </div>

                        {assignedCards.length > 0 ? (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/90 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700">
                                Thẻ đang gán cho khách:
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {assignedCards.map((card, idx) => (
                                <span
                                  key={card.cardCode || idx}
                                  className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-2xs"
                                >
                                  <span>{card.cardCode}</span>
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      card.isUnlocked
                                        ? "bg-emerald-500 ring-2 ring-emerald-200"
                                        : "bg-rose-500 ring-2 ring-rose-200"
                                    }`}
                                    title={card.isUnlocked ? "Đang mở gọi món" : "Đang khóa"}
                                  />
                                </span>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setAssignCardModal({
                                  isOpen: true,
                                  cardCode: "",
                                  assignedTo: "",
                                  note: "",
                                  isUnlocked: true,
                                  loading: false,
                                })
                              }
                              className="w-full text-center text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-xl border border-emerald-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Plus size={13} strokeWidth={2.5} /> Sắp Xếp & Gán Thêm Thẻ QR
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setAssignCardModal({
                                isOpen: true,
                                cardCode: "",
                                assignedTo: "",
                                note: "",
                                isUnlocked: true,
                                loading: false,
                              })
                            }
                            className="w-full py-2.5 px-3 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-dashed border-emerald-300 transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer hover:border-emerald-500 shadow-2xs"
                          >
                            <Plus size={14} strokeWidth={2.5} className="text-emerald-600" />
                            <span>+ Gán Thẻ QR Danh Thiếp Cho Khách</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* PENDING STATUS HANDLING: Deposit Input */}
                  {activeActionBooking.status === "Pending" && (
                    <div className="space-y-4 pt-2">
                      {/* TOTAL TENT PRICE SUMMARY & DEPOSIT RECOMMENDATION */}
                      <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
                        <span className="text-slate-700 font-bold block">
                          Tổng tiền thuê ({activeActionBooking.bookingTents?.length || 1} ô đất):
                        </span>
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
                          placeholder="Nhập số tiền cọc (VNĐ)..."
                          className="w-full bg-white border border-amber-300 rounded-xl px-4 py-2.5 text-sm font-extrabold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>

                      <button
                        onClick={() => handleBookingAction("confirm-deposit")}
                        className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-bold text-sm shadow-md"
                      >
                        <ShieldCheck size={20} />
                        Xác Nhận Đã Cọc & Chốt ({activeActionBooking.bookingTents?.length || 1} Ô Đất - {totalTentPrice.toLocaleString("vi-VN")}đ)
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
                          <span>Tổng phí thuê ({activeActionBooking.bookingTents?.length || 1} ô đất):</span>
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
                        {isHourlyBooking && (
                          <div className="bg-emerald-50/90 p-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5 mb-2">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-slate-600">Thời gian ở thực tế:</span>
                              <span className="font-extrabold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                                ⏱️ {actualTimeFormatted}
                              </span>
                            </div>
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-slate-600">Số giờ tính tiền (làm tròn 30p):</span>
                              <span className="font-black text-emerald-800">
                                {billedHours} giờ
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-600 text-xs font-medium">
                          <span>
                            Tổng phí thuê ({activeActionBooking.bookingTents?.length || 1} ô đất{isHourlyBooking ? ` - ${billedHours} giờ` : ''}):
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

      {/* Modal Gán Thẻ QR Danh Thiếp In Sẵn (Nâng cấp giao diện rộng rãi, trực quan) */}
      {assignCardModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-xs">
                  <QrCode size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-lg">
                      Gán Thẻ QR Danh Thiếp Cho Khách
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Ép Plastic
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium mt-0.5">
                    <span>Khách: <strong className="text-slate-800">{activeActionBooking?.customerName}</strong></span>
                    {activeActionBooking?.phoneNumber && <span>• SĐT: <strong className="text-slate-700">{activeActionBooking.phoneNumber}</strong></span>}
                    <span>• {activeActionBooking?.bookingTents?.length || 1} Ô đất</span>
                    {activeActionBooking?.tentSetupSummary && (
                      <span className="text-emerald-700 font-bold">• {activeActionBooking.tentSetupSummary}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignCardModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar text-xs">
              
              {/* SECTION 1: Các thẻ hiện đang gán cho đơn này */}
              {(() => {
                const currentCards = parseAssignedCards(activeActionBooking);
                if (currentCards.length === 0) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-emerald-900">
                      <span className="flex items-center gap-1.5">
                        <CreditCard size={15} className="text-emerald-700" />
                        Thẻ đang phục vụ đơn ({currentCards.length} thẻ):
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentCards.map((card, idx) => (
                        <div
                          key={card.cardCode || idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-emerald-200 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                              {card.cardCode}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-[11px] truncate">
                                {card.assignedTo || "Khu vực lều"}
                              </p>
                              <a
                                href={`${window.location.origin}/customer/menu?card=${card.cardCode}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                              >
                                Xem thử Menu ↗
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => handleToggleQrCard(card.cardCode)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-colors ${
                                card.isUnlocked
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                                  : "bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200"
                              }`}
                              title={card.isUnlocked ? "Bấm để KHÓA đặt món thẻ này" : "Bấm để MỞ đặt món thẻ này"}
                            >
                              {card.isUnlocked ? "Mở" : "Khóa"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveQrCard(card.cardCode)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Thu hồi thẻ về quầy lễ tân"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* SECTION 2: Gán thêm thẻ mới vào lều */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                
                {/* Cột 1: Chọn mã thẻ trong kho */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-700 uppercase tracking-wider block text-[11px]">
                      1. Chọn mã thẻ trên tay:
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">
                      {inventoryQrCards.filter(c => c.status === 'Available').length} thẻ rảnh
                    </span>
                  </div>

                  {inventoryQrCards.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200 custom-scrollbar">
                        {inventoryQrCards.map((card) => {
                          const code = card.cardCode;
                          const inOther = activeQrCards.find(
                            (c) => c.cardCode === code && c.bookingId !== activeActionBooking?.id
                          );
                          const currentCards = parseAssignedCards(activeActionBooking);
                          const inThis = currentCards.some((c) => c.cardCode === code);
                          const isSelected = assignCardModal.cardCode === code;
                          const isDamagedOrLost = card.status === "Damaged" || card.status === "Lost";
                          const isDisabled = isDamagedOrLost || !!inOther || inThis;

                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={isDisabled}
                              onClick={() =>
                                setAssignCardModal((prev) => ({
                                  ...prev,
                                  cardCode: code,
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500 scale-105"
                                  : inThis
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300 opacity-60 cursor-not-allowed"
                                    : isDamagedOrLost
                                      ? "bg-rose-50 text-rose-400 border border-rose-200 opacity-50 cursor-not-allowed"
                                      : inOther
                                        ? "bg-slate-100 text-slate-400 border border-slate-200 opacity-50 cursor-not-allowed"
                                        : "bg-white text-slate-700 border border-slate-300 hover:border-emerald-600 hover:text-emerald-700 hover:shadow-2xs"
                              }`}
                              title={
                                inThis
                                  ? "Đã gán cho đơn này"
                                  : isDamagedOrLost
                                    ? `Thẻ bị ${card.status === 'Lost' ? 'mất' : 'hỏng'}`
                                    : inOther
                                      ? `Đang dùng ở đơn ${inOther.customerName}`
                                      : "Thẻ rảnh sẵn sàng"
                              }
                            >
                              {code} {inThis ? "✓" : isDamagedOrLost ? (card.status === 'Lost' ? "❌" : "⚠️") : inOther ? "🔒" : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Input mã thẻ thủ công */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      Mã thẻ đang chọn (hoặc tự gõ mã tùy ý):
                    </label>
                    <input
                      type="text"
                      value={assignCardModal.cardCode}
                      onChange={(e) =>
                        setAssignCardModal((prev) => ({
                          ...prev,
                          cardCode: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Nhập mã thẻ..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-black text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Cột 2: Chọn vị trí cắm thẻ & Quyền */}
                <div className="space-y-3">
                  <label className="font-black text-slate-700 uppercase tracking-wider block text-[11px]">
                    2. Vị trí cắm thẻ tại khu đất:
                  </label>

                  {/* Gợi ý vị trí theo từng lều trong quy cách */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 block">
                      Vị trí nhanh:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {parseTentSetup(activeActionBooking).map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setAssignCardModal((prev) => ({
                              ...prev,
                              assignedTo: `Cắm tại ${item.name}`,
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          {item.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setAssignCardModal((prev) => ({
                            ...prev,
                            assignedTo: "Cắm tại Bàn BBQ ngoài trời",
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                      >
                        Bàn BBQ ngoài trời
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAssignCardModal((prev) => ({
                            ...prev,
                            assignedTo: "Trao cho Trưởng đoàn",
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                      >
                        Trưởng đoàn
                      </button>
                    </div>
                  </div>

                  {/* Ghi chú chi tiết vị trí */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">
                      Chi tiết vị trí đặt thẻ:
                    </span>
                    <input
                      type="text"
                      value={assignCardModal.assignedTo}
                      onChange={(e) =>
                        setAssignCardModal((prev) => ({
                          ...prev,
                          assignedTo: e.target.value,
                        }))
                      }
                      placeholder="Chi tiết vị trí đặt thẻ..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>

                  {/* Quyền mở đặt món */}
                  <div className="pt-2">
                    <label 
                      htmlFor="isUnlockedCheck"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 cursor-pointer transition-all"
                    >
                      <input
                        type="checkbox"
                        id="isUnlockedCheck"
                        checked={assignCardModal.isUnlocked}
                        onChange={(e) =>
                          setAssignCardModal((prev) => ({
                            ...prev,
                            isUnlocked: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold text-slate-800 text-xs">
                          Mở quyền quét QR đặt món
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Khách có thể quét thẻ bằng Zalo/Camera để gọi món ngay
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-xs text-slate-500">
                {assignCardModal.cardCode.trim() ? (
                  <span>Sẽ gán thẻ: <strong className="text-emerald-700 font-mono text-sm">{assignCardModal.cardCode}</strong></span>
                ) : (
                  <span className="text-slate-400 italic">Chưa chọn mã thẻ</span>
                )}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setAssignCardModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={assignCardModal.loading || !assignCardModal.cardCode.trim()}
                  onClick={handleAssignQrCard}
                  className="px-6 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white font-black shadow-md hover:shadow-lg transition-all text-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {assignCardModal.loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  Xác Nhận Gán Thẻ Cho Khách
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thay Đổi Quy Cách Lều Dựng Trên Ô Đất (Receptionist Flexibility) */}
      {changeTentModal.isOpen && changeTentModal.booking && (() => {
        const totalSlots = changeTentModal.booking.bookingTents?.length || 1;
        const slotsOccupied = Object.entries(changeTentModal.config || {}).reduce((sum, [typeId, qty]) => {
          const t = tentTypes.find((x) => x.id === parseInt(typeId));
          return sum + (t?.slotsOccupied || 1) * (qty || 0);
        }, 0);

        const isHourly = changeTentModal.booking.bookingType === "Hourly";
        const presets = getQuickPresetsForSlots(totalSlots);

        // Original booking tent fee
        const originalTentFee = changeTentModal.booking.totalPrice || changeTentModal.booking.tentPrice || 0;
        const newCalculatedPrice = calculateChangeTentPrice(changeTentModal.booking, changeTentModal.config);
        const priceDiff = newCalculatedPrice - originalTentFee;
        const depositAmount = changeTentModal.booking.depositAmount || 0;
        const remainingToPay = Math.max(0, newCalculatedPrice - depositAmount);

        // Original items in this booking for stock calculation
        const originalItems = parseTentSetup(changeTentModal.booking);

        const isPresetActiveInModal = (presetConfig) => {
          const pKeys = Object.keys(presetConfig);
          const cKeys = Object.keys(changeTentModal.config || {});
          if (pKeys.length !== cKeys.length) return false;
          return pKeys.every((k) => presetConfig[k] === changeTentModal.config[k]);
        };

        const fitPercent = Math.min(100, Math.round((slotsOccupied / totalSlots) * 100));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200 shadow-2xs">
                    <Tent size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      <span>Thay Đổi Quy Cách Lều</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {totalSlots} Ô Đất
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Đơn #{changeTentModal.booking.id} • {changeTentModal.booking.customerName} ({changeTentModal.booking.phoneNumber || "N/A"})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChangeTentModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs custom-scrollbar">
                {/* 1. Mặt bằng thông tin */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/70 p-3.5 rounded-2xl border border-emerald-200/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-700 flex items-center gap-1.5">
                      <MapPin size={13} className="text-emerald-700" />
                      <span>Các ô đất của đơn:</span>
                      <span className="font-black text-slate-900">
                        {(changeTentModal.booking.bookingTents || []).map((t) => t.name).join(", ") || `Ô ${changeTentModal.booking.tentName}`}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Tổng diện tích: {totalSlots * 3}m² • Hình thức: {isHourly ? "Theo Giờ" : "Qua Đêm"}
                    </p>
                  </div>
                  <span className="text-xs font-black text-emerald-900 bg-white/90 px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                    {totalSlots} ô đất (~{totalSlots * 3}m²)
                  </span>
                </div>

                {/* 2. Gợi ý combo 1-click */}
                {presets.length > 0 && (
                  <div className="space-y-1.5 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/70">
                    <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-600" />
                      Combo gợi ý ({totalSlots} ô):
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {presets.map((preset, idx) => {
                        const isSelected = isPresetActiveInModal(preset.config);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setChangeTentModal((prev) => ({
                                ...prev,
                                config: preset.config,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer active:scale-95 ${
                              isSelected
                                ? "bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300 font-black"
                                : "bg-white text-slate-700 hover:bg-amber-100 border-slate-200 hover:border-amber-300"
                            }`}
                          >
                            <span>{preset.label}</span>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Tùy chỉnh chi tiết từng loại lều trong kho */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders size={13} className="text-emerald-700" />
                      Tùy chỉnh số lượng lều dựng trên {totalSlots} ô đất:
                    </label>
                  </div>

                  <div className="space-y-2">
                    {tentTypes.map((tType) => {
                      const currentQty = changeTentModal.config[tType.id] || 0;
                      
                      // Calculate stock in warehouse taking this booking's original allocation into account
                      const originalItem = originalItems.find(
                        (it) =>
                          it.tentTypeId === tType.id ||
                          it.tentTypeName === tType.name ||
                          it.name === tType.name,
                      );
                      const originalQty = originalItem?.quantity || 0;
                      const effectiveAvailable = (tType.availableQuantity || 0) + originalQty;

                      const isOutOfStock = effectiveAvailable <= 0;
                      const canAddMore =
                        !isOutOfStock &&
                        currentQty < effectiveAvailable &&
                        slotsOccupied + tType.slotsOccupied <= totalSlots;

                      return (
                        <div
                          key={tType.id}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                            currentQty > 0
                              ? "bg-amber-50/40 border-amber-400 shadow-2xs ring-1 ring-amber-300/50"
                              : isOutOfStock
                                ? "bg-slate-100/70 border-slate-200 opacity-60"
                                : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-900 truncate">
                                {tType.name}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                Chiếm {tType.slotsOccupied} ô (~{tType.slotsOccupied * 3}m²)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                              <span>{tType.capacity}</span>
                              <span>•</span>
                              <span
                                className={`font-bold ${
                                  effectiveAvailable === 0
                                    ? "text-rose-600"
                                    : effectiveAvailable <= 2
                                      ? "text-amber-600"
                                      : "text-emerald-700"
                                }`}
                              >
                                Kho: {effectiveAvailable}/{tType.totalQuantity} chiếc
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-800 font-extrabold mt-0.5">
                              {isHourly
                                ? `${tType.hourlyFirstHourPrice?.toLocaleString("vi-VN")}đ (giờ đầu)`
                                : `${tType.price?.toLocaleString("vi-VN")}đ/đêm`}
                            </div>
                          </div>

                          {/* Stepper +/- */}
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 flex-shrink-0">
                            <button
                              type="button"
                              disabled={currentQty <= 0}
                              onClick={() => updateChangeTentQty(tType.id, -1)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-white text-slate-700 flex items-center justify-center font-black transition-all shadow-2xs cursor-pointer"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-6 text-center text-xs font-black text-slate-900 font-mono">
                              {currentQty}
                            </span>
                            <button
                              type="button"
                              disabled={!canAddMore}
                              onClick={() => updateChangeTentQty(tType.id, 1)}
                              className="w-7 h-7 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black transition-all shadow-2xs cursor-pointer"
                              title={
                                !canAddMore
                                  ? isOutOfStock
                                    ? "Hết lều trong kho"
                                    : "Không đủ ô đất trống"
                                  : "Thêm 1 lều"
                              }
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Tiến độ lấp đầy mặt bằng */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-600">
                      Diện tích ô đất sử dụng:
                    </span>
                    <span
                      className={`font-black ${
                        slotsOccupied === totalSlots
                          ? "text-emerald-700"
                          : slotsOccupied > totalSlots
                            ? "text-rose-600"
                            : "text-amber-700"
                      }`}
                    >
                      {slotsOccupied} / {totalSlots} ô ({fitPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        slotsOccupied === totalSlots
                          ? "bg-emerald-600"
                          : slotsOccupied > totalSlots
                            ? "bg-rose-500"
                            : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, fitPercent)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {slotsOccupied === totalSlots ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check size={12} /> Vừa khít toàn bộ {totalSlots} ô đất (~{totalSlots * 3}m²)!
                      </span>
                    ) : slotsOccupied < totalSlots ? (
                      <span className="text-amber-700 font-semibold">
                        Còn dư {totalSlots - slotsOccupied} ô đất trống (~{(totalSlots - slotsOccupied) * 3}m²) chưa dựng lều.
                      </span>
                    ) : (
                      <span className="text-rose-600 font-black">
                        ⚠️ Vượt quá diện tích {totalSlots} ô đất! Vui lòng giảm bớt lều.
                      </span>
                    )}
                  </div>
                </div>

                {/* 5. So sánh giá & Tác động tài chính */}
                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2">
                  <div className="font-black text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>So Sánh Chi Phí Thuê Lều:</span>
                    <span className="text-[10px] text-emerald-800 font-normal">
                      Cọc đã nhận: {depositAmount.toLocaleString("vi-VN")}đ
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold">
                        Quy cách ban đầu:
                      </span>
                      <span className="text-xs font-black text-slate-700">
                        {originalTentFee.toLocaleString("vi-VN")}đ
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-300 shadow-2xs">
                      <span className="text-[10px] text-emerald-700 block font-bold">
                        Quy cách mới ({slotsOccupied} ô):
                      </span>
                      <span className="text-xs font-black text-emerald-900">
                        {newCalculatedPrice.toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60 text-xs">
                    <span className="font-bold text-slate-700">
                      Chênh lệch giá thuê lều:
                    </span>
                    <span
                      className={`font-black text-xs ${
                        priceDiff > 0
                          ? "text-amber-800"
                          : priceDiff < 0
                            ? "text-emerald-700"
                            : "text-slate-600"
                      }`}
                    >
                      {priceDiff > 0
                        ? `+${priceDiff.toLocaleString("vi-VN")}đ (Khách trả thêm)`
                        : priceDiff < 0
                          ? `-${Math.abs(priceDiff).toLocaleString("vi-VN")}đ (Giảm trừ bill)`
                          : "0đ (Không đổi giá)"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs font-black text-slate-900 pt-1">
                    <span>Dự kiến còn lại cần thanh toán:</span>
                    <span className="text-sm text-emerald-800 font-black">
                      {remainingToPay.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>

                {/* 6. Lý do / Ghi chú */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block text-[11px]">
                    Lý do thay đổi / Ghi chú (Lưu vào lịch sử đơn):
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {[
                      "Khách đổi ý tại quầy",
                      "Khách muốn đổi sang 3 lều nhỏ",
                      "Nâng cấp quy cách lều",
                      "Đổi theo thỏa thuận",
                    ].map((tag, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setChangeTentModal((prev) => ({
                            ...prev,
                            reason: tag,
                          }))
                        }
                        className="text-[10px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={changeTentModal.reason}
                    onChange={(e) =>
                      setChangeTentModal((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    placeholder="Nhập lý do đổi lều..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* 7. Auto check-in checkbox */}
                {changeTentModal.booking.status === "Booked" && (
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={changeTentModal.autoCheckIn}
                      onChange={(e) =>
                        setChangeTentModal((prev) => ({
                          ...prev,
                          autoCheckIn: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-emerald-600 rounded-md border-amber-300 focus:ring-amber-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-extrabold text-amber-950 block">
                        Tự động Nhận Lều (Check-in) ngay sau khi đổi
                      </span>
                      <span className="text-[10px] text-amber-700">
                        Chuyển trạng thái đơn sang Đang sử dụng (Occupied) và tạo Master Order đồ ăn/uống.
                      </span>
                    </div>
                  </label>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setChangeTentModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={
                    changeTentModal.loading ||
                    slotsOccupied === 0 ||
                    slotsOccupied > totalSlots
                  }
                  onClick={handleSaveTentSetupChange}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md hover:shadow-lg transition-all text-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {changeTentModal.loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={15} />
                  )}
                  {changeTentModal.autoCheckIn
                    ? "Lưu & Check-in Luôn"
                    : "Lưu & Cập Nhật Quy Cách Lều"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
