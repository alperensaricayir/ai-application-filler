using System;

namespace ErasmusAi.Api.Models
{
    public class CV
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public required string FileName { get; set; }
        public required string FilePath { get; set; }
        public bool IsActive { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
