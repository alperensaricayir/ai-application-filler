using System.Text.Json;
using ErasmusAi.Api.Services.Security;

namespace ErasmusAi.Api.Services.AI
{
    public class ProviderConfigService
    {
        private const string ConfigFile = "app_config.json";
        private readonly EncryptedKeyStore _keyStore;
        private string _currentProvider = "ollama"; // Default
        private Dictionary<string, string> _currentModels = new();
        private readonly object _lock = new();

        public ProviderConfigService(EncryptedKeyStore keyStore)
        {
            _keyStore = keyStore;
            LoadConfig();
        }

        public string CurrentProvider => _currentProvider;

        public string? GetModel(string provider)
        {
            if (string.IsNullOrWhiteSpace(provider)) return null;
            var key = provider.Trim().ToLowerInvariant();
            lock (_lock)
            {
                return _currentModels.TryGetValue(key, out var model) ? model : null;
            }
        }

        public void SetModel(string provider, string model)
        {
            if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(model)) return;
            var key = provider.Trim().ToLowerInvariant();
            lock (_lock)
            {
                _currentModels[key] = model.Trim();
                SaveConfig();
            }
        }

        public void SetProvider(string provider)
        {
            lock (_lock)
            {
                _currentProvider = provider.ToLowerInvariant();
                SaveConfig();
            }
        }

        public void SetApiKey(string provider, string key)
        {
            _keyStore.SetKey(provider.ToLowerInvariant(), key);
        }

        public string? GetApiKey(string provider)
        {
            return _keyStore.GetKey(provider.ToLowerInvariant());
        }

        private void SaveConfig()
        {
            try
            {
                var config = new
                {
                    CurrentProvider = _currentProvider,
                    Models = _currentModels
                };
                var json = JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(ConfigFile, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to save config: {ex.Message}");
            }
        }

        private void LoadConfig()
        {
            if (!File.Exists(ConfigFile)) return;

            try
            {
                var json = File.ReadAllText(ConfigFile);
                var config = JsonSerializer.Deserialize<ConfigData>(json);
                if (config != null)
                {
                    _currentProvider = config.CurrentProvider ?? "ollama";
                    if (config.Models != null)
                    {
                        _currentModels = new Dictionary<string, string>(config.Models, StringComparer.OrdinalIgnoreCase);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to load config: {ex.Message}");
            }
        }

        private class ConfigData
        {
            public string? CurrentProvider { get; set; }
            public Dictionary<string, string>? Models { get; set; }
        }
    }
}
