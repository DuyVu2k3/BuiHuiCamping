using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using Microsoft.AspNetCore.SignalR;
using BuiHuiCamping.API.Hubs;
using System.Text.Json;

namespace BuiHuiCamping.API.Controllers
{
    public class TentSetupItemDto
    {
        public int TentTypeId { get; set; }
        public string TentTypeName { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public int SlotsOccupied { get; set; } = 1;
        public decimal Price { get; set; } = 0;
        public decimal HourlyFirstHourPrice { get; set; } = 0;
        public decimal HourlyExtraHourPrice { get; set; } = 0;
    }

    public class TentTypeDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Size { get; set; } = "Small";
        public int SlotsOccupied { get; set; } = 1;
        public string Capacity { get; set; } = "1 - 2 khách";
        public int TotalQuantity { get; set; } = 10;
        public int UsedQuantity { get; set; } = 0;
        public int AvailableQuantity { get; set; } = 10;
        public decimal Price { get; set; } = 500000;
        public decimal HourlyFirstHourPrice { get; set; } = 100000;
        public decimal HourlyExtraHourPrice { get; set; } = 50000;
        public string Description { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
    }

    [Route("api/[controller]")]
    [ApiController]
    public class TentTypesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public TentTypesController(AppDbContext context, IHubContext<OrderHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetTentTypes()
        {
            var types = await _context.TentTypes
                .Where(t => t.IsActive)
                .OrderBy(t => t.SlotsOccupied)
                .ThenBy(t => t.Price)
                .AsNoTracking()
                .ToListAsync();

            // Find all active bookings to calculate currently pitched/used tents
            var activeBookings = await _context.Bookings
                .Include(b => b.Tents)
                .Where(b => b.Status == "Booked" || b.Status == "Occupied" || b.Status == "Pending")
                .AsNoTracking()
                .ToListAsync();

            // Map used counts per TentTypeId
            var usedCounts = new Dictionary<int, int>();
            foreach (var t in types)
            {
                usedCounts[t.Id] = 0;
            }

            foreach (var b in activeBookings)
            {
                if (!string.IsNullOrEmpty(b.TentSetupDetails))
                {
                    try
                    {
                        var items = JsonSerializer.Deserialize<List<TentSetupItemDto>>(b.TentSetupDetails, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (items != null)
                        {
                            foreach (var item in items)
                            {
                                if (usedCounts.ContainsKey(item.TentTypeId))
                                {
                                    usedCounts[item.TentTypeId] += item.Quantity;
                                }
                                else
                                {
                                    // Try match by name
                                    var matched = types.FirstOrDefault(tt => tt.Name.Equals(item.TentTypeName, StringComparison.OrdinalIgnoreCase));
                                    if (matched != null)
                                    {
                                        usedCounts[matched.Id] += item.Quantity;
                                    }
                                }
                            }
                            continue;
                        }
                    }
                    catch
                    {
                        // Fallback to legacy calculation
                    }
                }

                // Fallback for bookings without explicit TentSetupDetails
                var slotCount = b.Tents?.Count ?? 0;
                if (slotCount == 1)
                {
                    var small = types.FirstOrDefault(t => t.SlotsOccupied == 1);
                    if (small != null) usedCounts[small.Id] += 1;
                }
                else if (slotCount == 2)
                {
                    var med = types.FirstOrDefault(t => t.SlotsOccupied == 2) ?? types.FirstOrDefault(t => t.SlotsOccupied == 1);
                    if (med != null) usedCounts[med.Id] += 1;
                }
                else if (slotCount >= 4)
                {
                    var large = types.FirstOrDefault(t => t.SlotsOccupied == 4) ?? types.FirstOrDefault(t => t.SlotsOccupied == 2);
                    if (large != null) usedCounts[large.Id] += 1;
                }
            }

            var result = types.Select(t => {
                var used = usedCounts.TryGetValue(t.Id, out var u) ? u : 0;
                var avail = Math.Max(0, t.TotalQuantity - used);
                return new TentTypeDto
                {
                    Id = t.Id,
                    Name = t.Name,
                    Size = t.Size,
                    SlotsOccupied = t.SlotsOccupied,
                    Capacity = t.Capacity,
                    TotalQuantity = t.TotalQuantity,
                    UsedQuantity = used,
                    AvailableQuantity = avail,
                    Price = t.Price,
                    HourlyFirstHourPrice = t.HourlyFirstHourPrice,
                    HourlyExtraHourPrice = t.HourlyExtraHourPrice,
                    Description = t.Description,
                    IsActive = t.IsActive
                };
            }).ToList();

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTentType(int id)
        {
            var item = await _context.TentTypes.FindAsync(id);
            if (item == null) return NotFound();
            return Ok(item);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTentType([FromBody] TentType model)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            model.IsActive = true;
            _context.TentTypes.Add(model);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentTypesUpdated");
            return CreatedAtAction(nameof(GetTentType), new { id = model.Id }, model);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTentType(int id, [FromBody] TentType model)
        {
            var existing = await _context.TentTypes.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Name = model.Name;
            existing.Size = model.Size;
            existing.SlotsOccupied = model.SlotsOccupied > 0 ? model.SlotsOccupied : 1;
            existing.Capacity = model.Capacity;
            existing.TotalQuantity = model.TotalQuantity >= 0 ? model.TotalQuantity : 0;
            existing.Price = model.Price;
            existing.HourlyFirstHourPrice = model.HourlyFirstHourPrice;
            existing.HourlyExtraHourPrice = model.HourlyExtraHourPrice;
            existing.Description = model.Description ?? string.Empty;
            existing.IsActive = model.IsActive;

            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("TentTypesUpdated");
            return Ok(existing);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTentType(int id)
        {
            var existing = await _context.TentTypes.FindAsync(id);
            if (existing == null) return NotFound();

            existing.IsActive = false; // Soft delete
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("TentTypesUpdated");
            return Ok(new { message = $"Đã xóa loại lều {existing.Name} thành công!" });
        }
    }
}
