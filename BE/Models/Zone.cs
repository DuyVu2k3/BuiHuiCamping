namespace BuiHuiCamping.API.Models
{
    public class Zone
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ZoneType { get; set; } = "Camping"; // "Camping" or "DiningTable"

        // Grid land slot capacity (mỗi ô ~3m2)
        public int TotalSlots { get; set; } = 20; // Default: 20 ô đất (~60m2)
        public int GridRows { get; set; } = 4;
        public int GridCols { get; set; } = 5;

        // Navigation property
        public ICollection<Tent> Tents { get; set; } = new List<Tent>();
    }
}
