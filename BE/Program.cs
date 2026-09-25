using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Hubs;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add Controllers
builder.Services.AddControllers().AddJsonOptions(options => {
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

// Add SignalR
builder.Services.AddSignalR();

// Enable CORS for frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection(); // Disabled for mobile LAN testing without SSL cert issues
app.UseStaticFiles(); // Enable serving files from wwwroot
app.UseCors();

app.UseAuthorization();

app.MapControllers();

// Map SignalR Hubs
app.MapHub<OrderHub>("/orderHub");

// Ensure DB columns exist on Startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        var sql = @"
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

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Zones') AND name = 'ZoneType')
        BEGIN
            ALTER TABLE [Zones] ADD [ZoneType] NVARCHAR(50) NOT NULL DEFAULT 'Camping';
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'BookingType')
        BEGIN
            ALTER TABLE [Bookings] ADD [BookingType] NVARCHAR(50) NOT NULL DEFAULT 'Overnight';
        END

        -- Auto-fix any bookings where CheckInDate and CheckOutDate are on the same day to Hourly
        EXEC('UPDATE Bookings SET BookingType = ''Hourly'' WHERE CheckInDate IS NOT NULL AND CheckOutDate IS NOT NULL AND CAST(CheckInDate AS DATE) = CAST(CheckOutDate AS DATE)');

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'HourlyFirstHourPrice')
        BEGIN
            ALTER TABLE [Bookings] ADD [HourlyFirstHourPrice] DECIMAL(18,2) NOT NULL DEFAULT 100000;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'HourlyExtraHourPrice')
        BEGIN
            ALTER TABLE [Bookings] ADD [HourlyExtraHourPrice] DECIMAL(18,2) NOT NULL DEFAULT 50000;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'Note')
        BEGIN
            ALTER TABLE [Bookings] ADD [Note] NVARCHAR(MAX) NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'EstimatedHours')
        BEGIN
            ALTER TABLE [Bookings] ADD [EstimatedHours] INT NOT NULL DEFAULT 1;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'HourlyPriceFirstHour')
        BEGIN
            ALTER TABLE [Tents] ADD [HourlyPriceFirstHour] DECIMAL(18,2) NOT NULL DEFAULT 100000;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'HourlyPriceExtraHour')
        BEGIN
            ALTER TABLE [Tents] ADD [HourlyPriceExtraHour] DECIMAL(18,2) NOT NULL DEFAULT 50000;
        END

        UPDATE [Bookings] SET [BookingType] = 'Overnight' WHERE [BookingType] IS NULL;
        UPDATE [Bookings] SET [HourlyFirstHourPrice] = 100000 WHERE [HourlyFirstHourPrice] IS NULL;
        UPDATE [Bookings] SET [HourlyExtraHourPrice] = 50000 WHERE [HourlyExtraHourPrice] IS NULL;
        UPDATE [Bookings] SET [EstimatedHours] = 1 WHERE [EstimatedHours] IS NULL;
        UPDATE [Bookings] SET [Note] = '' WHERE [Note] IS NULL;

        UPDATE [Tents] SET [HourlyPriceFirstHour] = 100000 WHERE [HourlyPriceFirstHour] IS NULL;
        UPDATE [Tents] SET [HourlyPriceExtraHour] = 50000 WHERE [HourlyPriceExtraHour] IS NULL;

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OrderDetails') AND name = 'RejectReason')
        BEGIN
            ALTER TABLE [OrderDetails] ADD [RejectReason] NVARCHAR(MAX) NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OrderDetails') AND name = 'DeliveredBy')
        BEGIN
            ALTER TABLE [OrderDetails] ADD [DeliveredBy] NVARCHAR(200) NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OrderDetails') AND name = 'ProofImage')
        BEGIN
            ALTER TABLE [OrderDetails] ADD [ProofImage] NVARCHAR(MAX) NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'MergedParentTentId')
        BEGIN
            ALTER TABLE [Tents] ADD [MergedParentTentId] INT NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Zones') AND name = 'TotalSlots')
        BEGIN
            ALTER TABLE [Zones] ADD [TotalSlots] INT NOT NULL DEFAULT 20;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Zones') AND name = 'GridRows')
        BEGIN
            ALTER TABLE [Zones] ADD [GridRows] INT NOT NULL DEFAULT 4;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Zones') AND name = 'GridCols')
        BEGIN
            ALTER TABLE [Zones] ADD [GridCols] INT NOT NULL DEFAULT 5;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'Size')
        BEGIN
            ALTER TABLE [Tents] ADD [Size] NVARCHAR(50) NOT NULL DEFAULT 'Small';
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'SlotsOccupied')
        BEGIN
            ALTER TABLE [Tents] ADD [SlotsOccupied] INT NOT NULL DEFAULT 1;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'SlotCode')
        BEGIN
            ALTER TABLE [Tents] ADD [SlotCode] NVARCHAR(50) NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'GridX')
        BEGIN
            ALTER TABLE [Tents] ADD [GridX] INT NOT NULL DEFAULT 0;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tents') AND name = 'GridY')
        BEGIN
            ALTER TABLE [Tents] ADD [GridY] INT NOT NULL DEFAULT 0;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'TentSetupDetails')
        BEGIN
            ALTER TABLE [Bookings] ADD [TentSetupDetails] NVARCHAR(MAX) NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Bookings') AND name = 'TentSetupSummary')
        BEGIN
            ALTER TABLE [Bookings] ADD [TentSetupSummary] NVARCHAR(250) NULL;
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TentTypes')
        BEGIN
            CREATE TABLE [TentTypes] (
                [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                [Name] NVARCHAR(100) NOT NULL,
                [Size] NVARCHAR(50) NOT NULL DEFAULT 'Small',
                [SlotsOccupied] INT NOT NULL DEFAULT 1,
                [Capacity] NVARCHAR(50) NOT NULL DEFAULT '1 - 2 khách',
                [TotalQuantity] INT NOT NULL DEFAULT 10,
                [Price] DECIMAL(18,2) NOT NULL DEFAULT 500000,
                [HourlyFirstHourPrice] DECIMAL(18,2) NOT NULL DEFAULT 100000,
                [HourlyExtraHourPrice] DECIMAL(18,2) NOT NULL DEFAULT 50000,
                [Description] NVARCHAR(MAX) NULL DEFAULT '',
                [IsActive] BIT NOT NULL DEFAULT 1
            );

            INSERT INTO [TentTypes] ([Name], [Size], [SlotsOccupied], [Capacity], [TotalQuantity], [Price], [HourlyFirstHourPrice], [HourlyExtraHourPrice], [Description], [IsActive])
            VALUES 
            (N'Lều Nhỏ (1-2 khách)', 'Small', 1, N'1 - 2 khách', 12, 500000, 100000, 50000, N'Lều vòm dã ngoại tiêu chuẩn, chiếm 1 ô đất (~3m²)', 1),
            (N'Lều Trung (3-4 khách)', 'Medium', 2, N'3 - 4 khách', 6, 800000, 150000, 80000, N'Lều gia đình tiện nghi, chiếm 2 ô đất (~6m²)', 1),
            (N'Lều Lớn (5-8 khách)', 'Large', 4, N'5 - 8 khách', 3, 1200000, 250000, 120000, N'Lều tập thể cỡ lớn, chiếm 4 ô đất (~12m²)', 1);
        END

        EXEC('UPDATE [Tents] SET [Size] = ''Small'' WHERE [Size] IS NULL');
        EXEC('UPDATE [Tents] SET [SlotsOccupied] = 1 WHERE [SlotsOccupied] IS NULL OR [SlotsOccupied] = 0');
        EXEC('UPDATE [Tents] SET [SlotCode] = [Name] WHERE [SlotCode] IS NULL OR [SlotCode] = ''''');
        EXEC('UPDATE [Zones] SET [TotalSlots] = 20 WHERE [TotalSlots] IS NULL OR [TotalSlots] = 0');
        EXEC('UPDATE [Zones] SET [GridRows] = 4 WHERE [GridRows] IS NULL OR [GridRows] = 0');
        EXEC('UPDATE [Zones] SET [GridCols] = 5 WHERE [GridCols] IS NULL OR [GridCols] = 0');";

        context.Database.ExecuteSqlRaw(sql);
    }
    catch (Exception ex)
    {
        Console.WriteLine("Database auto migration warning: " + ex.Message);
    }
}

    app.Run();
