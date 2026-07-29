# ⛺ BÙI HUI CAMPING - Hệ Thống Quản Lý & Đặt Lều Cắm Trại Thông Minh

[![ASP.NET Core](https://img.shields.io/badge/Backend-ASP.NET%20Core%2010.0-purple?style=for-the-badge&logo=.net)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/Frontend-ReactJS%20%2B%20Vite-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![SignalR](https://img.shields.io/badge/RealTime-SignalR-red?style=for-the-badge&logo=signalr)](https://dotnet.microsoft.com/apps/aspnet/signalr)
[![SQL Server](https://img.shields.io/badge/Database-SQL%20Server-CC292B?style=for-the-badge&logo=microsoftsqlserver)](https://www.microsoft.com/sql-server)

---

## 🌟 Giới Thiệu Dự Án

**Bùi Hui Camping** là hệ thống sinh thái ứng dụng web toàn diện hỗ trợ đặt lều cắm trại, quản lý sơ đồ khu cắm trại, nhận yêu cầu đặt lều và gọi đồ ăn/dịch vụ tại lều bằng **mã QR Code theo thời gian thực (Real-time)**. 

Dự án phục vụ 4 nhóm người dùng chính: **Khách Hàng (Customer)**, **Lễ Tân (Receptionist)**, **Quản Lý (Manager)**, và **Nhân Viên Phục Vụ (Waiter/Staff)**.

---

## 🔥 Các Tính Năng Nổi Bật

### 1. ⛺ Khách Hàng (Customer Portal)
- **Đặt lều Online dễ dàng**:
  - Tìm kiếm & xem danh sách lều phân chia theo **Khu vực (Khu A, Khu B, Khu C...)** đi kèm badge số lượng lều trống real-time.
  - Bộ lọc ngày giờ chính xác tới từng khung giờ 24h & số phút (`00..23 giờ : 00..55 phút`).
  - Hỗ trợ xem trực quan trên **Sơ đồ bản đồ khu cắm trại (Interactive Map)**.
- **Gọi Món Tại Lều Qua QR Code (QR Food & Service Ordering)**:
  - Quét mã QR tại lều để mở thực đơn điện tử.
  - Gọi đồ ăn, đồ uống, thuê dụng cụ nướng nướng than, lửa trại...
  - Xem lịch sử đơn hàng & tổng chi phí trực tiếp tại lều.

### 2. 🛎️ Lễ Tân (Receptionist Portal)
- **Quản lý Sơ đồ lều Real-time**:
  - Thanh công cụ lọc ngang đồng nhất chứa Ô tìm kiếm + Bộ lọc Ngày Check-in / Check-out 24h tiện lợi.
  - Sơ đồ lều hiển thị trạng thái động: `Trống`, `⚡ KHÁCH ĐẶT MỚI`, `Đã Đặt Cọc`, `Đang Ở`.
- **Thông báo SignalR Real-time & Auto-Navigate 1-Click**:
  - Âm thanh thông báo + Card yêu cầu đặt lều mới hiển thị chính xác **Lịch ở của khách** (`📅 01/08/2026 14:00 ➔ 02/08/2026 12:00`).
  - Bấm 1-click vào thông báo tự động điều hướng, áp dụng bộ lọc ngày giờ và highlight lều tương ứng.
- **Quản Lý Mở / Khóa Mã QR Theo TỪNG LỀU (Per-Tent QR Access Control)**:
  - Phân quyền mở/khóa QR thủ công độc lập cho từng lều trong đơn đặt gộp.
  - Hỗ trợ khách đến sớm (Check-in sớm trước 14h) hoặc tạm dừng dịch vụ gọi món của riêng từng lều.
- **Quy trình Duyệt đơn 4 bước**: `⚡ Khách đặt mới` ➔ `Xác nhận tiền cọc` ➔ `Nhận lều (Check-in)` ➔ `Check-out & Trả lều`.

### 3. 👨‍💼 Quản Lý (Manager Portal)
- **Quản lý Khu Vực & Lều Cắm Trại**:
  - Thêm/Sửa/Xóa Khu vực (Zone) và Lều (Tent).
  - Tải mã QR Code PNG chất lượng cao cho từng lều để in ấn dán tại lều.
  - Kéo thả chỉnh vị trí tọa độ lều trên Sơ đồ bản đồ (Map Coordinates Editor).
- **Đồng bộ trạng thái QR Real-time với Lễ Tân**:
  - Tự động đồng bộ cờ `IsQrUnlocked` và trạng thái `Occupied/Available` real-time qua SignalR Hub.
- **Quản lý Thực Đơn & Dịch Vụ**:
  - Thêm/Sửa/Xóa món ăn, thức uống, giá tiền, hình ảnh minh họa và danh mục.

### 4. 🍹 Phục Vụ & Bếp (Waiter & Staff Portal)
- **Nhận đơn gọi món Real-time**:
  - Tự động nhận thông báo khi lều đặt món mới.
  - Cập nhật trạng thái đơn: `Chờ xử lý` ➔ `Đang chuẩn bị` ➔ `Đã giao hàng` ➔ `Đã thanh toán`.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### Backend
- **Framework**: .NET 10.0 / ASP.NET Core Web API
- **ORM**: Entity Framework Core 10.0 (Code-First)
- **Database**: Microsoft SQL Server
- **Real-time Engine**: ASP.NET Core SignalR (`OrderHub`)

### Frontend
- **Framework**: React 19 + Vite 8
- **Styling**: TailwindCSS v3 + Custom Design Tokens (Bento Grid, Glassmorphism, Micro-animations)
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Real-time Client**: `@microsoft/signalr`
- **QR Generator**: `qrcode.react`

---

## 📁 Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
BuiHuiCamping/
├── BE/                           # Backend ASP.NET Core Web API
│   ├── Controllers/              # API Endpoints (Bookings, Tents, Zones, Orders, Menu...)
│   ├── Data/                     # DbContext & Migration Scripts
│   ├── Hubs/                     # SignalR Hubs (OrderHub)
│   ├── Models/                   # Entity Models (Booking, Tent, Zone, Order, MenuItem...)
│   ├── Program.cs                # App Configuration & Auto DB Migration
│   └── BuiHuiCamping.API.csproj
│
├── FE/                           # Frontend ReactJS + Vite
│   ├── src/
│   │   ├── components/           # Reusable UI Components (CampsiteMap, Navbar...)
│   │   ├── pages/
│   │   │   ├── Customer/         # OnlineBookingPage, MenuPage, CartPage, HistoryPage...
│   │   │   ├── Staff/            # ReceptionistBookingPage, ReceptionistOrdersPage, WaiterOrdersPage...
│   │   │   └── Manager/          # FacilityManagementPage, MenuManagementPage, ManagerDashboardPage...
│   │   ├── services/             # SignalR Client Service (signalrService.js)
│   │   └── apiConfig.js          # Dynamic API Host & Port Resolver
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore                    # Production Root Git Ignore
├── README.md                     # Documentation
└── PROJECT_DOCUMENTATION.md      # Detailed Architecture Manual
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án (Getting Started)

### 📋 Yêu Cầu Tiền Đề (Prerequisites)
- [.NET 10.0 SDK](https://dotnet.microsoft.com/download)
- [Node.js v18+](https://nodejs.org/)
- Microsoft SQL Server (LocalDB hoặc SQL Express)

---

### 1️⃣ Khởi Chạy Backend (ASP.NET Core API)

```bash
# 1. Truy cập thư mục Backend
cd BE

# 2. Cập nhật ConnectionString trong appsettings.json nếu cần
# "DefaultConnection": "Server=localhost;Database=BuiHuiCampingDb;Trusted_Connection=True;TrustServerCertificate=True;"

# 3. Chạy ứng dụng API
dotnet run --project BuiHuiCamping.API.csproj
```
> **API Server** sẽ chạy tại: `http://localhost:5248`  
> **Swagger API Docs**: `http://localhost:5248/swagger`

---

### 2️⃣ Khởi Chạy Frontend (ReactJS + Vite)

```bash
# 1. Truy cập thư mục Frontend
cd FE

# 2. Cài đặt các gói phụ thuộc (Dependencies)
npm install

# 3. Chạy môi trường Development
npm run dev
```
> **Web Application** sẽ chạy tại: `http://localhost:5173`

---

## 🔑 Các Đường Dẫn Truy Cập Nhanh (Routes Matrix)

| Vai Trò | Đường Dẫn (Route) | Mô Tả |
| :--- | :--- | :--- |
| **Khách Hàng** | `/customer/booking` | Đặt lều online & tra cứu theo khu vực |
| **Khách Hàng** | `/customer/menu?tent=A.1` | Thực đơn gọi món tại lều (Quét QR Code) |
| **Lễ Tân** | `/receptionist/booking` | Sơ đồ lều, duyệt cọc, quản lý QR & check-in/out |
| **Lễ Tân** | `/receptionist/orders` | Điều phối đơn gọi món từ các lều |
| **Quản Lý** | `/manager/facilities` | Quản lý khu vực, lều, mã QR & bản đồ |
| **Quản Lý** | `/manager/menu` | Quản lý thực đơn & giá cả dịch vụ |
| **Nhân Viên** | `/staff/orders` | Màn hình phục vụ & bếp nhận đơn real-time |

---

## 🤝 Đóng Góp & Phát Triển (Contributing)

Dự án được xây dựng và phát triển bởi đội ngũ **Bùi Hui Camping**.  
Mọi góp ý và báo lỗi vui lòng tạo **Issue** hoặc mở **Pull Request** trên Repository.

---

<p center>
  <sub>© 2026 Bùi Hui Camping Ecosystem. Made with ❤️ for Camping Enthusiasts.</sub>
</p>
