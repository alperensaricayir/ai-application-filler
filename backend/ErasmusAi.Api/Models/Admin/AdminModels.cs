namespace ErasmusAi.Api.Models.Admin
{
    public class ProviderConfigModel
    {
        public string Provider { get; set; } = string.Empty;
        public string? Model { get; set; }
    }

    public class ApiKeyModel
    {
        public string Provider { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
    }

    public class OllamaModelInfo
    {
        public string Name { get; set; } = string.Empty;
        public bool Installed { get; set; }
    }
}
