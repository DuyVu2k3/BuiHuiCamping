using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using Microsoft.AspNetCore.SignalR;
using BuiHuiCamping.API.Hubs;

namespace BuiHuiCamping.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public TentsController(AppDbContext context, IHubContext<OrderHub> hubContext) 
        { 
            _context = context; 
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetTents()
        {
            var tents = await _context.Tents
                .Include(t => t.Zone)
                .Include(t => t.Bookings)
                .AsNoTracking()
                .ToListAsync();
            return Ok(tents);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTent(Tent tent)
        {
            // Auto generate QR Code Data based on Zone Name and Tent Name if ZoneId is provided
            if (tent.ZoneId.HasValue)
            {
                var zone = await _context.Zones.FindAsync(tent.ZoneId.Value);
                if (zone != null)
                {
                    // Generate a relative URL for the QR code pointing to the customer portal
                    tent.QRCodeData = $"/customer/menu?tent={zone.Name}.{tent.Name}";
                }
            }
            
            if (string.IsNullOrEmpty(tent.QRCodeData))
            {
                tent.QRCodeData = $"/customer/menu?tent={tent.Name}";
            }

            _context.Tents.Add(tent);
            await _context.SaveChangesAsync();
            return Ok(tent);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTent(int id, [FromBody] Tent updatedTent)
        {
            var tent = await _context.Tents.FindAsync(id);
            if (tent == null) return NotFound();

            tent.Name = updatedTent.Name;
            tent.ZoneId = updatedTent.ZoneId;
            tent.Price = updatedTent.Price;
            tent.HourlyPriceFirstHour = updatedTent.HourlyPriceFirstHour;
            tent.HourlyPriceExtraHour = updatedTent.HourlyPriceExtraHour;
            if (!string.IsNullOrEmpty(updatedTent.TentType))
            {
                tent.TentType = updatedTent.TentType;
            }

            if (tent.ZoneId.HasValue)
            {
                var zone = await _context.Zones.FindAsync(tent.ZoneId.Value);
                if (zone != null)
                {
                    tent.QRCodeData = $"/customer/menu?tent={zone.Name}.{tent.Name}";
                }
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(tent);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTent(int id)
        {
            var tent = await _context.Tents.FindAsync(id);
            if (tent == null) return NotFound();

            _context.Tents.Remove(tent);
            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok();
        }

        [HttpPut("{id}/coordinates")]
        public async Task<IActionResult> UpdateCoordinates(int id, [FromBody] UpdateTentCoordinatesDto dto)
        {
            var tent = await _context.Tents.FindAsync(id);
            if (tent == null) return NotFound();

            tent.MapTop = dto.MapTop;
            tent.MapLeft = dto.MapLeft;

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(tent);
        }

        [HttpGet("validate")]
        public async Task<IActionResult> ValidateTent([FromQuery] string tent)
        {
            if (string.IsNullOrEmpty(tent))
                return BadRequest(new { active = false, message = "Thiếu thông tin lều." });

            var allTents = await _context.Tents
                .Include(t => t.Zone)
                .Include(t => t.Bookings)
                .ToListAsync();
            
            var tentEntity = OrdersController.FindMatchingTent(allTents, tent);

            if (tentEntity == null)
                return NotFound(new { active = false, message = "Không tìm thấy thông tin lều." });

            var activeBooking = tentEntity.Bookings?.FirstOrDefault(b => b.Status == "Booked" || b.Status == "Occupied" || b.Status == "Pending");
            
            // Check if this entity is a Restaurant Table (Bàn ăn) vs Overnight Tent (Lều)
            bool isTable = (tentEntity.Zone != null && tentEntity.Zone.ZoneType.Equals("DiningTable", StringComparison.OrdinalIgnoreCase)) ||
                           (tentEntity.TentType != null && (
                            tentEntity.TentType.Equals("Bàn", StringComparison.OrdinalIgnoreCase) ||
                            tentEntity.TentType.Equals("Tiệc", StringComparison.OrdinalIgnoreCase)
                           )) ||
                           (tentEntity.Zone != null && (
                            tentEntity.Zone.Name.Contains("Bàn", StringComparison.OrdinalIgnoreCase) ||
                            tentEntity.Zone.Name.Contains("Nhà hàng", StringComparison.OrdinalIgnoreCase) ||
                            tentEntity.Zone.Name.Contains("Ăn uống", StringComparison.OrdinalIgnoreCase)
                           ));

            // Dining tables are active & unlocked ONLY when the table is opened (IsQrUnlocked || Status == Occupied || MergedParentTentId != null)!
            bool isTableOpen = tentEntity.IsQrUnlocked || tentEntity.Status.Equals("Occupied", StringComparison.OrdinalIgnoreCase) || tentEntity.MergedParentTentId.HasValue;
            bool isActive = isTable ? isTableOpen : (tentEntity.IsQrUnlocked || tentEntity.Status.Equals("Occupied", StringComparison.OrdinalIgnoreCase) || (activeBooking != null && activeBooking.IsQrUnlocked));
            bool isUnlocked = isTable ? isTableOpen : (tentEntity.IsQrUnlocked || (activeBooking?.IsQrUnlocked ?? false));

            return Ok(new
            {
                id = tentEntity.Id,
                name = tentEntity.Name,
                status = isTable ? (isTableOpen ? "Occupied" : "Available") : tentEntity.Status,
                isTable = isTable,
                isQrUnlocked = isUnlocked,
                mergedParentTentId = tentEntity.MergedParentTentId,
                active = isActive
            });
        }

        [HttpPost("{id}/open-table")]
        public async Task<IActionResult> OpenTable(int id)
        {
            var tent = await _context.Tents.FindAsync(id);
            if (tent == null) return NotFound("Không tìm thấy bàn.");

            tent.Status = "Occupied";
            tent.IsQrUnlocked = true;

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(new { id = tent.Id, name = tent.Name, status = tent.Status, isQrUnlocked = tent.IsQrUnlocked, message = $"Đã MỞ BÀN {tent.Name} thành công!" });
        }

        [HttpPost("{id}/close-table")]
        public async Task<IActionResult> CloseTable(int id)
        {
            var tent = await _context.Tents.FindAsync(id);
            if (tent == null) return NotFound("Không tìm thấy bàn.");

            tent.Status = "Available";
            tent.IsQrUnlocked = false;
            tent.MergedParentTentId = null;

            // Also unmerge any child tables linked to this master table
            var childTables = await _context.Tents.Where(t => t.MergedParentTentId == id).ToListAsync();
            foreach (var child in childTables)
            {
                child.MergedParentTentId = null;
                child.Status = "Available";
                child.IsQrUnlocked = false;
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(new { id = tent.Id, name = tent.Name, status = tent.Status, isQrUnlocked = tent.IsQrUnlocked, message = $"Đã ĐÓNG BÀN & trả bàn {tent.Name} thành công!" });
        }

        [HttpPost("merge-tables")]
        public async Task<IActionResult> MergeTables([FromBody] MergeTablesDto dto)
        {
            if (dto.SourceTentId == dto.TargetTentId)
                return BadRequest("Không thể ghép bàn với chính nó.");

            var sourceTent = await _context.Tents.FindAsync(dto.SourceTentId);
            var targetTent = await _context.Tents.FindAsync(dto.TargetTentId);

            if (sourceTent == null || targetTent == null)
                return NotFound("Không tìm thấy bàn nguồn hoặc bàn đích.");

            // Set source table merged to target table
            sourceTent.MergedParentTentId = targetTent.Id;
            sourceTent.Status = "Occupied";
            sourceTent.IsQrUnlocked = true;

            // Ensure target table is also open
            targetTent.Status = "Occupied";
            targetTent.IsQrUnlocked = true;

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");

            return Ok(new
            {
                sourceTentId = sourceTent.Id,
                sourceTentName = sourceTent.Name,
                targetTentId = targetTent.Id,
                targetTentName = targetTent.Name,
                message = $"Đã ghép Bàn {sourceTent.Name} vào Bàn {targetTent.Name} thành công!"
            });
        }

        [HttpPost("{id}/unmerge-table")]
        public async Task<IActionResult> UnmergeTable(int id)
        {
            var tent = await _context.Tents.FindAsync(id);
            if (tent == null) return NotFound("Không tìm thấy bàn.");

            tent.MergedParentTentId = null;
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(new { id = tent.Id, message = $"Đã tách Bàn {tent.Name}!" });
        }

        [HttpPost("{id}/toggle-qr-lock")]
        public async Task<IActionResult> ToggleTentQrLock(int id)
        {
            var tent = await _context.Tents.FindAsync(id);
            if (tent == null) return NotFound();

            tent.IsQrUnlocked = !tent.IsQrUnlocked;
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(new { tentId = tent.Id, isQrUnlocked = tent.IsQrUnlocked, message = tent.IsQrUnlocked ? $"Đã MỞ KHÓA mã QR cho Lều {tent.Name}!" : $"Đã KHÓA mã QR Lều {tent.Name}!" });
        }

        [HttpPut("{id}/toggle-status")]
        public async Task<IActionResult> ToggleStatus(int id)
        {
            var tent = await _context.Tents
                .Include(t => t.Bookings)
                .FirstOrDefaultAsync(t => t.Id == id);
            if (tent == null) return NotFound();

            bool isNowOccupied = tent.Status != "Occupied";
            tent.Status = isNowOccupied ? "Occupied" : "Available";
            tent.IsQrUnlocked = isNowOccupied;

            // Sync active booking QR status
            var activeBooking = tent.Bookings?.FirstOrDefault(b => b.Status == "Booked" || b.Status == "Occupied" || b.Status == "Pending");
            if (activeBooking != null)
            {
                activeBooking.IsQrUnlocked = isNowOccupied;
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(new { id = tent.Id, status = tent.Status, isQrUnlocked = isNowOccupied });
        }
    }

    public class UpdateTentCoordinatesDto
    {
        public string MapTop { get; set; } = string.Empty;
        public string MapLeft { get; set; } = string.Empty;
    }

    public class MergeTablesDto
    {
        public int SourceTentId { get; set; }
        public int TargetTentId { get; set; }
    }
}
