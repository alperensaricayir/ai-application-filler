import { extractRealQuestions } from './smartQuestionExtractor';

export interface QuickParsedData {
    questions: string[];
    applicationType: string | null;
    programTopic: string | null;
}

export function parseQuickModeInput(text: string): QuickParsedData {
    if (!text || text.trim().length === 0) {
        return {
            questions: [],
            applicationType: null,
            programTopic: null
        };
    }

    // 1. Detect Questions using Smart Extractor
    const questions = extractRealQuestions(text);

    // 2. Detect Application Type (Heuristics)
    let applicationType: string | null = null;
    const lowerText = text.toLowerCase();

    if (lowerText.includes('erasmus')) {
        applicationType = 'Erasmus+';
        if (lowerText.includes('internship') || lowerText.includes('traineeship') || lowerText.includes('staj')) {
            applicationType += ' Internship';
        } else if (lowerText.includes('youth exchange') || lowerText.includes('gençlik değişimi')) {
            applicationType += ' Youth Exchange';
        } else if (lowerText.includes('esc') || lowerText.includes('solidarity corps') || lowerText.includes('volunteer')) {
            applicationType += ' ESC Volunteering';
        } else {
            applicationType += ' Mobility';
        }
    } else if (lowerText.includes('internship') || lowerText.includes('staj')) {
        applicationType = 'Internship Application';
    } else if (lowerText.includes('volunteer') || lowerText.includes('gönüllü')) {
        applicationType = 'Volunteering Application';
    } else if (lowerText.includes('master') || lowerText.includes('phd') || lowerText.includes('degree')) {
        applicationType = 'Academic Application';
    }

    // 3. Detect Program Topic (Heuristics)
    // Try to find the first line that looks like a title or topic (capitalized, short)
    let programTopic: string | null = null;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Look for lines that are not questions and look like headers
    for (const line of lines) {
        // Skip if it looks like a question number
        if (/^\d+[.)]/.test(line)) continue;
        
        // Skip if it looks like a date
        if (/\d{2}\/\d{2}\/\d{4}/.test(line)) continue;

        // Skip if it looks like a URL
        if (line.startsWith('http')) continue;

        // Heuristic: If line is relatively short (< 100 chars) and has some keywords or capital letters
        if (line.length < 100 && line.length > 5) {
             // If we found specific keywords in this line
             const lowerLine = line.toLowerCase();
             if (lowerLine.includes('project') || lowerLine.includes('topic') || lowerLine.includes('about') || lowerLine.includes('konu')) {
                 programTopic = line.replace(/^(project|topic|about|konu)[:\s-]*/i, '').trim();
                 break;
             }
        }
    }

    // Fallback topic if no specific keyword line found: First non-empty line that isn't a question
    if (!programTopic && lines.length > 0) {
        const potentialTitle = lines[0];
        if (potentialTitle.length < 100 && !potentialTitle.includes('?')) {
            programTopic = potentialTitle;
        }
    }

    return {
        questions,
        applicationType,
        programTopic
    };
}
