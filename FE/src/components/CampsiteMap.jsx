import React, { useState } from 'react';
import { Tent, MapPin, Sparkles, ChevronRight, Info, Eye, CheckCircle2 } from 'lucide-react';

export default function CampsiteMap({ tents = [], zones = [], selectedTentIds = [], onSelectTent }) {
  const [activeZoneFilter, setActiveZoneFilter] = useState('All');
  const [hoveredTent, setHoveredTent] = useState(null);

  const formatTentName = (tent) => {
    if (!tent.zone) return tent.name;
    const zonePrefix = tent.zone.name.replace(/^Khu\s+/i, '');
    if (tent.name.toUpperCase().startsWith(zonePrefix.toUpperCase()) || tent.name.includes('.')) {
      return tent.name;
    }
    return `${zonePrefix}.${tent.name}`;
  };

  // Map coordinates for zones on the aerial map background
  const mapHotspots = [
    { id: 'ruong', name: 'Ruộng Bình Rượu Trời', top: '30%', left: '25%', color: 'bg-teal-600', desc: 'Khu vực ruộng bậc thang xanh mát' },
    { id: 'do-xe', name: 'Khu Vực Đỗ Xe', top: '30%', left: '45%', color: 'bg-slate-600', desc: 'Bãi đỗ xe ô tô và xe máy an toàn 24/7' },
    { id: 'am-thuc', name: 'Khu Ẩm Thực & Lửa Trại', top: '55%', left: '30%', color: 'bg-amber-600', desc: 'Trung tâm ăn uống BBQ và sân khấu đêm' },
    { id: 'tro-choi', name: 'Khu Trò Chơi Trẻ Em', top: '75%', left: '10%', color: 'bg-purple-600', desc: 'Máng trượt cầu vồng, trò chơi dã ngoại' },
    { id: 'cay-giay', name: 'Khu Cây Giấy', top: '65%', left: '35%', color: 'bg-lime-600', desc: 'Bãi cỏ bằng phẳng, lều Cây Giấy' },
    { id: 'tren-doi', name: 'Trên đồi', top: '30%', left: '70%', color: 'bg-[#1B4D3E]', desc: 'View toàn cảnh đồi núi lộng gió' },
    { id: 'san-may', name: 'Sàn check-in Săn Mây', top: '92%', left: '70%', color: 'bg-emerald-600', desc: 'Khu vực lễ tân, sàn ngắm mây & gác quan sát' },
  ];

  // Specific tent pins overlay
  const tentPins = tents.map((t, idx) => {
    let top = '50%';
    let left = '50%';

    // If manager has pinned the tent, use their exact coordinates
    if (t.mapTop && t.mapLeft) {
      top = t.mapTop;
      left = t.mapLeft;
    } else {
      // Fallback distribution for unknown tents outside of view or clumped together
      top = `${10 + (idx % 5) * 5}%`;
      left = `${10 + Math.floor(idx / 5) * 5}%`;
    }

    return { ...t, top, left };
  });

  const filteredTents = tentPins.filter(t => 
    activeZoneFilter === 'All' || (t.zone && t.zone.name.toLowerCase().includes(activeZoneFilter.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Zone Filters Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <button 
          onClick={() => setActiveZoneFilter('All')}
          className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all ${activeZoneFilter === 'All' ? 'bg-[#1B4D3E] text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
        >
          🌐 Tất Cả Khu Vực ({tents.length} Lều)
        </button>
        {zones.map(z => (
          <button 
            key={z.id}
            onClick={() => setActiveZoneFilter(z.name)}
            className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all ${activeZoneFilter === z.name ? 'bg-[#1B4D3E] text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
          >
            🏕️ {z.name} ({z.tents?.length || 0})
          </button>
        ))}
      </div>

      {/* Main Interactive Map Container */}
      <div className="w-full overflow-x-auto custom-scrollbar rounded-3xl shadow-2xl border-4 border-white bg-slate-900">
        <div className="relative w-[1000px] lg:w-full aspect-[16/9] group select-none">
        {/* Aerial Map Image */}
        <img 
          src="/campsite-map-new.jpg" 
          alt="Bản đồ tương tác Bùi Hui" 
          className="w-full h-full object-cover object-center"
        />

        {/* Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 z-20 bg-slate-900/85 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl border border-white/20 shadow-lg flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">SƠ ĐỒ TRỰC QUAN MẶT BẰNG 2D</p>
            <p className="text-[11px] text-slate-300">Click chọn 1 hoặc nhiều lều để gửi yêu cầu giữ chỗ</p>
          </div>
        </div>

        {/* Zone Hotspots / Badges */}
        {mapHotspots.map(spot => (
          <div 
            key={spot.id}
            style={{ top: spot.top, left: spot.left }}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer group/spot"
          >
            <div className={`px-3 py-1.5 rounded-xl text-white font-extrabold text-[11px] shadow-xl border border-white/30 backdrop-blur-md flex items-center gap-1.5 transform transition-all duration-300 group-hover/spot:scale-110 ${spot.color}`}>
              <MapPin size={12} className="text-amber-300" />
              {spot.name}
            </div>
          </div>
        ))}

        {/* Tent Pin Markers */}
        {filteredTents.map(tent => {
          const isAvailable = tent.status === 'Available';
          const isSelected = selectedTentIds.includes(tent.id);
          const isHovered = hoveredTent?.id === tent.id;

          return (
            <div 
              key={tent.id}
              style={{ top: tent.top, left: tent.left }}
              onClick={() => onSelectTent(tent)}
              onMouseEnter={() => setHoveredTent(tent)}
              onMouseLeave={() => setHoveredTent(null)}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer group/tent"
            >
              {/* Pulse effect if available */}
              {isAvailable && !isSelected && (
                <div className="absolute -inset-2 bg-emerald-400/40 rounded-full animate-ping pointer-events-none" />
              )}

              {/* Pin Pill Button */}
              <div className={`relative px-2.5 py-1 rounded-full font-black text-[10px] flex items-center gap-1 shadow-2xl border-2 transition-all transform duration-200 group-hover/tent:scale-125 ${
                isSelected ? 'bg-amber-500 text-white border-white ring-4 ring-amber-300/80 scale-110 z-30' :
                isAvailable ? 'bg-emerald-500 text-white border-white' : 'bg-rose-500 text-white border-white/80 opacity-90'
              }`}>
                <Tent size={12} />
                <span>Lều {formatTentName(tent)}</span>
              </div>

              {/* Hover Tooltip Card */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-white/20 z-30 animate-in zoom-in-95 duration-200 pointer-events-none">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-xs text-emerald-400">Lều {formatTentName(tent)}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${isAvailable ? 'bg-emerald-500/30 text-emerald-300' : 'bg-rose-500/30 text-rose-300'}`}>
                      {isAvailable ? 'Trống' : 'Đã Đặt'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 mb-2">{tent.zone?.name || 'Khu cắm trại'}</p>
                  <div className="flex justify-between items-center pt-1 border-t border-white/10 text-xs">
                    <span className="text-slate-400 text-[10px]">Giá thuê/đêm:</span>
                    <span className="font-extrabold text-amber-300">{tent.price ? tent.price.toLocaleString('vi-VN') + 'đ' : '0đ'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* Map Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
            Lều Trống (Có thể đặt cọc)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm"></span>
            Lều Đã Đặt / Có Khách
          </span>
        </div>
        <div className="text-slate-400 text-[11px] font-medium">
          * Nhấp trực tiếp vào biểu tượng lều để mở khung thông tin & đặt cọc online.
        </div>
      </div>
    </div>
  );
}
