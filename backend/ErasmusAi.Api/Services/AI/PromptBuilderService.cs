using ErasmusAi.Api.Models.AI;
using System.Linq;
using System.Text;

namespace ErasmusAi.Api.Services.AI
{
    public class PromptBuilderService
    {
        public List<string> ExtractCleanQuestions(string rawText)
        {
            if (string.IsNullOrWhiteSpace(rawText))
            {
                return new List<string>();
            }

            static string NormalizeKey(string s)
            {
                return string.Join(' ', s
                    .Trim()
                    .ToLowerInvariant()
                    .Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries));
            }

            static string StripPrefix(string line)
            {
                var trimmed = line.Trim();

                // Remove common list prefixes (1., 1), -, *, •)
                trimmed = System.Text.RegularExpressions.Regex.Replace(trimmed, @"^\s*(\d+\s*[\.)]|[-*•]+)\s+", "");
                return trimmed.Trim();
            }

            static int WordCount(string line)
            {
                return line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length;
            }

            var bannedContains = new[]
            {
                "copyright",
                "instagram",
                "facebook",
                "tiktok",
                "linkedin",
                "search for",
                "anasayfa",
                "hakkımızda",
                "projeler",
                "info pack",
                "click the link",
                "ai prohibited",
                "please read carefully",
                "google forms",
                "navigation",
                "blog",
                "sss",
                "fırsatlar",
                "iletişim",
                "copyright"
            };

            bool IsBanned(string line)
            {
                var lower = line.ToLowerInvariant();
                return bannedContains.Any(b => lower.Contains(b));
            }

