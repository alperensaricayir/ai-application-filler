using ErasmusAi.Api.Services.AI.Interfaces;

namespace ErasmusAi.Api.Services.AI.Providers
{
    public class DynamicAIProvider : IAIProvider
    {
        public static readonly string[] AvailableProviders = { "ollama", "groq", "huggingface", "gemini" };

        private readonly IServiceProvider _serviceProvider;
        private readonly ProviderConfigService _configService;

        public DynamicAIProvider(IServiceProvider serviceProvider, ProviderConfigService configService)
        {
            _serviceProvider = serviceProvider;
            _configService = configService;
        }

        public async Task<string> GenerateAsync(string prompt)
        {
            return await GenerateAsync(prompt, null);
        }

        public async Task<string> GenerateAsync(string prompt, string? modelName)
        {
            var providerName = _configService.CurrentProvider?.Trim() ?? string.Empty;
            var providerKey = providerName.ToLowerInvariant();

            Console.WriteLine($"Using provider: {providerName}");

            IAIProvider provider = providerKey switch
            {
                "ollama" => _serviceProvider.GetRequiredService<OllamaProvider>(),
                "gemini" => _serviceProvider.GetRequiredService<GeminiProvider>(),
                "groq" => _serviceProvider.GetRequiredService<GroqProvider>(),
                "huggingface" => _serviceProvider.GetRequiredService<HuggingFaceProvider>(),
                "openai" => _serviceProvider.GetRequiredService<OpenAIProvider>(),
                "mock" => _serviceProvider.GetRequiredService<MockProvider>(),
                _ => null
            };

            if (provider == null)
            {
                Console.WriteLine($"Error: Unknown provider '{providerName}' requested.");
                return $"Error: Unknown provider '{providerName}'. Please select a valid provider in Admin Panel.";
            }

            var effectiveModel = modelName;
            if (string.IsNullOrWhiteSpace(effectiveModel))
            {
                effectiveModel = _configService.GetModel(providerKey);
            }

            if (providerKey == "groq" && string.Equals(effectiveModel, "llama3:8b", StringComparison.OrdinalIgnoreCase))
            {
                effectiveModel = "llama-3.1-8b-instant";
            }

            Console.WriteLine($"Using model: {(string.IsNullOrWhiteSpace(effectiveModel) ? "(default)" : effectiveModel)}");

            return await provider.GenerateAsync(prompt, effectiveModel);
        }
    }
}
