import React, { useState } from 'react';
import { Tent, Users, MapPin, Check, Plus, Eye, QrCode, Layers, Info, CheckCircle2, Clock, Edit, Trash2, Sparkles } from 'lucide-react';

export default function LandGridMatrix({
  zone,
  tents = [],
  mode = 'receptionist', // 'receptionist' | 'manager'
  selectedTentIds = [],
  onSelectTent,
  onOpenTentDetail,
  onAddTentAtSlot,
  onDeleteTent
}) {
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState(null);
  const [hoveredBookingId, setHoveredBookingId] = useState(null);

  if (!zone) return null;

  const isTableZone = zone.zoneType === 'DiningTable' || 
    zone.name.toLowerCase().includes('bàn') || 
    zone.name.toLowerCase().includes('ẩm thực') || 
    zone.name.toLowerCase().includes('nhà hàng');

  const totalSlots = zone.totalSlots || 20;
  const cols = zone.gridCols || 5;
  const rows = Math.ceil(totalSlots / cols) || 4;

  const zoneTents = tents.filter(t => t.zoneId === zone.id || t.zone?.id === zone.id);

  // Map tents into slots - each tent occupies 1 standardized unit slot (~3m²)
  const slotGrid = Array.from({ length: totalSlots }, (_, idx) => ({
    slotIndex: idx,
    row: Math.floor(idx / cols),
    col: idx % cols,
    slotCode: `${zone.name.replace(/^Khu\s+/i, '')}.${String(idx + 1).padStart(2, '0')}`,
    tent: null,
    isFree: true
  }));

  zoneTents.forEach((tent) => {
    let targetIdx = -1;
    if (tent.slotCode) {
      const match = tent.slotCode.match(/\d+$/);
      if (match) {
        const parsed = parseInt(match[0], 10) - 1;
        if (parsed >= 0 && parsed < totalSlots && slotGrid[parsed].isFree) {
          targetIdx = parsed;
        }
      }
    }

    if (targetIdx === -1) {
      targetIdx = slotGrid.findIndex(s => s.isFree);
    }

    if (targetIdx !== -1 && targetIdx < totalSlots) {
      slotGrid[targetIdx].isFree = false;
      slotGrid[targetIdx].tent = tent;
    }
  });

  // Calculate statistics
  const usedSlots = zoneTents.filter(t => t.status === 'Booked' || t.status === 'Occupied' || t.status === 'Pending').length;
  const totalPitchedSlots = zoneTents.length;
  const availableSlots = Math.max(0, totalSlots - usedSlots);
  const freeGrassSlots = Math.max(0, totalSlots - totalPitchedSlots);
  const percentUsed = Math.min(100, Math.round((usedSlots / totalSlots) * 100));

  const getSizeBadge = (size) => {
    return { label: 'Ô Chuẩn', slots: 1, sqm: 3, color: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-600' };
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-200/80 space-y-6">
      {/* Grid Header & Quantified Land Summary */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-8 bg-[#1B4D3E] rounded-full" />
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span>{zone.name}</span>
                <span className="text-xs font-bold text-slate-400 font-mono">
                  ({cols} cột × {rows} hàng = {totalSlots} ô pixel)
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {zone.description || 'Định lượng mặt bằng khu đất chia theo ô chuẩn ~3m²/ô'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
              percentUsed >= 90 ? 'bg-rose-50 text-rose-700 border-rose-200' :
              percentUsed >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              Công suất hoạt động: {percentUsed}% ({usedSlots}/{totalSlots} ô đang có khách)
            </span>
          </div>
        </div>

        {/* Quantified Land Capacity Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200 p-0.5">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                percentUsed >= 90 ? 'bg-rose-500' :
                percentUsed >= 70 ? 'bg-amber-500' :
                'bg-emerald-500'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between items-center text-[11px] text-slate-500 font-medium gap-2">
            <span>Tổng diện tích khu đất: <strong>{totalSlots} ô (~{totalSlots * 3}m²)</strong></span>
            <span>Đã dựng lều: <strong>{totalPitchedSlots} ô (~{totalPitchedSlots * 3}m²)</strong></span>
            <span>Đang ở / Đã cọc: <strong>{usedSlots} ô (~{usedSlots * 3}m²)</strong></span>
            <span className="text-emerald-700 font-bold">Đất cỏ trống sẵn sàng: <strong>{freeGrassSlots} ô (~{freeGrassSlots * 3}m²)</strong></span>
          </div>
        </div>
      </div>

      {/* Visual Land Matrix Grid */}
      <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
        {/* Grid Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 border-b border-slate-200/70 pb-3 font-semibold">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md border-2 border-dashed border-slate-300 bg-white inline-block"></span>
              Ô đất cỏ trống (~3m²)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shadow-xs"></span>
              Ô đất chuẩn sẵn sàng
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-500 inline-block shadow-xs"></span>
              Lều đã cọc / Lều gộp
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-rose-500 inline-block shadow-xs"></span>
              Đang có khách lưu trú
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
            <Sparkles size={13} className="text-amber-500" />
            * Di chuột vào ô đã đặt để phát sáng toàn bộ các ô thuộc cùng 1 đơn đặt lều gộp
          </span>
        </div>

        {/* Matrix Tiles */}
        <div 
          className="grid gap-2.5 sm:gap-3 select-none"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
          }}
        >
          {slotGrid.map((slot) => {
            const tent = slot.tent;
            const isHovered = hoveredSlotIndex === slot.slotIndex;

            // Empty Grass Land Slot
            if (slot.isFree || !tent) {
              return (
                <div
                  key={slot.slotIndex}
                  onMouseEnter={() => setHoveredSlotIndex(slot.slotIndex)}
                  onMouseLeave={() => setHoveredSlotIndex(null)}
                  onClick={() => {
                    if (onAddTentAtSlot) {
                      onAddTentAtSlot(zone, slot);
                    }
                  }}
                  className={`min-h-[92px] rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 hover:bg-emerald-50/40 hover:border-emerald-400 p-2.5 flex flex-col justify-between transition-all duration-200 ${
                    onAddTentAtSlot ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
                  }`}
                >
                  <div className="flex justify-between items-start text-[10px]">
                    <span className="font-mono font-bold text-slate-400">Ô {slot.slotCode}</span>
                    <span className="text-slate-400">~3m²</span>
                  </div>
                  <div className="text-center my-auto">
                    <p className="text-[11px] font-bold text-slate-400">Đất Trống</p>
                    <span className="text-[9px] text-slate-400 block">Sẵn sàng dựng</span>
                  </div>
                  {onAddTentAtSlot && (
                    <div className="text-[9px] font-bold text-emerald-600 flex items-center justify-center gap-1 pt-1 border-t border-slate-100">
                      <Plus size={10} /> Dựng lều
                    </div>
                  )}
                </div>
              );
            }

            // Occupied Slot with Tent
            const activeBooking = tent.activeBooking || tent.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected');
            const tentBookingId = activeBooking?.id;

            const siblingTentsInBooking = tentBookingId
              ? zoneTents.filter(t => (t.activeBooking?.id || t.bookings?.find(b => b.status !== 'CheckedOut' && b.status !== 'Cancelled' && b.status !== 'Rejected')?.id) === tentBookingId)
              : [];
            const isGrouped = siblingTentsInBooking.length > 1;

            const isLinkedToHoveredBooking = Boolean(hoveredBookingId && tentBookingId === hoveredBookingId);
            const isDimmed = Boolean(hoveredBookingId && !isLinkedToHoveredBooking);
            const isSelected = selectedTentIds.includes(tent.id);
            const isOccupied = tent.status === 'Occupied';
            const isBooked = tent.status === 'Booked' || tent.status === 'Pending';

            return (
              <div
                key={slot.slotIndex}
                onMouseEnter={() => {
                  setHoveredSlotIndex(slot.slotIndex);
                  if (tentBookingId) {
                    setHoveredBookingId(tentBookingId);
                  } else {
                    setHoveredBookingId(null);
                  }
                }}
                onMouseLeave={() => {
                  setHoveredSlotIndex(null);
                  setHoveredBookingId(null);
                }}
                onClick={() => {
                  if (mode === 'receptionist' && onSelectTent) {
                    onSelectTent(tent);
                  } else if (mode === 'manager' && onOpenTentDetail) {
                    onOpenTentDetail(tent);
                  }
                }}
                className={`min-h-[92px] rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer transition-all duration-200 relative group border-2 ${
                  isLinkedToHoveredBooking
                    ? 'border-amber-400 bg-amber-50 ring-4 ring-amber-400 shadow-xl scale-[1.04] z-20'
                    : isDimmed
                      ? 'opacity-35 scale-95 transition-all'
                      : isSelected
                        ? 'border-amber-400 bg-amber-50 ring-4 ring-amber-300/70 shadow-md scale-[1.02] z-10'
                        : isOccupied
                          ? 'border-rose-300 bg-rose-50/70 hover:border-rose-400'
                          : isBooked
                            ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400'
                            : 'border-emerald-300 bg-emerald-50/70 hover:border-emerald-500 hover:shadow-md'
                }`}
              >
                {/* Header: Slot Code & Group / Size Badge */}
                <div className="flex justify-between items-start text-[10px]">
                  <span className="font-mono font-bold text-slate-700">Ô {slot.slotCode}</span>
                  {isGrouped ? (
                    <span className="px-1.5 py-0.5 rounded-md font-black text-[9px] bg-amber-400 text-slate-900 border border-amber-500 shadow-xs">
                      Gộp {siblingTentsInBooking.length} ô
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md font-bold text-[9px] border bg-emerald-100 text-emerald-900 border-emerald-300">
                      ~3m²
                    </span>
                  )}
                </div>

                {/* Center: Tent Name & Customer Info */}
                <div className="my-auto py-1">
                  <p className="text-xs font-black text-slate-800 truncate">
                    {isTableZone ? (tent.name.startsWith('Bàn') ? tent.name : `Bàn ${tent.name}`) : `Ô ${tent.slotCode || tent.name}`}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium truncate">
                    {isGrouped ? (
                      <span className="text-amber-700 font-bold block truncate">
                        {activeBooking?.tentSetupSummary ? `⛺ ${activeBooking.tentSetupSummary} • ` : 'Lều Gộp • '}
                        {activeBooking?.customerName || 'Khách đặt'}
                      </span>
                    ) : activeBooking?.tentSetupSummary ? (
                      <span className="text-emerald-700 font-bold block truncate">
                        ⛺ {activeBooking.tentSetupSummary}
                      </span>
                    ) : (
                      <span>Ô Chuẩn (~3m²)</span>
                    )}
                  </p>
                </div>

                {/* Footer: Status Pill */}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[10px]">
                  <span className={`font-bold flex items-center gap-1 ${
                    isLinkedToHoveredBooking || isSelected ? 'text-amber-800' :
                    isOccupied ? 'text-rose-700' :
                    isBooked ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isLinkedToHoveredBooking || isSelected ? 'bg-amber-500' :
                      isOccupied ? 'bg-rose-500' :
                      isBooked ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    {isLinkedToHoveredBooking ? `Lều gộp (${siblingTentsInBooking.length} ô)` :
                     isSelected ? 'Đang chọn' :
                     isOccupied ? 'Đang ở' :
                     isBooked ? 'Đã cọc' : 'Sẵn sàng'}
                  </span>
                  <span className="font-bold text-slate-600">
                    ~3m²
                  </span>
                </div>

                {/* Manager Quick Actions: Edit & Delete */}
                {mode === 'manager' && (
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60 mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenTentDetail) onOpenTentDetail(tent);
                      }}
                      className="flex-1 py-1 px-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-xs transition-colors"
                      title={isTableZone ? "Chỉnh sửa bàn" : "Chỉnh sửa ô đất"}
                    >
                      <Edit size={10} /> Sửa
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteTent) onDeleteTent(tent);
                      }}
                      className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[10px] flex items-center justify-center transition-colors"
                      title={isTableZone ? "Xóa bàn này" : "Xóa ô đất này"}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}

                {/* Selected Indicator Checkmark */}
                {isSelected && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
