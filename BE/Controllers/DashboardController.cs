using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;

namespace BuiHuiCamping.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetDashboardStats()
        {
            // 1. Thống kê chung
            var totalBookings = await _context.Bookings.CountAsync();
            var activeTents = await _context.Tents.CountAsync(t => t.Status == "Occupied");
            
            // 2. Tính doanh thu (Chỉ tính các Order đã thanh toán: Status == "Paid")
            var completedOrders = await _context.Orders
                .Include(o => o.OrderDetails)
                .ThenInclude(od => od.MenuItem)
                .Where(o => o.Status == "Paid")
                .ToListAsync();

            decimal totalRevenue = completedOrders.Sum(o => o.TotalAmount);
            int totalBills = completedOrders.Count;

            // 3. Phần trăm doanh thu theo danh mục (Category)
            decimal foodRevenue = 0;
            decimal drinkRevenue = 0;
            decimal serviceRevenue = 0;

            foreach (var order in completedOrders)
            {
                foreach (var detail in order.OrderDetails)
                {
                    if (detail.MenuItem == null) continue;

                    var subTotal = detail.Quantity * detail.UnitPrice;
                    if (detail.MenuItem.Category == "Food") foodRevenue += subTotal;
                    else if (detail.MenuItem.Category == "Drink") drinkRevenue += subTotal;
                    else serviceRevenue += subTotal;
                }
            }

            var categoryRevenue = new
            {
                food = foodRevenue,
                drink = drinkRevenue,
                service = serviceRevenue
            };

            // 4. Các hóa đơn gần đây (Gom theo BookingId)
            var rawRecentOrders = await _context.Orders
                .Include(o => o.Tent)
                .Include(o => o.Booking)
                .OrderByDescending(o => o.CreatedAt)
                .Take(30)
                .ToListAsync();

            var recentOrders = rawRecentOrders
                .GroupBy(o => o.BookingId)
                .Select(g => new {
                    id = g.Key,
                    customerName = g.First().Booking?.CustomerName ?? "Khách",
                    tentName = g.First().Tent?.Name ?? "N/A",
                    totalAmount = g.Sum(o => o.TotalAmount),
                    status = g.All(o => o.Status == "Paid") ? "Paid" : "Unpaid",
                    createdAt = g.Max(o => o.CreatedAt)
                })
                .OrderByDescending(g => g.createdAt)
                .Take(5)
                .ToList();

            return Ok(new
            {
                totalBookings,
                activeTents,
                totalRevenue,
                totalOrders = totalBills,
                categoryRevenue,
                recentOrders
            });
        }
    }
}
