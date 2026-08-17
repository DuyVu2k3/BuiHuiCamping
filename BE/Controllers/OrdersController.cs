using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using Microsoft.AspNetCore.SignalR;
using BuiHuiCamping.API.Hubs;

namespace BuiHuiCamping.API.Controllers
{
    // DTOs for Order Placement
    public class PlaceOrderDto
    {
        public int? TentId { get; set; }
        public string TentName { get; set; } = string.Empty; // e.g. "A.1" or "Khu A.A.1"
        public string CustomerName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public List<OrderItemDto> Items { get; set; } = new List<OrderItemDto>();
    }

    public class OrderItemDto
    {
        public int MenuItemId { get; set; }
        public int Quantity { get; set; }
        public string? Note { get; set; }
    }

    public class RejectOrderDto
    {
        public string Reason { get; set; } = string.Empty;
    }

    [Route("api/[controller]")]
    [ApiController]
    public class OrdersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public OrdersController(AppDbContext context, IHubContext<OrderHub> hubContext) 
        { 
            _context = context; 
            _hubContext = hubContext;
        }

        // 1. Get active batches/tickets for Kitchen & Waiter
        [HttpGet]
        public async Task<IActionResult> GetActiveOrders()
        {
            // Get all order details that are not yet Delivered or Cancelled
            var activeDetails = await _context.OrderDetails
                .Include(od => od.MenuItem)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Tent!)
                        .ThenInclude(t => t.Zone)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Tent!)
                        .ThenInclude(t => t.Bookings)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Booking)
                .Where(od => od.Order != null && od.Order.Status == "Unpaid" && od.Status != "Delivered" && od.Status != "Cancelled")
                .ToListAsync();

            // Group by BatchId to form individual Kitchen Tickets
            var tickets = activeDetails
                .GroupBy(od => od.BatchId ?? od.Id.ToString())
                .Select(g => {
                    var first = g.First();
                    var tentObj = first.Order?.Tent;
                    var bookingObj = first.Order?.Booking;
                    var activeBookingObj = bookingObj ?? tentObj?.Bookings?.FirstOrDefault(b => b.Status == "Occupied" || b.Status == "Booked" || b.Status == "Pending");

                    string resolveCustomerName = activeBookingObj?.CustomerName ?? "Khách hàng";

                    return new
                    {
                        id = first.BatchId ?? first.Id.ToString(),
                        batchId = first.BatchId,
                        status = first.Status, // Pending, Preparing, Ready
                        rejectReason = first.RejectReason,
                        deliveredBy = first.DeliveredBy,
                        proofImage = first.ProofImage,
                        createdAt = g.Min(od => od.CreatedAt),
                        tent = new {
                            id = tentObj?.Id,
                            name = tentObj?.Name,
                            zoneId = tentObj?.ZoneId,
                            zoneName = tentObj?.Zone?.Name ?? "",
                            status = tentObj?.Status
                        },
                        booking = new {
                            id = activeBookingObj?.Id ?? bookingObj?.Id,
                            customerName = resolveCustomerName
                        },
                        orderDetails = g.Select(od => new {
                            id = od.Id,
                            menuItemId = od.MenuItemId,
                            menuItem = od.MenuItem,
                            quantity = od.Quantity,
                            unitPrice = od.UnitPrice,
                            note = od.Note,
                            status = od.Status,
                            rejectReason = od.RejectReason,
                            deliveredBy = od.DeliveredBy,
                            proofImage = od.ProofImage
                        }).ToList()
                    };
                })
                .OrderBy(t => t.createdAt)
                .ToList();

            return Ok(tickets);
        }

        public static Tent? FindMatchingTent(IEnumerable<Tent> allTents, string inputTent)
        {
            if (string.IsNullOrWhiteSpace(inputTent)) return null;
            inputTent = inputTent.Trim();

            // 1. QRCodeData match
            var match = allTents.FirstOrDefault(t => 
                !string.IsNullOrEmpty(t.QRCodeData) && 
                t.QRCodeData.EndsWith($"?tent={inputTent}", StringComparison.OrdinalIgnoreCase));
            if (match != null) return match;

            // 2. Exact Zone.Tent match e.g. "Khu B.1" or "Khu B.Lều 1"
            match = allTents.FirstOrDefault(t => 
                t.Zone != null && 
                (
                    $"{t.Zone.Name}.{t.Name}".Equals(inputTent, StringComparison.OrdinalIgnoreCase) ||
                    $"{t.Zone.Name.Replace("Khu ", "")}.{t.Name}".Equals(inputTent, StringComparison.OrdinalIgnoreCase) ||
                    $"{t.Zone.Name}.Lều {t.Name}".Equals(inputTent, StringComparison.OrdinalIgnoreCase) ||
                    $"{t.Zone.Name.Replace("Khu ", "")}.Lều {t.Name}".Equals(inputTent, StringComparison.OrdinalIgnoreCase)
                )
            );
            if (match != null) return match;

            // 3. Split input by '.' or '-' e.g. "Khu B.1" or "B.1"
            if (inputTent.Contains('.') || inputTent.Contains('-'))
            {
                var parts = inputTent.Split(new[] { '.', '-' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2)
                {
                    var zoneSearch = parts[0].Trim().Replace("Khu", "", StringComparison.OrdinalIgnoreCase).Trim();
                    var tentSearch = parts[1].Trim().Replace("Lều", "", StringComparison.OrdinalIgnoreCase).Trim();

                    match = allTents.FirstOrDefault(t => 
                        t.Zone != null &&
                        t.Zone.Name.Replace("Khu", "", StringComparison.OrdinalIgnoreCase).Trim().Equals(zoneSearch, StringComparison.OrdinalIgnoreCase) &&
                        t.Name.Replace("Lều", "", StringComparison.OrdinalIgnoreCase).Trim().Equals(tentSearch, StringComparison.OrdinalIgnoreCase)
                    );
                    if (match != null) return match;
                }
            }

            // 4. Exact full name match
            match = allTents.FirstOrDefault(t => t.Name.Equals(inputTent, StringComparison.OrdinalIgnoreCase));
            if (match != null) return match;

            // 5. Clean name match
            var cleanInput = inputTent.Replace("Lều", "", StringComparison.OrdinalIgnoreCase).Trim();
            return allTents.FirstOrDefault(t => t.Name.Replace("Lều", "", StringComparison.OrdinalIgnoreCase).Trim().Equals(cleanInput, StringComparison.OrdinalIgnoreCase));
        }

        // 2. Customer places an order (Appends items to Master Order under a new BatchId)
        [HttpPost]
        public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderDto dto)
        {
            if (string.IsNullOrEmpty(dto.TentName))
            {
                return BadRequest("Thiếu thông tin lều.");
            }

            var allTents = await _context.Tents
                .Include(t => t.Zone)
                .Include(t => t.Bookings)
                .ToListAsync();

            Tent? tent = null;
            if (dto.TentId.HasValue && dto.TentId.Value > 0)
            {
                tent = allTents.FirstOrDefault(t => t.Id == dto.TentId.Value);
            }
            if (tent == null)
            {
                tent = FindMatchingTent(allTents, dto.TentName);
            }

            if (tent == null) return NotFound("Không tìm thấy Lều này trong hệ thống.");

            var activeBooking = tent.Bookings.FirstOrDefault(b => b.Status == "Booked" || b.Status == "Occupied" || b.Status == "Pending");
            if (activeBooking == null)
            {
                bool isTableEntity = (tent.TentType != null && (tent.TentType.Equals("Bàn", StringComparison.OrdinalIgnoreCase) || tent.TentType.Equals("Tiệc", StringComparison.OrdinalIgnoreCase))) ||
                                     (tent.Zone != null && (tent.Zone.Name.Contains("Bàn", StringComparison.OrdinalIgnoreCase) || tent.Zone.Name.Contains("Nhà hàng", StringComparison.OrdinalIgnoreCase)));

                string defaultName = isTableEntity ? $"Khách Bàn {tent.Name}" : $"Khách Lều {tent.Name}";

                activeBooking = new Booking
                {
                    CustomerName = !string.IsNullOrEmpty(dto.CustomerName) ? dto.CustomerName : defaultName,
                    PhoneNumber = !string.IsNullOrEmpty(dto.PhoneNumber) ? dto.PhoneNumber : "0000000000",
                    Status = "Occupied",
                    CheckInDate = DateTime.UtcNow,
                    CheckOutDate = DateTime.UtcNow.AddDays(1),
                    IsQrUnlocked = true
                };
                _context.Bookings.Add(activeBooking);
                activeBooking.Tents.Add(tent);
                tent.Status = isTableEntity ? "Available" : "Occupied";
                await _context.SaveChangesAsync();
            }

            // Find or Create Master Order for this Booking & Tent
            var masterOrder = await _context.Orders
                .FirstOrDefaultAsync(o => o.BookingId == activeBooking.Id && o.TentId == tent.Id && o.Status == "Unpaid");

            if (masterOrder == null)
            {
                masterOrder = new Order
                {
                    TentId = tent.Id,
                    BookingId = activeBooking.Id,
                    CreatedAt = DateTime.UtcNow,
                    Status = "Unpaid",
                    TotalAmount = 0
                };
                _context.Orders.Add(masterOrder);
                await _context.SaveChangesAsync(); // get Master Order Id
            }

            string batchId = Guid.NewGuid().ToString("N").Substring(0, 8);
            decimal addedTotal = 0;
            var newDetails = new List<OrderDetail>();

            foreach (var itemDto in dto.Items)
            {
                var menuItem = await _context.MenuItems.FindAsync(itemDto.MenuItemId);
                if (menuItem != null)
                {
                    var detail = new OrderDetail
                    {
                        OrderId = masterOrder.Id,
                        MenuItemId = menuItem.Id,
                        Quantity = itemDto.Quantity,
                        UnitPrice = menuItem.Price,
                        Note = itemDto.Note,
                        Status = "Pending",
                        CreatedAt = DateTime.UtcNow,
                        BatchId = batchId
                    };
                    addedTotal += (menuItem.Price * itemDto.Quantity);
                    _context.OrderDetails.Add(detail);
                    newDetails.Add(detail);
                }
            }

            masterOrder.TotalAmount += addedTotal;
            masterOrder.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Real-time SignalR notifications to Receptionist, Waiter & Kitchen Staff
            var itemNames = newDetails.Select(d => {
                var menuItem = _context.MenuItems.Find(d.MenuItemId);
                return $"{d.Quantity}x {(menuItem?.Name ?? "Món")}";
            }).ToList();

            var orderPayload = new {
                batchId = batchId,
                orderId = masterOrder.Id,
                tentName = tent.Name,
                zoneName = tent.Zone?.Name ?? "Khu Cắm Trại",
                customerName = activeBooking?.CustomerName ?? $"Khách Lều {tent.Name}",
                phoneNumber = activeBooking?.PhoneNumber ?? "",
                itemsSummary = string.Join(", ", itemNames),
                totalAmount = addedTotal,
                createdAt = DateTime.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("NewFoodOrder", orderPayload);
            await _hubContext.Clients.All.SendAsync("OrderUpdated");

            return Ok(new { batchId, orderId = masterOrder.Id, addedTotal });
        }

        // 3. Customer order history for a tent
        [HttpGet("history")]
        public async Task<IActionResult> GetOrderHistory([FromQuery] string tentName)
        {
            if (string.IsNullOrEmpty(tentName)) return BadRequest("Tent name is required.");

            var tentNameParts = tentName.Split('.');
            var actualTentName = tentNameParts.Length > 1 ? tentNameParts[1] : tentName;

            var orders = await _context.Orders
                .Include(o => o.OrderDetails)
                    .ThenInclude(od => od.MenuItem)
                .Include(o => o.Tent)
                .Include(o => o.Booking)
                .Where(o => o.Tent != null && o.Tent.Name == actualTentName && o.Status == "Unpaid")
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return Ok(orders);
        }

        // 4. Update status of a Batch / Ticket (e.g. Pending -> Preparing -> Ready -> Completed)
        [HttpPut("{batchId}/status")]
        public async Task<IActionResult> UpdateBatchStatus(string batchId, [FromBody] string status)
        {
            // Status can be: "Preparing", "Ready", "Completed" (which maps to Delivered)
            string targetStatus = status == "Completed" ? "Delivered" : status;

            var details = await _context.OrderDetails
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Tent)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Booking)
                .Where(od => od.BatchId == batchId || od.Id.ToString() == batchId)
                .ToListAsync();

            if (!details.Any()) return NotFound("Không tìm thấy đợt gọi món này.");

            foreach (var od in details)
            {
                od.Status = targetStatus;
            }

            await _context.SaveChangesAsync();

            var first = details.First();
            var tentName = first.Order?.Tent?.Name ?? "";
            var zoneId = first.Order?.Tent?.ZoneId;
            var zoneName = first.Order?.Tent?.Zone?.Name ?? "";
            var customerName = first.Order?.Booking?.CustomerName ?? "";

            if (status == "Preparing")
            {
                await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", batchId, status);
            }
            else if (status == "Ready")
            {
                await _hubContext.Clients.All.SendAsync("OrderToWaiter", new {
                    OrderId = batchId,
                    TentName = tentName,
                    CustomerName = customerName,
                    ZoneId = zoneId,
                    ZoneName = zoneName,
                    Message = $"Có món tại lều {tentName} ({zoneName}) cần giao!"
                });
                await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", batchId, status);
            }
            else if (status == "Completed" || targetStatus == "Delivered")
            {
                await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", batchId, "Completed");
            }

            return Ok(new { batchId, status = targetStatus });
        }

        // 5. Kitchen Rejects an Order Batch with a preset Reason
        [HttpPut("{batchId}/reject")]
        public async Task<IActionResult> RejectBatchOrder(string batchId, [FromBody] RejectOrderDto dto)
        {
            var details = await _context.OrderDetails
                .Include(od => od.Order!)
                .Where(od => od.BatchId == batchId || od.Id.ToString() == batchId)
                .ToListAsync();

            if (!details.Any()) return NotFound("Không tìm thấy đợt gọi món này.");

            string reasonText = !string.IsNullOrWhiteSpace(dto.Reason) ? dto.Reason : "Bếp hiện chưa thể phục vụ đợt món này";

            foreach (var od in details)
            {
                od.Status = "Cancelled";
                od.RejectReason = reasonText;
            }

            var first = details.First();
            if (first.Order != null)
            {
                decimal rejectedTotal = details.Sum(d => d.UnitPrice * d.Quantity);
                first.Order.TotalAmount = Math.Max(0, first.Order.TotalAmount - rejectedTotal);
                first.Order.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("OrderRejected", new { batchId, reason = reasonText });
            await _hubContext.Clients.All.SendAsync("OrderUpdated");

            return Ok(new { batchId, status = "Cancelled", reason = reasonText });
        }

        // 5.5 Customer cancels order BEFORE Kitchen starts cooking
        [HttpPut("{batchId}/cancel-by-customer")]
        public async Task<IActionResult> CancelOrderByCustomer(string batchId)
        {
            var details = await _context.OrderDetails
                .Include(od => od.Order!)
                .Where(od => od.BatchId == batchId || od.Id.ToString() == batchId)
                .ToListAsync();

            if (!details.Any()) return NotFound("Không tìm thấy đợt gọi món này.");

            // CRITICAL BUSINESS LOGIC:
            // Customer can ONLY cancel if the order HAS NOT BEEN CONFIRMED by Kitchen (status must be Pending).
            bool anyStartedCooking = details.Any(od => od.Status != "Pending");
            if (anyStartedCooking)
            {
                return BadRequest(new { message = "Bếp đã tiếp nhận đơn hàng này và đang chế biến. Bạn không thể tự hủy đơn nữa!" });
            }

            foreach (var od in details)
            {
                od.Status = "Cancelled";
                od.RejectReason = "Khách hàng chủ động hủy đơn trước khi Bếp làm";
            }

            var first = details.First();
            if (first.Order != null)
            {
                decimal canceledTotal = details.Sum(d => d.UnitPrice * d.Quantity);
                first.Order.TotalAmount = Math.Max(0, first.Order.TotalAmount - canceledTotal);
                first.Order.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("OrderCancelled", new { batchId, reason = "Hủy bởi khách hàng" });
            await _hubContext.Clients.All.SendAsync("OrderUpdated");

            return Ok(new { batchId, status = "Cancelled", message = "Đã hủy đợt gọi món thành công." });
        }

        // 6. Waiter completes order by uploading delivery proof photo
        [HttpPost("{batchId}/upload-proof")]
        public async Task<IActionResult> UploadDeliveryProof(string batchId, [FromForm] IFormFile? photo, [FromForm] string? deliveredBy)
        {
            var details = await _context.OrderDetails
                .Include(od => od.Order!)
                .Where(od => od.BatchId == batchId || od.Id.ToString() == batchId)
                .ToListAsync();

            if (!details.Any()) return NotFound("Không tìm thấy đợt gọi món.");

            string proofUrl = "";
            if (photo != null && photo.Length > 0)
            {
                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "delivery_proofs");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var fileName = $"proof_{batchId}_{DateTime.UtcNow.Ticks}{Path.GetExtension(photo.FileName)}";
                var filePath = Path.Combine(uploadsFolder, fileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await photo.CopyToAsync(stream);
                }

                proofUrl = $"/uploads/delivery_proofs/{fileName}";
            }

            foreach (var od in details)
            {
                od.Status = "Delivered";
                if (!string.IsNullOrEmpty(proofUrl)) od.ProofImage = proofUrl;
                if (!string.IsNullOrEmpty(deliveredBy)) od.DeliveredBy = deliveredBy;
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", batchId, "Completed");
            await _hubContext.Clients.All.SendAsync("OrderUpdated");

            return Ok(new { batchId, status = "Delivered", proofImage = proofUrl, deliveredBy });
        }

        // 7. Receptionist / Manager Order Audit History with Proof Photos
        [HttpGet("all-history")]
        public async Task<IActionResult> GetAllOrderAuditHistory()
        {
            var allDetails = await _context.OrderDetails
                .Include(od => od.MenuItem)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Tent!)
                        .ThenInclude(t => t.Zone)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Booking)
                .Where(od => od.Order != null)
                .OrderByDescending(od => od.CreatedAt)
                .ToListAsync();

            var auditBatches = allDetails
                .GroupBy(od => od.BatchId ?? od.Id.ToString())
                .Select(g => {
                    var first = g.First();
                    var tentObj = first.Order?.Tent;
                    var bookingObj = first.Order?.Booking;

                    string rZone = tentObj?.Zone?.Name ?? "";
                    string rTent = tentObj?.Name ?? "";
                    bool isDiningTable = (tentObj?.Zone?.ZoneType == "DiningTable") || 
                                          (!string.IsNullOrEmpty(rZone) && (rZone.Contains("Bàn") || rZone.Contains("ẩm thực") || rZone.Contains("Ẩm thực"))) ||
                                          rTent.StartsWith("Bàn");

                    string tFormatted = rTent.StartsWith("Lều") || rTent.StartsWith("Bàn") 
                        ? rTent 
                        : (isDiningTable ? $"Bàn {rTent}" : $"Lều {rTent}");
                    string zFormatted = (!string.IsNullOrEmpty(rZone) && !rZone.StartsWith("Khu")) ? $"Khu {rZone}" : rZone;
                    string locName = !string.IsNullOrEmpty(zFormatted) ? $"{zFormatted} - {tFormatted}" : tFormatted;

                    return new
                    {
                        batchId = first.BatchId ?? first.Id.ToString(),
                        orderId = first.OrderId,
                        status = first.Status,
                        rejectReason = g.FirstOrDefault(od => !string.IsNullOrEmpty(od.RejectReason))?.RejectReason,
                        deliveredBy = g.FirstOrDefault(od => !string.IsNullOrEmpty(od.DeliveredBy))?.DeliveredBy,
                        proofImage = g.FirstOrDefault(od => !string.IsNullOrEmpty(od.ProofImage))?.ProofImage,
                        createdAt = g.Min(od => od.CreatedAt),
                        locationName = locName,
                        customerName = bookingObj?.CustomerName ?? "Khách hàng",
                        totalBatchAmount = g.Sum(od => od.Quantity * od.UnitPrice),
                        items = g.Select(od => new {
                            id = od.Id,
                            name = od.MenuItem?.Name ?? "Món ăn",
                            quantity = od.Quantity,
                            unitPrice = od.UnitPrice,
                            note = od.Note,
                            status = od.Status
                        }).ToList()
                    };
                })
                .OrderByDescending(b => b.createdAt)
                .Take(50)
                .ToList();

            return Ok(auditBatches);
        }
    }
}
