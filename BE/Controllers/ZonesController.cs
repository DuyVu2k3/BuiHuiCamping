using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;

namespace BuiHuiCamping.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ZonesController : ControllerBase
    {
        private readonly AppDbContext _context;
        public ZonesController(AppDbContext context) { _context = context; }

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
    }
}
