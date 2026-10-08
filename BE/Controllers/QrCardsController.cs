using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using Microsoft.AspNetCore.SignalR;
using BuiHuiCamping.API.Hubs;
using System.Text.Json;

namespace BuiHuiCamping.API.Controllers
{
    public class CreateQrCardDto
    {
        public string CardCode { get; set; } = string.Empty;
        public string? Note { get; set; }
    }

    public class BatchGenerateQrCardsDto
    {
        public string Prefix { get; set; } = "QR-";
        public int FromNumber { get; set; } = 1;
        public int ToNumber { get; set; } = 30;
        public int Digits { get; set; } = 2;
        public string? Note { get; set; }
    }

    public class UpdateQrCardStatusDto
    {
        public string Status { get; set; } = "Available"; // Available, Damaged, Lost
        public string? Note { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class QrCardsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public QrCardsController(AppDbContext context, IHubContext<OrderHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        // GET: api/QrCards
        [HttpGet]
        public async Task<IActionResult> GetQrCards([FromQuery] string? status, [FromQuery] string? search)
        {
            var query = _context.QrCards.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(q => q.Status.ToLower() == status.Trim().ToLower());
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var cleanSearch = search.Trim().ToLower();
                query = query.Where(q => q.CardCode.ToLower().Contains(cleanSearch) || 
                                         (q.Note != null && q.Note.ToLower().Contains(cleanSearch)) ||
                                         (q.AssignedPlacement != null && q.AssignedPlacement.ToLower().Contains(cleanSearch)));
            }

            var cards = await query
                .OrderBy(q => q.CardCode.Length)
                .ThenBy(q => q.CardCode)
                .ToListAsync();

            // Load associated active bookings
            var bookingIds = cards.Where(c => c.CurrentBookingId.HasValue).Select(c => c.CurrentBookingId!.Value).Distinct().ToList();
            var bookingsMap = await _context.Bookings
                .Include(b => b.Tents)
                    .ThenInclude(t => t.Zone)
                .Where(b => bookingIds.Contains(b.Id))
                .ToDictionaryAsync(b => b.Id);

            var items = cards.Select(c =>
            {
                Booking? booking = null;
                if (c.CurrentBookingId.HasValue && bookingsMap.TryGetValue(c.CurrentBookingId.Value, out var b))
                {
                    booking = b;
                }

                return new
                {
                    c.Id,
                    c.CardCode,
                    c.Status,
                    c.CurrentBookingId,
                    c.AssignedPlacement,
                    c.Note,
                    c.CreatedAt,
                    c.UpdatedAt,
                    Booking = booking == null ? null : new
                    {
                        booking.Id,
                        booking.CustomerName,
                        booking.PhoneNumber,
                        booking.Status,
                        booking.CheckInDate,
                        booking.CheckOutDate,
                        booking.TentSetupSummary,
                        Tents = booking.Tents.Select(t => new { t.Id, t.Name, ZoneName = t.Zone?.Name })
                    }
                };
            }).ToList();

            // Calculate inventory summary statistics
            var allCards = await _context.QrCards.AsNoTracking().ToListAsync();
            var stats = new
            {
                total = allCards.Count,
                available = allCards.Count(c => c.Status == "Available"),
                assigned = allCards.Count(c => c.Status == "Assigned"),
                damaged = allCards.Count(c => c.Status == "Damaged"),
                lost = allCards.Count(c => c.Status == "Lost")
            };

            return Ok(new { items, stats });
        }

        // POST: api/QrCards
        [HttpPost]
        public async Task<IActionResult> CreateQrCard([FromBody] CreateQrCardDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.CardCode))
                return BadRequest("Mã thẻ QR không được để trống.");

            var cleanCode = dto.CardCode.Trim().ToUpper();
            var exists = await _context.QrCards.AnyAsync(q => q.CardCode == cleanCode);
            if (exists)
                return BadRequest($"Mã thẻ '{cleanCode}' đã tồn tại trong kho.");

            var card = new QrCard
            {
                CardCode = cleanCode,
                Status = "Available",
                Note = dto.Note?.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _context.QrCards.Add(card);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");
            return Ok(card);
        }

