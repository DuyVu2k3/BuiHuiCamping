import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useOutletContext } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, X, Flame, Wine, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl } from '../../apiConfig';

export default function MenuPage() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCartModal, setShowCartModal] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Use Lifted Cart State
  const { cart, setCart, tentName, tentId } = useOutletContext();

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.itemData.price * item.quantity), 0);

  useEffect(() => {
    axios.get(getApiUrl('/api/Menu'))
      .then(res => {
        if (res.data) setMenu(res.data);
      })
      .catch(err => console.error("Failed to fetch menu:", err))
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (item) => {
    const existing = cart.find(c => c.menuItemId === item.id);
    if (existing) {
      setCart(cart.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { menuItemId: item.id, itemData: item, quantity: 1, note: '' }]);
    }
  };

  const updateQuantity = (itemId, delta) => {
    setCart(cart.map(c => {
      if (c.menuItemId === itemId) {
        return { ...c, quantity: Math.max(0, c.quantity + delta) };
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);

    try {
      const activeTentId = tentId || parseInt(sessionStorage.getItem('customerTentId'));
      const orderPayload = {
        tentId: activeTentId ? activeTentId : undefined,
        tentName: tentName,
        customerName: `Khách lều ${tentName}`,
        items: cart.map(c => ({
          menuItemId: c.menuItemId,
          quantity: c.quantity,
          note: c.note || ""
        }))
      };

      const res = await axios.post(getApiUrl('/api/Orders'), orderPayload);
      if (res.status === 200 || res.status === 201) {
        setCart([]);
        setOrderSuccess(true);
        setTimeout(() => {
          setOrderSuccess(false);
          setShowCartModal(false);
        }, 2000);
      }
    } catch (err) {
      toast.error(err.response?.data || "Đặt món thất bại. Vui lòng liên hệ Lễ Tân.");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { id: 'All', label: 'Tất cả' },
    { id: 'Food', label: 'Đồ ăn' },
    { id: 'Drink', label: 'Đồ uống' },
    { id: 'Service', label: 'Dịch vụ & Vui chơi' },
  ];

  const foodItems = menu.filter(m => m.category === 'Food');
  const drinkItems = menu.filter(m => m.category === 'Drink');
  const serviceItems = menu.filter(m => m.category === 'Service' || (m.category !== 'Food' && m.category !== 'Drink'));

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-32 bg-slate-200/60 rounded-3xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-5 pt-3 pb-12 flex flex-col gap-6 relative text-slate-800">
      
      {/* Title Header - Figma style */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-[#7C5A38] uppercase mb-1">HƯƠNG VỊ & TRẢI NGHIỆM NÚI RỪNG</p>
        <h2 className="text-2xl font-black text-[#1B4D3E] tracking-tight leading-tight">
          Thực đơn & Dịch vụ hôm nay
        </h2>
      </div>

      {/* Category Pills */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 -mx-5 px-5">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeCategory === cat.id 
                ? 'bg-[#1B4D3E] text-white shadow-md shadow-[#1B4D3E]/20' 
                : 'bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: FOOD (List view as Figma) */}
      {(activeCategory === 'All' || activeCategory === 'Food') && foodItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
            <Flame size={18} className="text-amber-600" />
            Đồ ăn
          </h3>

          <div className="space-y-3">
            {foodItems.map(item => {
              const cartItem = cart.find(c => c.menuItemId === item.id);
              return (
                <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-3.5 items-center">
                  <img 
                    src={item.imageUrl ? (item.imageUrl.startsWith('/') ? `https://localhost:7248${item.imageUrl}` : item.imageUrl) : 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&q=80&w=300'} 
                    alt={item.name} 
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm leading-snug truncate">{item.name}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.description}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-extrabold text-sm text-[#1B4D3E]">{item.price.toLocaleString('vi-VN')}đ</span>
                      
                      <button 
                        onClick={() => addToCart(item)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          cartItem ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#1B4D3E] text-white hover:bg-[#153d31] shadow-sm'
                        }`}
                        title="Thêm vào giỏ hàng"
                      >
                        {cartItem ? <span className="font-extrabold text-xs">x{cartItem.quantity}</span> : <Plus size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: DRINKS (2-Column Grid view as Figma) */}
      {(activeCategory === 'All' || activeCategory === 'Drink') && drinkItems.length > 0 && (
        <div className="space-y-3 mt-2">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
            <Wine size={18} className="text-rose-600" />
            Đồ uống
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {drinkItems.map(item => {
              const cartItem = cart.find(c => c.menuItemId === item.id);
              return (
                <div key={item.id} className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div>
                    <img 
                      src={item.imageUrl ? (item.imageUrl.startsWith('/') ? `https://localhost:7248${item.imageUrl}` : item.imageUrl) : 'https://images.unsplash.com/photo-1601550978931-7e3f84f04c62?auto=format&fit=crop&q=80&w=300'} 
                      alt={item.name} 
                      className="w-full h-24 rounded-xl object-cover mb-2"
                    />
                    <h4 className="font-bold text-slate-800 text-xs truncate">{item.name}</h4>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-extrabold text-xs text-[#1B4D3E]">{item.price.toLocaleString('vi-VN')}đ</span>
                    <button 
                      onClick={() => addToCart(item)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        cartItem ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#1B4D3E] text-white hover:bg-[#153d31] shadow-sm'
                      }`}
                      title="Thêm vào giỏ hàng"
                    >
                      {cartItem ? <span className="font-extrabold text-[11px]">x{cartItem.quantity}</span> : <Plus size={16} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: CAMPING SERVICES & ACTIVITIES */}
      {(activeCategory === 'All' || activeCategory === 'Service') && serviceItems.length > 0 && (
        <div className="space-y-3 mt-2">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
            <Sparkles size={18} className="text-amber-500" />
            Dịch vụ & Vui chơi Camping
          </h3>

          <div className="space-y-3">
            {serviceItems.map(item => {
              const cartItem = cart.find(c => c.menuItemId === item.id);
              return (
                <div key={item.id} className="bg-[#FAF7F2] p-3 rounded-2xl shadow-sm border border-amber-100 flex gap-3.5 items-center">
                  <img 
                    src={item.imageUrl ? (item.imageUrl.startsWith('/') ? `https://localhost:7248${item.imageUrl}` : item.imageUrl) : 'https://images.unsplash.com/photo-1522204523234-8729aa6e3d5f?auto=format&fit=crop&q=80&w=300'} 
                    alt={item.name} 
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full">Dịch vụ</span>
                      <h4 className="font-bold text-slate-800 text-sm leading-snug truncate">{item.name}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">{item.description}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-extrabold text-sm text-[#7C5A38]">{item.price.toLocaleString('vi-VN')}đ</span>
                      <button 
                        onClick={() => addToCart(item)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          cartItem ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#1B4D3E] text-white hover:bg-[#153d31] shadow-sm'
                        }`}
                        title="Thêm vào giỏ hàng"
                      >
                        {cartItem ? <span className="font-extrabold text-xs">x{cartItem.quantity}</span> : <Plus size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Cart Button - Figma Style */}
      {totalItems > 0 && (
        <button 
          onClick={() => setShowCartModal(true)}
          className="fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-[#A3432B] text-white flex items-center justify-center shadow-xl shadow-[#A3432B]/40 active:scale-95 transition-all"
        >
          <ShoppingCart size={24} />
          <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white">
            {totalItems}
          </span>
        </button>
      )}

      {/* Cart Modal Sheet */}
      {showCartModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl p-6 max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-10 duration-300">
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800">Giỏ hàng của bạn ({totalItems})</h3>
              <button onClick={() => setShowCartModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {orderSuccess ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <CheckCircle2 size={56} className="text-emerald-500 mb-3 animate-bounce" />
                <h4 className="text-xl font-bold text-slate-800">Đặt món thành công!</h4>
                <p className="text-xs text-slate-500 mt-1">Đồ ăn sẽ được chuẩn bị và chuyển đến lều ngay.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {cart.map(item => (
                    <div key={item.menuItemId} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex-1 pr-2">
                        <p className="font-bold text-sm text-slate-800">{item.itemData.name}</p>
                        <p className="text-xs text-[#1B4D3E] font-extrabold">{item.itemData.price.toLocaleString('vi-VN')}đ</p>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 border border-slate-200">
                        <button onClick={() => updateQuantity(item.menuItemId, -1)} className="text-slate-400 hover:text-rose-500">
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-xs text-slate-800 w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menuItemId, 1)} className="text-emerald-600">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-500">Tổng cộng</span>
                    <span className="text-xl font-black text-[#1B4D3E]">{totalPrice.toLocaleString('vi-VN')}đ</span>
                  </div>

                  <button 
                    onClick={handleCheckout}
                    disabled={submitting}
                    className="w-full py-3.5 bg-[#1B4D3E] hover:bg-[#153d31] text-white font-bold rounded-xl shadow-lg shadow-[#1B4D3E]/30 active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    {submitting ? 'Đang gửi đơn...' : 'XÁC NHẬN ĐẶT MÓN'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
