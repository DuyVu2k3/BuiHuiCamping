using System.Text.Json.Serialization;

namespace BuiHuiCamping.API.Models
{
    public class Tent
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string QRCodeData { get; set; } = string.Empty;
        public string Status { get; set; } = "Available"; // Available, Booked, Occupied, Maintenance
        public bool IsQrUnlocked { get; set; } = false; // Per-tent QR unlock override
        public string TentType { get; set; } = "Standard"; // Ngủ nhỏ, Ngủ lớn, Tiệc
        public decimal Price { get; set; } = 0;
        public decimal? HourlyPriceFirstHour { get; set; } = 100000;
        public decimal? HourlyPriceExtraHour { get; set; } = 50000;
        
        public string MapTop { get; set; } = string.Empty;
        public string MapLeft { get; set; } = string.Empty;

        // Many-to-Many with Booking
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();

        // Foreign Key
        public int? ZoneId { get; set; }

        // Navigation Property
        public Zone? Zone { get; set; }
    }
}
