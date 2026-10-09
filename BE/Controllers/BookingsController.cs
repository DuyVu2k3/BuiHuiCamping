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

        public string? TentSetupDetails { get; set; } = string.Empty;
        public string? TentSetupSummary { get; set; } = string.Empty;
    }

    public class OnlineBookingDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public List<int> TentIds { get; set; } = new List<int>();
        public DateTime? CheckInDate { get; set; }
        public DateTime? CheckOutDate { get; set; }
        public decimal DepositAmount { get; set; }
        public string? BookingType { get; set; } // Overnight or Hourly
        public string? TentSetupDetails { get; set; }
        public string? TentSetupSummary { get; set; }
    }

    public class RequestCheckoutDto
    {
        public int? TentId { get; set; }
        public string TentName { get; set; } = string.Empty;
    }

    public class AssignedQrCardDto
    {
        public string CardCode { get; set; } = string.Empty;
        public string? AssignedTo { get; set; } = string.Empty;
        public string? Note { get; set; } = string.Empty;
        public bool IsUnlocked { get; set; } = true;
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }

    public class AssignQrCardRequestDto
    {
        public string CardCode { get; set; } = string.Empty;
        public string? AssignedTo { get; set; } = string.Empty;
        public string? Note { get; set; } = string.Empty;
        public bool IsUnlocked { get; set; } = true;
    }

    public class ToggleQrCardRequestDto
    {
        public string CardCode { get; set; } = string.Empty;
        public bool? IsUnlocked { get; set; }
    }

    public class UpdateTentSetupDto
    {
        public string TentSetupDetails { get; set; } = string.Empty;
        public string TentSetupSummary { get; set; } = string.Empty;
        public decimal? NewTotalPrice { get; set; }
        public string? Reason { get; set; }
        public bool AutoCheckIn { get; set; } = false;
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

        [HttpGet("{id}")]
        public async Task<IActionResult> GetBooking(int id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                    .ThenInclude(t => t.Zone)
                .Include(b => b.Orders)
                    .ThenInclude(o => o.OrderDetails)
                        .ThenInclude(od => od.MenuItem)
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound("Không tìm thấy đơn đặt.");
            return Ok(booking);
        }

        [HttpGet("pending-requests")]
        public async Task<IActionResult> GetPendingBookingRequests()
        {
            var pendingBookings = await _context.Bookings
                .Include(b => b.Tents)
                .ThenInclude(t => t.Zone)
                .Where(b => b.Status == "Pending")
                .OrderByDescending(b => b.BookingTime)
                .AsNoTracking()
                .ToListAsync();

            var result = pendingBookings.Select(b => {
                var tentDetails = b.Tents.Select(t => {
                    var zoneName = t.Zone?.Name ?? "Khu Cắm Trại";
                    return $"{zoneName} (Lều {t.Name})";
                });

                return new {
                    bookingId = b.Id,
                    customerName = b.CustomerName,
                    phoneNumber = b.PhoneNumber,
                    tentsList = string.Join(", ", tentDetails),
                    checkInDate = b.CheckInDate,
                    checkOutDate = b.CheckOutDate,
                    bookingTime = b.BookingTime,
                    depositAmount = b.DepositAmount,
                    bookingType = b.BookingType,
                    totalPrice = b.TotalPrice
                };
            });

            return Ok(result);
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
                    int roundedHours = CalculateHourlyBilledHours(startTime, endTime);

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
                    bookingType = b.BookingType,
                    checkInDate = b.CheckInDate,
                    checkOutDate = b.CheckOutDate,
                    actualCheckInDate = b.ActualCheckInDate,
                    actualCheckOutDate = b.ActualCheckOutDate,
                    estimatedHours = b.EstimatedHours,
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
                CheckOutDate = dto.CheckOutDate ?? (isHourly ? (dto.CheckInDate ?? DateTime.Now).AddHours(dto.EstimatedHours > 0 ? dto.EstimatedHours : 1) : (dto.CheckInDate ?? DateTime.Now).AddDays(1)),
                DepositAmount = dto.DepositAmount,
                BookingType = isHourly ? "Hourly" : "Overnight",
                HourlyFirstHourPrice = dto.HourlyFirstHourPrice > 0 ? dto.HourlyFirstHourPrice : 100000,
                HourlyExtraHourPrice = dto.HourlyExtraHourPrice > 0 ? dto.HourlyExtraHourPrice : 50000,
                EstimatedHours = dto.EstimatedHours > 0 ? dto.EstimatedHours : 1,
                Note = dto.Note ?? string.Empty,
                TentSetupDetails = dto.TentSetupDetails ?? string.Empty,
                TentSetupSummary = dto.TentSetupSummary ?? string.Empty,
                Status = "Booked"
            };
            
            var tents = await _context.Tents.Where(t => dto.TentIds.Contains(t.Id)).ToListAsync();
            foreach(var tent in tents)
            {
                booking.Tents.Add(tent);
                if (tent.Status != "Occupied")
                {
                    tent.Status = "Booked";
                }
            }

            // Calculate pricing dynamically based on configured physical tents if provided
            bool pricingCalculatedFromSetup = false;
            if (!string.IsNullOrEmpty(dto.TentSetupDetails))
            {
                try
                {
                    var items = System.Text.Json.JsonSerializer.Deserialize<List<TentSetupItemDto>>(dto.TentSetupDetails, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (items != null && items.Count > 0)
                    {
                        if (isHourly)
                        {
                            decimal sumFirst = items.Sum(i => (i.HourlyFirstHourPrice > 0 ? i.HourlyFirstHourPrice : 100000) * i.Quantity);
                            decimal sumExtra = items.Sum(i => (i.HourlyExtraHourPrice > 0 ? i.HourlyExtraHourPrice : 50000) * i.Quantity);
                            if (sumFirst > 0) booking.HourlyFirstHourPrice = sumFirst;
                            if (sumExtra > 0) booking.HourlyExtraHourPrice = sumExtra;

                            var start = dto.CheckInDate ?? DateTime.Now;
                            var end = dto.CheckOutDate ?? start.AddHours(dto.EstimatedHours > 0 ? dto.EstimatedHours : 1);
                            var diffHours = Math.Max(1, (int)Math.Ceiling((end - start).TotalHours));
                            booking.EstimatedHours = diffHours;
                            booking.TotalPrice = sumFirst + (diffHours > 1 ? (diffHours - 1) * sumExtra : 0);
                        }
                        else
                        {
                            decimal sumPerNight = items.Sum(i => (i.Price > 0 ? i.Price : 500000) * i.Quantity);
                            var start = dto.CheckInDate ?? DateTime.Now;
                            var end = dto.CheckOutDate ?? start.AddDays(1);
                            var nights = Math.Max(1, (int)Math.Ceiling((end.Date - start.Date).TotalDays));
                            booking.TotalPrice = sumPerNight * nights;
                        }
                        pricingCalculatedFromSetup = true;
                    }
                }
                catch {}
            }

            if (!pricingCalculatedFromSetup)
            {
                if (isHourly)
                {
                    var start = dto.CheckInDate ?? DateTime.Now;
                    var end = dto.CheckOutDate ?? start.AddHours(dto.EstimatedHours > 0 ? dto.EstimatedHours : 1);
                    var diffHours = Math.Max(1, (int)Math.Ceiling((end - start).TotalHours));
                    booking.EstimatedHours = diffHours;

                    decimal totalHourlyPrice = 0;
                    foreach (var tent in tents)
                    {
                        decimal firstHour = tent.HourlyPriceFirstHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceFirstHour.Value : (dto.HourlyFirstHourPrice > 0 ? dto.HourlyFirstHourPrice : 100000);
                        decimal extraHour = tent.HourlyPriceExtraHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceExtraHour.Value : (dto.HourlyExtraHourPrice > 0 ? dto.HourlyExtraHourPrice : 50000);
                        totalHourlyPrice += firstHour + (diffHours > 1 ? (diffHours - 1) * extraHour : 0);
                    }
                    booking.TotalPrice = totalHourlyPrice;
                }
                else
                {
                    var start = dto.CheckInDate ?? DateTime.Now;
                    var end = dto.CheckOutDate ?? start.AddDays(1);
                    var nights = Math.Max(1, (int)Math.Ceiling((end.Date - start.Date).TotalDays));
                    booking.TotalPrice = tents.Sum(t => t.Price) * nights;
                }
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

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("TentTypesUpdated");

            return Ok(booking);
        }

        [HttpPost("online-booking")]
        public async Task<IActionResult> CreateOnlineBooking([FromBody] OnlineBookingDto dto)
        {
            string resolvedBookingType = "Overnight";
            if (!string.IsNullOrEmpty(dto.BookingType))
            {
                resolvedBookingType = (dto.BookingType.ToLower().Contains("hour") || dto.BookingType.ToLower().Contains("day")) ? "Hourly" : "Overnight";
            }
            else if (dto.CheckInDate.HasValue && dto.CheckOutDate.HasValue && dto.CheckInDate.Value.Date == dto.CheckOutDate.Value.Date)
            {
                resolvedBookingType = "Hourly";
            }

            var booking = new Booking
            {
                CustomerName = dto.CustomerName,
                PhoneNumber = dto.PhoneNumber,
                CheckInDate = dto.CheckInDate,
                CheckOutDate = dto.CheckOutDate,
                DepositAmount = dto.DepositAmount,
                DepositStatus = "Paid",
                Status = "Booked",
                BookingType = resolvedBookingType
            };
            
            var tents = await _context.Tents.Where(t => dto.TentIds.Contains(t.Id)).ToListAsync();
            foreach(var tent in tents)
            {
                booking.Tents.Add(tent);
                tent.Status = "Booked"; 
            }

            if (resolvedBookingType == "Hourly")
            {
                var start = dto.CheckInDate ?? DateTime.Now;
                var end = dto.CheckOutDate ?? start.AddHours(1);
                var diffHours = Math.Max(1, (int)Math.Ceiling((end - start).TotalHours));
                booking.EstimatedHours = diffHours;
                booking.HourlyFirstHourPrice = 100000;
                booking.HourlyExtraHourPrice = 50000;

                decimal totalHourlyPrice = 0;
                foreach (var tent in tents)
                {
                    decimal firstHour = tent.HourlyPriceFirstHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceFirstHour.Value : 100000;
                    decimal extraHour = tent.HourlyPriceExtraHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceExtraHour.Value : 50000;
                    totalHourlyPrice += firstHour + (diffHours > 1 ? (diffHours - 1) * extraHour : 0);
                }
                booking.TotalPrice = totalHourlyPrice;
            }
            else
            {
                var start = dto.CheckInDate ?? DateTime.Now;
                var end = dto.CheckOutDate ?? start.AddDays(1);
                var nights = Math.Max(1, (int)Math.Ceiling((end.Date - start.Date).TotalDays));
                booking.TotalPrice = tents.Sum(t => t.Price) * nights;
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

    public class ConfirmDepositDto
    {
        public decimal DepositAmount { get; set; }
        public List<int>? FinalTentIds { get; set; }
    }

        [HttpPost("online-booking-request")]
        public async Task<IActionResult> CreateOnlineBookingRequest([FromBody] OnlineBookingDto dto)
        {
            string resolvedBookingType = "Overnight";
            if (!string.IsNullOrEmpty(dto.BookingType))
            {
                resolvedBookingType = (dto.BookingType.ToLower().Contains("hour") || dto.BookingType.ToLower().Contains("day")) ? "Hourly" : "Overnight";
            }
            else if (dto.CheckInDate.HasValue && dto.CheckOutDate.HasValue && dto.CheckInDate.Value.Date == dto.CheckOutDate.Value.Date)
            {
                resolvedBookingType = "Hourly";
            }

            var booking = new Booking
            {
                CustomerName = dto.CustomerName,
                PhoneNumber = dto.PhoneNumber,
                CheckInDate = dto.CheckInDate,
                CheckOutDate = dto.CheckOutDate,
                DepositAmount = dto.DepositAmount,
                DepositStatus = "Pending",
                Status = "Pending",
                BookingType = resolvedBookingType
            };
            
            var tents = await _context.Tents.Include(t => t.Zone).Where(t => dto.TentIds.Contains(t.Id)).ToListAsync();
            foreach(var tent in tents)
            {
                booking.Tents.Add(tent);
            }

            if (resolvedBookingType == "Hourly")
            {
                var start = dto.CheckInDate ?? DateTime.Now;
                var end = dto.CheckOutDate ?? start.AddHours(1);
                var diffHours = Math.Max(1, (int)Math.Ceiling((end - start).TotalHours));
                booking.EstimatedHours = diffHours;
                booking.HourlyFirstHourPrice = 100000;
                booking.HourlyExtraHourPrice = 50000;

                decimal totalHourlyPrice = 0;
                foreach (var tent in tents)
                {
                    decimal firstHour = tent.HourlyPriceFirstHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceFirstHour.Value : 100000;
                    decimal extraHour = tent.HourlyPriceExtraHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceExtraHour.Value : 50000;
                    totalHourlyPrice += firstHour + (diffHours > 1 ? (diffHours - 1) * extraHour : 0);
                }
                booking.TotalPrice = totalHourlyPrice;
            }
            else
            {
                var start = dto.CheckInDate ?? DateTime.Now;
                var end = dto.CheckOutDate ?? start.AddDays(1);
                var nights = Math.Max(1, (int)Math.Ceiling((end.Date - start.Date).TotalDays));
                booking.TotalPrice = tents.Sum(t => t.Price) * nights;
            }
            
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

            if (!string.IsNullOrEmpty(booking.TentSetupDetails))
            {
                try
                {
                    var items = System.Text.Json.JsonSerializer.Deserialize<List<TentSetupItemDto>>(booking.TentSetupDetails, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (items != null && items.Count > 0)
                    {
                        if (booking.BookingType == "Hourly")
                        {
                            decimal sumFirst = items.Sum(i => (i.HourlyFirstHourPrice > 0 ? i.HourlyFirstHourPrice : 100000) * i.Quantity);
                            decimal sumExtra = items.Sum(i => (i.HourlyExtraHourPrice > 0 ? i.HourlyExtraHourPrice : 50000) * i.Quantity);
                            var diffHours = booking.EstimatedHours.GetValueOrDefault(1);
                            booking.TotalPrice = sumFirst + (diffHours > 1 ? (diffHours - 1) * sumExtra : 0);
                        }
                        else
                        {
                            decimal sumPerNight = items.Sum(i => (i.Price > 0 ? i.Price : 500000) * i.Quantity);
                            var start = booking.CheckInDate ?? DateTime.Now;
                            var end = booking.CheckOutDate ?? start.AddDays(1);
                            var nights = Math.Max(1, (int)Math.Ceiling((end.Date - start.Date).TotalDays));
                            booking.TotalPrice = sumPerNight * nights;
                        }
                    }
                }
                catch {}
            }
            else if (booking.BookingType == "Hourly")
            {
                var start = booking.CheckInDate ?? DateTime.Now;
                var end = booking.CheckOutDate ?? start.AddHours(booking.EstimatedHours.GetValueOrDefault(1));
                var diffHours = Math.Max(1, (int)Math.Ceiling((end - start).TotalHours));
                booking.EstimatedHours = diffHours;

                decimal totalHourlyPrice = 0;
                foreach (var tent in booking.Tents)
                {
                    decimal fPrice = tent.HourlyPriceFirstHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceFirstHour.Value : (booking.HourlyFirstHourPrice.GetValueOrDefault(0) > 0 ? booking.HourlyFirstHourPrice.Value : 100000);
                    decimal ePrice = tent.HourlyPriceExtraHour.GetValueOrDefault(0) > 0 ? tent.HourlyPriceExtraHour.Value : (booking.HourlyExtraHourPrice.GetValueOrDefault(0) > 0 ? booking.HourlyExtraHourPrice.Value : 50000);
                    totalHourlyPrice += fPrice + (diffHours > 1 ? (diffHours - 1) * ePrice : 0);
                }
                booking.TotalPrice = totalHourlyPrice;
            }
            else
            {
                var start = booking.CheckInDate ?? DateTime.Now;
                var end = booking.CheckOutDate ?? start.AddDays(1);
                var nights = Math.Max(1, (int)Math.Ceiling((end.Date - start.Date).TotalDays));
                booking.TotalPrice = booking.Tents.Sum(t => t.Price) * nights;
            }

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
            await _hubContext.Clients.All.SendAsync("TentTypesUpdated");
            return Ok(booking);
        }

        private static int CalculateHourlyBilledHours(DateTime startTime, DateTime endTime)
        {
            var duration = endTime - startTime;
            double totalMinutes = Math.Max(0, duration.TotalMinutes);
            if (totalMinutes <= 60)
            {
                return 1;
            }
            int fullHours = (int)(totalMinutes / 60);
            double extraMinutes = totalMinutes % 60;
            if (extraMinutes > 30)
            {
                return fullHours + 1;
            }
            return Math.Max(1, fullHours);
        }

        private static (decimal firstHourRate, decimal extraHourRate) GetHourlyRates(Booking booking)
        {
            decimal firstHourRate = 0;
            decimal extraHourRate = 0;

            if (!string.IsNullOrEmpty(booking.TentSetupDetails))
            {
                try
                {
                    var items = System.Text.Json.JsonSerializer.Deserialize<List<TentSetupItemDto>>(
                        booking.TentSetupDetails,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );
                    if (items != null && items.Count > 0)
                    {
                        firstHourRate = items.Sum(i => (i.HourlyFirstHourPrice > 0 ? i.HourlyFirstHourPrice : 100000) * i.Quantity);
                        extraHourRate = items.Sum(i => (i.HourlyExtraHourPrice > 0 ? i.HourlyExtraHourPrice : 50000) * i.Quantity);
                    }
                }
                catch {}
            }

            if (firstHourRate <= 0)
            {
                firstHourRate = booking.HourlyFirstHourPrice.GetValueOrDefault(0) > 0
                    ? booking.HourlyFirstHourPrice.Value
                    : (booking.Tents.Any() ? booking.Tents.Sum(t => t.HourlyPriceFirstHour.GetValueOrDefault(0) > 0 ? t.HourlyPriceFirstHour.Value : 100000) : 100000);
            }

            if (extraHourRate <= 0)
            {
                extraHourRate = booking.HourlyExtraHourPrice.GetValueOrDefault(0) > 0
                    ? booking.HourlyExtraHourPrice.Value
                    : (booking.Tents.Any() ? booking.Tents.Sum(t => t.HourlyPriceExtraHour.GetValueOrDefault(0) > 0 ? t.HourlyPriceExtraHour.Value : 50000) : 50000);
            }

            return (firstHourRate, extraHourRate);
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

            string resolvedBookingType = booking.BookingType;
            if (string.IsNullOrEmpty(resolvedBookingType))
            {
                resolvedBookingType = (booking.CheckInDate.HasValue && booking.CheckOutDate.HasValue && booking.CheckInDate.Value.Date == booking.CheckOutDate.Value.Date) ? "Hourly" : "Overnight";
            }

            decimal tentRentalFee = 0;
            int totalHourlyDuration = 0;
            bool isHourlyBooking = resolvedBookingType.Equals("Hourly", StringComparison.OrdinalIgnoreCase);

            var startTime = booking.ActualCheckInDate ?? booking.CheckInDate ?? booking.BookingTime;
            var endTime = (booking.Status == "CheckedOut" ? booking.ActualCheckOutDate : null) ?? DateTime.Now;

            if (isHourlyBooking)
            {
                if (booking.Status == "Occupied" || booking.Status == "CheckedOut")
                {
                    totalHourlyDuration = CalculateHourlyBilledHours(startTime, endTime);
                }
                else
                {
                    totalHourlyDuration = Math.Max(1, booking.EstimatedHours.GetValueOrDefault(1));
                }

                var (fPrice, ePrice) = GetHourlyRates(booking);
                decimal calculatedHourlyPrice = fPrice + (totalHourlyDuration > 1 ? (totalHourlyDuration - 1) * ePrice : 0);

                if (booking.Status == "Occupied" || booking.Status == "CheckedOut")
                {
                    tentRentalFee = calculatedHourlyPrice;
                }
                else
                {
                    tentRentalFee = booking.TotalPrice > 0 ? booking.TotalPrice : calculatedHourlyPrice;
                }
            }
            else
            {
                var inDate = booking.CheckInDate ?? DateTime.Now;
                var outDate = booking.CheckOutDate ?? inDate.AddDays(1);
                var nights = Math.Max(1, (int)Math.Ceiling((outDate.Date - inDate.Date).TotalDays));
                tentRentalFee = booking.TotalPrice > 0 ? booking.TotalPrice : booking.Tents.Sum(t => t.Price) * nights;
            }

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

                decimal calculatedPrice = t.Price;
                if (isHourlyBooking)
                {
                    calculatedPrice = booking.Tents.Count > 0 ? Math.Round(tentRentalFee / booking.Tents.Count) : tentRentalFee;
                }

                return new {
                    id = t.Id,
                    name = rTent,
                    zoneName = rZone,
                    locationName = locName,
                    price = calculatedPrice
                };
            }).ToList();

            string combinedLocationName = string.Join(", ", tentsList.Select(t => t.locationName));
            var firstTent = tentsList.FirstOrDefault();
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

            var effectiveCheckOutDate = (booking.Status == "CheckedOut" ? booking.ActualCheckOutDate : null) ?? DateTime.Now;
            var actualDurationMinutes = Math.Max(0, (int)(endTime - startTime).TotalMinutes);

            return Ok(new {
                bookingId = booking.Id,
                customerName = booking.CustomerName,
                phoneNumber = booking.PhoneNumber,
                status = booking.Status,
                bookingType = resolvedBookingType,
                hourlyDurationHours = totalHourlyDuration,
                checkInDate = booking.CheckInDate,
                checkOutDate = booking.CheckOutDate,
                actualCheckInDate = booking.ActualCheckInDate,
                actualCheckOutDate = booking.ActualCheckOutDate,
                effectiveCheckOutDate = effectiveCheckOutDate,
                actualDurationMinutes = actualDurationMinutes,
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
                remainingBalance = remainingBalance,
                tentSetupDetails = booking.TentSetupDetails,
                tentSetupSummary = booking.TentSetupSummary
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

                    var nowTime = DateTime.Now;
                    return Ok(new {
                        bookingId = (int?)null,
                        customerName = "Khách Ăn Tại Bàn",
                        phoneNumber = "",
                        status = "Occupied",
                        checkInDate = nowTime,
                        checkOutDate = (DateTime?)null,
                        actualCheckInDate = nowTime,
                        actualCheckOutDate = (DateTime?)null,
                        effectiveCheckOutDate = nowTime,
                        actualDurationMinutes = 0,
                        hourlyDurationHours = 1,
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

            string resolvedBookingType = booking.BookingType;
            if (string.IsNullOrEmpty(resolvedBookingType))
            {
                resolvedBookingType = (booking.CheckInDate.HasValue && booking.CheckOutDate.HasValue && booking.CheckInDate.Value.Date == booking.CheckOutDate.Value.Date) ? "Hourly" : "Overnight";
            }

            if (resolvedBookingType.Equals("Hourly", StringComparison.OrdinalIgnoreCase))
            {
                var startTime = booking.ActualCheckInDate ?? booking.CheckInDate ?? booking.BookingTime;
                var endTime = booking.ActualCheckOutDate.Value;
                int billedHours = CalculateHourlyBilledHours(startTime, endTime);
                var (firstHourRate, extraHourRate) = GetHourlyRates(booking);
                decimal finalPrice = firstHourRate + (billedHours > 1 ? (billedHours - 1) * extraHourRate : 0);
                booking.EstimatedHours = billedHours;
                booking.TotalPrice = finalPrice;
            }

            // Automatically return all assigned physical QR business cards back to warehouse inventory
            if (!string.IsNullOrWhiteSpace(booking.AssignedQrCards))
            {
                try
                {
                    var cards = System.Text.Json.JsonSerializer.Deserialize<List<AssignedQrCardDto>>(
                        booking.AssignedQrCards,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );
                    if (cards != null && cards.Any())
                    {
                        var codes = cards.Select(c => c.CardCode.ToUpper()).ToList();
                        var dbCards = await _context.QrCards.Where(q => codes.Contains(q.CardCode.ToUpper())).ToListAsync();
                        foreach (var dc in dbCards)
                        {
                            dc.Status = "Available";
                            dc.CurrentBookingId = null;
                            dc.AssignedPlacement = null;
                            dc.UpdatedAt = DateTime.UtcNow;
                        }

                        foreach (var c in cards) c.IsUnlocked = false;
                        booking.AssignedQrCards = System.Text.Json.JsonSerializer.Serialize(cards);
                    }
                }
                catch {}
            }

            foreach (var tent in booking.Tents)
            {
                // Safely recalculate status for this slot based on other active bookings
                var remainingActive = await _context.Bookings
                    .Where(b => b.Id != booking.Id && (b.Status == "Occupied" || b.Status == "Booked" || b.Status == "Pending") && b.Tents.Any(t => t.Id == tent.Id))
                    .ToListAsync();

                if (remainingActive.Any(b => b.Status == "Occupied"))
                {
                    tent.Status = "Occupied";
                }
                else if (remainingActive.Any(b => b.Status == "Booked" || b.Status == "Pending"))
                {
                    tent.Status = "Booked";
                }
                else
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
            }

            foreach (var order in booking.Orders)
            {
                order.Status = "Paid";
                order.UpdatedAt = DateTime.UtcNow;
            }
            
            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("TentTypesUpdated");
            await _hubContext.Clients.All.SendAsync("BookingQrStatusChanged");
            await _hubContext.Clients.All.SendAsync("OrderUpdated");
            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");
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
                tent.Status = "Occupied";

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

        [HttpPut("{id}/update-tent-setup")]
        public async Task<IActionResult> UpdateTentSetup(int id, [FromBody] UpdateTentSetupDto dto)
        {
            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .Include(b => b.Orders)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đơn đặt!" });

            if (booking.Status == "CheckedOut" || booking.Status == "Cancelled" || booking.Status == "Occupied")
            {
                return BadRequest(new { message = "Không thể thay đổi quy cách lều khi khách đang ở (Occupied), đã trả phòng hoặc đã hủy!" });
            }

            booking.TentSetupDetails = dto?.TentSetupDetails ?? string.Empty;
            booking.TentSetupSummary = dto?.TentSetupSummary ?? string.Empty;

            // Recalculate price
            if (dto?.NewTotalPrice.HasValue == true && dto.NewTotalPrice.Value > 0)
            {
                booking.TotalPrice = dto.NewTotalPrice.Value;
            }
            else if (!string.IsNullOrEmpty(dto?.TentSetupDetails))
            {
                try
                {
                    var items = System.Text.Json.JsonSerializer.Deserialize<List<TentSetupItemDto>>(dto.TentSetupDetails, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (items != null && items.Count > 0)
                    {
                        if (booking.BookingType == "Hourly")
                        {
                            decimal sumFirst = items.Sum(i => (i.HourlyFirstHourPrice > 0 ? i.HourlyFirstHourPrice : 100000) * i.Quantity);
                            decimal sumExtra = items.Sum(i => (i.HourlyExtraHourPrice > 0 ? i.HourlyExtraHourPrice : 50000) * i.Quantity);
                            booking.HourlyFirstHourPrice = sumFirst;
                            booking.HourlyExtraHourPrice = sumExtra;
                            var diffHours = booking.EstimatedHours.GetValueOrDefault(1);
                            booking.TotalPrice = sumFirst + (diffHours > 1 ? (diffHours - 1) * sumExtra : 0);
                        }
                        else
                        {
                            decimal sumPerNight = items.Sum(i => (i.Price > 0 ? i.Price : 500000) * i.Quantity);
                            var start = booking.CheckInDate ?? DateTime.Now;
                            var end = booking.CheckOutDate ?? start.AddDays(1);
                            var nights = Math.Max(1, (int)Math.Ceiling((end.Date - start.Date).TotalDays));
                            booking.TotalPrice = sumPerNight * nights;
                        }
                    }
                }
                catch {}
            }

            // Append audit log to Note
            var timestamp = DateTime.Now.ToString("dd/MM HH:mm");
            var noteMsg = $"[{timestamp} Lễ tân đổi lều: {booking.TentSetupSummary}]";
            if (!string.IsNullOrWhiteSpace(dto?.Reason))
            {
                noteMsg += $" (Lý do: {dto.Reason.Trim()})";
            }
            booking.Note = string.IsNullOrWhiteSpace(booking.Note) ? noteMsg : $"{booking.Note}\n{noteMsg}";

            // Optional auto checkin
            if (dto?.AutoCheckIn == true && booking.Status == "Booked")
            {
                booking.Status = "Occupied";
                if (!booking.ActualCheckInDate.HasValue)
                {
                    booking.ActualCheckInDate = DateTime.Now;
                }

                foreach (var tent in booking.Tents)
                {
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
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentTypesUpdated");
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("OrderUpdated");

            return Ok(new {
                message = "Cập nhật quy cách lều thành công!",
                booking = booking
            });
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

        [HttpGet("active-qr-cards")]
        public async Task<IActionResult> GetActiveQrCards()
        {
            var activeBookings = await _context.Bookings
                .Include(b => b.Tents)
                .Where(b => b.Status == "Booked" || b.Status == "Occupied")
                .AsNoTracking()
                .ToListAsync();

            var list = new List<object>();
            foreach (var b in activeBookings)
            {
                if (string.IsNullOrWhiteSpace(b.AssignedQrCards)) continue;
                try
                {
                    var cards = System.Text.Json.JsonSerializer.Deserialize<List<AssignedQrCardDto>>(
                        b.AssignedQrCards, 
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );
                    if (cards != null)
                    {
                        foreach (var c in cards)
                        {
                            list.Add(new {
                                cardCode = c.CardCode,
                                bookingId = b.Id,
                                customerName = b.CustomerName,
                                assignedTo = c.AssignedTo,
                                note = c.Note,
                                isUnlocked = c.IsUnlocked,
                                assignedAt = c.AssignedAt
                            });
                        }
                    }
                }
                catch {}
            }
            return Ok(list);
        }

        [HttpPost("{id}/assign-qr-card")]
        public async Task<IActionResult> AssignQrCard(int id, [FromBody] AssignQrCardRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.CardCode))
                return BadRequest("Mã thẻ QR không được để trống.");

            var cleanCardCode = dto.CardCode.Trim().ToUpper();

            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound("Không tìm thấy đơn đặt.");

            // Check if card is currently assigned to another active booking
            var otherActive = await _context.Bookings
                .Where(b => b.Id != id && (b.Status == "Booked" || b.Status == "Occupied") && !string.IsNullOrEmpty(b.AssignedQrCards))
                .ToListAsync();

            foreach (var ob in otherActive)
            {
                try
                {
                    var obCards = System.Text.Json.JsonSerializer.Deserialize<List<AssignedQrCardDto>>(
                        ob.AssignedQrCards!,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );
                    if (obCards != null && obCards.Any(c => c.CardCode.Equals(cleanCardCode, StringComparison.OrdinalIgnoreCase)))
                    {
                        return BadRequest($"Thẻ '{cleanCardCode}' hiện đang được gán cho đơn của khách {ob.CustomerName} (Booking #{ob.Id}). Vui lòng thu hồi thẻ trước.");
                    }
                }
                catch {}
            }

            // Parse existing cards of this booking
            var cards = new List<AssignedQrCardDto>();
            if (!string.IsNullOrWhiteSpace(booking.AssignedQrCards))
            {
                try
                {
                    cards = System.Text.Json.JsonSerializer.Deserialize<List<AssignedQrCardDto>>(
                        booking.AssignedQrCards,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    ) ?? new List<AssignedQrCardDto>();
                }
                catch
                {
                    cards = new List<AssignedQrCardDto>();
                }
            }

            var existing = cards.FirstOrDefault(c => c.CardCode.Equals(cleanCardCode, StringComparison.OrdinalIgnoreCase));
            if (existing != null)
            {
                existing.AssignedTo = dto.AssignedTo ?? existing.AssignedTo;
                existing.Note = dto.Note ?? existing.Note;
                existing.IsUnlocked = dto.IsUnlocked;
            }
            else
            {
                cards.Add(new AssignedQrCardDto
                {
                    CardCode = cleanCardCode,
                    AssignedTo = dto.AssignedTo ?? string.Empty,
                    Note = dto.Note ?? string.Empty,
                    IsUnlocked = dto.IsUnlocked,
                    AssignedAt = DateTime.UtcNow
                });
            }

            booking.AssignedQrCards = System.Text.Json.JsonSerializer.Serialize(cards);

            // Sync booking overall IsQrUnlocked
            booking.IsQrUnlocked = cards.Any(c => c.IsUnlocked);
            foreach (var tent in booking.Tents)
            {
                tent.IsQrUnlocked = booking.IsQrUnlocked;
            }

            // Sync with QrCards inventory table
            var qrCard = await _context.QrCards.FirstOrDefaultAsync(q => q.CardCode.ToUpper() == cleanCardCode);
            if (qrCard != null)
            {
                qrCard.Status = "Assigned";
                qrCard.CurrentBookingId = booking.Id;
                qrCard.AssignedPlacement = dto.AssignedTo;
                qrCard.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _context.QrCards.Add(new QrCard
                {
                    CardCode = cleanCardCode,
                    Status = "Assigned",
                    CurrentBookingId = booking.Id,
                    AssignedPlacement = dto.AssignedTo,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("BookingQrStatusChanged", new { bookingId = booking.Id, isQrUnlocked = booking.IsQrUnlocked });
            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");

            return Ok(new {
                message = $"Đã gán thẻ QR '{cleanCardCode}' thành công!",
                cards = cards,
                bookingId = booking.Id,
                isQrUnlocked = booking.IsQrUnlocked
            });
        }

        [HttpPost("{id}/toggle-qr-card")]
        public async Task<IActionResult> ToggleQrCard(int id, [FromBody] ToggleQrCardRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.CardCode))
                return BadRequest("Mã thẻ QR không được để trống.");

            var cleanCardCode = dto.CardCode.Trim().ToUpper();

            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound("Không tìm thấy đơn đặt.");

            var cards = new List<AssignedQrCardDto>();
            if (!string.IsNullOrWhiteSpace(booking.AssignedQrCards))
            {
                try
                {
                    cards = System.Text.Json.JsonSerializer.Deserialize<List<AssignedQrCardDto>>(
                        booking.AssignedQrCards,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    ) ?? new List<AssignedQrCardDto>();
                }
                catch {}
            }

            var card = cards.FirstOrDefault(c => c.CardCode.Equals(cleanCardCode, StringComparison.OrdinalIgnoreCase));
            if (card == null)
            {
                return NotFound($"Không tìm thấy thẻ '{cleanCardCode}' trong đơn này.");
            }

            card.IsUnlocked = dto.IsUnlocked.HasValue ? dto.IsUnlocked.Value : !card.IsUnlocked;
            booking.AssignedQrCards = System.Text.Json.JsonSerializer.Serialize(cards);

            // Booking level IsQrUnlocked is true if at least one card is unlocked
            booking.IsQrUnlocked = cards.Any(c => c.IsUnlocked);
            foreach (var tent in booking.Tents)
            {
                tent.IsQrUnlocked = booking.IsQrUnlocked;
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("BookingQrStatusChanged", new { bookingId = booking.Id, isQrUnlocked = booking.IsQrUnlocked });

            return Ok(new {
                message = card.IsUnlocked ? $"Thẻ QR '{cleanCardCode}' đã được MỞ KHÓA!" : $"Thẻ QR '{cleanCardCode}' đã bị KHÓA!",
                card = card,
                cards = cards,
                bookingId = booking.Id,
                isQrUnlocked = booking.IsQrUnlocked
            });
        }

        [HttpDelete("{id}/remove-qr-card/{cardCode}")]
        public async Task<IActionResult> RemoveQrCard(int id, string cardCode)
        {
            if (string.IsNullOrWhiteSpace(cardCode))
                return BadRequest("Mã thẻ QR không được để trống.");

            var cleanCardCode = cardCode.Trim().ToUpper();

            var booking = await _context.Bookings
                .Include(b => b.Tents)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound("Không tìm thấy đơn đặt.");

            var cards = new List<AssignedQrCardDto>();
            if (!string.IsNullOrWhiteSpace(booking.AssignedQrCards))
            {
                try
                {
                    cards = System.Text.Json.JsonSerializer.Deserialize<List<AssignedQrCardDto>>(
                        booking.AssignedQrCards,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    ) ?? new List<AssignedQrCardDto>();
                }
                catch {}
            }

            var removed = cards.RemoveAll(c => c.CardCode.Equals(cleanCardCode, StringComparison.OrdinalIgnoreCase));
            if (removed == 0)
            {
                return NotFound($"Không tìm thấy thẻ '{cleanCardCode}' trong đơn đặt này.");
            }

            booking.AssignedQrCards = System.Text.Json.JsonSerializer.Serialize(cards);
            booking.IsQrUnlocked = cards.Any(c => c.IsUnlocked);
            foreach (var tent in booking.Tents)
            {
                tent.IsQrUnlocked = booking.IsQrUnlocked;
            }

            // Sync with QrCards inventory table
            var qrCard = await _context.QrCards.FirstOrDefaultAsync(q => q.CardCode.ToUpper() == cleanCardCode);
            if (qrCard != null)
            {
                qrCard.Status = "Available";
                qrCard.CurrentBookingId = null;
                qrCard.AssignedPlacement = null;
                qrCard.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("BookingQrStatusChanged", new { bookingId = booking.Id, isQrUnlocked = booking.IsQrUnlocked });
            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");

            return Ok(new {
                message = $"Đã gỡ và thu hồi thẻ '{cleanCardCode}' thành công!",
                cards = cards,
                bookingId = booking.Id,
                isQrUnlocked = booking.IsQrUnlocked
            });
        }

        [HttpGet("validate-qr-card")]
        public async Task<IActionResult> ValidateQrCard([FromQuery] string card)
        {
            if (string.IsNullOrWhiteSpace(card))
                return BadRequest(new { active = false, message = "Thiếu mã thẻ QR." });

            var cleanCard = card.Trim().ToUpper();

            var activeBookings = await _context.Bookings
                .Include(b => b.Tents)
                    .ThenInclude(t => t.Zone)
                .Where(b => (b.Status == "Booked" || b.Status == "Occupied") && !string.IsNullOrEmpty(b.AssignedQrCards))
                .ToListAsync();

            foreach (var b in activeBookings)
            {
                try
                {
                    var cards = System.Text.Json.JsonSerializer.Deserialize<List<AssignedQrCardDto>>(
                        b.AssignedQrCards!,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );
                    var matched = cards?.FirstOrDefault(c => c.CardCode.Equals(cleanCard, StringComparison.OrdinalIgnoreCase));
                    if (matched != null)
                    {
                        var primaryTent = b.Tents.FirstOrDefault();
                        return Ok(new {
                            valid = true,
                            active = matched.IsUnlocked,
                            isUnlocked = matched.IsUnlocked,
                            bookingId = b.Id,
                            customerName = b.CustomerName,
                            cardCode = matched.CardCode,
                            assignedTo = matched.AssignedTo,
                            note = matched.Note,
                            tentName = primaryTent?.Name ?? cleanCard,
                            tentSetupSummary = b.TentSetupSummary,
                            tentSetupDetails = b.TentSetupDetails,
                            landSlots = b.Tents.Select(t => new { id = t.Id, name = t.Name, zoneName = t.Zone?.Name })
                        });
                    }
                }
                catch {}
            }

            return NotFound(new { valid = false, active = false, message = $"Thẻ QR '{cleanCard}' chưa được gán cho đơn đặt nào hoặc đã được thu hồi." });
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
                await _hubContext.Clients.All.SendAsync("TentTypesUpdated");
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
