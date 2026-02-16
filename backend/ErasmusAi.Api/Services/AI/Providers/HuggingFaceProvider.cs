using ErasmusAi.Api.Services.AI.Interfaces;
using System.Text;
using System.Text.Json;
using System.Net.Http.Headers;

namespace ErasmusAi.Api.Services.AI.Providers
{
    public class HuggingFaceProvider : IAIProvider
    {
        private readonly HttpClient _httpClient;
        private readonly ProviderConfigService _configService;
        private readonly IConfiguration _configuration;

        public HuggingFaceProvider(HttpClient httpClient, ProviderConfigService configService, IConfiguration configuration)
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
            var apiKey = _configService.GetApiKey("huggingface")
                ?? _configuration["AI:HuggingFace:ApiKey"]
                ?? string.Empty;

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("HuggingFace API Key is missing. Please configure it in the Admin Panel.");
            }

            var configuredModel = _configService.GetModel("huggingface")
                ?? _configuration["AI:HuggingFace:Model"]
                ?? "mistralai/Mistral-7B-Instruct-v0.2";

            var model = string.IsNullOrWhiteSpace(modelName) ? configuredModel : modelName.Trim();
            
            // New Router API Endpoint (OpenAI Compatible)
            var url = "https://router.huggingface.co/v1/chat/completions";

            Console.WriteLine($"Using provider: HuggingFace (Router API)");
            Console.WriteLine($"Using model: {model}");
            
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var messages = BuildMessages(prompt, out double temperature);

            var requestBody = new
            {
                model = model,
                messages = messages,
                temperature = temperature,
                max_tokens = 2048 // Increased for full Q&A responses
            };
            
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            stopwatch.Stop();
            
            Console.WriteLine($"[HuggingFace] Input: {prompt.Length} chars | Time: {stopwatch.ElapsedMilliseconds}ms | Model: {model} | Temp: {temperature}");

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                
                // Specific Error Handling for User Feedback
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    throw new HttpRequestException("Invalid API Key");
                }
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    throw new HttpRequestException("Model not available on router");
                }
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    throw new HttpRequestException("Rate limit exceeded");
                }

                throw new HttpRequestException($"HuggingFace API failed with status code {response.StatusCode}: {errorContent}");
            }

            var responseString = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseString);

            // Parse response: response.choices[0].message.content
            if (jsonDoc.RootElement.TryGetProperty("choices", out var choices) && 
                choices.ValueKind == JsonValueKind.Array && 
                choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var messageElement))
                {
                    if (messageElement.TryGetProperty("content", out var content))
                    {
                        return content.GetString() ?? string.Empty;
                    }
                }
            }

            return string.Empty;
        }

        public Task<string> ChatAsync(string message)
        {
            return GenerateAsync(message);
        }

        private object[] BuildMessages(string fullPrompt, out double temperature)
        {
            // Default temperature
            temperature = 0.7;

            // Check for System Separator
            var separator = "###SYSTEM_END###";
            if (fullPrompt.Contains(separator))
            {
                var parts = fullPrompt.Split(new[] { separator }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2)
                {
                    var systemContent = parts[0].Trim();
                    var userContent = parts[1].Trim();

                    // Heuristic: Check if this is Question Extraction Mode
                    if (systemContent.Contains("specialized form data extractor") || 
                        systemContent.Contains("extract ONLY explicit application form questions"))
                    {
                        temperature = 0.3; // Lower temperature for extraction
                    }
                    else if (systemContent.Contains("Answer each question separately")) // Question Mode
                    {
                        temperature = 0.2; // Very low temperature for strict Q&A
                    }
                    else if (systemContent.Contains("Motivation Letter")) // Motivation Letter
                    {
                        temperature = 0.7; // High temperature for creativity
                    }

                    return new object[]
                    {
                        new { role = "system", content = systemContent },
                        new { role = "user", content = userContent }
                    };
                }
            }

            // Fallback: Treat entire prompt as user message
            return new object[]
            {
                new { role = "user", content = fullPrompt }
            };
        }
    }
}
