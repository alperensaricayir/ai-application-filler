using ErasmusAi.Api.Services.AI.Interfaces;
using System.Text;
using System.Text.Json;
using System.Net.Http.Headers;

namespace ErasmusAi.Api.Services.AI.Providers
{
    public class GroqProvider : IAIProvider
    {
        private readonly HttpClient _httpClient;
        private readonly ProviderConfigService _configService;
        private readonly IConfiguration _configuration;

        public GroqProvider(HttpClient httpClient, ProviderConfigService configService, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _configService = configService;
            _configuration = configuration;
        }

        private static readonly HashSet<string> AllowedModels = new()
        {
            "llama-3.1-8b-instant",
            "llama-3.1-70b-versatile",
            "mixtral-8x7b-32768"
        };

        public async Task<string> GenerateAsync(string prompt)
        {
            return await GenerateAsync(prompt, null);
        }

        public async Task<string> GenerateAsync(string prompt, string? modelName)
        {
            var apiKey = _configService.GetApiKey("groq");
            if (string.IsNullOrEmpty(apiKey))
            {
                throw new InvalidOperationException("Groq API Key is missing. Please configure it in the Admin Panel.");
            }

            var url = "https://api.groq.com/openai/v1/chat/completions";
            // Default to llama-3.1-8b-instant if not configured
            var model = !string.IsNullOrEmpty(modelName) ? modelName : (_configuration["AI:Groq:Model"] ?? "llama-3.1-8b-instant");

            // Safety: Force allowed models
            if (!AllowedModels.Contains(model))
            {
                model = "llama-3.1-8b-instant";
            }
            
            Console.WriteLine($"Groq model validated: {model}");

            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            async Task<HttpResponseMessage> SendRequest(string targetModel)
            {
                var requestBody = new
                {
                    model = targetModel,
                    messages = new[]
                    {
                        new { role = "user", content = prompt }
                    },
                    temperature = 0.7
                };

                var requestJson = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(requestJson, Encoding.UTF8, "application/json");
                return await _httpClient.PostAsync(url, content);
            }

            var response = await SendRequest(model);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                
                // PART 1: FIX GROQ DEPRECATED MODEL AUTO-FALLBACK
                if (errorContent.Contains("model_decommissioned") || errorContent.Contains("model_not_found"))
                {
                    Console.WriteLine($"Groq model '{model}' deprecated or not found. Falling back to llama-3.1-8b-instant");
                    response = await SendRequest("llama-3.1-8b-instant");
                    
                    if (!response.IsSuccessStatusCode)
                    {
                         var fallbackError = await response.Content.ReadAsStringAsync();
                         throw new HttpRequestException($"Groq Fallback Failed. Original: {errorContent} | Fallback: {fallbackError}");
                    }
                }
                else
                {
                    throw new HttpRequestException($"Groq API failed with status code {response.StatusCode}: {errorContent}");
                }
            }

            var responseString = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseString);

            if (jsonDoc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) && 
                    message.TryGetProperty("content", out var contentElement))
                {
                    return contentElement.GetString() ?? string.Empty;
                }
            }

            return string.Empty;
        }
    }
}
