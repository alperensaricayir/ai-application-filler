using ErasmusAi.Api.Services.AI.Interfaces;

namespace ErasmusAi.Api.Services.AI.Internal
{
    public class SmartContextReducerService
    {
        private readonly IAIProvider _aiProvider;

        public SmartContextReducerService(IAIProvider aiProvider)
        {
            _aiProvider = aiProvider;
        }

        public async Task<string> SmartReduceAsync(string content)
        {
            if (string.IsNullOrWhiteSpace(content)) return content;

            // Only summarize if content is reasonably long (> 8000 chars)
            if (content.Length <= 8000) return content;

            Console.WriteLine($"[SmartContextReducer] Content length {content.Length} exceeds limit. Auto-summarizing...");

            var summaryPrompt = @"
You are an expert content summarizer for professional applications.
Your goal is to reduce the text length while preserving CRITICAL information for an application form.

INSTRUCTIONS:
1. Keep ALL specific questions found in the text.
2. Keep ALL personal experience details (dates, roles, companies).
3. Keep ALL project description details.
4. REMOVE: Navigation text, website footers, legal disclaimers, cookie warnings, duplicate paragraphs.
5. REMOVE: Generic instructions like 'Please fill this form'.

INPUT TEXT:
================
" + content.Substring(0, Math.Min(content.Length, 12000)) + @"
================

OUTPUT (Condensed Version):";

            try
            {
                // We use a small, fast model call to summarize before the main call
                // Note: This recursively calls the provider. Be careful of infinite loops if provider logic calls this.
                // Since this service is called by AIService, and AIService calls Provider, it's safe 
                // AS LONG AS this call doesn't trigger another reduction.
                // We pass 'null' model to use default.
                
                // Important: The provider itself doesn't use this service. AIService uses this service.
                // So calling _aiProvider.GenerateAsync is safe.
                var summary = await _aiProvider.GenerateAsync(summaryPrompt);
                
                if (string.IsNullOrWhiteSpace(summary)) return content; // Fallback if summary fails
                
                Console.WriteLine($"[SmartContextReducer] Reduced to {summary.Length} chars.");
                return summary;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SmartContextReducer] Summary failed: {ex.Message}. Using original content.");
                return content;
            }
        }
        public async Task<string> ReduceForSpecificQuestion(string fullContext, string question)
        {
            if (string.IsNullOrWhiteSpace(fullContext)) return string.Empty;

            Console.WriteLine($"[SmartContextReducer] Trimming for question: {question}");

            var reductionPrompt = $@"
You are an expert context reducer.
Your goal is to extract ONLY the information from the provided context that is relevant to answering the specific question below.

QUESTION:
{question}

INSTRUCTIONS:
1. Keep only the parts relevant to this specific question.
2. Remove navigation text, unrelated sections, repeated information, legal warnings, and footer text.
3. If the context contains the answer or relevant experience, keep it.
4. If the context contains the specific question itself, keep the surrounding details.

CONTEXT:
================
{fullContext.Substring(0, Math.Min(fullContext.Length, 15000))}
================

OUTPUT (Reduced Context):";

            try
            {
                // Use the provider to generate the reduced context
                var reduced = await _aiProvider.GenerateAsync(reductionPrompt);
                
                if (string.IsNullOrWhiteSpace(reduced)) 
                {
                    Console.WriteLine("[SmartContextReducer] Reduction returned empty. Using original.");
                    return fullContext;
                }

                Console.WriteLine($"[SmartContextReducer] Reduced context size: {fullContext.Length} -> {reduced.Length}");
                return reduced;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SmartContextReducer] Reduction failed: {ex.Message}");
                return fullContext;
            }
        }
    }
}