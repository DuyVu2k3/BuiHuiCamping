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
            _context.Zones.Add(zone);
            await _context.SaveChangesAsync();
            return Ok(zone);
        }
    }
}
