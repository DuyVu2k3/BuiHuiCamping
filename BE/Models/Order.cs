using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BuiHuiCamping.API.Models
{
    public class Order
    {
        public int Id { get; set; }
        public int TentId { get; set; }
        public Tent? Tent { get; set; }
        
        public int BookingId { get; set; }
        [JsonIgnore]
        public Booking? Booking { get; set; }
        public string Status { get; set; } = "Unpaid"; // Unpaid, Paid
        public decimal TotalAmount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        
        public ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();
    }
}
