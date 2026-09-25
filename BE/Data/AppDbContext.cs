using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Models;

namespace BuiHuiCamping.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Zone> Zones { get; set; }
        public DbSet<LandSlot> LandSlots { get; set; }
        public DbSet<LandSlot> Tents => LandSlots; // Backwards compatibility
        public DbSet<TentType> TentTypes { get; set; }
        public DbSet<Booking> Bookings { get; set; }
        public DbSet<MenuItem> MenuItems { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderDetail> OrderDetails { get; set; }
        public DbSet<ServiceRequest> ServiceRequests { get; set; }
        public DbSet<User> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<LandSlot>()
                .ToTable("LandSlots");

            modelBuilder.Entity<LandSlot>()
                .Property(t => t.Price)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<Booking>()
                .Property(b => b.DepositAmount)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<Booking>()
                .Property(b => b.TotalPrice)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<Booking>()
                .HasMany(b => b.Tents)
                .WithMany(s => s.Bookings)
                .UsingEntity<Dictionary<string, object>>(
                    "BookingLandSlot",
                    r => r.HasOne<LandSlot>().WithMany().HasForeignKey("LandSlotsId"),
                    l => l.HasOne<Booking>().WithMany().HasForeignKey("BookingsId")
                );

            modelBuilder.Entity<MenuItem>()
                .Property(m => m.Price)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<Order>()
                .Property(o => o.TotalAmount)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<OrderDetail>()
                .Property(od => od.UnitPrice)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<OrderDetail>()
                .HasOne(od => od.Order)
                .WithMany(o => o.OrderDetails)
                .HasForeignKey(od => od.OrderId);

            modelBuilder.Entity<OrderDetail>()
                .HasOne(od => od.MenuItem)
                .WithMany()
                .HasForeignKey(od => od.MenuItemId);
        }
    }
}
