using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using BuiHuiCamping.API.Hubs;

namespace BuiHuiCamping.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ZonesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public ZonesController(AppDbContext context, IHubContext<OrderHub> hubContext) 
        { 
            _context = context; 
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetZones()
        {
            var zones = await _context.Zones
                .Include(z => z.Tents)
                .ThenInclude(t => t.Bookings)
                .AsNoTracking()
                .ToListAsync();
            return Ok(zones);
        }

        [HttpPost]
        public async Task<IActionResult> CreateZone(Zone zone)
        {
            if (zone.TotalSlots <= 0) zone.TotalSlots = 20;
            if (zone.GridRows <= 0) zone.GridRows = 4;
            if (zone.GridCols <= 0) zone.GridCols = 5;

            _context.Zones.Add(zone);
            await _context.SaveChangesAsync();
            return Ok(zone);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateZone(int id, [FromBody] Zone updatedZone)
        {
            var zone = await _context.Zones.FindAsync(id);
            if (zone == null) return NotFound();

            zone.Name = updatedZone.Name;
            zone.Description = updatedZone.Description;
            zone.ZoneType = updatedZone.ZoneType;
            if (updatedZone.TotalSlots > 0) zone.TotalSlots = updatedZone.TotalSlots;
            if (updatedZone.GridRows > 0) zone.GridRows = updatedZone.GridRows;
            if (updatedZone.GridCols > 0) zone.GridCols = updatedZone.GridCols;

            await _context.SaveChangesAsync();
            return Ok(zone);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteZone(int id)
        {
            var zone = await _context.Zones.Include(z => z.Tents).FirstOrDefaultAsync(z => z.Id == id);
            if (zone == null) return NotFound();

            if (zone.Tents.Any())
            {
                return BadRequest("Không thể xóa khu vực đang có lều/bàn.");
            }

            _context.Zones.Remove(zone);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // Toggle Flexible / Festival mode for a specific zone (Manager only)
        [HttpPut("{id}/toggle-flexible-mode")]
        public async Task<IActionResult> ToggleFlexibleMode(int id)
        {
            var zone = await _context.Zones.FindAsync(id);
            if (zone == null) return NotFound("Không tìm thấy phân khu.");

            zone.IsFlexibleMode = !zone.IsFlexibleMode;
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("ZoneUpdated");

            return Ok(new { zone.Id, zone.Name, zone.IsFlexibleMode });
        }

        // Toggle Flexible / Festival mode for all camping zones (Manager only)
        public class ToggleAllFlexibleRequest
        {
            public bool? Enabled { get; set; }
        }

        [HttpPut("toggle-all-flexible-mode")]
        public async Task<IActionResult> ToggleAllFlexibleMode([FromBody] ToggleAllFlexibleRequest? request, [FromQuery] bool? enabled)
        {
            var campingZones = await _context.Zones
                .Where(z => z.ZoneType != "DiningTable")
                .ToListAsync();

            bool? target = request?.Enabled ?? enabled;
            bool targetState = target.HasValue ? target.Value : campingZones.Any(z => !z.IsFlexibleMode);

            foreach (var z in campingZones)
            {
                z.IsFlexibleMode = targetState;
            }
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentStatusChanged");
            await _hubContext.Clients.All.SendAsync("ZoneUpdated");

            return Ok(new { isFlexibleMode = targetState, updatedCount = campingZones.Count });
        }
    }
}
