using ErasmusAi.Api.Models.AI;
using System.Text.Json;

namespace ErasmusAi.Api.Services.AI
{
    public class FormAnalysisService
    {
        private readonly AIService _aiService;

        public FormAnalysisService(AIService aiService)
        {
            _aiService = aiService;
        }

        public async Task<FormAnalysisResponse> AnalyzeFormAsync(string formText)
        {
            var prompt = $@"
You are an expert in academic and internship application analysis. 
From the provided text, extract:

1. Application type (Erasmus+, Internship, Youth Exchange, Research, etc.)
2. Program topic (short descriptive title)
3. Suggested writing focus notes (2-3 bullet ideas)

Return STRICT JSON:

{{
  ""applicationType"": ""..."",
  ""programTopic"": ""..."",
  ""suggestedNotes"": ""...""
}}

If unknown, return empty string for that field.

TEXT TO ANALYZE:
{formText}
";

            var jsonResponse = await _aiService.GenerateAsync(prompt);
            return ParseResponse<FormAnalysisResponse>(jsonResponse);
        }

        public async Task<ProjectAnalysisResponse> AnalyzeProjectAsync(string projectText)
        {
            var prompt = $@"
You are an expert in project analysis. 
From the provided text, extract:

1. Application type (Erasmus+, Internship, Youth Exchange, Research, etc.)
2. Program topic (short descriptive title)

Return STRICT JSON:

{{
  ""applicationType"": ""..."",
  ""programTopic"": ""...""
}}

If unknown, return empty string for that field.

TEXT TO ANALYZE:
{projectText}
";

            var jsonResponse = await _aiService.GenerateAsync(prompt);
            return ParseResponse<ProjectAnalysisResponse>(jsonResponse);
        }

        private T ParseResponse<T>(string json) where T : new()
        {
            try
            {
                // Try to clean up json if it contains markdown code blocks
                var cleanJson = json.Replace("```json", "").Replace("```", "").Trim();
                
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                
                return JsonSerializer.Deserialize<T>(cleanJson, options) ?? new T();
            }
            catch
            {
                // Fallback if parsing fails - return empty object
                return new T();
            }
        }
    }
}
