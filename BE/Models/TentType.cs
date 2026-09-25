using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuiHuiCamping.API.Models
{
    public class TentType
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty; // "Lều Nhỏ", "Lều Trung", "Lều Lớn", "Lều Glamping"

        [MaxLength(50)]
        public string Size { get; set; } = "Small"; // "Small", "Medium", "Large", "Custom"

        public int SlotsOccupied { get; set; } = 1; // Số ô đất quy chuẩn (~3m2/ô) cần để dựng: 1, 2, 4...

        [MaxLength(50)]
        public string Capacity { get; set; } = "1 - 2 khách"; // Sức chứa người

        public int TotalQuantity { get; set; } = 10; // Tổng số lượng lều loại này khu camping đang sở hữu

        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; } = 500000; // Giá thuê qua đêm

        [Column(TypeName = "decimal(18,2)")]
        public decimal HourlyFirstHourPrice { get; set; } = 100000; // Giá giờ đầu

        [Column(TypeName = "decimal(18,2)")]
        public decimal HourlyExtraHourPrice { get; set; } = 50000; // Giá giờ tiếp theo

        public string Description { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;
    }
}
