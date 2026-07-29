import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { History, Check, ArrowRight } from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import toast from 'react-hot-toast';

export default function CustomerHistoryPage() {
  const { tentName } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`https://localhost:7248/api/Orders/history?tentName=${encodeURIComponent(tentName)}`);
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [tentName]);

  // Fix GMT+7 Timezone by parsing ISO string correctly
  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const now = new Date();
    const diffMins = Math.max(0, Math.floor((now - date) / (1000 * 60)));
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const hours = Math.floor(diffMins / 60);
    return `${hours} giờ trước`;
  };

  // Flatten all details from all orders and group by status
  const preparingItems = [];
  const completedItems = [];
  let grandTotal = 0;

  orders.forEach(order => {
    order.orderDetails?.forEach(detail => {
      const subtotal = detail.unitPrice * detail.quantity;
      grandTotal += subtotal;

      const itemInfo = {
        id: detail.id,
        name: detail.menuItem?.name || 'Món ăn',
        quantity: detail.quantity,
        price: detail.unitPrice,
        subtotal: subtotal,
        imageUrl: detail.menuItem?.imageUrl,
        createdAt: detail.createdAt || order.createdAt,
        status: detail.status || order.status
      };

      const isCompleted = detail.status === 'Delivered' || detail.status === 'Completed' || order.status === 'Paid';

      if (isCompleted) {
        completedItems.push(itemInfo);
      } else {
        preparingItems.push(itemInfo);
      }
    });
  });

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-24 bg-slate-200/60 rounded-3xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-5 pt-3 pb-32 flex flex-col gap-6 relative text-slate-800">
      
      {/* Header - Figma style */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-[#1B4D3E] tracking-tight">Đã gọi</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Chi tiết các món tại bàn</p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-extrabold text-slate-400">Mã đơn:</span>
          <p className="text-xs font-black text-slate-700">#BH-{tentName}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 opacity-40">
          <History size={48} className="text-slate-400 mb-3" />
          <p className="text-sm font-bold text-slate-600">Chưa gọi món nào</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* SECTION 1: ĐANG CHUẨN BỊ (Pending / Preparing) */}
          {preparingItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black tracking-wider text-amber-800 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                ĐANG CHUẨN BỊ
              </h3>

              <div className="space-y-2.5">
                {preparingItems.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <img 
                      src={item.imageUrl ? (item.imageUrl.startsWith('/') ? `https://localhost:7248${item.imageUrl}` : item.imageUrl) : 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&q=80&w=200'} 
                      alt={item.name} 
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">⏱ {getTimeAgo(item.createdAt)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-amber-700 text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                      x{item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: ĐÃ PHỤC VỤ (Ready / Completed) */}
          {completedItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black tracking-wider text-emerald-800 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                ĐÃ PHỤC VỤ
              </h3>

              <div className="space-y-2.5">
                {completedItems.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <img 
                      src={item.imageUrl ? (item.imageUrl.startsWith('/') ? `https://localhost:7248${item.imageUrl}` : item.imageUrl) : 'https://images.unsplash.com/photo-1601550978931-7e3f84f04c62?auto=format&fit=crop&q=80&w=200'} 
                      alt={item.name} 
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                      <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                        <Check size={12} strokeWidth={3} /> Đã giao
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                      x{item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Floating Bottom Bar: Total Price & Request Checkout (Figma Style) */}
      {orders.length > 0 && (
        <div className="fixed bottom-20 left-6 right-6 z-40 max-w-md mx-auto">
          <div className="bg-[#232B28] text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-white/10">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tổng tạm tính</p>
              <p className="text-lg font-black tracking-tight">{grandTotal.toLocaleString('vi-VN')}đ</p>
            </div>
            
            <button 
              onClick={async () => {
                try {
                  const hubConnection = new signalR.HubConnectionBuilder()
                    .withUrl("https://localhost:7248/orderHub")
                    .withAutomaticReconnect()
                    .build();
                  await hubConnection.start();
                  await hubConnection.invoke("RequestCheckout", tentName);
                  await hubConnection.stop();
                  toast.success("Đã gửi yêu cầu thanh toán tới Lễ Tân!");
                } catch (err) {
                  console.error("SignalR checkout error:", err);
                  toast.error("Không thể gửi thông báo, vui lòng gọi nhân viên!");
                }
              }}
              className="bg-[#1B4D3E] hover:bg-[#153d31] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <span>Thanh toán</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
