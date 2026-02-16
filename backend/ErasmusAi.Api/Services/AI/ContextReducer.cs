using ErasmusAi.Api.Services.AI.Interfaces;

namespace ErasmusAi.Api.Services.AI
{
    public class ContextReducer
    {
        private readonly IAIProvider _aiProvider;

        public ContextReducer(IAIProvider aiProvider)
        {
            _aiProvider = aiProvider;
        }

        public async Task<string> ReduceIfNecessaryAsync(string fullContext)
        {
            // 1. If context length is safe, return original
            if (string.IsNullOrWhiteSpace(fullContext) || fullContext.Length < 5000)
            {
                return fullContext;
            }

            // 2. If context is too long, summarize it using the AI provider
            // We use a specific prompt for compression
            var compressionPrompt = @"
Compress the following Erasmus application context. 
Keep only: 
- Education 
- Work experience 
- Skills 
- Relevant achievements 
- Information relevant to youth exchange or internship 

Remove repetition. 
Keep it under 2000 characters. 
Keep structured bullet format.

CONTEXT TO COMPRESS:
" + fullContext;

            try
            {
                // We don't want to loop infinitely, so we call the provider directly 
                // or via a minimal wrapper, but here we assume provider handles a single request fine 
                // as long as THIS prompt itself isn't massive. 
                // However, if fullContext is 50k chars, even this might fail.
                // For safety, we hard-trim the input to 12000 chars before asking for summary
                // to prevent the summarization request itself from crashing.
                
                string safeContextInput = fullContext.Length > 12000 
                    ? fullContext.Substring(0, 12000) + "\n...(truncated)..." 
                    : fullContext;

                string finalPrompt = compressionPrompt.Replace(fullContext, safeContextInput);
                
                var summary = await _aiProvider.GenerateAsync(finalPrompt);
                
                return summary;
            }
            catch
            {
                // If summarization fails, fallback to hard truncation
                // This ensures we never return a 500 just because summarization failed
                return fullContext.Substring(0, 4000) + "\n...(content auto-reduced due to size limit)...";
            }
        }
    }
}
