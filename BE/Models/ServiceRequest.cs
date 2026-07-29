using System;

namespace BuiHuiCamping.API.Models
{
    public class ServiceRequest
    {
        public int Id { get; set; }
        public int TentId { get; set; }
        public Tent? Tent { get; set; }
        public string RequestType { get; set; } = "CallStaff"; // CallStaff, CleanUp, Other
        public string? Note { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Resolved
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
