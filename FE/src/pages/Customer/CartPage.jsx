import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ShoppingBag, Minus, Plus, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl, getImageUrl } from '../../apiConfig';

export default function CartPage() {
  const { cart, setCart, tentName } = useOutletContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const updateQuantity = (itemId, delta) => {
    setCart(cart.map(c => {
      if (c.menuItemId === itemId) {
        return { ...c, quantity: Math.max(0, c.quantity + delta) };
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const updateNote = (itemId, note) => {
    setCart(cart.map(c => c.menuItemId === itemId ? { ...c, note } : c));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.itemData.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const submitOrder = async () => {
    if (cart.length === 0) return;

    const payload = {
      tentName: tentName,
      customerName: "Khách quét QR",
      phoneNumber: "",
      items: cart.map(c => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        note: c.note
      }))
    };

    try {
      setIsSubmitting(true);
      const res = await fetch('https://localhost:7248/api/Orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        toast.error(`Lỗi: ${errText}`);
      } else {
        setSuccess(true);
        setCart([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể kết nối đến máy chủ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
          <CheckCircle2 size={48} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Đặt món thành công!</h2>
        <p className="text-slate-500 mb-8 px-4 leading-relaxed">Nhà bếp đã nhận được yêu cầu của bạn. Đồ ăn sẽ được mang tới <b>{tentName}</b> trong ít phút nữa.</p>
        <button 
          onClick={() => { setSuccess(false); navigate('/customer/menu'); }}
          className="bg-slate-900 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-slate-900/30 transition-all active:scale-95 flex items-center gap-2"
        >
          Tiếp tục gọi món <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-50 p-6">
        <ShoppingBag size={64} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-500">Giỏ hàng trống</h2>
        <p className="text-sm text-slate-400 text-center mt-2">Bạn chưa chọn món nào. Hãy qua trang Menu để chọn đồ ngon nhé!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="bg-rose-100 p-2.5 rounded-2xl text-rose-600 shadow-sm">
          <ShoppingBag size={22} />
        </div>
        <div>
          <h2 className="font-black text-xl text-slate-800 tracking-tight">Đơn hàng của bạn</h2>
          <p className="text-xs text-slate-500 font-semibold">Đã chọn {totalItems} món</p>
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-6">
        {cart.map(item => (
          <div key={item.menuItemId} className="bg-white p-3 rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.03)] flex gap-4 border border-slate-100/50">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm border border-slate-200/50">
              <img src={getImageUrl(item.itemData.imageUrl)} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <h4 className="font-bold text-slate-800 text-sm leading-tight pr-2">{item.itemData.name}</h4>
                <div className="font-black text-emerald-600 text-sm mt-1">
                  {(item.itemData.price * item.quantity).toLocaleString('vi-VN')} đ
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3 bg-slate-50 rounded-full border border-slate-200 px-2 py-1 shadow-sm">
                  <button onClick={() => updateQuantity(item.menuItemId, -1)} className="text-slate-400 hover:text-rose-500 p-1"><Minus size={14} strokeWidth={3} /></button>
                  <span className="font-bold text-sm text-slate-800 w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.menuItemId, 1)} className="text-emerald-500 hover:text-emerald-600 p-1"><Plus size={14} strokeWidth={3} /></button>
                </div>
              </div>
              
              <div className="mt-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center px-3 py-1.5 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-sm">
                <Info size={14} className="text-slate-400 mr-2" />
                <input 
                  type="text" 
                  placeholder="Ghi chú (Vd: ít đá, cay...)" 
                  value={item.note}
                  onChange={(e) => updateNote(item.menuItemId, e.target.value)}
                  className="text-xs w-full bg-transparent outline-none text-slate-700 placeholder-slate-400 font-medium"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Submit */}
      <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgb(0,0,0,0.03)] rounded-t-3xl mt-auto">
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-500 font-semibold text-sm">Tổng thanh toán</span>
          <span className="font-black text-2xl text-rose-600">{totalAmount.toLocaleString('vi-VN')} đ</span>
        </div>
        <button 
          onClick={submitOrder}
          disabled={isSubmitting}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold text-lg rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex justify-center items-center gap-2 active:scale-95"
        >
          {isSubmitting ? 'Đang gửi Order...' : 'Xác nhận Đặt món'}
        </button>
      </div>
    </div>
  );
}
