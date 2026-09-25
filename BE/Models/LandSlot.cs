using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BuiHuiCamping.API.Models
{
    [Table("LandSlots")]
    public class LandSlot
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string QRCodeData { get; set; } = string.Empty;
        public string Status { get; set; } = "Available"; // Available, Booked, Occupied, Maintenance
        public bool IsQrUnlocked { get; set; } = false; // Per-slot QR unlock override
        public string TentType { get; set; } = "Standard";
        
        // Grid slot & Dynamic tent size
        public string Size { get; set; } = "Small"; // "Small" (1 ô ~3m2), "Medium" (2 ô ~6m2), "Large" (4 ô ~12m2), "DiningTable"
        public int SlotsOccupied { get; set; } = 1; // 1, 2, or 4 slots
        public string SlotCode { get; set; } = string.Empty; // Mã ô định vị tương đối, ví dụ: "01", "02"
        public int GridX { get; set; } = 0; // Tọa độ cột ô lưới
        public int GridY { get; set; } = 0; // Tọa độ hàng ô lưới

        public decimal Price { get; set; } = 0;
        public decimal? HourlyPriceFirstHour { get; set; } = 100000;
        public decimal? HourlyPriceExtraHour { get; set; } = 50000;
        
        public string MapTop { get; set; } = string.Empty;
        public string MapLeft { get; set; } = string.Empty;

        // Many-to-Many with Booking
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();

        // Foreign Key
        public int? ZoneId { get; set; }

        // Foreign Key for Table Merging
        public int? MergedParentTentId { get; set; }

        // Navigation Property
        public Zone? Zone { get; set; }
    }
}
