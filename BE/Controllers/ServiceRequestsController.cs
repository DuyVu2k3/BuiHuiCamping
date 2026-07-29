using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;

namespace BuiHuiCamping.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ServiceRequestsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public ServiceRequestsController(AppDbContext context) { _context = context; }

        // Staff sees active requests
        [HttpGet]
        public async Task<IActionResult> GetRequests()
        {
            var requests = await _context.ServiceRequests
                .Where(r => r.Status == "Pending")
                .ToListAsync();
            return Ok(requests);
        }

        // End-user calls for staff
        [HttpPost]
        public async Task<IActionResult> CreateRequest(ServiceRequest request)
        {
            request.CreatedAt = DateTime.UtcNow;
            request.Status = "Pending";
            _context.ServiceRequests.Add(request);
            await _context.SaveChangesAsync();

            // TODO: SignalR notify staff here

            return Ok(request);
        }

        // Staff resolves a request
        [HttpPut("{id}/resolve")]
        public async Task<IActionResult> ResolveRequest(int id)
        {
            var request = await _context.ServiceRequests.FindAsync(id);
            if (request == null) return NotFound();
            request.Status = "Resolved";
            await _context.SaveChangesAsync();
            return Ok(request);
        }
    }
}
