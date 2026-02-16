using ErasmusAi.Api.Services.AI.Interfaces;
using ErasmusAi.Api.Services.AI.Internal;

namespace ErasmusAi.Api.Services.AI
{
    public class AIService
    {
        private readonly IAIProvider _aiProvider;
        private readonly ContextReducer _contextReducer;
        private readonly SmartContextReducerService _smartReducer;
        private string? _cachedReducedContext = null;

        public AIService(IAIProvider aiProvider, ContextReducer contextReducer, SmartContextReducerService smartReducer)
        {
            _aiProvider = aiProvider;
            _contextReducer = contextReducer;
            _smartReducer = smartReducer;
        }

        public async Task<string> GenerateAsync(string prompt, string? modelName = null)
        {
            // PART 1: Smart Summarization for Large Inputs
            if (prompt.Length > 8000)
            {
                prompt = await _smartReducer.SmartReduceAsync(prompt);
            }

            return await GenerateInternalAsync(prompt, modelName);
        }

        public async Task<string> GenerateWithContextAsync(string fullContext, string question, bool useContextCache, string? modelName = null)
        {
            // PART 1: Smart Summarization (applied to context only)
            if (fullContext.Length > 8000)
            {
                fullContext = await _smartReducer.SmartReduceAsync(fullContext);
            }

            if (useContextCache)
            {
                // ... (existing logic) ...
                
                string effectiveContext = await _contextReducer.ReduceIfNecessaryAsync(fullContext);
                
                // Reconstruct a simple prompt with the reduced context
                string prompt = $"{effectiveContext}\n\nQUESTION:\n{question}\n\nANSWER:";
                
                return await GenerateInternalAsync(prompt, modelName);
            }
            else
            {
                // Normal mode: Just combine and send (Internal logic handles safety reduction if it crashes)
                string prompt = $"{fullContext}\n\nQUESTION:\n{question}\n\nANSWER:";
                return await GenerateInternalAsync(prompt, modelName);
            }
        }

        private async Task<string> GenerateInternalAsync(string prompt, string? modelName = null)
        {
            if (string.IsNullOrWhiteSpace(prompt))
            {
                throw new ArgumentException("Prompt cannot be empty", nameof(prompt));
            }

            try 
            {
                return await _aiProvider.GenerateAsync(prompt, modelName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AIService] Generation Error: {ex.Message}");
                throw;
            }
        }
    }
}
