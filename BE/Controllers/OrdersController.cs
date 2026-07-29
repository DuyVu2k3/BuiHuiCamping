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
            // Get all order details that are not yet Delivered
            var activeDetails = await _context.OrderDetails
                .Include(od => od.MenuItem)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Tent)
                .Include(od => od.Order!)
                    .ThenInclude(o => o.Booking)
                .Where(od => od.Order != null && od.Order.Status == "Unpaid" && od.Status != "Delivered" && od.Status != "Cancelled")
                .ToListAsync();

            // Group by BatchId to form individual Kitchen Tickets
            var tickets = activeDetails
                .GroupBy(od => od.BatchId ?? od.Id.ToString())
                .Select(g => {
                    var first = g.First();
                    return new
                    {
                        id = first.BatchId ?? first.Id.ToString(),
                        batchId = first.BatchId,
                        status = first.Status, // Pending, Preparing, Ready
                        createdAt = g.Min(od => od.CreatedAt),
                        tent = first.Order?.Tent,
                        booking = first.Order?.Booking,
                        orderDetails = g.Select(od => new {
                            id = od.Id,
                            menuItemId = od.MenuItemId,
                            menuItem = od.MenuItem,
                            quantity = od.Quantity,
                            unitPrice = od.UnitPrice,
                            note = od.Note,
                            status = od.Status
                        }).ToList()
                    };
                })
                .OrderBy(t => t.createdAt)
                .ToList();

            return Ok(tickets);
        }

        // 2. Customer places an order (Appends items to Master Order under a new BatchId)
        [HttpPost]
        public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderDto dto)
        {
            if (string.IsNullOrEmpty(dto.TentName))
            {
                return BadRequest("Thiếu thông tin lều.");
            }

            var tentNameParts = dto.TentName.Split('.');
            var actualTentName = tentNameParts.Length > 1 ? tentNameParts[1] : dto.TentName;

            var allTents = await _context.Tents
                .Include(t => t.Zone)
                .Include(t => t.Bookings)
                .ToListAsync();

            var tent = allTents.FirstOrDefault(t => 
                (!string.IsNullOrEmpty(t.QRCodeData) && t.QRCodeData.EndsWith($"?tent={dto.TentName}", StringComparison.OrdinalIgnoreCase)) ||
                t.Name.Equals(dto.TentName, StringComparison.OrdinalIgnoreCase) ||
                (t.Zone != null && $"{t.Zone.Name}.{t.Name}".Equals(dto.TentName, StringComparison.OrdinalIgnoreCase)) ||
                (t.Zone != null && $"{t.Zone.Name.Replace("Khu ", "")}.{t.Name}".Equals(dto.TentName, StringComparison.OrdinalIgnoreCase)) ||
                t.Name.Equals(actualTentName, StringComparison.OrdinalIgnoreCase)
            );

            if (tent == null) return NotFound("Không tìm thấy Lều này trong hệ thống.");

            var activeBooking = tent.Bookings.FirstOrDefault(b => b.Status == "Booked" || b.Status == "Occupied" || b.Status == "Pending");

            // Find or Create Master Order for this Booking & Tent
            var masterOrder = await _context.Orders
                .FirstOrDefaultAsync(o => (activeBooking != null && o.BookingId == activeBooking.Id) || (o.TentId == tent.Id && o.Status == "Unpaid"));

            if (masterOrder == null)
            {
                masterOrder = new Order
                {
                    TentId = tent.Id,
                    BookingId = activeBooking?.Id,
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

            // SignalR notification to Kitchen / Staff
            await _hubContext.Clients.All.SendAsync("ReceiveOrder", new {
                OrderId = batchId,
                TentName = tent.Name,
                CustomerName = activeBooking.CustomerName,
                Message = $"Lều {tent.Name} vừa gọi món mới!"
            });

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
                    Message = $"Có món tại lều {tentName} cần giao!"
                });
                await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", batchId, status);
            }
            else if (status == "Completed" || targetStatus == "Delivered")
            {
                await _hubContext.Clients.All.SendAsync("OrderStatusUpdated", batchId, "Completed");
            }

            return Ok(new { batchId, status = targetStatus });
        }
    }
}
