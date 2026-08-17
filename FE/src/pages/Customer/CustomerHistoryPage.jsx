import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { History, Check, ArrowRight, Clock, ChefHat, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalrService';

export default function CustomerHistoryPage() {
  const { tentName, tentId } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(getApiUrl(`/api/Orders/history?tentName=${encodeURIComponent(tentName)}`));
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    signalRService.startConnection();

    const handleRefresh = () => {
      fetchHistory();
    };

    signalRService.on("OrderUpdated", handleRefresh);
    signalRService.on("NewFoodOrder", handleRefresh);

    return () => {
      signalRService.off("OrderUpdated", handleRefresh);
      signalRService.off("NewFoodOrder", handleRefresh);
    };
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

  // Flatten all details from all orders and group into 3 categories:
  // 1. Pending (Đã đặt / Chờ xử lý)
  // 2. Preparing / Ready (Đang chuẩn bị / Bếp đang làm)
  // 3. Delivered / Completed (Đã phục vụ / Đã mang ra bàn)
  const pendingItems = [];
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

      const st = (detail.status || '').toLowerCase();
      if (st === 'delivered' || st === 'completed' || order.status === 'Paid') {
        completedItems.push(itemInfo);
      } else if (st === 'preparing' || st === 'ready' || st === 'processing') {
        preparingItems.push(itemInfo);
      } else {
        pendingItems.push(itemInfo);
      }
    });
  });

  const handleCancelPendingOrder = async (detailId) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy món này không?")) return;

    try {
      const res = await axios.put(getApiUrl(`/api/Orders/${detailId}/cancel-by-customer`));
      toast.success(res.data.message || "Đã hủy đợt gọi món thành công!");
      fetchHistory();
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Không thể hủy đơn. Có thể Bếp đã tiếp nhận chế biến món này!";
      toast.error(errorMsg);
      fetchHistory();
    }
  };

  const getImageUrl = (url) => {
    if (!url) return 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&q=80&w=200';
    if (url.includes('/uploads/')) return getApiUrl(url.substring(url.indexOf('/uploads/')));
    if (url.startsWith('http') && !url.includes('localhost')) return url;
    return getApiUrl(url);
  };

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
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-[#1B4D3E] tracking-tight">Đã Gọi Món</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Lịch sử & trạng thái các món tại {tentName}</p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-extrabold text-slate-400">Mã Lều:</span>
          <p className="text-xs font-black text-slate-700">#LỀU-{tentName}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 opacity-40">
          <History size={48} className="text-slate-400 mb-3" />
          <p className="text-sm font-bold text-slate-600">Chưa có món nào được gọi</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: ĐÃ ĐẶT - CHỜ XỬ LÝ (Pending - Có Thể Hủy) */}
          {pendingItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black tracking-wider text-amber-800 uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                  <Clock size={14} className="text-amber-600" />
                  1. ĐÃ ĐẶT (CHỜ BẾP XÁC NHẬN)
                </h3>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Có thể hủy khi Bếp chưa làm
                </span>
              </div>

              <div className="space-y-2.5">
                {pendingItems.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-2xl shadow-xs border border-amber-200/80 flex items-center gap-3">
                    <img 
                      src={getImageUrl(item.imageUrl)} 
                      alt={item.name} 
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                      <p className="text-[11px] text-amber-700 font-bold flex items-center gap-1 mt-0.5">
                        🕒 Chờ Bếp nhận ({getTimeAgo(item.createdAt)})
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                        x{item.quantity}
                      </div>
                      <button
                        onClick={() => handleCancelPendingOrder(item.id)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black rounded-lg transition-all active:scale-95"
                      >
                        🔴 Hủy Đơn
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ĐANG CHUẨN BỊ (Preparing / Ready - Khóa Hủy) */}
          {preparingItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black tracking-wider text-blue-800 uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <ChefHat size={14} className="text-blue-600" />
                  2. BẾP ĐANG LÀM MÓN
                </h3>
                <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  🔒 Khóa hủy đơn
                </span>
              </div>

              <div className="space-y-2.5">
                {preparingItems.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-2xl shadow-xs border border-blue-200/80 flex items-center gap-3">
                    <img 
                      src={getImageUrl(item.imageUrl)} 
                      alt={item.name} 
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                      <p className="text-[11px] text-blue-700 font-bold flex items-center gap-1 mt-0.5">
                        🍳 Bếp đang làm món ({getTimeAgo(item.createdAt)})
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                      x{item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ĐÃ PHỤC VỤ (Delivered / Completed) */}
          {completedItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black tracking-wider text-emerald-800 uppercase flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                3. ĐÃ PHỤC VỤ (ĐÃ GIAO RA BÀN)
              </h3>

              <div className="space-y-2.5">
                {completedItems.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-2xl shadow-xs border border-emerald-100 flex items-center gap-3">
                    <img 
                      src={getImageUrl(item.imageUrl)} 
                      alt={item.name} 
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                      <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                        <Check size={12} strokeWidth={3} /> Đã giao tới lều
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                      x{item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Floating Bottom Bar: Total Price & Request Checkout */}
      {orders.length > 0 && (
        <div className="fixed bottom-20 left-6 right-6 z-40 max-w-md mx-auto">
          <div className="bg-[#232B28] text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-white/10">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tổng tiền các món</p>
              <p className="text-lg font-black tracking-tight">{grandTotal.toLocaleString('vi-VN')}đ</p>
            </div>
            
            <button 
              onClick={async () => {
                try {
                  const activeTentId = tentId || parseInt(sessionStorage.getItem('customerTentId'));
                  await axios.post(getApiUrl('/api/Bookings/request-checkout'), {
                    tentId: activeTentId ? activeTentId : undefined,
                    tentName: tentName
                  });
                  try {
                    await signalRService.send("RequestCheckout", tentName);
                  } catch (sErr) {}
                  toast.success("Đã gửi yêu cầu thanh toán tới Lễ Tân!");
                } catch (err) {
                  console.error("Checkout request error:", err);
                  toast.error("Không thể gửi yêu cầu thanh toán. Vui lòng thử lại!");
                }
              }}
              className="bg-[#1B4D3E] hover:bg-[#153d31] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <span>Yêu cầu thanh toán</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
