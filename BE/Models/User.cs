using System.ComponentModel.DataAnnotations;

namespace BuiHuiCamping.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = string.Empty; // "Manager", "Receptionist", "Waiter"

        public int? AssignedZoneId { get; set; }
        public Zone? AssignedZone { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
