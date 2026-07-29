import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Flame, CloudSun, MapPin, ShieldCheck, Heart, Sparkles, ChevronRight, Tent, Utensils, Star, Phone, ArrowRight } from 'lucide-react';

export default function CustomerIntroPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Hero Banner Section */}
      <div className="relative min-h-[650px] h-[calc(100vh-90px)] w-full overflow-hidden rounded-b-[40px] shadow-2xl">
        <img 
          src="https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmmwlohal5Ljr4cYstGs6k81HvmZbvhBXtN1zTl1QFLf0-HyX0HuaViTpbfIaABLgPGKK9s8u3nmha3RNeo9csLgXt1ZcHqfgy5-_8B6yYHEO1-uw2yXLzJXOx3mjnAaA6og8F_ab7i9kK6=s1360-w1360-h1020-rw" 
          alt="Bùi Hui Camping Aerial View" 
          className="absolute inset-0 w-full h-full object-cover object-center scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1B4D3E] via-[#1B4D3E]/60 to-black/30" />

        {/* Floating Content */}
        <div className="relative z-10 max-w-6xl mx-auto h-full flex flex-col justify-center px-6 py-12 gap-8 sm:gap-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-white text-xs font-bold uppercase tracking-widest self-start shadow-lg animate-in fade-in slide-in-from-top-4 duration-700">
            <Sparkles size={14} className="text-amber-300" />
            Thiên Đường Cắm Trại & Săn Mây Trên Đỉnh Bùi Hui
          </div>

          {/* Headline & CTA */}
          <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-left-6 duration-1000">
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-md">
              Hòa Mình Với <br />
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200 bg-clip-text text-transparent">
                Mây Ngàn & Thảo Nguyên
              </span>
            </h1>
            <p className="text-emerald-100/90 text-base sm:text-lg font-medium leading-relaxed drop-shadow">
              Trải nghiệm thiên nhiên hoang sơ tuyệt đẹp tại Quảng Ngãi. Đón bình minh biển mây, thưởng thức BBQ nướng thơm lừng và lưu giữ từng khoảnh khắc đáng nhớ.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button 
                onClick={() => navigate('/guest/booking')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-extrabold text-base flex items-center gap-3 shadow-xl hover:shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Tent size={20} />
                Khám Phá Sơ Đồ & Đặt Lều Ngay
                <ArrowRight size={18} />
              </button>
              <button 
                onClick={() => navigate('/customer/menu')}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 px-6 py-4 rounded-2xl font-bold text-base flex items-center gap-2 transition-all"
              >
                <Utensils size={18} />
                Xem Thực Đơn BBQ
              </button>
            </div>
          </div>

          {/* Key Stats Pill */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 text-white">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-amber-300">700m+</p>
              <p className="text-xs text-emerald-100 font-medium">Độ cao so với mực nước biển</p>
            </div>
            <div className="text-center border-l border-white/10">
              <p className="text-2xl font-extrabold text-amber-300">100%</p>
              <p className="text-xs text-emerald-100 font-medium">Biển mây bồng bềnh mỗi sáng</p>
            </div>
            <div className="text-center border-l border-white/10">
              <p className="text-2xl font-extrabold text-amber-300">20+</p>
              <p className="text-xs text-emerald-100 font-medium">Lều trại cao cấp view toàn cảnh</p>
            </div>
            <div className="text-center border-l border-white/10">
              <p className="text-2xl font-extrabold text-amber-300">4.9★</p>
              <p className="text-xs text-emerald-100 font-medium">Đánh giá tuyệt vời từ du khách</p>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-emerald-700 font-bold uppercase tracking-widest text-xs bg-emerald-100 px-3 py-1 rounded-full">
            TRẢI NGHIỆM ĐỘC BẢN
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">
            Tại Sao Chọn Bùi Hui Camping?
          </h2>
          <p className="text-slate-500 text-sm sm:text-base font-medium">
            Không gian dã ngoại chuẩn chỉnh kết hợp hoàn hảo giữa thiên nhiên hoang sơ và tiện nghi hiện đại.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-4 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CloudSun size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Săn Mây & Ngắm Bình Minh</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Tận hưởng khoảnh khắc mở cửa lều là biển mây trắng cuồn cuộn bao phủ khắp các đỉnh núi dưới ánh bình minh rực rỡ.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-4 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Flame size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Tiệc Đêm & Lửa Trại BBQ</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Quây quần bên ánh lửa ấm áp, thưởng thức thịt nướng nóng hổi, thịt xiên quay cùng nhạc acoustic giữa đêm núi rừng.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-4 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Tiện Nghi & An Toàn</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Lều chống nước cao cấp, chăn nệm ấm áp, khu vệ sinh sạch sẽ, có bảo vệ túc trực 24/7 bảo đảm trải nghiệm trọn vẹn.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Map Teaser Banner */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="relative rounded-3xl overflow-hidden bg-[#1B4D3E] text-white p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-emerald-800">
          <div className="space-y-4 max-w-xl">
            <span className="bg-amber-400/20 text-amber-300 text-xs font-extrabold uppercase px-3 py-1 rounded-full border border-amber-400/30">
              SƠ ĐỒ TRỰC QUAN MỚI
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Chọn Lều Yêu Thích Trên Bản Đồ Thực Tế
            </h2>
            <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed">
              Bạn thích khu **Sàn Săn Mây**, góc **Trên Đồi** lộng gió hay **Khu Cây Giấy** thoáng mát? Hãy chọn vị trí chính xác trên sơ đồ 2D và đặt giữ chỗ ngay từ nhà!
            </p>
            <button 
              onClick={() => navigate('/guest/booking')}
              className="bg-white text-[#1B4D3E] hover:bg-emerald-50 px-8 py-4 rounded-2xl font-extrabold text-base flex items-center gap-3 shadow-lg transition-all transform hover:scale-105 mt-4"
            >
              <Compass size={20} />
              Mở Sơ Đồ Đặt Lều Online
            </button>
          </div>
          <div className="w-full md:w-1/2 aspect-video rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl relative group">
            <img src="https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmmwlohal5Ljr4cYstGs6k81HvmZbvhBXtN1zTl1QFLf0-HyX0HuaViTpbfIaABLgPGKK9s8u3nmha3RNeo9csLgXt1ZcHqfgy5-_8B6yYHEO1-uw2yXLzJXOx3mjnAaA6og8F_ab7i9kK6=s1360-w1360-h1020-rw" alt="Sơ đồ tương tác" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out will-change-transform" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="bg-emerald-500/90 text-white font-extrabold text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur-sm animate-bounce">
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
