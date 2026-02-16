namespace ErasmusAi.Api.Services.AI
{
    public class ResponseFormatterService
    {
        public string FormatResponse(string response, int? characterLimit)
        {
            if (string.IsNullOrWhiteSpace(response))
                return string.Empty;

            if (!characterLimit.HasValue || characterLimit.Value <= 0)
                return response;

            if (response.Length <= characterLimit.Value)
                return response;

            // Trim to limit
            var trimmed = response.Substring(0, characterLimit.Value);

            // Try to cut at the last space to avoid cutting words
            var lastSpaceIndex = trimmed.LastIndexOf(' ');
            if (lastSpaceIndex > 0)
            {
                trimmed = trimmed.Substring(0, lastSpaceIndex);
            }

            return trimmed + "...";
        }
    }
}
