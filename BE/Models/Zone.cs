namespace BuiHuiCamping.API.Models
{
    public class Zone
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        // Navigation property
        public ICollection<Tent> Tents { get; set; } = new List<Tent>();
    }
}
