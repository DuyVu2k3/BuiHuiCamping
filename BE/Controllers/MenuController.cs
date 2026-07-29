using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BuiHuiCamping.API.Data;
using BuiHuiCamping.API.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace BuiHuiCamping.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MenuController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        public MenuController(AppDbContext context, IWebHostEnvironment env) { 
            _context = context; 
            _env = env;
        }

        // End-user sees available menu
        [HttpGet]
        public async Task<IActionResult> GetMenu()
        {
            var menu = await _context.MenuItems.Where(m => m.IsAvailable).ToListAsync();
            return Ok(menu);
        }

        // Manager adds menu item with image upload
        [HttpPost]
        public async Task<IActionResult> AddMenuItem([FromForm] MenuItem item, IFormFile? imageFile)
        {
            // Reset ID in case FE sends it
            item.Id = 0;

            if (imageFile != null && imageFile.Length > 0)
            {
                var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var uploadsFolder = Path.Combine(webRoot, "uploads");
                
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }
                
                var uniqueFileName = Guid.NewGuid().ToString() + "_" + imageFile.FileName;
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);
                
                using (var fileStream = new FileStream(filePath, FileMode.Create))
                {
                    await imageFile.CopyToAsync(fileStream);
                }
                
                item.ImageUrl = "/uploads/" + uniqueFileName;
            }

            _context.MenuItems.Add(item);
            await _context.SaveChangesAsync();
            return Ok(item);
        }
    }
}
