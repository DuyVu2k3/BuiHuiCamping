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

// Auto-ensure IsQrUnlocked column exists in Bookings table
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        context.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[Bookings]') 
                AND name = 'IsQrUnlocked'
            )
            BEGIN
                ALTER TABLE [Bookings] ADD [IsQrUnlocked] BIT NOT NULL DEFAULT 0;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[Bookings]') 
                AND name = 'TotalPrice'
            )
            BEGIN
                ALTER TABLE [Bookings] ADD [TotalPrice] DECIMAL(18,2) NOT NULL DEFAULT 0;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[Tents]') 
                AND name = 'IsQrUnlocked'
            )
            BEGIN
                ALTER TABLE [Tents] ADD [IsQrUnlocked] BIT NOT NULL DEFAULT 0;
            END
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine("Error auto-adding IsQrUnlocked column: " + ex.Message);
    }
}

// Map SignalR Hubs
app.MapHub<OrderHub>("/orderHub");

app.Run();