        // POST: api/QrCards/batch-generate
        [HttpPost("batch-generate")]
        public async Task<IActionResult> BatchGenerate([FromBody] BatchGenerateQrCardsDto dto)
        {
            if (dto.FromNumber > dto.ToNumber)
                return BadRequest("Số bắt đầu không được lớn hơn số kết thúc.");

            if (dto.ToNumber - dto.FromNumber > 200)
                return BadRequest("Mỗi đợt sinh chỉ được tối đa 200 thẻ.");

            var prefix = string.IsNullOrWhiteSpace(dto.Prefix) ? "QR-" : dto.Prefix.Trim().ToUpper();
            var digits = Math.Clamp(dto.Digits, 1, 6);

            var existingCodes = await _context.QrCards.Select(q => q.CardCode).ToListAsync();
            var existingSet = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

            var newCards = new List<QrCard>();
            for (int i = dto.FromNumber; i <= dto.ToNumber; i++)
            {
                var code = $"{prefix}{i.ToString().PadLeft(digits, '0')}";
                if (!existingSet.Contains(code))
                {
                    newCards.Add(new QrCard
                    {
                        CardCode = code,
                        Status = "Available",
                        Note = dto.Note?.Trim(),
                        CreatedAt = DateTime.UtcNow
                    });
                    existingSet.Add(code);
                }
            }

            if (newCards.Any())
            {
                _context.QrCards.AddRange(newCards);
                await _context.SaveChangesAsync();
                await _hubContext.Clients.All.SendAsync("QrCardsUpdated");
            }

            return Ok(new
            {
                message = $"Đã sinh thành công {newCards.Count} thẻ mới vào kho.",
                createdCount = newCards.Count,
                skippedCount = (dto.ToNumber - dto.FromNumber + 1) - newCards.Count
            });
        }

