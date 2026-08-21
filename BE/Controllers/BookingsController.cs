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
        public DateTime? CheckInDate { get; set; }
        public DateTime? CheckOutDate { get; set; }
        public decimal DepositAmount { get; set; } = 0;
        public string Note { get; set; } = string.Empty;

        public string BookingType { get; set; } = "Overnight"; // Overnight or Hourly
        public decimal HourlyFirstHourPrice { get; set; } = 100000;
        public decimal HourlyExtraHourPrice { get; set; } = 50000;
        public int EstimatedHours { get; set; } = 1;
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
                .AsNoTracking()
                .ToListAsync();
            return Ok(bookings);
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetBookingHistory(
            [FromQuery] int? zoneId,
            [FromQuery] int? tentId,
            [FromQuery] string? tentName,
            [FromQuery] string? status,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            var query = _context.Bookings
                .Include(b => b.Tents)
                .ThenInclude(t => t.Zone)
                .Include(b => b.Orders)
                .ThenInclude(o => o.OrderDetails)
                .ThenInclude(od => od.MenuItem)
                .AsQueryable();

            if (zoneId.HasValue)
                query = query.Where(b => b.Tents.Any(t => t.ZoneId == zoneId.Value));

            if (tentId.HasValue)
                query = query.Where(b => b.Tents.Any(t => t.Id == tentId.Value));

            if (!string.IsNullOrEmpty(tentName))
                query = query.Where(b => b.Tents.Any(t => t.Name.Contains(tentName)));

            if (!string.IsNullOrEmpty(status) && status != "All")
                query = query.Where(b => b.Status == status);

            if (fromDate.HasValue)
                query = query.Where(b => b.BookingTime >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(b => b.BookingTime <= toDate.Value.AddDays(1));

            var rawBookings = await query.OrderByDescending(b => b.BookingTime).ToListAsync();

            var result = rawBookings.Select(b => {
                var tentsList = b.Tents.Select(t => {
                    string rZone = t.Zone?.Name ?? "";
                    string rTent = t.Name ?? "";
                    bool isDiningTable = (t.Zone?.ZoneType == "DiningTable") || 
                                          (!string.IsNullOrEmpty(rZone) && (rZone.Contains("Bàn") || rZone.Contains("ẩm thực") || rZone.Contains("Ẩm thực"))) ||
                                          rTent.StartsWith("Bàn");
                    string tFormatted = rTent.StartsWith("Lều") || rTent.StartsWith("Bàn") 
                        ? rTent 
                        : (isDiningTable ? $"Bàn {rTent}" : $"Lều {rTent}");
                    string zFormatted = (!string.IsNullOrEmpty(rZone) && !rZone.StartsWith("Khu")) ? $"Khu {rZone}" : rZone;
                    string locName = !string.IsNullOrEmpty(zFormatted) ? $"{zFormatted} - {tFormatted}" : tFormatted;
                    return new {
                        id = t.Id,
                        name = rTent,
                        zoneName = rZone,
                        locationName = locName,
                        price = t.Price
                    };
                }).ToList();

                string combinedLocationName = string.Join(", ", tentsList.Select(t => t.locationName));
                decimal tentRentalFee = 0;

                if (b.BookingType != null && b.BookingType.Equals("Hourly", StringComparison.OrdinalIgnoreCase))
                {
                    var startTime = b.ActualCheckInDate ?? b.CheckInDate ?? b.BookingTime;
                    var endTime = b.ActualCheckOutDate ?? DateTime.Now;
                    var duration = endTime - startTime;

                    double totalHours = duration.TotalHours;
                    int roundedHours = Math.Max(1, (int)Math.Ceiling(totalHours));

                    foreach (var tent in b.Tents)
                    {
                        decimal fPrice = tent.HourlyPriceFirstHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceFirstHour.Value : (b.HourlyFirstHourPrice.GetValueOrDefault(0) > 0 ? b.HourlyFirstHourPrice.Value : 100000);
                        decimal ePrice = tent.HourlyPriceExtraHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceExtraHour.Value : (b.HourlyExtraHourPrice.GetValueOrDefault(0) > 0 ? b.HourlyExtraHourPrice.Value : 50000);

                        decimal tentFee = fPrice + (roundedHours > 1 ? (roundedHours - 1) * ePrice : 0);
                        tentRentalFee += tentFee;
                    }
                }
                else
                {
                    tentRentalFee = b.TotalPrice > 0 ? b.TotalPrice : tentsList.Sum(t => t.price);
                }

                decimal depositPaid = b.DepositAmount;

                var activeOrders = b.Orders.Where(o => o.Status != "Cancelled").ToList();
                var allOrderDetails = activeOrders.SelectMany(o => o.OrderDetails).Where(od => od.Status != "Cancelled").ToList();

                decimal foodAndServicesTotal = allOrderDetails.Sum(od => {
                    var unitPrice = od.UnitPrice > 0 ? od.UnitPrice : (od.MenuItem?.Price ?? 0);
                    return od.Quantity * unitPrice;
                });

                decimal grandTotal = tentRentalFee + foodAndServicesTotal;
                decimal remainingBalance = Math.Max(0, grandTotal - depositPaid);

                return new {
                    id = b.Id,
                    customerName = b.CustomerName,
                    phoneNumber = b.PhoneNumber,
                    status = b.Status,
                    bookingTime = b.BookingTime,
                    checkInDate = b.CheckInDate,
                    checkOutDate = b.CheckOutDate,
                    isQrUnlocked = b.IsQrUnlocked,
                    tentsCount = tentsList.Count,
                    tents = tentsList,
                    locationName = combinedLocationName,
                    tentRentalFee = tentRentalFee,
                    foodAndServicesTotal = foodAndServicesTotal,
                    depositPaid = depositPaid,
                    grandTotal = grandTotal,
                    remainingBalance = remainingBalance
                };
            }).ToList();

            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
        {
            var isHourly = dto.BookingType.Equals("Hourly", StringComparison.OrdinalIgnoreCase);

            var booking = new Booking
            {
                CustomerName = dto.CustomerName,
                PhoneNumber = dto.PhoneNumber,
                CheckInDate = dto.CheckInDate ?? DateTime.Now,
                CheckOutDate = isHourly ? null : dto.CheckOutDate,
                DepositAmount = dto.DepositAmount,
                BookingType = isHourly ? "Hourly" : "Overnight",
                HourlyFirstHourPrice = dto.HourlyFirstHourPrice > 0 ? dto.HourlyFirstHourPrice : 100000,
                HourlyExtraHourPrice = dto.HourlyExtraHourPrice > 0 ? dto.HourlyExtraHourPrice : 50000,
                EstimatedHours = dto.EstimatedHours > 0 ? dto.EstimatedHours : 1,
                Note = dto.Note ?? string.Empty,
                Status = "Booked"
            };
            
            var tents = await _context.Tents.Where(t => dto.TentIds.Contains(t.Id)).ToListAsync();
            foreach(var tent in tents)
            {
                booking.Tents.Add(tent);
                tent.Status = "Booked"; 
            }

            if (isHourly)
            {
                decimal totalHourlyPrice = 0;
                foreach (var tent in tents)
                {
                    decimal firstHour = tent.HourlyPriceFirstHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceFirstHour.Value : (dto.HourlyFirstHourPrice > 0 ? dto.HourlyFirstHourPrice : 100000);
                    totalHourlyPrice += firstHour;
                }
                booking.TotalPrice = totalHourlyPrice;
            }
            else
            {
                booking.TotalPrice = tents.Sum(t => t.Price);
            }
            
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

        [HttpGet("{id}/master-bill")]
        public async Task<IActionResult> GetMasterBill(int id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                    .ThenInclude(t => t.Zone)
                .Include(b => b.Orders)
                    .ThenInclude(o => o.OrderDetails)
                        .ThenInclude(od => od.MenuItem)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound("Không tìm thấy Booking.");

            var tentsList = booking.Tents.Select(t => {
                string rZone = t.Zone?.Name ?? "";
                string rTent = t.Name ?? "";
                bool isDiningTable = (t.Zone?.ZoneType == "DiningTable") || 
                                      (!string.IsNullOrEmpty(rZone) && (rZone.Contains("Bàn") || rZone.Contains("ẩm thực") || rZone.Contains("Ẩm thực"))) ||
                                      rTent.StartsWith("Bàn");
                string tFormatted = rTent.StartsWith("Lều") || rTent.StartsWith("Bàn") 
                    ? rTent 
                    : (isDiningTable ? $"Bàn {rTent}" : $"Lều {rTent}");
                string zFormatted = (!string.IsNullOrEmpty(rZone) && !rZone.StartsWith("Khu")) ? $"Khu {rZone}" : rZone;
                string locName = !string.IsNullOrEmpty(zFormatted) ? $"{zFormatted} - {tFormatted}" : tFormatted;
                return new {
                    id = t.Id,
                    name = rTent,
                    zoneName = rZone,
                    locationName = locName,
                    price = t.Price
                };
            }).ToList();

            string combinedLocationName = string.Join(", ", tentsList.Select(t => t.locationName));
            var firstTent = tentsList.FirstOrDefault();

            decimal tentRentalFee = booking.TotalPrice > 0 ? booking.TotalPrice : tentsList.Sum(t => t.price);
            decimal depositPaid = booking.DepositAmount;

            var activeOrders = booking.Orders.Where(o => o.Status != "Cancelled").ToList();
            var allOrderDetails = activeOrders.SelectMany(o => o.OrderDetails).Where(od => od.Status != "Cancelled").ToList();

            var itemSummaries = allOrderDetails
                .GroupBy(od => od.MenuItemId)
                .Select(g => {
                    var first = g.First();
                    var quantity = g.Sum(od => od.Quantity);
                    var unitPrice = first.UnitPrice > 0 ? first.UnitPrice : (first.MenuItem?.Price ?? 0);
                    return new {
                        menuItemId = first.MenuItemId,
                        name = first.MenuItem?.Name ?? "Món ăn/Dịch vụ",
                        quantity = quantity,
                        unitPrice = unitPrice,
                        totalPrice = quantity * unitPrice
                    };
                })
                .ToList();

            decimal foodAndServicesTotal = itemSummaries.Sum(i => i.totalPrice);
            decimal grandTotal = tentRentalFee + foodAndServicesTotal;
            decimal remainingBalance = Math.Max(0, grandTotal - depositPaid);

            return Ok(new {
                bookingId = booking.Id,
                customerName = booking.CustomerName,
                phoneNumber = booking.PhoneNumber,
                status = booking.Status,
                checkInDate = booking.CheckInDate,
                checkOutDate = booking.CheckOutDate,
                actualCheckInDate = booking.ActualCheckInDate,
                actualCheckOutDate = booking.ActualCheckOutDate,
                tentsCount = tentsList.Count,
                tents = tentsList,
                locationName = combinedLocationName,
                tent = new {
                    id = firstTent?.id,
                    name = firstTent?.name,
                    zoneName = firstTent?.zoneName,
                    locationName = combinedLocationName,
                    price = firstTent?.price ?? 0
                },
                tentRentalFee = tentRentalFee,
                depositPaid = depositPaid,
                foodAndServices = itemSummaries,
                foodAndServicesTotal = foodAndServicesTotal,
                grandTotal = grandTotal,
                remainingBalance = remainingBalance
            });
        }

        [HttpGet("master-bill-by-tent")]
        public async Task<IActionResult> GetMasterBillByTent([FromQuery] int? tentId, [FromQuery] string? tentName)
        {
            var allTents = await _context.Tents
                .Include(t => t.Zone)
                .Include(t => t.Bookings)
                    .ThenInclude(b => b.Orders)
                        .ThenInclude(o => o.OrderDetails)
                            .ThenInclude(od => od.MenuItem)
                .ToListAsync();

            Tent? targetTent = null;

            if (tentId.HasValue && tentId.Value > 0)
            {
                targetTent = allTents.FirstOrDefault(t => t.Id == tentId.Value);
            }
            
            if (targetTent == null && !string.IsNullOrWhiteSpace(tentName))
            {
                targetTent = OrdersController.FindMatchingTent(allTents, tentName);
            }

            if (targetTent == null)
            {
                return NotFound(new { message = "Không tìm thấy thông tin Lều / Bàn ăn." });
            }

            var activeBooking = targetTent.Bookings
                .Where(b => b.Status != "Cancelled" && b.Status != "CheckedOut")
                .OrderByDescending(b => b.BookingTime)
                .FirstOrDefault();

            if (activeBooking == null)
            {
                // Check if there are active unpaid orders for this Tent/Table directly
                var activeTableOrders = await _context.Orders
                    .Include(o => o.OrderDetails)
                        .ThenInclude(od => od.MenuItem)
                    .Where(o => o.TentId == targetTent.Id && o.Status != "Cancelled" && o.Status != "Paid")
                    .ToListAsync();

                if (activeTableOrders.Any())
                {
                    string rZone = targetTent.Zone?.Name ?? "";
                    string rTent = targetTent.Name ?? "";
                    string tFormatted = rTent.StartsWith("Bàn") || rTent.StartsWith("Lều") ? rTent : $"Bàn {rTent}";
                    string zFormatted = (!string.IsNullOrEmpty(rZone) && !rZone.StartsWith("Khu")) ? $"Khu {rZone}" : rZone;
                    string locName = !string.IsNullOrEmpty(zFormatted) ? $"{zFormatted} - {tFormatted}" : tFormatted;

                    var allDetails = activeTableOrders.SelectMany(o => o.OrderDetails).Where(od => od.Status != "Cancelled").ToList();
                    var itemSummaries = allDetails
                        .GroupBy(od => od.MenuItemId)
                        .Select(g => {
                            var first = g.First();
                            var quantity = g.Sum(od => od.Quantity);
                            var unitPrice = first.UnitPrice > 0 ? first.UnitPrice : (first.MenuItem?.Price ?? 0);
                            return new {
                                menuItemId = first.MenuItemId,
                                name = first.MenuItem?.Name ?? "Món ăn/Dịch vụ",
                                quantity = quantity,
                                unitPrice = unitPrice,
                                totalPrice = quantity * unitPrice
                            };
                        }).ToList();

                    decimal foodAndServicesTotal = itemSummaries.Sum(i => i.totalPrice);

                    return Ok(new {
                        bookingId = (int?)null,
                        customerName = "Khách Ăn Tại Bàn",
                        phoneNumber = "",
                        status = "Occupied",
                        checkInDate = DateTime.Now,
                        checkOutDate = (DateTime?)null,
                        tentsCount = 1,
                        tents = new[] { new { id = targetTent.Id, name = targetTent.Name, zoneName = rZone, locationName = locName, price = targetTent.Price } },
                        locationName = locName,
                        tent = new { id = targetTent.Id, name = targetTent.Name, zoneName = rZone, locationName = locName, price = targetTent.Price },
                        tentRentalFee = targetTent.Price,
                        depositPaid = 0m,
                        foodAndServices = itemSummaries,
                        foodAndServicesTotal = foodAndServicesTotal,
                        grandTotal = targetTent.Price + foodAndServicesTotal,
                        remainingBalance = targetTent.Price + foodAndServicesTotal
                    });
                }

                return NotFound(new { message = $"Lều/Bàn {targetTent.Name} hiện không có hóa đơn cần thanh toán." });
            }

            return await GetMasterBill(activeBooking.Id);
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
            booking.ActualCheckOutDate = DateTime.Now;

            foreach (var tent in booking.Tents)
            {
                tent.Status = "Available";
                tent.IsQrUnlocked = false;
                tent.MergedParentTentId = null;

                // Reset any child merged tables linked to this master table
                var childTables = await _context.Tents.Where(t => t.MergedParentTentId == tent.Id).ToListAsync();
                foreach (var child in childTables)
                {
                    child.MergedParentTentId = null;
                    child.Status = "Available";
                    child.IsQrUnlocked = false;
                }
            }

            foreach (var order in booking.Orders)
            {
                order.Status = "Paid";
                order.UpdatedAt = DateTime.UtcNow;
            }
            
            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("BookingQrStatusChanged");
            await _hubContext.Clients.All.SendAsync("OrderUpdated");
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
            if (!booking.ActualCheckInDate.HasValue)
            {
                booking.ActualCheckInDate = DateTime.Now;
            }

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
            
            // Sync tent physical status & QR lock for Manager view
            foreach (var tent in booking.Tents)
            {
                tent.IsQrUnlocked = booking.IsQrUnlocked;
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
