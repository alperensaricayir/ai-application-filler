using ErasmusAi.Api.Services.AI.Interfaces;
using System.Text;
using System.Text.Json;

namespace ErasmusAi.Api.Services.AI.Providers
{
    public class GeminiProvider : IAIProvider
    {
        private readonly HttpClient _httpClient;
        private readonly ProviderConfigService _configService;
        private readonly IConfiguration _configuration;

        public GeminiProvider(HttpClient httpClient, ProviderConfigService configService, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _configService = configService;
            _configuration = configuration;
        }

        public async Task<string> GenerateAsync(string prompt)
        {
            return await GenerateAsync(prompt, null);
        }

        public async Task<string> GenerateAsync(string prompt, string? modelName)
        {
            var apiKey = _configService.GetApiKey("gemini")
                ?? _configuration["AI:Gemini:ApiKey"]
                ?? string.Empty;

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("Gemini API Key is missing. Please configure it in the Admin Panel.");
            }

            var configuredModel = _configService.GetModel("gemini")
                ?? _configuration["AI:Gemini:Model"]
                ?? "gemini-1.5-flash";

            var model = string.IsNullOrWhiteSpace(modelName) ? configuredModel : modelName.Trim();

            Console.WriteLine($"Using provider: Gemini");
            Console.WriteLine($"Using model: {model}");

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                }
            };

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Gemini API failed with status code {response.StatusCode}: {errorContent}");
            }

            var responseString = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseString);

            if (jsonDoc.RootElement.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
            {
                var firstCandidate = candidates[0];
                if (firstCandidate.TryGetProperty("content", out var contentElement) && 
                    contentElement.TryGetProperty("parts", out var parts) && 
                    parts.GetArrayLength() > 0)
                {
                    return parts[0].GetProperty("text").GetString() ?? string.Empty;
                }
            }

            return string.Empty;
        }

        public Task<string> ChatAsync(string message)
        {
            return GenerateAsync(message);
        }
    }
}
