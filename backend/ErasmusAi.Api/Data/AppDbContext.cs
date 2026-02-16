using ErasmusAi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ErasmusAi.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<CV> CVs { get; set; }
    }
}
