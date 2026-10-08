using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuiHuiCamping.API.Models
{
    [Table("QrCards")]
    public class QrCard
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string CardCode { get; set; } = string.Empty; // e.g. "QR-01", "VIP-01"

        [MaxLength(50)]
        public string Status { get; set; } = "Available"; // "Available", "Assigned", "Damaged", "Lost"

        public int? CurrentBookingId { get; set; }

        [MaxLength(100)]
        public string? AssignedPlacement { get; set; } // e.g. "Lều Nhỏ (Ô đất A-01)"

        [MaxLength(255)]
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}
