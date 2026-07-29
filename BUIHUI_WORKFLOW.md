# TÀI LIỆU LUỒNG VẬN HÀNH BÙI HUI CAMPING (WORKFLOW)
*Tài liệu này giúp tổng hợp và theo dõi toàn bộ các luồng nghiệp vụ trong hệ thống tính đến hiện tại.*

---

## 1. PHÂN QUYỀN VÀ CÁC THỰC THỂ CHÍNH (ROLES & ENTITIES)
- **Quản lý (Manager):** Cài đặt dữ liệu nền (Món ăn, Dịch vụ, Sơ đồ khu vực).
- **Lễ tân / Nhân viên (Staff):** Đón khách, điều phối lều, xem thông báo gọi món.
- **Khách hàng (Customer):** Người trải nghiệm dịch vụ, quét mã QR tại lều để order.

## 2. LUỒNG SETUP HỆ THỐNG (GIAI ĐOẠN ĐẦU)
1. Quản lý vào trang `/manager/menu` tạo các món ăn (Có tính năng upload ảnh vật lý).
2. Quản lý vào trang `/manager/facilities` tạo các Khu Vực (Zone A, B...).
3. Quản lý tạo Lều (A.1, A.2) thuộc các Zone.
4. Hệ thống tự động sinh ra **Mã QR** (chứa URL có tham số lều, vd: `?tent=Zone A.A.1`) để Quản lý in ra dán lên các lều.

## 3. LUỒNG ĐẶT LỀU & GOM BILL (MASTER BILL)
*Đây là luồng cốt lõi để giải quyết bài toán khách đi theo nhóm.*
1. Khách hàng (ví dụ anh A) tới quầy Lễ tân thuê 3 lều (A.1, A.2, A.3).
2. Lễ tân mở **Staff Portal**, tạo 1 `Booking` mới mang tên anh A + SĐT anh A.
3. Lễ tân tick chọn 3 lều (A.1, A.2, A.3) gán vào chung Booking này. 
4. Trạng thái 3 lều chuyển sang **Đang phục vụ (Occupied)**.

## 4. LUỒNG KHÁCH HÀNG GỌI MÓN (CUSTOMER ORDER)
1. Bạn của anh A (đang ở lều A.2) dùng điện thoại quét mã QR.
2. Điện thoại mở ra **Customer Portal**, tự động nhận diện "Bạn đang ngồi ở Lều A.2".
3. Khách hàng chọn món (Thêm vào Giỏ Hàng) và bấm "Gửi Order".
4. **Xử lý ngầm tại Backend:**
   - Backend nhận thông tin "Lều A.2 vừa gọi đồ".
   - Backend quét Database tìm xem Lều A.2 đang thuộc Booking nào (Sẽ tìm ra Booking của anh A).
   - Backend tự động tính tiền món ăn, tạo Bill, và **cộng dồn tiền vào Master Bill** của anh A.
   - Backend bắn thông báo (SignalR) lên màn hình Staff Portal.

## 5. LUỒNG STAFF ĐIỀU PHỐI (KẾT THÚC)
1. Nhân viên nghe tiếng "Ting" từ thiết bị, nhìn vào màn hình Staff Portal thấy thông báo: *"Chuẩn bị 2 Cafe mang ra Lều A.2"*.
2. Nhân viên làm đồ và mang ra lều.
3. Khi nhóm anh A trả lều (Check-out), Lễ tân bấm nút thanh toán. Hệ thống sẽ xuất ra **1 tờ Bill duy nhất** liệt kê toàn bộ tiền lều và tiền đồ ăn/nước uống của cả 3 lều A.1, A.2, A.3.
4. Trạng thái 3 lều trở về **Trống (Available)**.

---
*Tài liệu được cập nhật tự động bởi AI Agent.*
