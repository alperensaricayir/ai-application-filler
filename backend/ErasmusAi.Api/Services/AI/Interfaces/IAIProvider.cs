namespace ErasmusAi.Api.Services.AI.Interfaces
{
    public interface IAIProvider
    {
        Task<string> GenerateAsync(string prompt);
        
        // Optional: Support dynamic model switching without breaking existing implementations
        // Default implementation for providers that don't support it
        Task<string> GenerateAsync(string prompt, string? modelName) => GenerateAsync(prompt);
    }
}
