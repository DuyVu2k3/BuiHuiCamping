import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Tent,
  Lock,
  User,
  LogIn,
  Sparkles,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    if (!username || !password) {
      toast.error("Vui lòng nhập Tên đăng nhập và Mật khẩu");
      return;
    }

    setLoading(true);
    try {
      const userData = await login(username, password);
      toast.success(`Xin chào, ${userData.fullName}!`);

      // Redirect based on role
      if (userData.role === "Manager") {
        navigate("/manager/dashboard");
      } else if (userData.role === "Receptionist") {
        navigate("/receptionist/booking");
      } else if (userData.role === "Waiter") {
        navigate("/waiter/orders");
      } else if (userData.role === "Kitchen") {
        navigate("/kitchen/orders");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
          "Đăng nhập thất bại. Kiểm tra lại thông tin!",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
    setLoading(true);
    login(u, p)
      .then((userData) => {
        toast.success(`Đăng nhập nhanh thành công: ${userData.fullName}`);
        if (userData.role === "Manager") navigate("/manager/dashboard");
        else if (userData.role === "Receptionist")
          navigate("/receptionist/booking");
        else if (userData.role === "Waiter") navigate("/waiter/orders");
        else if (userData.role === "Kitchen") navigate("/kitchen/orders");
      })
      .catch((err) => {
        toast.error("Đăng nhập nhanh không thành công");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-md w-full p-8 relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center mx-auto shadow-lg shadow-[#1B4D3E]/30">
            <Tent size={36} strokeWidth={2.5} />
          </div>
          <h1
            className="text-4xl font-bold text-[#1B4D3E]"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Bùi Hui Camping
          </h1>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
            CỔNG ĐĂNG NHẬP NỘI BỘ NHÂN VIÊN
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
              <User size={14} className="text-[#1B4D3E]" /> Tên Đăng Nhập
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tài khoản ..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
              <Lock size={14} className="text-[#1B4D3E]" /> Mật Khẩu
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-extrabold rounded-2xl shadow-lg shadow-[#1B4D3E]/20 flex items-center justify-center gap-2 transition-all active:scale-98 text-sm"
          >
            <LogIn size={18} />
            {loading ? "Đang xác thực..." : "Đăng Nhập Hệ Thống"}
          </button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" /> Đăng Nhập Nhanh Để
            Test Demo
          </p>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => handleQuickLogin("manager", "123456")}
              className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-xl border border-slate-300 transition-all text-left flex items-center gap-1.5"
            >
              👑{" "}
              <div>
                <p className="text-[10px]">Quản Lý</p>
                <p className="text-[8px] text-slate-500 font-mono">manager</p>
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin("reception", "123456")}
              className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold rounded-xl border border-emerald-200 transition-all text-left flex items-center gap-1.5"
            >
              🛎️{" "}
              <div>
                <p className="text-[10px]">Lễ Tân</p>
                <p className="text-[8px] text-emerald-600 font-mono">
                  reception
                </p>
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin("bep1", "123456")}
              className="py-2 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-200 transition-all text-left flex items-center gap-1.5"
            >
              🍳{" "}
              <div>
                <p className="text-[10px]">Nhà Bếp</p>
                <p className="text-[8px] text-amber-600 font-mono">
                  bep1
                </p>
              </div>
            </button>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Chạy Bàn Theo Khu Vực Phụ Trách:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              <button
                onClick={() => handleQuickLogin("waiter_a", "123456")}
                className="py-2 px-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold rounded-xl border border-sky-200 transition-all text-center"
              >
                <span className="block text-[10px]">🏃 Khu A</span>
                <span className="text-[8px] text-sky-600 font-mono block">
                  waiter_a
                </span>
              </button>

              <button
                onClick={() => handleQuickLogin("waiter_b", "123456")}
                className="py-2 px-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold rounded-xl border border-purple-200 transition-all text-center"
              >
                <span className="block text-[10px]">🏃 Khu B</span>
                <span className="text-[8px] text-purple-600 font-mono block">
                  waiter_b
                </span>
              </button>

              <button
                onClick={() => handleQuickLogin("waiter_amthuc", "123456")}
                className="py-2 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold rounded-xl border border-emerald-200 transition-all text-center"
              >
                <span className="block text-[10px]">🍽️ Khu Ẩm Thực</span>
                <span className="text-[8px] text-emerald-600 font-mono block">
                  waiter_amthuc
                </span>
              </button>

              <button
                onClick={() => handleQuickLogin("waiter_all", "123456")}
                className="py-2 px-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-200 transition-all text-center"
              >
                <span className="block text-[10px]">🏃 Toàn Khu</span>
                <span className="text-[8px] text-amber-600 font-mono block">
                  waiter_all
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
