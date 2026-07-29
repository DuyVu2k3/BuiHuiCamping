using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using Microsoft.AspNetCore.SignalR;
using BuiHuiCamping.API.Hubs;

namespace BuiHuiCamping.API.Controllers
{
    public class CreateBookingDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public List<int> TentIds { get; set; } = new List<int>();
    }

    public class OnlineBookingDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public List<int> TentIds { get; set; } = new List<int>();
        public DateTime? CheckInDate { get; set; }
        public DateTime? CheckOutDate { get; set; }
        public decimal DepositAmount { get; set; }
    }

    public class RequestCheckoutDto
    {
        public int? TentId { get; set; }
        public string TentName { get; set; } = string.Empty;
    }

    [Route("api/[controller]")]
    [ApiController]
    public class BookingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public BookingsController(AppDbContext context, IHubContext<OrderHub> hubContext) 
        { 
            _context = context; 
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetBookings()
        {
            var bookings = await _context.Bookings
                .Include(b => b.Tents)
                .Include(b => b.Orders)
                .ToListAsync();
            return Ok(bookings);
        }

        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
        {
            var booking = new Booking
            {
                CustomerName = dto.CustomerName,
                PhoneNumber = dto.PhoneNumber,
                Status = "Booked"
            };
            
            var tents = await _context.Tents.Where(t => dto.TentIds.Contains(t.Id)).ToListAsync();
            foreach(var tent in tents)
            {
                booking.Tents.Add(tent);
                tent.Status = "Booked"; 
            }

            booking.TotalPrice = tents.Sum(t => t.Price);
            
            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            // Auto create Master Unpaid Orders for each Tent in the Booking
            foreach (var tent in booking.Tents)
            {
                var masterOrder = new Order
                {
                    TentId = tent.Id,
                    BookingId = booking.Id,
                    Status = "Unpaid",
                    CreatedAt = DateTime.UtcNow,
                    TotalAmount = 0
                };
                _context.Orders.Add(masterOrder);
            }
            await _context.SaveChangesAsync();

            return Ok(booking);
        }

        [HttpPost("online-booking")]
        public async Task<IActionResult> CreateOnlineBooking([FromBody] OnlineBookingDto dto)
        {
            var booking = new Booking
            {
                CustomerName = dto.CustomerName,
                PhoneNumber = dto.PhoneNumber,
                CheckInDate = dto.CheckInDate,
                CheckOutDate = dto.CheckOutDate,
                DepositAmount = dto.DepositAmount,
                DepositStatus = "Paid",
                Status = "Booked"
            };
            
            var tents = await _context.Tents.Where(t => dto.TentIds.Contains(t.Id)).ToListAsync();
            foreach(var tent in tents)
            {
                booking.Tents.Add(tent);
                tent.Status = "Booked"; 
            }

            booking.TotalPrice = tents.Sum(t => t.Price);
            
            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            // Auto create Master Unpaid Orders for each Tent in the Booking
            foreach (var tent in booking.Tents)
            {
                var masterOrder = new Order
                {
                    TentId = tent.Id,
                    BookingId = booking.Id,
                    Status = "Unpaid",
                    CreatedAt = DateTime.UtcNow,
                    TotalAmount = 0
                };
                _context.Orders.Add(masterOrder);
            }
            await _context.SaveChangesAsync();

            return Ok(booking);
        }

    public class ConfirmDepositDto
    {
        public decimal DepositAmount { get; set; }
        public List<int>? FinalTentIds { get; set; }
    }

        [HttpPost("online-booking-request")]
        public async Task<IActionResult> CreateOnlineBookingRequest([FromBody] OnlineBookingDto dto)
        {
            var booking = new Booking
            {
                CustomerName = dto.CustomerName,
                PhoneNumber = dto.PhoneNumber,
                CheckInDate = dto.CheckInDate,
                CheckOutDate = dto.CheckOutDate,
                DepositAmount = dto.DepositAmount,
                DepositStatus = "Pending",
                Status = "Pending"
            };
            
            var tents = await _context.Tents.Include(t => t.Zone).Where(t => dto.TentIds.Contains(t.Id)).ToListAsync();
            foreach(var tent in tents)
            {
                booking.Tents.Add(tent);
            }

            booking.TotalPrice = tents.Sum(t => t.Price);
            
            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            var tentDetails = tents.Select(t => {
                var zoneName = t.Zone?.Name ?? "Khu Cắm Trại";
                return $"{zoneName} (Lều {t.Name})";
            });

            // Real-time SignalR notifications
            await _hubContext.Clients.All.SendAsync("NewBookingRequest", new {
                bookingId = booking.Id,
                customerName = booking.CustomerName,
                phoneNumber = booking.PhoneNumber,
                tentsList = string.Join(", ", tentDetails),
                checkInDate = booking.CheckInDate,
                checkOutDate = booking.CheckOutDate
            });
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");

            return Ok(booking);
        }

        [HttpPut("{id}/confirm-deposit")]
        public async Task<IActionResult> ConfirmDeposit(int id, [FromBody] ConfirmDepositDto dto)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound();

            if (dto != null && dto.DepositAmount > 0)
            {
                booking.DepositAmount = dto.DepositAmount;
            }

            // If Receptionist removed some tents during consultation
            if (dto?.FinalTentIds != null && dto.FinalTentIds.Any())
            {
                var removedTents = booking.Tents.Where(t => !dto.FinalTentIds.Contains(t.Id)).ToList();
                foreach (var rTent in removedTents)
                {
                    booking.Tents.Remove(rTent);
                }
            }

            booking.TotalPrice = booking.Tents.Sum(t => t.Price);
            booking.DepositStatus = "Paid";
            booking.Status = "Booked";
            // IsQrUnlocked is strictly controlled 100% manually by Receptionist

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(booking);
        }

        [HttpPut("{id}/reject-request")]
        public async Task<IActionResult> RejectRequest(int id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound();

            booking.Status = "Cancelled";
            booking.IsQrUnlocked = false;

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(booking);
        }

        [HttpPut("{id}/checkout")]
        public async Task<IActionResult> Checkout(int id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .Include(b => b.Orders)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound();

            booking.Status = "CheckedOut";
            booking.IsQrUnlocked = false; // Lock QR upon checkout

            foreach (var order in booking.Orders)
            {
                if (order.Status == "Unpaid")
                {
                    order.Status = "Paid";
                    order.UpdatedAt = DateTime.UtcNow;
                }
            }
            
            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(booking);
        }

        [HttpPut("{id}/checkin")]
        public async Task<IActionResult> Checkin(int id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .Include(b => b.Orders)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound();

            booking.Status = "Occupied";
            // IsQrUnlocked is strictly controlled 100% manually by Receptionist

            foreach(var tent in booking.Tents)
            {
                // Ensure Master Order exists
                var existingOrder = booking.Orders.FirstOrDefault(o => o.TentId == tent.Id && o.Status == "Unpaid");
                if (existingOrder == null)
                {
                    var order = new Order
                    {
                        TentId = tent.Id,
                        BookingId = booking.Id,
                        Status = "Unpaid",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Orders.Add(order);
                }
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(booking);
        }

        [HttpPost("{id}/toggle-qr-lock")]
        public async Task<IActionResult> ToggleQrLock(int id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return NotFound();

            booking.IsQrUnlocked = !booking.IsQrUnlocked;
            
            // Sync tent physical status for Manager view
            foreach (var tent in booking.Tents)
            {
                tent.Status = booking.IsQrUnlocked ? "Occupied" : "Available";
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("BookingQrStatusChanged", new { bookingId = booking.Id, isQrUnlocked = booking.IsQrUnlocked });
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");

            return Ok(new { bookingId = booking.Id, isQrUnlocked = booking.IsQrUnlocked, message = booking.IsQrUnlocked ? "Mã QR đã được MỞ KHÓA thủ công!" : "Mã QR đã bị KHÓA thủ công!" });
        }

        [HttpGet("reset-tent-statuses")]
        public async Task<IActionResult> ResetTentStatuses()
        {
            var tents = await _context.Tents.ToListAsync();
            foreach (var t in tents)
            {
                t.Status = "Available";
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Reset physical tent statuses to Available" });
        }

        [HttpPost("request-checkout")]
        public async Task<IActionResult> RequestCheckout([FromBody] RequestCheckoutDto dto)
        {
            if (string.IsNullOrEmpty(dto.TentName) && (!dto.TentId.HasValue || dto.TentId <= 0))
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
                tent = OrdersController.FindMatchingTent(allTents, dto.TentName);
            }

            if (tent == null) return NotFound("Không tìm thấy Lều.");

            var activeBooking = tent.Bookings?.FirstOrDefault(b => b.Status == "Occupied" || b.Status == "Booked" || b.Status == "Pending");
            
            string rawZone = tent.Zone?.Name ?? "";
            string rawTentName = tent.Name ?? "";
            string tentNameFormatted = rawTentName.StartsWith("Lều") ? rawTentName : $"Lều {rawTentName}";
            string zoneFormatted = (!string.IsNullOrEmpty(rawZone) && !rawZone.StartsWith("Khu")) ? $"Khu {rawZone}" : rawZone;
            string locationName = !string.IsNullOrEmpty(zoneFormatted) ? $"{zoneFormatted} - {tentNameFormatted}" : tentNameFormatted;

            await _hubContext.Clients.All.SendAsync("CheckoutRequested", locationName);
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");

            return Ok(new { message = "Đã gửi yêu cầu thanh toán tới Lễ Tân thành công!" });
        }

        [HttpPost("clear-all-data")]
        [HttpDelete("clear-all-data")]
        [HttpGet("clear-all-data")]
        public async Task<IActionResult> ClearAllData()
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM [OrderDetails];");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM [Orders];");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM [BookingTent];");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM [Bookings];");

                try
                {
                    await _context.Database.ExecuteSqlRawAsync("DBCC CHECKIDENT ('OrderDetails', RESEED, 0);");
                } catch {}
                try
                {
                    await _context.Database.ExecuteSqlRawAsync("DBCC CHECKIDENT ('Orders', RESEED, 0);");
                } catch {}
                try
                {
                    await _context.Database.ExecuteSqlRawAsync("DBCC CHECKIDENT ('Bookings', RESEED, 0);");
                } catch {}

                var tents = await _context.Tents.ToListAsync();
                foreach (var t in tents)
                {
                    t.Status = "Available";
                    t.IsQrUnlocked = false;
                }
                await _context.SaveChangesAsync();

                await _hubContext.Clients.All.SendAsync("TentStatusChanged");
                await _hubContext.Clients.All.SendAsync("BookingQrStatusChanged");
                await _hubContext.Clients.All.SendAsync("OrderUpdated");

                return Ok(new { message = "Đã xóa toàn bộ dữ liệu Bookings & Orders và reset bộ đếm ID về 1 thành công!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}
