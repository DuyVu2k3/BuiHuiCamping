using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;

namespace BuiHuiCamping.API.Controllers
{
    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureUsersSeededAsync()
        {
            try
            {
                var createUsersTableSql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
                BEGIN
                    CREATE TABLE [Users] (
                        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [Username] NVARCHAR(50) NOT NULL,
                        [PasswordHash] NVARCHAR(MAX) NOT NULL,
                        [FullName] NVARCHAR(100) NOT NULL,
                        [Role] NVARCHAR(20) NOT NULL,
                        [AssignedZoneId] INT NULL,
                        [IsActive] BIT NOT NULL DEFAULT 1
                    );
                END
                ELSE
                BEGIN
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'AssignedZoneId')
                    BEGIN
                        ALTER TABLE [Users] ADD [AssignedZoneId] INT NULL;
                    END

                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'ActualCheckInDate')
                    BEGIN
                        ALTER TABLE [Bookings] ADD [ActualCheckInDate] DATETIME2 NULL;
                    END

                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'ActualCheckOutDate')
                    BEGIN
                        ALTER TABLE [Bookings] ADD [ActualCheckOutDate] DATETIME2 NULL;
                    END
                END";

                await _context.Database.ExecuteSqlRawAsync(createUsersTableSql);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Warning ensuring Users table structure: " + ex.Message);
            }

            if (!await _context.Users.AnyAsync())
            {
                var zoneA = await _context.Zones.FirstOrDefaultAsync(z => z.Name.Contains("A"));
                var zoneB = await _context.Zones.FirstOrDefaultAsync(z => z.Name.Contains("B"));

                var users = new List<User>
                {
                    new User
                    {
                        Username = "manager",
                        PasswordHash = "123456",
                        FullName = "Bùi Văn Quản Lý",
                        Role = "Manager",
                        IsActive = true
                    },
                    new User
                    {
                        Username = "reception",
                        PasswordHash = "123456",
                        FullName = "Nguyễn Thị Lễ Tân",
                        Role = "Receptionist",
                        IsActive = true
                    },
                    new User
                    {
                        Username = "waiter_a",
                        PasswordHash = "123456",
                        FullName = "Trần Văn Chạy Bàn (Khu A)",
                        Role = "Waiter",
                        AssignedZoneId = zoneA?.Id,
                        IsActive = true
                    },
                    new User
                    {
                        Username = "waiter_b",
                        PasswordHash = "123456",
                        FullName = "Lê Thị Chạy Bàn (Khu B)",
                        Role = "Waiter",
                        AssignedZoneId = zoneB?.Id,
                        IsActive = true
                    },
                    new User
                    {
                        Username = "waiter_all",
                        PasswordHash = "123456",
                        FullName = "Phạm Văn Chạy Bàn (Toàn Khu)",
                        Role = "Waiter",
                        AssignedZoneId = null,
                        IsActive = true
                    },
                    new User
                    {
                        Username = "bep1",
                        PasswordHash = "123456",
                        FullName = "Đầu Bếp Trưởng Bùi Hui",
                        Role = "Kitchen",
                        IsActive = true
                    }
                };

                _context.Users.AddRange(users);
                await _context.SaveChangesAsync();
            }
            else
            {
                // Ensure bep1 exists in existing DB
                var bepUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == "bep1");
                if (bepUser == null)
                {
                    _context.Users.Add(new User
                    {
                        Username = "bep1",
                        PasswordHash = "123456",
                        FullName = "Đầu Bếp Trưởng Bùi Hui",
                        Role = "Kitchen",
                        IsActive = true
                    });
                    await _context.SaveChangesAsync();
                }

                // Ensure waiter_amthuc exists in existing DB
                var waiterAmThuc = await _context.Users.FirstOrDefaultAsync(u => u.Username == "waiter_amthuc");
                if (waiterAmThuc == null)
                {
                    var zoneAmThuc = await _context.Zones.FirstOrDefaultAsync(z => 
                        z.ZoneType == "DiningTable" || 
                        z.Name.Contains("Ẩm thực") || 
                        z.Name.Contains("Bàn") || 
                        z.Name.Contains("Nhà hàng"));

                    _context.Users.Add(new User
                    {
                        Username = "waiter_amthuc",
                        PasswordHash = "123456",
                        FullName = "Nguyễn Văn Chạy Bàn (Khu Ẩm Thực)",
                        Role = "Waiter",
                        AssignedZoneId = zoneAmThuc?.Id,
                        IsActive = true
                    });
                    await _context.SaveChangesAsync();
                }
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            await EnsureUsersSeededAsync();

            if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            {
                return BadRequest(new { message = "Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu." });
            }

            var user = await _context.Users
                .Include(u => u.AssignedZone)
                .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower());

            if (user == null || user.PasswordHash != dto.Password.Trim() || !user.IsActive)
            {
                return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không chính xác." });
            }

            return Ok(new
            {
                id = user.Id,
                username = user.Username,
                fullName = user.FullName,
                role = user.Role,
                assignedZoneId = user.AssignedZoneId,
                assignedZoneName = user.AssignedZone?.Name ?? "Tất cả các khu",
                token = $"token_mock_{user.Id}_{Guid.NewGuid()}"
            });
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser([FromQuery] int id)
        {
            var user = await _context.Users
                .Include(u => u.AssignedZone)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null) return NotFound(new { message = "Không tìm thấy người dùng." });

            return Ok(new
            {
                id = user.Id,
                username = user.Username,
                fullName = user.FullName,
                role = user.Role,
                assignedZoneId = user.AssignedZoneId,
                assignedZoneName = user.AssignedZone?.Name ?? "Tất cả các khu"
            });
        }
    }
}
