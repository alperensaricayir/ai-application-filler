using ErasmusAi.Api.Models.AI;
using ErasmusAi.Api.Services.AI;
using ErasmusAi.Api.Services.AI.Providers;
using ErasmusAi.Api.Services.AI.Internal;
using Microsoft.AspNetCore.Mvc;

namespace ErasmusAi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AIController : ControllerBase
    {
        private readonly AIService _aiService;
        private readonly PromptBuilderService _promptBuilderService;
        private readonly ResponseFormatterService _responseFormatterService;
        private readonly IConfiguration _configuration;
        private readonly ProviderConfigService _providerConfig;
        private readonly SmartContextReducerService _smartContextReducer;

        public AIController(
            AIService aiService, 
            PromptBuilderService promptBuilderService,
            ResponseFormatterService responseFormatterService,
            IConfiguration configuration,
            ProviderConfigService providerConfig,
            SmartContextReducerService smartContextReducer)
        {
            _aiService = aiService;
            _promptBuilderService = promptBuilderService;
            _responseFormatterService = responseFormatterService;
            _configuration = configuration;
            _providerConfig = providerConfig;
            _smartContextReducer = smartContextReducer;
        }

        [HttpGet("providers")]
        [Produces("application/json")]
        public IActionResult GetProviders()
        {
            return Ok(DynamicAIProvider.AvailableProviders);
        }

        [HttpGet("models")]
        [Produces("application/json")]
        public async Task<IActionResult> GetAvailableModels([FromQuery] string? provider = null)
        {
            try
            {
                var effectiveProvider = (provider ?? _providerConfig.CurrentProvider ?? "").Trim().ToLowerInvariant();

                if (effectiveProvider == "groq")
                {
                    return Ok(new[]
                    {
                        new { id = "llama-3.1-8b-instant", name = "Llama 3.1 8B Instant" },
                        new { id = "llama-3.1-70b-versatile", name = "Llama 3.1 70B Versatile" },
                        new { id = "mixtral-8x7b-32768", name = "Mixtral 8x7B" }
                    });
                }

                // Default: Ollama models from local Ollama API
                var baseUrl = _configuration["AI:Ollama:BaseUrl"] ?? "http://localhost:11434";
                using var client = new HttpClient();
                client.Timeout = TimeSpan.FromSeconds(5);

                var response = await client.GetAsync($"{baseUrl}/api/tags");
                if (!response.IsSuccessStatusCode)
                {
                    return Ok(Array.Empty<object>());
                }

                var content = await response.Content.ReadAsStringAsync();
                using var doc = System.Text.Json.JsonDocument.Parse(content);

                var models = new List<object>();
                if (doc.RootElement.TryGetProperty("models", out var modelsElement))
                {
                    foreach (var model in modelsElement.EnumerateArray())
                    {
                        if (model.TryGetProperty("name", out var nameElement))
                        {
                            var name = nameElement.GetString();
                            if (!string.IsNullOrWhiteSpace(name))
                            {
                                models.Add(new { id = name, name });
                            }
                        }
                    }
                }

                return Ok(models);
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpGet("api-test")]
        public IActionResult ApiTest()
        {
            return Ok("Backend OK");
        }

        [HttpGet("llm-test")]
        public async Task<IActionResult> LlmTest([FromQuery] string prompt = "Hello")
        {
            try
            {
                var response = await _aiService.GenerateAsync(prompt);
                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("provider-status")]
        [Produces("application/json")]
        public IActionResult GetProviderStatus()
        {
            try
            {
                static string NormalizeProvider(string? raw)
                {
                    return raw?.Trim().ToLowerInvariant() switch
                    {
                        "ollama" => "Ollama",
                        "groq" => "Groq",
                        "gemini" => "Gemini",
                        "huggingface" => "HuggingFace",
                        "openai" => "OpenAI",
                        _ => "Unknown"
                    };
                }

                var rawProvider = _providerConfig.CurrentProvider;
                var provider = NormalizeProvider(rawProvider);
                var providerKey = rawProvider?.Trim().ToLowerInvariant() ?? string.Empty;
                var model = _providerConfig.GetModel(providerKey) ?? string.Empty;
                
                // Check API Key existence for non-local providers
                bool apiKeyConfigured = false;
                if (provider != "Ollama" && provider != "Unknown")
                {
                    var key = _providerConfig.GetApiKey(providerKey);
                    apiKeyConfigured = !string.IsNullOrWhiteSpace(key);
                }
                else if (provider == "Ollama")
                {
                    apiKeyConfigured = true; // Local provider doesn't need key
                }

                Console.WriteLine($"Provider Status → {provider} | Model → {(string.IsNullOrWhiteSpace(model) ? "Unknown" : model)} | Key Configured: {apiKeyConfigured}");

                return Ok(new { 
                    status = "OK", 
                    provider, 
                    model = string.IsNullOrWhiteSpace(model) ? "Unknown" : model,
                    apiKeyConfigured
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetProviderStatus: {ex}");
                return Ok(new { 
                    status = "ERROR", 
                    provider = "unknown", 
                    model = "", 
                    apiKeyConfigured = false 
                });
            }
        }

        [HttpGet("model-status")]
        [Produces("application/json")]
        public IActionResult GetModelStatus()
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

                var rawProvider = _providerConfig.CurrentProvider;
                var provider = NormalizeProvider(rawProvider);
                var providerKey = rawProvider?.Trim().ToLowerInvariant() ?? string.Empty;
                var model = _providerConfig.GetModel(providerKey) ?? "Unknown";

                Console.WriteLine($"Model Status Requested → {provider} / {model}");

                return Ok(new { status = "OK", provider, model });
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        public class AiSetModelRequest
        {
            public string? Model { get; set; }
        }

        [HttpPost("set-model")]
        [Produces("application/json")]
        public IActionResult SetModel([FromBody] AiSetModelRequest request)
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

                var rawProvider = _providerConfig.CurrentProvider;
                var provider = NormalizeProvider(rawProvider);
                var providerKey = rawProvider?.Trim().ToLowerInvariant() ?? string.Empty;

                var model = request.Model?.Trim();
                if (string.IsNullOrWhiteSpace(model))
                {
                    model = _providerConfig.GetModel(providerKey) ?? "Unknown";
                    return Ok(new { status = "OK", provider, model });
                }

                if (providerKey == "groq" && string.Equals(model, "llama3:8b", StringComparison.OrdinalIgnoreCase))
                {
                    model = "llama-3.1-8b-instant";
                }

                if (!string.IsNullOrWhiteSpace(providerKey) && provider != "Unknown")
                {
                    _providerConfig.SetModel(providerKey, model);
                }

                Console.WriteLine($"Model Set → {provider} / {model}");

                return Ok(new { status = "OK", provider, model });
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpGet("provider-test")]
        public async Task<IActionResult> ProviderTest()
        {
            try
            {
                // Simple prompt to verify connectivity
                var response = await _aiService.GenerateAsync("Say hello");
                if (!string.IsNullOrEmpty(response))
                {
                    return Ok(new { success = true });
                }
                return StatusCode(500, new { success = false, error = "Empty response from provider" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { success = false, error = "Message cannot be empty." });

            try
            {
                Console.WriteLine("AI Chat endpoint called.");
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();

                var response = await _aiService.GenerateAsync(request.Message);
                stopwatch.Stop();

                var elapsedMs = stopwatch.ElapsedMilliseconds;
                Console.WriteLine($"Response time: {elapsedMs} ms");

                return Ok(new 
                { 
                    success = true, 
                    response,
                    responseTimeMs = elapsedMs,
                    durationMs = elapsedMs
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpPost("generate")]
        public async Task<IActionResult> Generate([FromBody] AnswerGenerationRequest request)
        {
            // Payload Size Guard (approx 20KB)
            if (Request.ContentLength > 20480)
            {
                return BadRequest(new { success = false, error = "Input too large. Please reduce content." });
            }

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                Console.WriteLine($"Selected Provider in Generate: {_providerConfig.CurrentProvider}");

                var providerKey = (_providerConfig.CurrentProvider ?? string.Empty).Trim().ToLowerInvariant();

                // Defensive Null Checks
                request.CVContent = request.CVContent ?? string.Empty;
                request.ApplicationContent = request.ApplicationContent ?? string.Empty;
                request.AdditionalNotes = request.AdditionalNotes ?? string.Empty;
                request.Question = request.Question ?? string.Empty;

                // SmartContextReducer Logic
                string? trimmedCv = null;
                string? trimmedProject = null;
                string? trimmedForm = null;

                if (request.EnableTextTrimmer)
                {
                    // Trim CV
                    if (!string.IsNullOrEmpty(request.CVContent))
                    {
                        request.CVContent = _promptBuilderService.TrimCV(request.CVContent);
                        trimmedCv = request.CVContent;
                    }

                    // Trim Project Info
                    if (!string.IsNullOrEmpty(request.ApplicationContent))
                    {
                        request.ApplicationContent = _promptBuilderService.TrimProject(request.ApplicationContent);
                        trimmedProject = request.ApplicationContent;
                    }

                    // Trim Form (Extract explicit questions)
                    var cleanQuestions = _promptBuilderService.ExtractCleanQuestions(request.Question);
                    if (cleanQuestions.Count > 0)
                    {
                        trimmedForm = string.Join("\n\n", cleanQuestions);
                        // If it's a single question but was buried in junk, update it.
                        if (cleanQuestions.Count == 1)
                        {
                            request.Question = cleanQuestions[0];
                        }
                    }
                }

                // Model Name Mapping Logic
                // If using Groq, map "llama3:8b" to "llama-3.1-8b-instant"
                // Ideally this should be in the Provider itself, but requested to be handled here safely.
                // We check the configured provider first.
                // Actually, request.ModelName comes from Frontend.
                if (!string.IsNullOrEmpty(request.ModelName))
                {
                     // If the frontend sends "llama3:8b" (Ollama style) but we are using Groq, 
                     // Groq will fail. We need to normalize or clear it if it's incompatible.
                     // A safer way is: If ModelName contains "llama3:8b" and it's NOT Ollama, 
                     // switch to the provider default (null).
                     
                     // However, we don't know the active provider here easily without injecting config service.
                     // But we can just fix the specific known issue:
                     if (request.ModelName == "llama3:8b" || request.ModelName == "llama3-8b-8192")
                     {
                         // Check if we are likely targeting Groq (e.g. by checking if Groq is active or just safe mapping)
                         // Since "llama3:8b" works for Ollama, we shouldn't break it.
                         // But "llama3-8b-8192" is definitely deprecated.
                         if (request.ModelName == "llama3-8b-8192")
                         {
                             request.ModelName = "llama-3.1-8b-instant";
                         }
                     }
                }

                // Persist last-used model for provider-status badge
                if (!string.IsNullOrWhiteSpace(request.ModelName) && !string.IsNullOrWhiteSpace(providerKey))
                {
                    var modelToStore = request.ModelName;
                    if (providerKey == "groq" && string.Equals(modelToStore, "llama3:8b", StringComparison.OrdinalIgnoreCase))
                    {
                        modelToStore = "llama-3.1-8b-instant";
                    }
                    _providerConfig.SetModel(providerKey, modelToStore);
                }

                Console.WriteLine($"Application Mode: {request.ApplicationType ?? "Default"}");
                Console.WriteLine($"Question Mode: {request.UseQuestionMode}");
                Console.WriteLine($"Additional Notes: {request.AdditionalNotes}");

                // PART 1: Determine questions to answer
                var questionsToAnswer = new List<string>();

                if (request.UseQuestionMode && !string.IsNullOrWhiteSpace(request.ApplicationContent))
                {
                    // Agentic Extraction for Question Mode
                    Console.WriteLine("[QuestionMode] Agentic Extraction Started...");
                    Console.WriteLine($"[QuestionMode] Advanced Form Mode: {request.UseAdvancedFormMode}");
                    
                    var sourceText = request.ApplicationContent;
                    
                    // PRE-PROCESSING: If content is huge, trim it first using SmartContextReducer logic (light version)
                    if (sourceText.Length > 10000)
                    {
                        Console.WriteLine("[QuestionMode] Content too large. Reducing before extraction...");
                        sourceText = _promptBuilderService.CleanProjectInfo(sourceText);
                    }
                    
                    string extractionPrompt;

                    if (request.UseQuestionMode)
                    {
                        // STRICT MODE: Question Mode has priority over Advanced Mode
                        // OLD: Strict Logic (Only '?' and clear labels)
                        extractionPrompt = @"Extract ONLY explicit application form questions.

Ignore:
- CV content
- Personal information blocks
- Website navigation
- Headers
- Legal disclaimers
- Descriptions
- Project explanations
- Repeated content
- Lines without question marks unless they are clearly form fields.
- Lines containing 'Info Pack', 'Click the Link', 'Google Forms', 'Please read carefully', 'AI prohibited', 'Navigation', 'Blog', 'SSS', 'Anasayfa', 'Hakkımızda', 'Projeler', 'Fırsatlar', 'İletişim', 'Copyright'.
- CV sections like 'WORK EXPERIENCE', 'EDUCATION AND TRAINING', 'Passport:', 'Date of birth:', 'Phone number:', 'LinkedIn:'.

ONLY include lines that:
- End with '?'
- OR are clear form labels such as:
  Name and Surname
  Email Address
  Phone Number
  Date of Birth
  Gender
  City
  Passport Type
  Level of English
  Yes/No questions

If a line is a label (e.g. 'Name and Surname'), convert it to a question (e.g. 'What is your name and surname?').

Do NOT include paragraphs.
Do NOT include CV blocks.
Do NOT include descriptive text.

Return questions as a numbered list only.

TEXT TO EXTRACT FROM:
" + sourceText;
                    }
                    else if (request.UseAdvancedFormMode)
                    {
                        // NEW: Advanced Extraction Logic (Captures non-question mark fields)
                        extractionPrompt = @"Extract ALL application form fields and questions.

TARGETS TO EXTRACT:
1. Questions ending with '?'.
2. Form fields that require user input (e.g., 'Name', 'Email', 'Phone', 'Date of Birth', 'Passport Type', 'Gender', 'City', 'University', 'Major', 'Instagram').
3. Short lines (< 80 chars) starting with a capital letter that look like labels.

IGNORE:
- Lines containing 'Info Pack', 'Click', 'AI prohibited', 'Google Forms', 'Navigation', 'Blog', 'Search', 'Contact', 'Anasayfa', 'Hakkımızda', 'Projeler', 'Fırsatlar', 'İletişim', 'Copyright'.
- URLs (http/https).
- Paragraphs longer than 150 characters.
- CV sections (WORK EXPERIENCE, EDUCATION).

TRANSFORMATION RULES:
- If a line is a label (e.g. 'Name and Surname'), convert it to a natural question (e.g. 'What is your name and surname?').
- If a line is 'Date of Birth', convert to 'What is your date of birth?'.
- Keep 'Do you have a Passport?' as is.

Return the final list of questions/fields as a numbered list.

TEXT TO EXTRACT FROM:
" + sourceText;
                    }
                    else
                    {
                        // OLD: Strict Logic (Only '?' and clear labels)
                        extractionPrompt = @"Extract ONLY explicit application form questions.

Ignore:
- CV content
- Personal information blocks
- Website navigation
- Headers
- Legal disclaimers
- Descriptions
- Project explanations
- Repeated content
- Lines without question marks unless they are clearly form fields.
- Lines containing 'Info Pack', 'Click the Link', 'Google Forms', 'Please read carefully', 'AI prohibited', 'Navigation', 'Blog', 'SSS', 'Anasayfa', 'Hakkımızda', 'Projeler', 'Fırsatlar', 'İletişim', 'Copyright'.
- CV sections like 'WORK EXPERIENCE', 'EDUCATION AND TRAINING', 'Passport:', 'Date of birth:', 'Phone number:', 'LinkedIn:'.

ONLY include lines that:
- End with '?'
- OR are clear form labels such as:
  Name and Surname
  Email Address
  Phone Number
  Date of Birth
  Gender
  City
  Passport Type
  Level of English
  Yes/No questions

If a line is a label (e.g. 'Name and Surname'), convert it to a question (e.g. 'What is your name and surname?').

Do NOT include paragraphs.
Do NOT include CV blocks.
Do NOT include descriptive text.

Return questions as a numbered list only.

TEXT TO EXTRACT FROM:
" + sourceText;
                    }
                    
                    var extractionResponse = await _aiService.GenerateAsync(extractionPrompt, request.ModelName);
                    
                    if (!string.IsNullOrWhiteSpace(extractionResponse))
                    {
                        var lines = extractionResponse.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                        foreach (var line in lines)
                        {
                            var q = line.Trim();
                            // Cleanup: remove leading numbers/bullets
                            q = System.Text.RegularExpressions.Regex.Replace(q, @"^(\d+[\.)]\s*|Q\d+\s*[:\.]\s*|- )", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
                            
                            if (!string.IsNullOrWhiteSpace(q) && q.Length > 5) 
                            {
                                questionsToAnswer.Add(q);
                            }
                        }
                    }
                    Console.WriteLine($"[QuestionMode] Extracted {questionsToAnswer.Count} questions:");
                    foreach (var q in questionsToAnswer) Console.WriteLine($"- {q}");
                }
                else
                {
                    // Standard Extraction from "Question" field
                    questionsToAnswer = _promptBuilderService.ExtractCleanQuestions(request.Question);
                }

                // Logic to use Batch/Loop processing:
                // 1. If we have multiple questions (Bulk Mode)
                // 2. OR if we are in Question Mode and found at least one question (Agentic Mode)
                bool useBatchLogic = questionsToAnswer.Count >= 2;
                if (request.UseQuestionMode && questionsToAnswer.Count >= 1) useBatchLogic = true;

                if (useBatchLogic && request.IsMotivationLetter == false)
                {
                    Console.WriteLine($"Processing {questionsToAnswer.Count} questions.");
                    
                    if (request.EnableTextTrimmer)
                    {
                        // NEW: Per-Question Trimming Loop
                        Console.WriteLine("[TextTrimmer] Enabled. Generating per-question answers with smart context reduction.");
                        
                        var trimmedAnswers = new List<object>();
                        var debugContexts = new List<object>();
                        
                        // Base context for reduction
                        var sourceContent = trimmedProject ?? request.ApplicationContent;
                        
                        var baseContext = $@"
CV:
{request.CVContent}

PROJECT INFO:
{sourceContent}

NOTES:
{request.AdditionalNotes}";

                        for (var i = 0; i < questionsToAnswer.Count; i++)
                        {
                            var question = questionsToAnswer[i];
                            
                            // 1. Reduce context specifically for this question
                            var specificContext = await _smartContextReducer.ReduceForSpecificQuestion(baseContext, question);
                            
                            // 2. Generate Answer for this single question
                            var singleRequest = new AnswerGenerationRequest
                            {
                                CVContent = request.CVContent,
                                ApplicationContent = specificContext, // Inject Reduced Context
                                ApplicationType = request.ApplicationType,
                                ProgramTopic = request.ProgramTopic,
                                Question = question,
                                LanguageLevel = request.LanguageLevel,
                                CharacterLimit = request.CharacterLimit,
                                AdditionalNotes = "", // Avoid duplication as notes are in specificContext
                                IsMotivationLetter = false,
                                UseQuestionMode = false, // We are answering a specific question now
                                EnableTextTrimmer = false, // We already trimmed
                                ModelName = request.ModelName
                            };
                            
                            var questionPrompt = _promptBuilderService.BuildPrompt(singleRequest);
                            var questionResponse = await _aiService.GenerateAsync(questionPrompt, request.ModelName);
                            var formatted = _responseFormatterService.FormatResponse(questionResponse, request.CharacterLimit);
                            
                            trimmedAnswers.Add(new { question = question, answer = formatted });
                            debugContexts.Add(new { index = i, question = question, trimmedContext = specificContext });
                        }
                        
                        return Ok(new { success = true, answers = trimmedAnswers, trimmedCv, trimmedProject, trimmedForm, debug = new { trimmedContexts = debugContexts } });
                    }
                    else
                    {
                        // OLD: Single Batch Call
                        Console.WriteLine("Using single batch LLM call.");
    
                        var batchPrompt = _promptBuilderService.BuildBatchPrompt(request, questionsToAnswer);
                        var batchResponse = await _aiService.GenerateAsync(batchPrompt, request.ModelName);
    
                        var parsedAnswers = ParseNumberedAnswers(batchResponse, questionsToAnswer.Count);
                        var batchAnswers = new List<object>(questionsToAnswer.Count);
                        
                        for (var i = 0; i < questionsToAnswer.Count; i++)
                        {
                            var answerText = i < parsedAnswers.Count ? parsedAnswers[i] : string.Empty;
                            var formatted = _responseFormatterService.FormatResponse(answerText, request.CharacterLimit);
                            batchAnswers.Add(new { question = questionsToAnswer[i], answer = formatted });
                        }
    
                        return Ok(new { success = true, answers = batchAnswers, trimmedCv, trimmedProject, trimmedForm, debug = (object?)null });
                    }
                }

                // Single-question generation (backward compatible)
                var prompt = _promptBuilderService.BuildPrompt(request);
                var response = request.UseContextCache
                    ? await _aiService.GenerateWithContextAsync(prompt, "", true, request.ModelName)
                    : await _aiService.GenerateAsync(prompt, request.ModelName);

                // META RESPONSE GUARD: Regenerate once if AI persona leaks
                if (response.Contains("As an AI") || 
                    response.Contains("I am an AI") || 
                    response.Contains("I don't have a passport") || 
                    response.Contains("I do not have a passport") || 
                    response.Contains("As an assistant"))
                {
                    Console.WriteLine("[Guard] Meta response detected. Regenerating with strict persona...");
                    
                    var recoveryPrompt = "Reminder: You are the applicant. Answer as a human applicant. " + prompt;
                    
                    response = await _aiService.GenerateAsync(recoveryPrompt, request.ModelName);
                }

                // NEW: Split answers server-side if QuestionMode is ON and it wasn't a batch call
                var answers = new List<object>();
                
                if (request.UseQuestionMode && !request.IsMotivationLetter)
                {
                     // Parse Q1: ... Answer: ... format
                     var parsed = ParseNumberedAnswers(response, 0);
                     if (parsed.Count > 0)
                     {
                         // Map back to structured object if possible
                         // Since we don't have the questions list here easily without re-extraction, 
                         // we will try to extract Question text from the response or just index them.
                         
                         // Better regex to capture Question AND Answer from the block
                         // Pattern: Q\d+: (.*?) Answer: (.*?) (next Q or end)
                         var regex = new System.Text.RegularExpressions.Regex(
                            @"(?ms)^Q\d+:\s*(.*?)\s*Answer:\s*(.*?)(?=^Q\d+:|\z)",
                            System.Text.RegularExpressions.RegexOptions.IgnoreCase
                         );
                         
                         var matches = regex.Matches(response);
                         if (matches.Count > 0)
                         {
                             foreach (System.Text.RegularExpressions.Match m in matches)
                             {
                                 answers.Add(new { 
                                     question = m.Groups[1].Value.Trim(), 
                                     answer = _responseFormatterService.FormatResponse(m.Groups[2].Value.Trim(), request.CharacterLimit)
                                 });
                             }
                         }
                         else
                         {
                             // Fallback to simple split if strict format failed
                             for (int i = 0; i < parsed.Count; i++)
                             {
                                 answers.Add(new { question = $"Question {i+1}", answer = _responseFormatterService.FormatResponse(parsed[i], request.CharacterLimit) });
                             }
                         }
                     }
                     else
                     {
                         // No split found, return as single answer
                         answers.Add(new { question = request.Question, answer = _responseFormatterService.FormatResponse(response, request.CharacterLimit) });
                     }
                }
                else
                {
                    // Default single answer behavior
                    answers.Add(new { question = request.Question, answer = _responseFormatterService.FormatResponse(response, request.CharacterLimit) });
                }

                object? debugInfo = null;
                if (request.EnableTextTrimmer)
                {
                    // If we split answers, we should ideally try to map contexts, but for single-shot generation
                    // we only have one global context.
                    // We will return the same global context for all answers to support visibility.
                    var contexts = new List<object>();
                    for(int i=0; i < answers.Count; i++)
                    {
                        contexts.Add(new { index = i, question = "Global Context", trimmedContext = prompt });
                    }
                    
                    debugInfo = new
                    {
                        trimmedContexts = contexts
                    };
                }

                return Ok(new
                {
                    success = true,
                    answers = answers,
                    trimmedCv,
                    trimmedProject,
                    trimmedForm,
                    debug = debugInfo
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        private static List<string> ParseNumberedAnswers(string modelOutput, int expectedCount)
        {
            if (string.IsNullOrWhiteSpace(modelOutput))
            {
                return new List<string>();
            }

            // Accept formats:
            // 1. Answer:
            // ...
            // 2. Answer:
            // ...
            // or
            // 1) Answer:
            // ...

            var results = new List<string>();

            var matches = System.Text.RegularExpressions.Regex.Matches(
                modelOutput,
                @"(?ms)^\s*(\d+)\s*[\.)]\s*Answer\s*:\s*(.*?)(?=^\s*\d+\s*[\.)]\s*Answer\s*:|\z)"
            );

            if (matches.Count > 0)
            {
                foreach (System.Text.RegularExpressions.Match match in matches)
                {
                    var content = match.Groups[2].Value.Trim();
                    results.Add(content);
                }
                return results;
            }

            // Fallback: split by numbered headings (without the word Answer)
            var fallbackMatches = System.Text.RegularExpressions.Regex.Matches(
                modelOutput,
                @"(?ms)^\s*(\d+)\s*[\.)]\s*(.*?)(?=^\s*\d+\s*[\.)]|\z)"
            );

            foreach (System.Text.RegularExpressions.Match match in fallbackMatches)
            {
                var content = match.Groups[2].Value.Trim();
                if (!string.IsNullOrWhiteSpace(content))
                {
                    results.Add(content);
                }
            }

            // If still nothing, return the whole output as first answer.
            if (results.Count == 0)
            {
                results.Add(modelOutput.Trim());
            }

            // Trim to expectedCount to avoid overrun.
            if (expectedCount > 0 && results.Count > expectedCount)
            {
                results = results.Take(expectedCount).ToList();
            }

            return results;
        }
    }
}
