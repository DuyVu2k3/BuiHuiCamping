using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace BuiHuiCamping.API.Models
{
    public class Booking
    {
        public int Id { get; set; }
        
        [Required]
        public string CustomerName { get; set; } = string.Empty;
        
        [Required]
        public string PhoneNumber { get; set; } = string.Empty;
        
        public DateTime BookingTime { get; set; } = DateTime.UtcNow;
        
        public string Status { get; set; } = "Booked"; // Booked (Đã đặt), Occupied (Đang phục vụ), CheckedOut (Đã trả)
        
        public DateTime? CheckInDate { get; set; }
        public DateTime? CheckOutDate { get; set; }
        public decimal DepositAmount { get; set; } = 0;
        public int DepositPercent { get; set; } = 50;
        public string DepositStatus { get; set; } = "Pending"; // Pending, Paid
        public bool IsQrUnlocked { get; set; } = false; // Receptionist manual override for QR access
        
        // Tents associated with this booking
        public ICollection<Tent> Tents { get; set; } = new List<Tent>();
        
        // Orders associated with this booking (Master Bill)
        public ICollection<Order> Orders { get; set; } = new List<Order>();
    }
}
