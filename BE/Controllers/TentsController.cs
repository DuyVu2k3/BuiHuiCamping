using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using Microsoft.AspNetCore.SignalR;
using BuiHuiCamping.API.Hubs;

namespace BuiHuiCamping.API.Controllers
{
    [Route("api/[controller]")]
    [Route("api/LandSlots")]
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
            if (string.IsNullOrEmpty(tent.Size)) tent.Size = "Small";
            if (tent.SlotsOccupied <= 0)
            {
                tent.SlotsOccupied = tent.Size == "Large" ? 4 : (tent.Size == "Medium" ? 2 : 1);
            }
            if (string.IsNullOrEmpty(tent.SlotCode))
            {
                tent.SlotCode = tent.Name;
            }

            if (tent.QRCodeData == null)
            {
                tent.QRCodeData = string.Empty;
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

            if (!string.IsNullOrEmpty(updatedTent.Size))
            {
                tent.Size = updatedTent.Size;
            }
            if (updatedTent.SlotsOccupied > 0)
            {
                tent.SlotsOccupied = updatedTent.SlotsOccupied;
            }
            else
            {
                tent.SlotsOccupied = tent.Size == "Large" ? 4 : (tent.Size == "Medium" ? 2 : 1);
            }

            if (!string.IsNullOrEmpty(updatedTent.SlotCode))
            {
                tent.SlotCode = updatedTent.SlotCode;
            }
            tent.GridX = updatedTent.GridX;
            tent.GridY = updatedTent.GridY;
            if (!string.IsNullOrEmpty(updatedTent.MapTop)) tent.MapTop = updatedTent.MapTop;
            if (!string.IsNullOrEmpty(updatedTent.MapLeft)) tent.MapLeft = updatedTent.MapLeft;

            if (updatedTent.QRCodeData != null)
            {
                tent.QRCodeData = updatedTent.QRCodeData;
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

        [HttpPut("batch-coordinates")]
        public async Task<IActionResult> BatchUpdateCoordinates([FromBody] List<BatchUpdateCoordinatesDto> dtoList)
        {
            if (dtoList == null || !dtoList.Any()) return BadRequest("Danh sách rỗng");

            var ids = dtoList.Select(d => d.Id).ToList();
            var tents = await _context.Tents.Where(t => ids.Contains(t.Id)).ToListAsync();

            foreach (var item in dtoList)
            {
                var tent = tents.FirstOrDefault(t => t.Id == item.Id);
                if (tent != null)
                {
                    tent.MapTop = item.MapTop;
                    tent.MapLeft = item.MapLeft;
                }
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(new { success = true, updatedCount = tents.Count });
        }

        [HttpPost("preset-diagram-layout")]
        public async Task<IActionResult> ApplyPresetDiagramLayout()
        {
            // Preset 16 slots matching user hand-drawn diagram on flycam aerial map:
            // 7 slots on Row 1 (bottom), 5 slots on Row 2 (middle), 4 slots on Row 3 (top)
            var zoneB = await _context.Zones.FirstOrDefaultAsync(z => z.Name.Contains("B") || z.ZoneType == "Camping");
            int zoneId = zoneB?.Id ?? 2;
            string zonePrefix = zoneB?.Name?.Replace("Khu", "")?.Trim() ?? "B";

            var presetSlots = new List<(string code, string name, string top, string left, string size, decimal price)>
            {
                // Hàng 1 (7 ô chuẩn dưới cùng sát mép bãi cỏ)
                ($"{zonePrefix}.01", $"Ô {zonePrefix}.01", "91%", "11%", "Small", 500000),
                ($"{zonePrefix}.02", $"Ô {zonePrefix}.02", "91%", "17%", "Small", 500000),
                ($"{zonePrefix}.03", $"Ô {zonePrefix}.03", "91%", "23%", "Small", 500000),
                ($"{zonePrefix}.04", $"Ô {zonePrefix}.04", "91%", "30%", "Small", 500000),
                ($"{zonePrefix}.05", $"Ô {zonePrefix}.05", "91%", "36%", "Small", 500000),
                ($"{zonePrefix}.06", $"Ô {zonePrefix}.06", "91%", "42%", "Small", 500000),
                ($"{zonePrefix}.07", $"Ô {zonePrefix}.07", "90%", "48%", "Small", 500000),

                // Hàng 2 (5 ô chuẩn giữa bãi cỏ)
                ($"{zonePrefix}.08", $"Ô {zonePrefix}.08", "82%", "14%", "Small", 500000),
                ($"{zonePrefix}.09", $"Ô {zonePrefix}.09", "82%", "21%", "Small", 500000),
                ($"{zonePrefix}.10", $"Ô {zonePrefix}.10", "82%", "29%", "Small", 500000),
                ($"{zonePrefix}.11", $"Ô {zonePrefix}.11", "81%", "36%", "Small", 500000),
                ($"{zonePrefix}.12", $"Ô {zonePrefix}.12", "80%", "43%", "Small", 500000),

                // Hàng 3 (4 ô chuẩn trên gần đường và khu dịch vụ)
                ($"{zonePrefix}.13", $"Ô {zonePrefix}.13", "72%", "22%", "Small", 500000),
                ($"{zonePrefix}.14", $"Ô {zonePrefix}.14", "71%", "30%", "Small", 500000),
                ($"{zonePrefix}.15", $"Ô {zonePrefix}.15", "71%", "37%", "Small", 500000),
                ($"{zonePrefix}.16", $"Ô {zonePrefix}.16", "70%", "44%", "Small", 500000)
            };

            var existingTents = await _context.Tents.Where(t => t.ZoneId == zoneId).ToListAsync();
            
            foreach (var slot in presetSlots)
            {
                var existing = existingTents.FirstOrDefault(t => t.SlotCode == slot.code || t.Name == slot.name);
                int slotsOccupied = 1;
                if (existing != null)
                {
                    existing.MapTop = slot.top;
                    existing.MapLeft = slot.left;
                    existing.Size = "Small";
                    existing.SlotsOccupied = 1;
                    existing.Price = slot.price;
                }
                else
                {
                    var newTent = new Tent
                    {
                        Name = slot.name,
                        SlotCode = slot.code,
                        ZoneId = zoneId,
                        Size = "Small",
                        SlotsOccupied = 1,
                        MapTop = slot.top,
                        MapLeft = slot.left,
                        Price = slot.price,
                        HourlyPriceFirstHour = 100000,
                        HourlyPriceExtraHour = 50000,
                        Status = "Available",
                        QRCodeData = string.Empty
                    };
                    _context.Tents.Add(newTent);
                }
            }

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            return Ok(new { success = true, count = presetSlots.Count });
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

    public class BatchUpdateCoordinatesDto
    {
        public int Id { get; set; }
        public string MapTop { get; set; } = string.Empty;
        public string MapLeft { get; set; } = string.Empty;
    }

    public class MergeTablesDto
    {
        public int SourceTentId { get; set; }
        public int TargetTentId { get; set; }
    }
}
