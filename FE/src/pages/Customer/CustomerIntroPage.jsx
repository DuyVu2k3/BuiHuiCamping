import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Compass, Flame, CloudSun, MapPin, ShieldCheck, Heart, Sparkles, ChevronRight, Tent, Utensils, Star, Phone, ArrowRight, X, Wine } from 'lucide-react';
import { getApiUrl, getImageUrl } from '../../apiConfig';

export default function CustomerIntroPage() {
  const navigate = useNavigate();
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  const openMenuModal = async () => {
    setShowMenuModal(true);
    if (menuItems.length === 0) {
      setLoadingMenu(true);
      try {
        const res = await axios.get(getApiUrl('/api/Menu'));
        if (res.data) setMenuItems(res.data);
      } catch (err) {
        console.error("Lỗi khi tải thực đơn tham khảo:", err);
      } finally {
        setLoadingMenu(false);
      }
    }
  };

  const categories = ['All', ...new Set(menuItems.map(item => item.category || 'Khác'))];
  const filteredItems = activeCategory === 'All' 
    ? menuItems 
    : menuItems.filter(item => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Hero Banner Section */}
      <div className="relative min-h-[520px] lg:min-h-[600px] w-full overflow-hidden rounded-b-[40px] shadow-xl pt-5 sm:pt-8 pb-10 sm:pb-12 flex flex-col justify-between">
        <img 
          src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=1920" 
          alt="Bùi Hui Camping Aerial View" 
          className="absolute inset-0 w-full h-full object-cover object-center scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1B4D3E] via-[#1B4D3E]/60 to-black/40" />

        {/* Floating Content Container */}
        <div className="relative z-10 max-w-5xl mx-auto w-full h-full flex flex-col justify-between px-6 gap-6 sm:gap-8 flex-1">
          {/* Top Section: Badge & Headline */}
          <div className="space-y-4 max-w-xl pt-2 sm:pt-4 animate-in fade-in slide-in-from-left-6 duration-1000">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full text-white text-[11px] font-bold uppercase tracking-wider shadow-md">
              <Sparkles size={13} className="text-amber-300" />
              Thiên Đường Cắm Trại & Săn Mây Trên Đỉnh Bùi Hui
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-md">
              Hòa Mình Với <br />
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200 bg-clip-text text-transparent">
                Mây Ngàn & Thảo Nguyên
              </span>
            </h1>
            <p className="text-emerald-100/90 text-sm sm:text-base font-medium leading-relaxed drop-shadow">
              Trải nghiệm thiên nhiên hoang sơ tuyệt đẹp tại Quảng Ngãi. Đón bình minh biển mây, thưởng thức BBQ nướng thơm lừng và lưu giữ từng khoảnh khắc đáng nhớ.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button 
                onClick={() => navigate('/guest/booking')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2.5 shadow-lg hover:shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Tent size={18} />
                Khám Phá Sơ Đồ & Đặt Lều Ngay
                <ArrowRight size={16} />
              </button>
              <button 
                onClick={openMenuModal}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Utensils size={16} />
                Xem Thực Đơn BBQ
              </button>
            </div>
          </div>

          {/* Bottom Section: Key Stats Pill */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-amber-300">700m+</p>
              <p className="text-[11px] text-emerald-100 font-medium mt-0.5">Độ cao so với mực nước biển</p>
            </div>
            <div className="text-center border-l border-white/15">
              <p className="text-xl sm:text-2xl font-extrabold text-amber-300">100%</p>
              <p className="text-[11px] text-emerald-100 font-medium mt-0.5">Biển mây bồng bềnh mỗi sáng</p>
            </div>
            <div className="text-center border-l border-white/15">
              <p className="text-xl sm:text-2xl font-extrabold text-amber-300">20+</p>
              <p className="text-[11px] text-emerald-100 font-medium mt-0.5">Lều trại cao cấp view toàn cảnh</p>
            </div>
            <div className="text-center border-l border-white/15">
              <p className="text-xl sm:text-2xl font-extrabold text-amber-300">4.9★</p>
              <p className="text-[11px] text-emerald-100 font-medium mt-0.5">Đánh giá tuyệt vời từ du khách</p>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights Section */}
      <section className="max-w-5xl mx-auto px-6 pt-12 sm:pt-16 pb-16 space-y-12">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-emerald-700 font-bold uppercase tracking-widest text-[11px] bg-emerald-100 px-3 py-1 rounded-full">
            TRẢI NGHIỆM ĐỘC BẢN
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            Tại Sao Chọn Bùi Hui Camping?
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            Không gian dã ngoại chuẩn chỉnh kết hợp hoàn hảo giữa thiên nhiên hoang sơ và tiện nghi hiện đại.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 space-y-3 hover:shadow-lg transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CloudSun size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Săn Mây & Ngắm Bình Minh</h3>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              Tận hưởng khoảnh khắc mở cửa lều là biển mây trắng cuồn cuộn bao phủ khắp các đỉnh núi dưới ánh bình minh rực rỡ.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 space-y-3 hover:shadow-lg transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Tiệc Đêm & Lửa Trại BBQ</h3>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              Quây quần bên ánh lửa ấm áp, thưởng thức thịt nướng nóng hổi, thịt xiên quay cùng nhạc acoustic giữa đêm núi rừng.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 space-y-3 hover:shadow-lg transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Tiện Nghi & An Toàn</h3>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              Lều chống nước cao cấp, chăn nệm ấm áp, khu vệ sinh sạch sẽ, có bảo vệ túc trực 24/7 bảo đảm trải nghiệm trọn vẹn.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Map Teaser Banner */}
      <section className="max-w-5xl mx-auto px-6 mb-16">
        <div className="relative rounded-2xl overflow-hidden bg-[#1B4D3E] text-white p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-emerald-800">
          <div className="space-y-3 max-w-lg">
            <span className="bg-amber-400/20 text-amber-300 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-amber-400/30">
              SƠ ĐỒ TRỰC QUAN MỚI
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Chọn Lều Yêu Thích Trên Bản Đồ Thực Tế
            </h2>
            <p className="text-emerald-100/90 text-xs sm:text-sm leading-relaxed">
              Bạn thích khu **Sàn Săn Mây**, góc **Trên Đồi** lộng gió hay **Khu Cây Giấy** thoáng mát? Hãy chọn vị trí chính xác trên sơ đồ 2D và đặt giữ chỗ ngay từ nhà!
            </p>
            <button 
              onClick={() => navigate('/guest/booking')}
              className="bg-white text-[#1B4D3E] hover:bg-emerald-50 px-6 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 shadow-md transition-all transform hover:scale-105 mt-2"
            >
              <Compass size={18} />
              Mở Sơ Đồ Đặt Lều Online
            </button>
          </div>
          <div className="w-full md:w-5/12 aspect-video rounded-xl overflow-hidden border border-white/20 shadow-xl relative group">
            <img src="https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&q=80&w=800" alt="Sơ đồ tương tác" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="bg-emerald-500/90 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm animate-bounce">
                Click để mở Sơ đồ tương tác
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Read-Only Menu Preview Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#1B4D3E] text-white p-6 sm:p-8 flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full border border-amber-400/30">
                  📋 Thực Đơn Tham Khảo
                </span>
                <h3 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
                  Thực Đơn Ẩm Thực Bùi Hui Camping
                </h3>
                <p className="text-emerald-100/90 text-xs sm:text-sm mt-1 font-medium">
                  Vui lòng quét mã QR tại Lều / Bàn ẩm thực để đặt món trực tiếp
                </p>
              </div>
              <button
                onClick={() => setShowMenuModal(false)}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={22} />
              </button>
            </div>

            {/* Category Filter Bar - Expanded height & spacing */}
            <div className="bg-slate-100/80 p-3.5 sm:p-4 border-b border-slate-200 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold whitespace-nowrap flex items-center justify-center gap-2 h-10 transition-all cursor-pointer shadow-xs ${
                    activeCategory === cat
                      ? "bg-[#1B4D3E] text-white shadow-md ring-2 ring-[#1B4D3E]/30"
                      : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {cat === "All" ? "🍽️ Tất cả món" : cat}
                </button>
              ))}
            </div>

            {/* Dishes Content Grid - 4 Columns on desktop */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-50/80 space-y-4">
              {loadingMenu ? (
                <div className="text-center py-20 text-emerald-800 font-extrabold animate-pulse">
                  Đang tải thực đơn tham khảo...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-semibold">
                  Chưa có món ăn nào trong danh mục này.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                          <img
                            src={
                              item.imageUrl
                                ? getImageUrl(item.imageUrl)
                                : "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&q=80&w=300"
                            }
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src =
                                "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&q=80&w=300";
                            }}
                          />
                          <span className="absolute top-2 left-2 text-[10px] font-extrabold uppercase bg-emerald-900/80 text-white px-2 py-0.5 rounded-md backdrop-blur-xs">
                            {item.category || "Ẩm thực"}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">
                            {item.name}
                          </h4>
                          {item.description && (
                            <p className="text-slate-500 text-xs line-clamp-2 mt-0.5 font-medium">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-sm font-black text-emerald-700">
                          {(item.price || 0).toLocaleString("vi-VN")}đ
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                          Chỉ xem tham khảo
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Notice */}
            <div className="bg-white border-t border-slate-200 p-4 text-center">
              <p className="text-xs font-bold text-slate-600">
                💡 Để đặt món, quý khách chỉ cần **quét mã QR** dán tại Lều cắm trại hoặc Bàn ẩm thực của mình.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
          <p>© 2026 Bùi Hui Camping. Bản quyền thuộc về Khu du lịch sinh thái Bùi Hui.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><MapPin size={14} className="text-emerald-600" /> Ba Tơ, Quảng Ngãi</span>
            <span className="flex items-center gap-1"><Phone size={14} className="text-emerald-600" /> Hotline: 0901.234.567</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
