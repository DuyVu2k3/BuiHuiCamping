import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Flame, CloudSun, MapPin, ShieldCheck, Heart, Sparkles, ChevronRight, Tent, Utensils, Star, Phone, ArrowRight } from 'lucide-react';

export default function CustomerIntroPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Hero Banner Section */}
      <div className="relative min-h-[520px] lg:min-h-[600px] w-full overflow-hidden rounded-b-[40px] shadow-xl pt-5 sm:pt-8 pb-10 sm:pb-12 flex flex-col justify-between">
        <img 
          src="https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmmwlohal5Ljr4cYstGs6k81HvmZbvhBXtN1zTl1QFLf0-HyX0HuaViTpbfIaABLgPGKK9s8u3nmha3RNeo9csLgXt1ZcHqfgy5-_8B6yYHEO1-uw2yXLzJXOx3mjnAaA6og8F_ab7i9kK6=s1360-w1360-h1020-rw" 
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
                onClick={() => navigate('/customer/menu')}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
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
            <img src="https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmmwlohal5Ljr4cYstGs6k81HvmZbvhBXtN1zTl1QFLf0-HyX0HuaViTpbfIaABLgPGKK9s8u3nmha3RNeo9csLgXt1ZcHqfgy5-_8B6yYHEO1-uw2yXLzJXOx3mjnAaA6og8F_ab7i9kK6=s1360-w1360-h1020-rw" alt="Sơ đồ tương tác" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="bg-emerald-500/90 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm animate-bounce">
                Click để mở Sơ đồ tương tác
              </span>
            </div>
          </div>
        </div>
      </section>

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
