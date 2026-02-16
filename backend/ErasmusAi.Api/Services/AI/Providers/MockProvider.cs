using ErasmusAi.Api.Services.AI.Interfaces;

namespace ErasmusAi.Api.Services.AI.Providers
{
    public class MockProvider : IAIProvider
    {
        public Task<string> GenerateAsync(string prompt)
        {
            return Task.FromResult($"[MOCK RESPONSE] {prompt}");
        }
    }
}
