namespace BuiHuiCamping.API.Models
{
    public class OrderDetail
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public Order? Order { get; set; }
        public int MenuItemId { get; set; }
        public MenuItem? MenuItem { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public string? Note { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Preparing, Delivered
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string? BatchId { get; set; }
        public string? RejectReason { get; set; }
        public string? DeliveredBy { get; set; }
        public string? ProofImage { get; set; }
    }
}
