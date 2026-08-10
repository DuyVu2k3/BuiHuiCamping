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
        UPDATE [Tents] SET [HourlyPriceExtraHour] = 50000 WHERE [HourlyPriceExtraHour] IS NULL;";

        context.Database.ExecuteSqlRaw(sql);
    }
    catch (Exception ex)
    {
        Console.WriteLine("Database auto migration warning: " + ex.Message);
    }
}

    app.Run();
