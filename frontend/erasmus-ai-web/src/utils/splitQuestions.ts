export function splitQuestions(text: string): string[] {
    if (!text || text.trim().length === 0) {
        return [];
    }

    // 1. Try to split by numbered items (e.g., "1.", "2.", "1)", "2)")
    // Regex explanation:
    // (?:^|\n)  -> Start of string OR newline
    // \s*       -> Optional whitespace
    // \d+       -> One or more digits
    // [.)]      -> Dot or parenthesis
    // \s+       -> Whitespace after
    const numberedRegex = /(?:^|\n)\s*\d+[.)]\s+/;

    if (numberedRegex.test(text)) {
        const parts = text.split(numberedRegex)
            .map(part => part.trim())
            .filter(part => part.length > 0);
        
        if (parts.length > 1) {
            return parts;
        }
    }

    // 2. Try to split by double newlines (paragraphs) if they look like questions
    const paragraphs = text.split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (paragraphs.length > 1) {
        return paragraphs;
    }

    // 3. Fallback: Split by question mark if no other structure found
    // But only if the text is long enough to justify it
    if (text.includes('?')) {
        const questionParts = text.split('?')
            .map(part => part.trim())
            .filter(part => part.length > 10); // Filter out tiny fragments
        
        // Re-add question mark to the end of each part except the last one if it didn't have one
        const reconstructed = questionParts.map((part) => {
             // If original text had a question mark at this split point, add it back
             // Ideally we should keep the delimiter, but split removes it.
             // For simplicity, we append '?' to all parts that are actual questions.
             return part.endsWith('.') || part.endsWith('!') ? part : part + '?';
        });

        if (reconstructed.length > 1) {
            return reconstructed;
        }
    }

    // Default: Return as single question
    return [text.trim()];
}
