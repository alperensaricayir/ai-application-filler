using ErasmusAi.Api.Data;
using ErasmusAi.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ErasmusAi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CVController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public CVController(AppDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        [HttpPost("upload")]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var uploadsFolder = Path.Combine(_environment.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var uniqueFileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Deactivate previous active CVs
            var activeCVs = await _context.CVs.Where(c => c.IsActive).ToListAsync();
            foreach (var cv in activeCVs)
            {
                cv.IsActive = false;
            }

            var newCV = new CV
            {
                FileName = file.FileName,
                FilePath = filePath,
                IsActive = true
            };

            _context.CVs.Add(newCV);
            await _context.SaveChangesAsync();

            return Ok(new { newCV.Id, newCV.FileName, newCV.IsActive, newCV.UploadedAt });
        }

        [HttpGet("active")]
        public async Task<IActionResult> GetActiveCV()
        {
            var activeCV = await _context.CVs
                .Where(c => c.IsActive)
                .OrderByDescending(c => c.UploadedAt)
                .FirstOrDefaultAsync();

            if (activeCV == null)
                return NotFound("No active CV found.");

            return Ok(activeCV);
        }
    }
}
