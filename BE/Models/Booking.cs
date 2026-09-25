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
        
        public DateTime BookingTime { get; set; } = DateTime.Now;
        
        public string Status { get; set; } = "Booked"; // Booked (Đã đặt), Occupied (Đang phục vụ), CheckedOut (Đã trả)
        
        public DateTime? CheckInDate { get; set; }
        public DateTime? CheckOutDate { get; set; }
        public DateTime? ActualCheckInDate { get; set; }
        public DateTime? ActualCheckOutDate { get; set; }
        public decimal TotalPrice { get; set; } = 0; // Total tent rental price for this booking
        public decimal DepositAmount { get; set; } = 0;
        public string DepositStatus { get; set; } = "Pending"; // Pending, Paid
        public bool IsQrUnlocked { get; set; } = false; // Receptionist manual override for QR access
        
        public string? BookingType { get; set; } = "Overnight"; // Overnight or Hourly
        public decimal? HourlyFirstHourPrice { get; set; } = 100000;
        public decimal? HourlyExtraHourPrice { get; set; } = 50000;
        public int? EstimatedHours { get; set; } = 1;
        public string? Note { get; set; } = string.Empty;
        
        // Flexible Tent Setup details (JSON list of tents chosen by customer to pitch on the land slots)
        public string? TentSetupDetails { get; set; } = string.Empty;
        public string? TentSetupSummary { get; set; } = string.Empty; // e.g. "2 Lều Nhỏ (~3m²/lều)" or "1 Lều Trung (~6m²)"
        
        // Land slots (Tents table representing parcels) associated with this booking
        public ICollection<Tent> Tents { get; set; } = new List<Tent>();
        
        // Orders associated with this booking (Master Bill)
        public ICollection<Order> Orders { get; set; } = new List<Order>();
    }
}
