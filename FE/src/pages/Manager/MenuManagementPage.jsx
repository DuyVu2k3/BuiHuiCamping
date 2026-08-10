import React, { useState, useEffect } from "react";
import axios from "axios";
import { getApiUrl, getImageUrl } from "../../apiConfig";
import { Plus, Edit, Trash2, Image as ImageIcon } from "lucide-react";
import toast from 'react-hot-toast';

export default function MenuManagementPage() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    category: "Food",
    imageUrl: "",
    isAvailable: true,
  });

  const fetchMenu = () => {
    setLoading(true);
    axios
      .get("https://localhost:7248/api/Menu")
      .then((res) => setMenu(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", newItem.name);
    formData.append("description", newItem.description);
    formData.append("price", parseFloat(newItem.price) || 0);
    formData.append("category", newItem.category);
    formData.append("isAvailable", newItem.isAvailable);

    if (imageFile) {
      formData.append("imageFile", imageFile);
    } else if (newItem.imageUrl) {
      formData.append("imageUrl", newItem.imageUrl);
    }

    axios
      .post("https://localhost:7248/api/Menu", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(() => {
        toast.success("Thêm món thành công!");
        setShowModal(false);
        setNewItem({
          name: "",
          description: "",
          price: "",
          category: "Food",
          imageUrl: "",
          isAvailable: true,
        });
        setImageFile(null);
        fetchMenu();
      })
      .catch((err) => toast.error("Có lỗi xảy ra khi thêm món."));
  };

  const categories = [
    { id: "All", label: "Tất cả" },
    { id: "Food", label: "Đồ ăn" },
    { id: "Drink", label: "Đồ uống" },
    { id: "Service", label: "Dịch vụ & Vui chơi" },
  ];

  const filteredMenu =
    activeCategory === "All"
      ? menu
      : menu.filter((item) => item.category === activeCategory);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Quản lý Menu & Dịch vụ
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Thêm, sửa, xóa các đồ ăn, thức uống và dịch vụ camping
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus size={20} />
          Thêm Món / Dịch vụ
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${
              activeCategory === cat.id
                ? "bg-emerald-100 text-emerald-700"
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Data Table / Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 font-medium animate-pulse">
          Đang nạp dữ liệu...
        </div>
      ) : filteredMenu.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
          <ImageIcon size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">
            Chưa có dữ liệu nào trong mục này.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {(activeCategory === "All"
            ? categories.filter((c) => c.id !== "All")
            : [categories.find((c) => c.id === activeCategory)]
          ).map((cat) => {
            const items = menu.filter((m) => m.category === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-4">
                {activeCategory === "All" && (
                  <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                    {cat.label}
                    <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {items.length} mục
                    </span>
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-3xl p-4 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 flex gap-4 hover:border-emerald-200 transition-colors group"
                    >
                      <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 relative">
                        {item.imageUrl ? (
                          <img
                            src={getImageUrl(item.imageUrl)}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-slate-800 line-clamp-1">
                              {item.name}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
                              {cat.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-extrabold text-emerald-600">
                            {item.price.toLocaleString("vi-VN")} đ
                          </span>
                          <div className="flex gap-2">
                            <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors">
                              <Edit size={14} />
                            </button>
                            <button className="w-8 h-8 rounded-full bg-rose-50 text-rose-400 hover:text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          ></div>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-800">
                Thêm Mới
              </h2>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Tên món / dịch vụ
                </label>
                <input
                  required
                  type="text"
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
                  placeholder="Nhập thông tin..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Giá (VNĐ)
                  </label>
                  <input
                    required
                    type="number"
                    value={newItem.price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, price: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
                    placeholder="Nhập giá..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
                  >
                    <option value="Food">Đồ ăn</option>
                    <option value="Drink">Đồ uống</option>
                    <option value="Service">Dịch vụ & Vui chơi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Hình ảnh (Tải lên từ máy)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  rows="3"
                  value={newItem.description}
                  onChange={(e) =>
                    setNewItem({ ...newItem, description: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all resize-none"
                  placeholder="Mô tả chi tiết..."
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