        // PUT: api/QrCards/{id}/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateQrCardStatusDto dto)
        {
            var card = await _context.QrCards.FindAsync(id);
            if (card == null) return NotFound("Không tìm thấy thẻ QR.");

            var oldStatus = card.Status;
            var newStatus = dto.Status.Trim();

            // Validate status
            var validStatuses = new[] { "Available", "Assigned", "Damaged", "Lost" };
            if (!validStatuses.Contains(newStatus))
                return BadRequest("Trạng thái không hợp lệ.");

            card.Status = newStatus;
            if (!string.IsNullOrWhiteSpace(dto.Note))
            {
                card.Note = dto.Note.Trim();
            }
            card.UpdatedAt = DateTime.UtcNow;

            // If changing to Available, unlink from any booking
            if (newStatus == "Available")
            {
                if (card.CurrentBookingId.HasValue)
                {
                    // Also remove from booking's AssignedQrCards JSON
                    var booking = await _context.Bookings.FindAsync(card.CurrentBookingId.Value);
                    if (booking != null && !string.IsNullOrWhiteSpace(booking.AssignedQrCards))
                    {
                        try
                        {
                            var bCards = JsonSerializer.Deserialize<List<AssignedQrCardDto>>(booking.AssignedQrCards, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                            if (bCards != null)
                            {
                                bCards.RemoveAll(c => c.CardCode.Equals(card.CardCode, StringComparison.OrdinalIgnoreCase));
                                booking.AssignedQrCards = JsonSerializer.Serialize(bCards);
                            }
                        }
                        catch {}
                    }
                }
                card.CurrentBookingId = null;
                card.AssignedPlacement = null;
            }

            // If changing to Lost or Damaged, remove from active booking assignment
            if ((newStatus == "Lost" || newStatus == "Damaged") && card.CurrentBookingId.HasValue)
            {
                var booking = await _context.Bookings.FindAsync(card.CurrentBookingId.Value);
                if (booking != null && !string.IsNullOrWhiteSpace(booking.AssignedQrCards))
                {
                    try
                    {
                        var bCards = JsonSerializer.Deserialize<List<AssignedQrCardDto>>(booking.AssignedQrCards, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (bCards != null)
                        {
                            bCards.RemoveAll(c => c.CardCode.Equals(card.CardCode, StringComparison.OrdinalIgnoreCase));
                            booking.AssignedQrCards = JsonSerializer.Serialize(bCards);
                        }
                    }
                    catch {}
                }
                card.CurrentBookingId = null;
                card.AssignedPlacement = null;
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");

            return Ok(card);
        }

        // DELETE: api/QrCards/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteQrCard(int id)
        {
            var card = await _context.QrCards.FindAsync(id);
            if (card == null) return NotFound("Không tìm thấy thẻ QR.");

            if (card.Status == "Assigned" || card.CurrentBookingId.HasValue)
            {
                return BadRequest("Không thể xóa thẻ đang được gán phục vụ khách. Vui lòng thu hồi thẻ về kho trước.");
            }

            _context.QrCards.Remove(card);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");
            return Ok(new { message = $"Đã xóa thẻ {card.CardCode} khỏi kho." });
        }

        // POST: api/QrCards/sync
        [HttpPost("sync")]
        public async Task<IActionResult> SyncWithBookings()
        {
            var activeBookings = await _context.Bookings
                .Where(b => b.Status == "Booked" || b.Status == "Occupied")
                .ToListAsync();

            var allDbCards = await _context.QrCards.ToListAsync();
            var cardMap = allDbCards.ToDictionary(c => c.CardCode.ToUpper(), c => c);

            var assignedCodesInBookings = new Dictionary<string, (int BookingId, string? Placement)>();

            foreach (var b in activeBookings)
            {
                if (string.IsNullOrWhiteSpace(b.AssignedQrCards)) continue;
                try
                {
                    var cards = JsonSerializer.Deserialize<List<AssignedQrCardDto>>(b.AssignedQrCards, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (cards != null)
                    {
                        foreach (var c in cards)
                        {
                            var cleanCode = c.CardCode.Trim().ToUpper();
                            if (!assignedCodesInBookings.ContainsKey(cleanCode))
                            {
                                assignedCodesInBookings[cleanCode] = (b.Id, c.AssignedTo);
                            }
                        }
                    }
                }
                catch {}
            }

            // Sync with DB cards
            foreach (var kvp in assignedCodesInBookings)
            {
                if (cardMap.TryGetValue(kvp.Key, out var existingCard))
                {
                    existingCard.Status = "Assigned";
                    existingCard.CurrentBookingId = kvp.Value.BookingId;
                    existingCard.AssignedPlacement = kvp.Value.Placement;
                    existingCard.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    // Card exists in booking but wasn't in DB yet -> auto create
                    var newCard = new QrCard
                    {
                        CardCode = kvp.Key,
                        Status = "Assigned",
                        CurrentBookingId = kvp.Value.BookingId,
                        AssignedPlacement = kvp.Value.Placement,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.QrCards.Add(newCard);
                }
            }

            // Cards in DB that were marked Assigned but no active booking holds them
            foreach (var card in allDbCards)
            {
                if (card.Status == "Assigned" && !assignedCodesInBookings.ContainsKey(card.CardCode.ToUpper()))
                {
                    card.Status = "Available";
                    card.CurrentBookingId = null;
                    card.AssignedPlacement = null;
                    card.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");

            return Ok(new { message = "Đã đồng bộ kho thẻ QR thành công với các đơn đặt đang hoạt động." });
        }

        // POST: api/QrCards/clear-all
        [HttpPost("clear-all")]
        public async Task<IActionResult> ClearAll([FromQuery] bool includeAssigned = true)
        {
            if (includeAssigned)
            {
                var bookingsWithCards = await _context.Bookings.Where(b => !string.IsNullOrEmpty(b.AssignedQrCards)).ToListAsync();
                foreach (var b in bookingsWithCards)
                {
                    b.AssignedQrCards = null;
                }
                _context.QrCards.RemoveRange(_context.QrCards);
            }
            else
            {
                var unassigned = await _context.QrCards.Where(c => c.Status != "Assigned").ToListAsync();
                _context.QrCards.RemoveRange(unassigned);
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("QrCardsUpdated");
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");

            return Ok(new { message = "Đã xóa toàn bộ dữ liệu kho thẻ QR thành công." });
        }
    }
}
