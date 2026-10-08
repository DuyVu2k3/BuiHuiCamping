import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  QrCode, Plus, RefreshCw, Printer, AlertTriangle, 
  CheckCircle2, Trash2, Search, Filter, Tent, User, 
  Calendar, Phone, ExternalLink, X, ShieldAlert, 
  Layers, Copy, Check, FileDown, Eye
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { getApiUrl } from '../../apiConfig';
import signalRService from '../../services/signalRService';

export default function QrCardInventoryPage() {
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState({ total: 0, available: 0, assigned: 0, damaged: 0, lost: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCardForm, setNewCardForm] = useState({ cardCode: '', note: '' });

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ prefix: 'QR-', fromNumber: 1, toNumber: 30, digits: 2, note: '' });

  const [statusModalCard, setStatusModalCard] = useState(null);
  const [newStatus, setNewStatus] = useState('Available');
  const [statusNote, setStatusNote] = useState('');

  // Print Studio Modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState([]);
  const [printFilter, setPrintFilter] = useState('available'); // 'all', 'available', 'selected'
  const printContainerRef = useRef(null);

  // Fetch cards
  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await axios.get(getApiUrl(`/api/QrCards?status=${filterStatus}&search=${encodeURIComponent(searchQuery)}`));
      if (res.data) {
        setCards(res.data.items || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error('Lỗi tải kho thẻ QR:', err);
      toast.error('Không thể tải dữ liệu kho thẻ QR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [filterStatus, searchQuery]);

  // SignalR real-time listener
  useEffect(() => {
    const handleQrUpdate = () => {
      console.log('⚡ SignalR: QrCardsUpdated received -> Refreshing inventory');
      fetchCards();
    };

    signalRService.on('QrCardsUpdated', handleQrUpdate);
    signalRService.on('TentStatusChanged', handleQrUpdate);

    return () => {
      signalRService.off('QrCardsUpdated', handleQrUpdate);
      signalRService.off('TentStatusChanged', handleQrUpdate);
    };
  }, []);

  // Sync inventory with active bookings
  const handleSyncWithBookings = async () => {
    try {
      const res = await axios.post(getApiUrl('/api/QrCards/sync'));
      toast.success(res.data?.message || 'Đã đồng bộ kho thẻ thành công!');
      fetchCards();
    } catch (err) {
      toast.error('Lỗi khi đồng bộ kho thẻ');
    }
  };

  // Add single card
  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardForm.cardCode.trim()) {
      toast.error('Vui lòng nhập mã thẻ');
      return;
    }
    try {
      await axios.post(getApiUrl('/api/QrCards'), {
        cardCode: newCardForm.cardCode.trim().toUpperCase(),
        note: newCardForm.note.trim()
      });
      toast.success(`Đã thêm thẻ ${newCardForm.cardCode.toUpperCase()} vào kho!`);
      setShowAddModal(false);
      setNewCardForm({ cardCode: '', note: '' });
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data || 'Không thể tạo thẻ');
    }
  };

  // Batch generate cards
  const handleBatchGenerate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(getApiUrl('/api/QrCards/batch-generate'), batchForm);
      toast.success(res.data?.message || 'Sinh dải thẻ thành công!');
      setShowBatchModal(false);
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data || 'Lỗi khi sinh dải thẻ');
    }
  };

  // Update card status
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!statusModalCard) return;
    try {
      await axios.put(getApiUrl(`/api/QrCards/${statusModalCard.id}/status`), {
        status: newStatus,
        note: statusNote
      });
      toast.success(`Đã cập nhật trạng thái thẻ ${statusModalCard.cardCode}`);
      setStatusModalCard(null);
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data || 'Không thể cập nhật trạng thái thẻ');
    }
  };

  // Delete card
  const handleDeleteCard = async (card) => {
    if (card.status === 'Assigned') {
      toast.error('Không thể xóa thẻ đang phục vụ khách!');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thẻ ${card.cardCode} khỏi kho không?`)) return;
    try {
      await axios.delete(getApiUrl(`/api/QrCards/${card.id}`));
      toast.success(`Đã xóa thẻ ${card.cardCode}`);
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data || 'Không thể xóa thẻ');
    }
  };

  // Clear all cards from inventory
  const handleClearAll = async () => {
    if (!window.confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ KHO THẺ QR KHÔNG?\nThao tác này sẽ xóa sạch tất cả thẻ trong kho để tạo lại từ đầu.')) return;
    try {
      const res = await axios.post(getApiUrl('/api/QrCards/clear-all?includeAssigned=true'));
      toast.success(res.data?.message || 'Đã xóa toàn bộ kho thẻ!');
      fetchCards();
    } catch (err) {
      toast.error('Lỗi khi xóa kho thẻ');
    }
  };

  // Print cards trigger
  const handlePrint = () => {
    window.print();
  };

  // Toggle select card for printing
  const toggleSelectCard = (code) => {
    setSelectedForPrint(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Select all visible cards for print
  const toggleSelectAllVisible = () => {
    const visibleCodes = cards.map(c => c.cardCode);
    if (selectedForPrint.length === visibleCodes.length) {
      setSelectedForPrint([]);
    } else {
      setSelectedForPrint(visibleCodes);
    }
  };

  // Cards to be printed in modal
  const cardsToPrint = useMemo(() => {
    if (printFilter === 'selected') {
      return cards.filter(c => selectedForPrint.includes(c.cardCode));
    }
    if (printFilter === 'available') {
      return cards.filter(c => c.status === 'Available');
    }
    return cards;
  }, [cards, printFilter, selectedForPrint]);

  // Card status badge styling
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Sẵn sàng
          </span>
        );
      case 'Assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            Đang cắm tại lều
          </span>
        );
      case 'Damaged':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle size={12} className="text-amber-600" />
            Hỏng / Rách
          </span>
        );
      case 'Lost':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <ShieldAlert size={12} className="text-rose-600" />
            Mất / Thất lạc
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E6E2D8] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-[#1B4D3E] font-black text-xs uppercase tracking-wider">
              Vật Tư & Thiết Bị
            </span>
            <span className="text-xs text-slate-400 font-bold">• Ép Plastic / Laminated</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
            <QrCode className="text-[#1B4D3E]" size={28} />
            Kho Thẻ QR Danh Thiếp Cắm Lều
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý tập trung toàn bộ dải thẻ QR danh thiếp vật lý để lễ tân linh hoạt cấp phát cho các ô đất và lều trại.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncWithBookings}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Đồng bộ thẻ đang dùng theo đơn thực tế"
          >
            <RefreshCw size={15} />
            Đồng bộ
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Xóa toàn bộ kho thẻ để tạo lại từ đầu"
          >
            <Trash2 size={15} />
            Xóa Kho Thẻ
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-black shadow-xs transition-colors cursor-pointer"
          >
            <Layers size={15} />
            Sinh Dải Thẻ
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            Thêm Thẻ Lẻ
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-xs font-black shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Printer size={16} />
            In Thẻ Danh Thiếp
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div 
          onClick={() => setFilterStatus('All')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === 'All' ? 'bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-md' : 'bg-white border-[#E6E2D8] hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Tổng Thẻ Trong Kho</div>
          <div className="text-2xl font-black mt-1">{stats.total}</div>
          <div className="text-[10px] mt-1 opacity-70">Toàn bộ dải thẻ đã tạo</div>
        </div>

        <div 
          onClick={() => setFilterStatus('Available')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === 'Available' ? 'bg-emerald-700 text-white border-emerald-700 shadow-md' : 'bg-white border-[#E6E2D8] hover:border-emerald-300'}`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Sẵn Sàng Cấp
          </div>
          <div className={`text-2xl font-black mt-1 ${filterStatus === 'Available' ? 'text-white' : 'text-emerald-700'}`}>{stats.available}</div>
          <div className="text-[10px] mt-1 text-slate-400">Rảnh rỗi trong hộp thẻ quầy</div>
        </div>

        <div 
          onClick={() => setFilterStatus('Assigned')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === 'Assigned' ? 'bg-blue-700 text-white border-blue-700 shadow-md' : 'bg-white border-[#E6E2D8] hover:border-blue-300'}`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Đang Phục Vụ
          </div>
          <div className={`text-2xl font-black mt-1 ${filterStatus === 'Assigned' ? 'text-white' : 'text-blue-700'}`}>{stats.assigned}</div>
          <div className="text-[10px] mt-1 text-slate-400">Đang cắm tại lều cho khách</div>
        </div>

        <div 
          onClick={() => setFilterStatus('Damaged')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === 'Damaged' ? 'bg-amber-700 text-white border-amber-700 shadow-md' : 'bg-white border-[#E6E2D8] hover:border-amber-300'}`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <AlertTriangle size={12} />
            Hỏng / Rách
          </div>
          <div className={`text-2xl font-black mt-1 ${filterStatus === 'Damaged' ? 'text-white' : 'text-amber-700'}`}>{stats.damaged}</div>
          <div className="text-[10px] mt-1 text-slate-400">Cần in mới thay thế</div>
        </div>

        <div 
          onClick={() => setFilterStatus('Lost')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === 'Lost' ? 'bg-rose-700 text-white border-rose-700 shadow-md' : 'bg-white border-[#E6E2D8] hover:border-rose-300'}`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
            <ShieldAlert size={12} />
            Mất / Thất Lạc
          </div>
          <div className={`text-2xl font-black mt-1 ${filterStatus === 'Lost' ? 'text-white' : 'text-rose-700'}`}>{stats.lost}</div>
          <div className="text-[10px] mt-1 text-slate-400">Khách mang về hoặc thất lạc</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E6E2D8] flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã thẻ (QR-01), tên khách, lều..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter size={13} />
            Lọc:
          </span>
          {[
            { id: 'All', label: 'Tất cả' },
            { id: 'Available', label: 'Sẵn sàng' },
            { id: 'Assigned', label: 'Đang dùng' },
            { id: 'Damaged', label: 'Hỏng' },
            { id: 'Lost', label: 'Mất' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {cards.length > 0 && (
            <button
              onClick={toggleSelectAllVisible}
              className="ml-auto md:ml-3 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              {selectedForPrint.length === cards.length ? 'Bỏ chọn tất cả' : `Chọn in (${selectedForPrint.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-[#E6E2D8]">
          <RefreshCw className="animate-spin mx-auto text-emerald-600 mb-2" size={28} />
          <p className="text-sm font-bold text-slate-500">Đang tải danh sách thẻ QR...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-[#E6E2D8]">
          <QrCode className="mx-auto text-slate-300 mb-3" size={48} />
          <h3 className="text-base font-black text-slate-700">Chưa có thẻ nào phù hợp</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Không tìm thấy thẻ với bộ lọc hiện tại. Bạn có thể bấm "Sinh Dải Thẻ" để tạo hàng loạt mã QR mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map(card => {
            const isSelected = selectedForPrint.includes(card.cardCode);
            const qrUrl = `${window.location.origin}/customer/menu?card=${card.cardCode}`;

            return (
              <div
                key={card.id}
                className={`relative bg-white rounded-2xl border p-4 transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                  isSelected ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-[#E6E2D8]'
                }`}
              >
                {/* Card Top: Checkbox, Code, Status */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectCard(card.cardCode)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title="Chọn thẻ này để in"
                      />
                      <span className="text-lg font-black text-slate-900 tracking-tight">
                        {card.cardCode}
                      </span>
                    </div>
                    {renderStatusBadge(card.status)}
                  </div>

                  {/* QR Preview & Info */}
                  <div className="flex items-center gap-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
                    <div className="bg-white p-1.5 rounded-lg border border-slate-200 shrink-0 shadow-2xs">
                      <QRCodeSVG
                        value={qrUrl}
                        size={64}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div className="text-xs space-y-1 min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Đường dẫn khách quét:
                      </div>
                      <div className="font-mono text-[11px] text-slate-700 truncate" title={qrUrl}>
                        .../menu?card={card.cardCode}
                      </div>
                      <a
                        href={qrUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        <Eye size={12} />
                        Mở thử thực đơn
                      </a>
                    </div>
                  </div>

                  {/* Assignment details (if assigned) */}
                  {card.status === 'Assigned' && card.booking ? (
                    <div className="bg-blue-50/70 border border-blue-200/80 p-3 rounded-xl text-xs space-y-1.5 mb-3">
                      <div className="font-black text-blue-900 flex items-center gap-1.5">
                        <User size={13} />
                        <span>{card.booking.customerName}</span>
                        {card.booking.phoneNumber && (
                          <span className="text-[11px] font-medium text-blue-700">({card.booking.phoneNumber})</span>
                        )}
                      </div>
                      <div className="text-blue-800 font-semibold flex items-center gap-1.5 text-[11px]">
                        <Tent size={12} />
                        <span>Vị trí: {card.assignedPlacement || 'Khu cắm trại'}</span>
                      </div>
                      {card.booking.tentSetupSummary && (
                        <div className="text-[10px] text-blue-700">
                          Quy cách: {card.booking.tentSetupSummary}
                        </div>
                      )}
                    </div>
                  ) : card.note ? (
                    <div className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg mb-3">
                      Ghi chú: {card.note}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 mb-3 italic">
                      Thẻ đang sẵn sàng trong hộp, chưa gán cho khách nào.
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => {
                      setStatusModalCard(card);
                      setNewStatus(card.status);
                      setStatusNote(card.note || '');
                    }}
                    className="font-bold text-slate-600 hover:text-emerald-700 cursor-pointer flex items-center gap-1"
                  >
                    Đổi trạng thái
                  </button>

                  <div className="flex items-center gap-1">
                    {card.status !== 'Assigned' && (
                      <button
                        onClick={() => handleDeleteCard(card)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa thẻ khỏi kho"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: THÊM 1 THẺ MỚI */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Plus size={20} className="text-[#1B4D3E]" />
                Thêm Thẻ QR Mới Vào Kho
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Mã thẻ danh thiếp: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: QR-31, VIP-01, GLAMP-02..."
                  value={newCardForm.cardCode}
                  onChange={(e) => setNewCardForm({ ...newCardForm, cardCode: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Ghi chú (Tùy chọn):
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú về đợt in hoặc vị trí sử dụng..."
                  value={newCardForm.note}
                  onChange={(e) => setNewCardForm({ ...newCardForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Tạo Thẻ Vào Kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SINH THẺ HÀNG LOẠT (BATCH GENERATE) */}
      {/* ========================================================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Layers size={20} className="text-[#1B4D3E]" />
                  Sinh Dải Thẻ Tự Động
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Tự động sinh dải mã số liên tiếp (bỏ qua mã đã tồn tại)</p>
              </div>
              <button 
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBatchGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Tiền tố mã thẻ:
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.prefix}
                  onChange={(e) => setBatchForm({ ...batchForm, prefix: e.target.value.toUpperCase() })}
                  placeholder="QR-, VIP-, LEO-..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Từ số:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    required
                    value={batchForm.fromNumber}
                    onChange={(e) => setBatchForm({ ...batchForm, fromNumber: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Đến số:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    required
                    value={batchForm.toNumber}
                    onChange={(e) => setBatchForm({ ...batchForm, toNumber: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 font-medium">
                💡 Ví dụ: Tiền tố <span className="font-bold">{batchForm.prefix}</span>, từ <span className="font-bold">{batchForm.fromNumber}</span> đến <span className="font-bold">{batchForm.toNumber}</span> sẽ sinh ra: 
                <span className="font-mono font-bold block mt-1 text-emerald-800">
                  {batchForm.prefix}{String(batchForm.fromNumber).padStart(2, '0')}, {batchForm.prefix}{String(batchForm.fromNumber + 1).padStart(2, '0')}, ... {batchForm.prefix}{String(batchForm.toNumber).padStart(2, '0')}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Sinh Dải Thẻ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ĐỔI TRẠNG THÁI THẺ */}
      {/* ========================================================= */}
      {statusModalCard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Cập Nhật Trạng Thái Thẻ {statusModalCard.cardCode}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Quản lý vòng đời thẻ vật lý</p>
              </div>
              <button 
                onClick={() => setStatusModalCard(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Trạng thái mới:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Available', label: '🟢 Sẵn Sàng (Thu hồi)', desc: 'Trả thẻ về hộp quầy' },
                    { id: 'Damaged', label: '⚠️ Hỏng / Rách', desc: 'Thẻ mờ, rách nát' },
                    { id: 'Lost', label: '❌ Mất / Thất Lạc', desc: 'Không tìm thấy thẻ' },
                    { id: 'Assigned', label: '⛺ Đang Cắm Lều', desc: 'Đang phục vụ khách' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewStatus(opt.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newStatus === opt.id
                          ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-800">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Lý do / Ghi chú:
                </label>
                <input
                  type="text"
                  placeholder="VD: Rách khi giặt, khách làm rơi suối, in mới..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalCard(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Lưu Trạng Thái
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PRINT STUDIO - XUẤT / IN THẺ DANH THIẾP */}
      {/* ========================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-[#1B4D3E] font-black text-xs uppercase tracking-wider">
                    Print Studio
                  </span>
                  <span className="text-xs text-slate-400 font-bold">• Chuẩn Thẻ Danh Thiếp Ép Nhựa</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
                  <Printer size={22} className="text-[#1B4D3E]" />
                  Xem Trước & In Thẻ Danh Thiếp ({cardsToPrint.length} Thẻ)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Print Filter Selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setPrintFilter('available')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      printFilter === 'available' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Thẻ Rảnh ({stats.available})
                  </button>
                  <button
                    onClick={() => setPrintFilter('selected')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      printFilter === 'selected' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Đã Chọn ({selectedForPrint.length})
                  </button>
                  <button
                    onClick={() => setPrintFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      printFilter === 'all' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất Cả Kho ({stats.total})
                  </button>
                </div>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  <Printer size={16} />
                  Bắt Đầu In (Print)
                </button>

                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body / Printable Sheet Preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/80 custom-scrollbar">
              <div className="max-w-[210mm] mx-auto bg-white p-8 rounded-2xl shadow-md border border-slate-300 print:p-0 print:border-none print:shadow-none">
                <div className="text-center pb-4 mb-6 border-b border-dashed border-slate-300 print:hidden">
                  <h4 className="font-extrabold text-sm text-slate-700">Khổ In A4 Chuẩn Danh Thiếp Dã Ngoại</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mỗi trang in gồm các thẻ kích thước tiêu chuẩn, có viền nét đứt mờ để cắt và ép plastic.
                  </p>
                </div>

                {/* Printable Grid of Cards */}
                <div 
                  ref={printContainerRef}
                  className="grid grid-cols-2 gap-4 print:grid-cols-2 print:gap-3"
                >
                  {cardsToPrint.map(card => {
                    const cardQrUrl = `${window.location.origin}/customer/menu?card=${card.cardCode}`;
                    return (
                      <div
                        key={card.id}
                        className="relative border-2 border-dashed border-slate-300 bg-linear-to-b from-[#FAF8F5] to-white p-4 rounded-2xl flex flex-col justify-between items-center text-center shadow-xs page-break-inside-avoid print:border-slate-400 print:shadow-none"
                        style={{ minHeight: '62mm', width: '100%' }}
                      >
                        {/* Cut guide corners */}
                        <div className="absolute top-1 left-1 text-[8px] text-slate-300 font-mono">✂</div>
                        <div className="absolute bottom-1 right-1 text-[8px] text-slate-300 font-mono">✂</div>

                        {/* Top Branding */}
                        <div className="w-full pb-1.5 border-b border-emerald-900/10 mb-2">
                          <div className="flex items-center justify-center gap-1.5 text-[#1B4D3E]">
                            <Tent size={16} strokeWidth={2.5} />
                            <span 
                              className="text-lg font-black tracking-wide"
                              style={{ fontFamily: "'Dancing Script', cursive" }}
                            >
                              Bùi Hui Camping
                            </span>
                          </div>
                          <div className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-800">
                            Thảo Nguyên Ba Tơ • Quảng Ngãi
                          </div>
                        </div>

                        {/* Center: QR Code with high sharpness */}
                        <div className="p-2 bg-white rounded-xl border border-emerald-950/20 shadow-xs mb-2">
                          <QRCodeSVG
                            value={cardQrUrl}
                            size={105}
                            level="H"
                            includeMargin={false}
                            fgColor="#0F2D24"
                          />
                        </div>

                        {/* Card Identifier - Bold and Prominent */}
                        <div className="bg-[#1B4D3E] text-white px-4 py-1 rounded-lg font-black text-sm tracking-wider uppercase mb-1 shadow-xs">
                          {card.cardCode}
                        </div>

                        {/* Instructions */}
                        <div className="text-[10px] font-bold text-slate-700 leading-tight">
                          Quét mã QR để xem Menu & Đặt món tại lều
                        </div>
                        <div className="text-[8px] text-slate-400 mt-1">
                          Hotline / Zalo: 0988.xxx.xxx • Wifi: BuiHui_Free
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 shrink-0">
              <div>
                * Gợi ý: Dùng giấy bìa dày (Couche 300gsm) in màu, sau đó cắt theo viền rồi ép màng plastic để chống nước khi cắm ngoài trời.
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white font-black shadow-md cursor-pointer"
              >
                <Printer size={15} />
                In Ngay Bây Giờ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