            var candidates = rawText
                .Replace("\r\n", "\n")
                .Replace('\r', '\n')
                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(l => StripPrefix(l))
                .Select(l => l.Trim())
                .Where(l => !string.IsNullOrWhiteSpace(l))
                .Where(l => l.Length <= 250)
                .Where(l => !IsBanned(l))
                // Hard Filter: Exclude known CV headers
                .Where(l => !l.Contains("WORK EXPERIENCE", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.Contains("EDUCATION AND TRAINING", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.StartsWith("Passport:", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.StartsWith("Phone:", StringComparison.OrdinalIgnoreCase))
                .ToList();

            var results = new List<string>();
            var seen = new HashSet<string>();

            foreach (var line in candidates)
            {
                // Must end with '?' OR clearly request user input (mandatory fields with '*')
                var endsWithQuestion = line.EndsWith("?");
                var looksLikeField = line.Contains('*') || line.Contains(':');

                if (!endsWithQuestion && !looksLikeField)
                {
                    continue;
                }

                // Minimum words per requirement
                if (WordCount(line) < 5)
                {
                    continue;
                }

                var key = NormalizeKey(line);
                if (!seen.Add(key))
                {
                    continue;
                }

                results.Add(line);
            }

            return results;
        }

        public string CleanProjectInfo(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;

            var lines = text.Replace("\r\n", "\n").Split('\n');
            var uniqueLines = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var sb = new StringBuilder();

            var bannedPhrases = new[]
            {
                "copyright", "instagram", "facebook", "tiktok", "linkedin",
                "search for", "anasayfa", "hakkımızda", "projeler", "blog",
                "s.s.s", "gizlilik", "kullanım şartları", "ai platform",
                "blacklist", "info pack", "google formlar"
            };

            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                
                // Rule: Remove lines longer than 300 characters
                if (trimmed.Length > 300) continue;

                // Rule: Remove duplicate lines
                if (!uniqueLines.Add(trimmed)) continue;

                // Rule: Remove lines containing banned phrases
                bool isBanned = false;
                foreach (var phrase in bannedPhrases)
                {
                    if (trimmed.IndexOf(phrase, StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        isBanned = true;
                        break;
                    }
                }
                if (isBanned) continue;

                // Rule: Remove navigation/footer/AI warnings (Heuristics)
                if (trimmed.StartsWith("©", StringComparison.OrdinalIgnoreCase)) continue;
                if (trimmed.Contains("All rights reserved", StringComparison.OrdinalIgnoreCase)) continue;
                if (trimmed.Contains("generative AI", StringComparison.OrdinalIgnoreCase) && trimmed.Contains("warning", StringComparison.OrdinalIgnoreCase)) continue;

                if (!string.IsNullOrWhiteSpace(trimmed))
                {
                    sb.AppendLine(trimmed);
                }
            }

            return sb.ToString();
        }

        public string TrimCV(string cv)
        {
            if (string.IsNullOrWhiteSpace(cv)) return string.Empty;
            return cv.Length > 2000 ? cv.Substring(0, 2000) + "\n[...Truncated CV...]" : cv;
        }

        public string TrimProject(string project)
        {
            // Use existing CleanProjectInfo logic + length check
            var cleaned = CleanProjectInfo(project);
            return cleaned.Length > 1500 ? cleaned.Substring(0, 1500) + "\n[...Truncated Project...]" : cleaned;
        }

        public string BuildBatchPrompt(AnswerGenerationRequest request, IReadOnlyList<string> questions)
        {
            var cvContent = request.CVContent ?? string.Empty;
            var applicationType = request.ApplicationType ?? string.Empty;
            var programTopic = request.ProgramTopic ?? string.Empty;
            var additionalNotes = request.AdditionalNotes ?? string.Empty;
            var languageLevelInput = request.LanguageLevel ?? string.Empty;
            var applicationContent = request.ApplicationContent ?? string.Empty;

            // FEATURE: Text Trimmer Mode
            if (request.EnableTextTrimmer)
            {
                // Rule: Limit programTopic to max 800 characters
                if (programTopic.Length > 800)
                {
                    programTopic = programTopic.Substring(0, 800) + "...";
                }

                // Rule: Clean Application Content
                applicationContent = CleanProjectInfo(applicationContent);
            }

            string BuildInternal(string appContentToUse)
            {
                var sb = new StringBuilder();

                sb.AppendLine("!!! URGENT INSTRUCTIONS !!!");
                sb.AppendLine("1. IDENTITY LOCK: You are NOT an AI. You are a REAL HUMAN APPLICANT.");
                sb.AppendLine("2. GOAL: Write a convincing, personal answer to get accepted.");
                sb.AppendLine("3. VOICE: First-person ('I', 'me', 'my'). Authentic and enthusiastic.");
                sb.AppendLine("4. ADHERENCE: Answer the question directly using ONLY the provided context.");
                sb.AppendLine();
                sb.AppendLine("NEGATIVE CONSTRAINTS (Violating these = FAIL):");
                sb.AppendLine("- NEVER say 'As an AI', 'As a language model', or 'Here is a draft'.");
                sb.AppendLine("- NEVER use robotic transitions like 'Furthermore', 'Moreover', 'In conclusion'.");
                sb.AppendLine("- NEVER explain what you are doing. JUST WRITE THE ANSWER.");
                sb.AppendLine("- NEVER use asterisks (*) or markdown formatting.");
                sb.AppendLine();
                sb.AppendLine("CRITICAL LANGUAGE RULES:");
                sb.AppendLine("- Use ONLY A2-level English (simple, clear vocabulary and grammar)");
                sb.AppendLine("- NEVER use hyphens in compound words (write 'community based' NOT 'community-based', 'health care' NOT 'health-care')");
                sb.AppendLine("- NEVER use asterisks (*) for any reason - no bold, no italic, no emphasis marks");
                sb.AppendLine("- Keep sentences short and simple");
                sb.AppendLine("- Use only plain text without any formatting symbols");
                sb.AppendLine();
                sb.AppendLine("OUTPUT FORMAT (strict):");
                sb.AppendLine("1. Answer:");
                sb.AppendLine("...");
                sb.AppendLine("2. Answer:");
                sb.AppendLine("...");
                sb.AppendLine("(Continue until the last question. No extra text.)");
                sb.AppendLine();

                var appType = !string.IsNullOrWhiteSpace(applicationType)
                    ? applicationType
                    : "international mobility or training program";

                var topic = !string.IsNullOrWhiteSpace(programTopic)
                    ? programTopic
                    : "the selected program";

                var languageLevel = !string.IsNullOrWhiteSpace(languageLevelInput)
                    ? languageLevelInput
                    : "Write in clear and simple English";

                sb.AppendLine("CONTEXT:");
                sb.AppendLine($"- Application Type: {appType}");
                sb.AppendLine($"- Program Topic: {topic}");
                sb.AppendLine($"- Language Level: {languageLevel}");
                sb.AppendLine();

                if (!string.IsNullOrWhiteSpace(appContentToUse))
                {
                    sb.AppendLine("PROJECT / APPLICATION INFO:");
                    sb.AppendLine(appContentToUse);
                    sb.AppendLine();
                }

                sb.AppendLine("APPLICANT CV:");
                sb.AppendLine(cvContent);
                sb.AppendLine();

                if (!string.IsNullOrWhiteSpace(additionalNotes))
                {
                    sb.AppendLine("ADDITIONAL NOTES:");
                    sb.AppendLine(additionalNotes);
                    sb.AppendLine();
                }

                sb.AppendLine("QUESTIONS:");
                for (var i = 0; i < questions.Count; i++)
                {
                    sb.AppendLine($"{i + 1}. {questions[i]}");
                }
                sb.AppendLine();
                sb.AppendLine("ANSWERS:");

                return sb.ToString();
            }

            var finalPrompt = BuildInternal(applicationContent);

            // FEATURE: Hard Length Guard (User requested 6000 chars)
            if (request.EnableTextTrimmer && finalPrompt.Length > 6000)
            {
                // Calculate how much to cut
                int excess = finalPrompt.Length - 6000;
                int currentAppContentLen = applicationContent.Length;
                
                // We truncate ONLY the project info section
                int newLength = Math.Max(0, currentAppContentLen - excess - 100); // -100 safety buffer
                
                var truncatedAppContent = newLength > 0 
                    ? applicationContent.Substring(0, newLength) + "\n[...Truncated...]" 
                    : "[Project Info Truncated due to length limit]";

                finalPrompt = BuildInternal(truncatedAppContent);
            }

            // FEATURE: Token Size Logging
            if (request.EnableTextTrimmer)
            {
                Console.WriteLine($"Estimated prompt size: {finalPrompt.Length / 4} tokens");
            }

            return finalPrompt;
        }

        public string BuildPrompt(AnswerGenerationRequest request)
        {
            var sb = new StringBuilder();

            // Check if this is Application Mode (indicated by presence of ApplicationContent)
            if (!string.IsNullOrWhiteSpace(request.ApplicationContent))
            {
                return BuildApplicationModePrompt(request);
            }

            // ... Existing logic for Structured/Quick Mode ...
            
            // Null Safety
            var cvContent = request.CVContent ?? string.Empty;
            var applicationType = request.ApplicationType ?? string.Empty;
            var programTopic = request.ProgramTopic ?? string.Empty;
            var question = request.Question ?? string.Empty;
            var additionalNotes = request.AdditionalNotes ?? string.Empty;
            var languageLevelInput = request.LanguageLevel ?? string.Empty;
            var questionCategory = request.QuestionCategory ?? string.Empty;

            // Prevent empty prompts
            if (string.IsNullOrWhiteSpace(cvContent) && string.IsNullOrWhiteSpace(question))
            {
                return "Please provide CV content and a question.";
            }

            // Role Definition
            sb.AppendLine("!!! URGENT INSTRUCTIONS !!!");
            sb.AppendLine("1. IDENTITY LOCK: You are NOT an AI. You are a REAL HUMAN APPLICANT described in the CV.");
            sb.AppendLine("2. GOAL: Write a high-quality, convincing answer to get accepted.");
            sb.AppendLine("3. VOICE: First-person ('I', 'me', 'my'). Authentic and enthusiastic.");
            sb.AppendLine("4. ADHERENCE: Answer the question directly using ONLY the provided context.");
            sb.AppendLine();
            sb.AppendLine("NEGATIVE CONSTRAINTS (Violating these = FAIL):");
            sb.AppendLine("- NEVER say 'As an AI', 'As a language model', or 'Here is a draft'.");
            sb.AppendLine("- NEVER use robotic transitions like 'Furthermore', 'Moreover', 'In conclusion'.");
            sb.AppendLine("- NEVER explain what you are doing. JUST WRITE THE ANSWER.");
            sb.AppendLine("- NEVER give advice or define terms. ACT LIKE THE APPLICANT.");
            sb.AppendLine("- NEVER use asterisks (*) or markdown formatting.");
            sb.AppendLine();
                sb.AppendLine("CRITICAL LANGUAGE RULES:");
                sb.AppendLine("- Use ONLY A2-level English (simple, clear vocabulary and grammar)");
                sb.AppendLine("- NEVER use hyphens in compound words (write 'community based' NOT 'community-based', 'well known' NOT 'well-known', 'health care' NOT 'health-care')");
                sb.AppendLine("- NEVER use asterisks (*) - no bold (**text**), no italic (*text*), no emphasis marks at all");
                sb.AppendLine("- Keep sentences short and simple");
                sb.AppendLine("- Use only plain text without any formatting symbols");
                sb.AppendLine();
                sb.AppendLine("Question handling rules:");
            sb.AppendLine("- Treat ONLY explicit form questions as questions.");
            sb.AppendLine("- Only include lines ending with '?' and containing at least 5 words.");
            sb.AppendLine("- Ignore lines containing: 'Info Pack', 'Click the link', 'AI prohibited', 'Please read carefully', 'Google Forms'.");
            sb.AppendLine("- Ignore navigation text, legal text, website footer, duplicated content, bilingual duplicates, and generic instructions.");
            sb.AppendLine();

            // Context: Application & Program
            sb.AppendLine("==========================================");
            sb.AppendLine("               CONTEXT");
            sb.AppendLine("==========================================");
            
            // Fallback for Application Type
            var appType = !string.IsNullOrWhiteSpace(applicationType) 
                ? applicationType 
                : "international mobility or training program";
            
            // Fallback for Program Topic
            var topic = !string.IsNullOrWhiteSpace(programTopic) 
                ? programTopic 
                : "the selected program";

            // Fallback for Language Level (Infer from CV)
            string languageLevel = "Write in clear and simple English";
            if (!string.IsNullOrWhiteSpace(languageLevelInput))
            {
                languageLevel = languageLevelInput;
            }
            else if (!string.IsNullOrWhiteSpace(cvContent))
            {
                if (cvContent.Contains("B2") || cvContent.Contains("C1") || cvContent.Contains("C2"))
                {
                    languageLevel = "Write in professional English";
                }
                else if (cvContent.Contains("B1"))
                {
                    languageLevel = "Write in intermediate English";
                }
            }

            sb.AppendLine($"- **Application Type:** {appType}");
            sb.AppendLine($"- **Program Topic:** {topic}");
            sb.AppendLine($"- **Language Level:** {languageLevel}");
            sb.AppendLine();

            // Context: The Question
            sb.AppendLine("==========================================");
            sb.AppendLine("             THE QUESTION");
            sb.AppendLine("==========================================");
            if (!string.IsNullOrWhiteSpace(questionCategory))
            {
                sb.AppendLine($"**Category:** {questionCategory}");
            }
            sb.AppendLine($"**Question:** {question}");
            sb.AppendLine();

            // Context: The Applicant (CV)
            sb.AppendLine("==========================================");
            sb.AppendLine("          APPLICANT PROFILE (CV)");
            sb.AppendLine("==========================================");
            sb.AppendLine(cvContent);
            sb.AppendLine();

            // Constraints & Instructions
            sb.AppendLine("==========================================");
            sb.AppendLine("             INSTRUCTIONS");
            sb.AppendLine("==========================================");
            sb.AppendLine("1. **Relevance:** Use specific details from the CV that relate directly to the question and program topic.");
            sb.AppendLine("2. **Tone:** Professional, enthusiastic, and confident.");
            sb.AppendLine("3. **Structure:** Clear, coherent, and well-structured paragraphs.");
            sb.AppendLine("4. **Specificity:** Avoid generic statements like 'I am a hard worker'. Instead, provide evidence from the CV.");
            sb.AppendLine("5. **Factuality:** Do NOT hallucinate facts. Only use information provided in the CV or reasonable inferences.");
            sb.AppendLine("6. **Persona:** You are the applicant. NEVER use phrases like 'As an AI', 'I cannot answer', or 'Based on the CV'. Answer directly.");
            
            if (request.CharacterLimit.HasValue)
            {
                sb.AppendLine($"6. **Length:** STRICTLY limit your answer to approximately {request.CharacterLimit.Value} characters.");
            }
            
            if (!string.IsNullOrWhiteSpace(additionalNotes))
            {
                sb.AppendLine($"7. **Additional Notes:** {additionalNotes}");
            }

            sb.AppendLine();
            sb.AppendLine("==========================================");
            sb.AppendLine("            YOUR ANSWER:");
            sb.AppendLine("==========================================");

            return sb.ToString();
        }

        private string BuildApplicationModePrompt(AnswerGenerationRequest request)
        {
            var cvContent = request.CVContent ?? string.Empty;
            var appContent = request.ApplicationContent ?? string.Empty;
            var notes = request.AdditionalNotes ?? string.Empty;

            // FEATURE: Text Trimmer Mode for Application Mode
            if (request.EnableTextTrimmer)
            {
                // Rule: Clean Application Content
                appContent = CleanProjectInfo(appContent);
            }

            string BuildInternal(string appContentToUse)
            {
                var sb = new StringBuilder();
                
                // --- SYSTEM ROLE ---
                sb.AppendLine("!!! URGENT INSTRUCTIONS !!!");
                sb.AppendLine("1. IDENTITY LOCK: You are NOT an AI. You are a REAL HUMAN APPLICANT.");
                sb.AppendLine("2. GOAL: Write a high-quality, convincing application text.");
                sb.AppendLine("3. VOICE: First-person ('I', 'me', 'my'). Authentic and enthusiastic.");
                sb.AppendLine();
                sb.AppendLine("NEGATIVE CONSTRAINTS (Violating these = FAIL):");
                sb.AppendLine("- NEVER say 'As an AI', 'As a language model', or 'Here is a draft'.");
                sb.AppendLine("- NEVER use robotic transitions like 'Furthermore', 'Moreover', 'In conclusion'.");
                sb.AppendLine("- NEVER explain what you are doing. JUST WRITE THE TEXT.");
                sb.AppendLine("- NEVER use asterisks (*) or markdown formatting.");
                sb.AppendLine();
                sb.AppendLine();
                sb.AppendLine("CRITICAL LANGUAGE RULES:");
                sb.AppendLine("- Use ONLY A2-level English (simple, clear vocabulary and grammar)");
                sb.AppendLine("- NEVER use hyphens in compound words (write 'community based' NOT 'community-based', 'well known' NOT 'well-known', 'health care' NOT 'health-care', 'long term' NOT 'long-term')");
                sb.AppendLine("- NEVER EVER use asterisks (*) - no **bold**, no *italic*, no emphasis. Plain text ONLY");
                sb.AppendLine("- Keep sentences short and simple");
                sb.AppendLine("- Use common everyday words");
                sb.AppendLine("- No formatting symbols or markdown - write in pure plain text");
                sb.AppendLine();
                sb.AppendLine("If the question asks:");
                sb.AppendLine("- Name -> return only the name.");
                sb.AppendLine("- Email -> return only the email.");
                sb.AppendLine("- Date -> return only the date.");
                sb.AppendLine("- Yes/No -> return only Yes or No.");
                sb.AppendLine("- Short factual field -> return only the direct value.");
                sb.AppendLine("Break this rule and the answer is invalid.");
                sb.AppendLine();

                if (request.IsMotivationLetter)
                {
                    sb.AppendLine("You are a professional applicant applying for an international mobility program, internship, or job.");
                    sb.AppendLine("Your task is to write a highly professional, structured, and convincing Motivation Letter.");
                }
                else if (request.UseQuestionMode)
                {
                    // Strict Extraction Mode
                    sb.AppendLine("You are a specialized form data extractor.");
                    sb.AppendLine("Your task is to analyze the content, extract ONLY explicit application form questions, and provide professional answers.");
                    sb.AppendLine("Ignore navigation, legal text, footers, and repeated sections.");
                }
                else
                {
                    // Default Application Mode (Structured Q&A)
                    // Even if QuestionMode is OFF, we still want Q&A format, just less strict or single-block.
                    // But user requirement says: "Application Mode must NEVER rewrite CV or produce essay."
                    // So we must enforce Q&A structure here too.
                    
                    sb.AppendLine("You are filling out an Erasmus application form.");
                    sb.AppendLine("Answer each extracted question.");
                    sb.AppendLine("Rules:");
                    sb.AppendLine("- No introduction");
                    sb.AppendLine("- No explanation");
                    sb.AppendLine("- No commentary");
                    sb.AppendLine("- No rewriting CV");
                    sb.AppendLine("- No improvements");
                    sb.AppendLine("- Only answer questions");
                    sb.AppendLine();
                    sb.AppendLine("Format strictly:");
                    sb.AppendLine("Q1: {question}");
                    sb.AppendLine("Answer:");
                    sb.AppendLine("{answer}");
                    sb.AppendLine();
                    sb.AppendLine("Repeat for all questions.");
                }
                
                // Add System Separator for Provider Parsing
                sb.AppendLine();
                sb.AppendLine("###SYSTEM_END###");
                sb.AppendLine();

                // --- USER PROMPT ---

                sb.AppendLine("==========================================");
                sb.AppendLine("               CV SECTION");
                sb.AppendLine("==========================================");
                sb.AppendLine(cvContent);
                sb.AppendLine();

                sb.AppendLine("==========================================");
                sb.AppendLine("           APPLICATION SECTION");
                sb.AppendLine("==========================================");
                sb.AppendLine(appContentToUse);
                sb.AppendLine();

                if (!string.IsNullOrWhiteSpace(notes))
                {
                    sb.AppendLine("==========================================");
                    sb.AppendLine("                 NOTES");
                    sb.AppendLine("==========================================");
                    sb.AppendLine(notes);
                    sb.AppendLine();
                }

                sb.AppendLine("==========================================");
                sb.AppendLine("             INSTRUCTIONS");
                sb.AppendLine("==========================================");
                
                if (request.IsMotivationLetter)
                {
                    sb.AppendLine("1. **Structure:** Introduction, Body Paragraphs (Experience, Skills, Alignment), Conclusion.");
                    sb.AppendLine("2. **Tone:** Enthusiastic, professional, and polite.");
                    sb.AppendLine("3. **Language:** Use ONLY A2-level English with simple vocabulary and grammar. NEVER use hyphens (write 'well known' not 'well-known'). NEVER use asterisks (*) for emphasis.");
                    sb.AppendLine("4. **Formatting:** Plain text only - no bold, no italic, no markdown, no asterisks.");
                    sb.AppendLine("5. **Alignment:** Explicitly connect the applicant's CV details to the Application/Project details.");
                    sb.AppendLine("6. **No Hallucination:** Do not invent facts not present in the CV.");
                }
                else if (request.UseQuestionMode)
                {
                    // Strict Branching for Question Mode
                    sb.AppendLine("You are filling an Erasmus application form.");
                    sb.AppendLine("Answer each question separately.");
                    sb.AppendLine("Rules:");
                    sb.AppendLine("- Do NOT merge answers.");
                    sb.AppendLine("- Do NOT generate essay style text.");
                    sb.AppendLine("- Do NOT add introduction.");
                    sb.AppendLine("- Do NOT add conclusion.");
                    sb.AppendLine("- Do NOT comment.");
                    sb.AppendLine("- Answer directly and concisely.");
                    sb.AppendLine();
                    sb.AppendLine("Output format:");
                    sb.AppendLine("Q1: {question}");
                    sb.AppendLine("Answer:");
                    sb.AppendLine("{answer}");
                    sb.AppendLine();
                    sb.AppendLine("Q2: {question}");
                    sb.AppendLine("Answer:");
                    sb.AppendLine("{answer}");
                    sb.AppendLine("Repeat until finished.");
                }
                else
                {
                    // Strict Branching for Paragraph Mode
                    if (!string.IsNullOrWhiteSpace(request.Question))
                    {
                        sb.AppendLine($"**Specific Question to Answer:** {request.Question}");
                        sb.AppendLine("1. Answer ONLY this question.");
                        sb.AppendLine("2. Use the CV and Application info to provide evidence.");
                    }
                    else
                    {
                        sb.AppendLine("1. Identify the key questions or requirements in the Application Section.");
                        sb.AppendLine("2. Provide structured answers or a comprehensive application text.");
                        sb.AppendLine("3. **Constraint:** Never split by question numbers like 'Q1'. Return a single integrated text.");
                    }
                }

                sb.AppendLine();
                sb.AppendLine("--- ADDITIONAL INSTRUCTIONS ---");
                sb.AppendLine("You MUST follow these instructions strictly:");
                sb.AppendLine(notes);
                sb.AppendLine("--- END OF ADDITIONAL INSTRUCTIONS ---");

                sb.AppendLine();
                sb.AppendLine("==========================================");
                sb.AppendLine("            YOUR RESPONSE:");
                sb.AppendLine("==========================================");

                return sb.ToString();
            }

            var finalPrompt = BuildInternal(appContent);

            // FEATURE: Hard Length Guard (User requested 6000 chars)
            if (request.EnableTextTrimmer && finalPrompt.Length > 6000)
            {
                // Calculate how much to cut
                int excess = finalPrompt.Length - 6000;
                int currentAppContentLen = appContent.Length;
                
                // We truncate ONLY the project info section
                int newLength = Math.Max(0, currentAppContentLen - excess - 100); // -100 safety buffer
                
                var truncatedAppContent = newLength > 0 
                    ? appContent.Substring(0, newLength) + "\n[...Truncated...]" 
                    : "[Project Info Truncated due to length limit]";

                finalPrompt = BuildInternal(truncatedAppContent);
            }

            // FEATURE: Token Size Logging
            if (request.EnableTextTrimmer)
            {
                Console.WriteLine($"Estimated prompt size: {finalPrompt.Length / 4} tokens");
            }

            return finalPrompt;
        }
    }
}
