using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ErasmusAi.Api.Services.Security
{
    public class EncryptedKeyStore
    {
        private const string KeyFile = "secrets.enc";
        private readonly Dictionary<string, string> _cache = new();
        private readonly object _lock = new();

        public EncryptedKeyStore()
        {
            LoadKeys();
        }

        public void SetKey(string provider, string key)
        {
            lock (_lock)
            {
                _cache[provider] = key;
                SaveKeys();
            }
        }

        public string? GetKey(string provider)
        {
            lock (_lock)
            {
                return _cache.TryGetValue(provider, out var key) ? key : null;
            }
        }

        private void SaveKeys()
        {
            try
            {
                var json = JsonSerializer.Serialize(_cache);
                var data = Encoding.UTF8.GetBytes(json);
                
                // Use DPAPI for current user. Only this user on this machine can decrypt.
                var encrypted = ProtectedData.Protect(data, null, DataProtectionScope.CurrentUser);
                
                File.WriteAllBytes(KeyFile, encrypted);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to save keys: {ex.Message}");
            }
        }

        private void LoadKeys()
        {
            if (!File.Exists(KeyFile)) return;

            try
            {
                var encrypted = File.ReadAllBytes(KeyFile);
                var data = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
                var json = Encoding.UTF8.GetString(data);
                
                var loaded = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
                if (loaded != null)
                {
                    foreach (var kvp in loaded)
                    {
                        _cache[kvp.Key] = kvp.Value;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to load keys: {ex.Message}");
            }
        }
    }
}
