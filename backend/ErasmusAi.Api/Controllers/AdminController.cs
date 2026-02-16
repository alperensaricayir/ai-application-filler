using ErasmusAi.Api.Models.Admin;
using ErasmusAi.Api.Services.AI;
using Microsoft.AspNetCore.Mvc;

namespace ErasmusAi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly ProviderConfigService _configService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public AdminController(ProviderConfigService configService, IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _configService = configService;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        [HttpGet("config")]
        public IActionResult GetConfig()
        {
            var provider = _configService.CurrentProvider;
            var model = _configService.GetModel(provider);
            return Ok(new { provider, model });
        }

        [HttpPost("config")]
        public IActionResult SetConfig([FromBody] ProviderConfigModel model)
        {
            if (string.IsNullOrEmpty(model.Provider))
                return BadRequest("Provider is required");

            _configService.SetProvider(model.Provider);
            if (!string.IsNullOrWhiteSpace(model.Model))
            {
                _configService.SetModel(model.Provider, model.Model);
            }
            return Ok();
        }

        [HttpPost("keys")]
        public IActionResult SetApiKey([FromBody] ApiKeyModel model)
        {
            if (string.IsNullOrEmpty(model.Provider) || string.IsNullOrEmpty(model.Key))
                return BadRequest("Provider and Key are required");

            _configService.SetApiKey(model.Provider, model.Key);
            return Ok();
        }

        [HttpGet("ollama-models")]
        public async Task<IActionResult> GetOllamaModels()
        {
            var recommendedModels = new[] { "llama3:8b", "mistral:7b", "gemma:2b", "phi3" };
            var installedModels = new List<string>();

            try
            {
                using var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(10);
                var baseUrl = _configuration["AI:Ollama:BaseUrl"] ?? "http://localhost:11434";
                var response = await client.GetAsync($"{baseUrl}/api/tags");
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    using var doc = System.Text.Json.JsonDocument.Parse(content);
                    
                    if (doc.RootElement.TryGetProperty("models", out var modelsElement))
                    {
                        foreach (var model in modelsElement.EnumerateArray())
                        {
                            if (model.TryGetProperty("name", out var nameElement))
                            {
                                installedModels.Add(nameElement.GetString() ?? "");
                            }
                        }
                    }
                }
            }
            catch
            {
                // Ollama not running or unreachable
            }

            var result = recommendedModels.Select(m => new OllamaModelInfo
            {
                Name = m,
                Installed = installedModels.Any(im => im.StartsWith(m))
            }).ToList();

            // Also add any other installed models that are not in recommended list
            foreach (var im in installedModels)
            {
                if (!result.Any(r => im.StartsWith(r.Name)))
                {
                    result.Add(new OllamaModelInfo { Name = im, Installed = true });
                }
            }

            return Ok(result);
        }

        public class SetModelRequest
        {
            public string? Model { get; set; }
        }

        [HttpPost("set-model")]
        [Produces("application/json")]
        public IActionResult SetModel([FromBody] SetModelRequest request)
        {
            try
            {
                static string NormalizeProvider(string? raw)
                {
                    return raw?.Trim().ToLowerInvariant() switch
                    {
                        "ollama" => "Ollama",
                        "groq" => "Groq",
                        _ => "Unknown"
                    };
                }

                var rawProvider = _configService.CurrentProvider;
                var provider = NormalizeProvider(rawProvider);
                var providerKey = rawProvider?.Trim().ToLowerInvariant() ?? string.Empty;

                var model = request.Model?.Trim();
                if (string.IsNullOrWhiteSpace(model))
                {
                    model = _configService.GetModel(providerKey) ?? "Unknown";
                    return Ok(new { status = "OK", provider, model });
                }

                if (providerKey == "groq" && string.Equals(model, "llama3:8b", StringComparison.OrdinalIgnoreCase))
                {
                    model = "llama-3.1-8b-instant";
                }

                if (!string.IsNullOrWhiteSpace(providerKey) && provider != "Unknown")
                {
                    _configService.SetModel(providerKey, model);
                }

                Console.WriteLine($"Using model: {model}");

                return Ok(new { status = "OK", provider, model });
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }
    }
}
