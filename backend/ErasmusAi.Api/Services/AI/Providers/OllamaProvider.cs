using ErasmusAi.Api.Services.AI.Interfaces;
using System.Text;
using System.Text.Json;

namespace ErasmusAi.Api.Services.AI.Providers
{
    public class OllamaProvider : IAIProvider
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        public OllamaProvider(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _configuration = configuration;
        }

        public async Task<string> GenerateAsync(string prompt)
        {
            return await GenerateAsync(prompt, null);
        }

        public async Task<string> GenerateAsync(string prompt, string? modelName)
        {
            var baseUrl = _configuration["AI:Ollama:BaseUrl"];
            // Use requested model if provided, otherwise fallback to config default
            var model = !string.IsNullOrEmpty(modelName) ? modelName : _configuration["AI:Ollama:Model"];

            if (string.IsNullOrEmpty(baseUrl))
            {
                throw new InvalidOperationException("Ollama Base URL is missing in configuration.");
            }

            if (string.IsNullOrEmpty(model))
            {
                throw new InvalidOperationException("Ollama Model is missing in configuration.");
            }

            // Ensure base URL doesn't end with slash to avoid double slashes
            baseUrl = baseUrl.TrimEnd('/');

            var requestBody = new
            {
                model = model,
                prompt = prompt,
                stream = false
            };

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            try
            {
                var response = await _httpClient.PostAsync($"{baseUrl}/api/generate", content);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    throw new HttpRequestException($"Ollama API failed with status code {response.StatusCode}: {errorContent}");
                }

                var responseString = await response.Content.ReadAsStringAsync();
                
                using (var jsonDoc = JsonDocument.Parse(responseString))
                {
                    if (jsonDoc.RootElement.TryGetProperty("response", out var responseElement))
                    {
                        var result = responseElement.GetString();
                        if (string.IsNullOrEmpty(result))
                        {
                            throw new InvalidOperationException("Ollama returned an empty response.");
                        }
                        return result;
                    }
                    else
                    {
                         throw new InvalidOperationException("Ollama response format is invalid. 'response' field is missing.");
                    }
                }
            }
            catch (Exception ex) when (ex is not HttpRequestException && ex is not InvalidOperationException)
            {
                 throw new Exception($"An unexpected error occurred while communicating with Ollama: {ex.Message}", ex);
            }
        }
    }
}
