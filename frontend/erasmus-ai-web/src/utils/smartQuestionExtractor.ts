export function extractRealQuestions(text: string): string[] {
    if (!text || text.trim().length === 0) {
        return [];
    }

    const lines = text.split('\n');
    const validQuestions: string[] = [];
    
    // Noise patterns to strictly ignore
    const noisePatterns = [
        /- Select -/i,
        /- None -/i,
        /^Breadcrumb/i,
        /^Skip to main content/i,
        /^Email/i,
        /^First name/i,
        /^Last name/i,
        /^\+1\s?201-/i, // Phone number format often seen in footers
        /^Home/i,
        /^About/i,
        /^Contact/i,
        /^Copyright/i,
        /^All rights reserved/i,
        /^Page \d+ of \d+/i,
        /^Please select/i,
        /^Choose one/i
    ];

    // Checkbox confirmation patterns (unless they are questions)
    const checkboxPatterns = [
        /^I am over 18/i,
        /^I commit to/i,
        /^I allow/i,
        /^I agree/i,
        /^I confirm/i,
        /^I understand/i,
        /^I declare/i,
        /^By checking this box/i
    ];

    // Helper to check if line is noise
    const isNoise = (line: string): boolean => {
        if (!line.trim()) return true;
        return noisePatterns.some(pattern => pattern.test(line));
    };

    // Helper to check if line is a checkbox statement
    const isCheckbox = (line: string): boolean => {
        return checkboxPatterns.some(pattern => pattern.test(line));
    };

    // Helper to check if line looks like a valid question
    const isValidQuestion = (line: string): boolean => {
        const trimmed = line.trim();
        
        // Rule 1: Must be reasonably long
        if (trimmed.length < 10) return false;

        // Rule 2: Explicit question markers
        const hasQuestionMark = trimmed.endsWith('?');
        const startsWithQuestionWord = /^(What|How|Why|Where|When|Who|Which|Is there|Are there|Do you|Can you|Please describe|Please explain|Tell us|Describe|Explain)/i.test(trimmed);

        // Rule 3: Numbered list item that looks like a question or task
        const isNumberedItem = /^\d+[.)]/.test(trimmed) && trimmed.length > 20;

        // Rule 4: Not ALL CAPS (usually headers or disclaimers)
        const isAllCaps = trimmed.length > 10 && trimmed === trimmed.toUpperCase();

        if (isAllCaps) return false;

        // If it's a checkbox statement, only accept if it asks something (ends with ?)
        if (isCheckbox(trimmed)) {
            return hasQuestionMark;
        }

        // Strongest signal: Ends with question mark
        if (hasQuestionMark) return true;

        // Second strongest: Starts with question word AND reasonable length
        if (startsWithQuestionWord && trimmed.length > 15) return true;

        // Numbered items are often questions in forms even without ?
        if (isNumberedItem) return true;

        return false;
    };

    let buffer = "";

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (isNoise(line)) continue;

        // If line ends with sentence terminator, it might be a complete question
        // If not, it might be part of a multi-line question
        
        // Simple heuristic: If line starts with a number or question word, it's likely the start of a new question
        const isStartOfQuestion = /^\d+[.)]/.test(line) || /^(What|How|Why|Where|When|Who|Which|Please|Tell|Describe|Explain)/i.test(line);

        if (isStartOfQuestion && buffer.length > 0) {
            // Push previous buffer if valid
            if (isValidQuestion(buffer)) {
                validQuestions.push(buffer);
            }
            buffer = line;
        } else {
            // Append to buffer
            buffer = buffer ? buffer + " " + line : line;
        }

        // If buffer ends with ?, it's likely the end of the question
        if (buffer.endsWith('?')) {
            if (isValidQuestion(buffer)) {
                validQuestions.push(buffer);
                buffer = "";
            }
        }
    }

    // Process remaining buffer
    if (buffer.length > 0 && isValidQuestion(buffer)) {
        validQuestions.push(buffer);
    }

    // Post-processing filter to remove duplicates and very similar items
    return [...new Set(validQuestions)];
}
