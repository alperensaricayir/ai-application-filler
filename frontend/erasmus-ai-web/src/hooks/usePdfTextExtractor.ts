import { useState, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Correctly load worker for Vite environment
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerSrc;

interface UsePdfTextExtractorReturn {
    text: string;
    loading: boolean;
    error: string | null;
    extract: (file: File) => Promise<void>;
    reset: () => void;
}

export const usePdfTextExtractor = (): UsePdfTextExtractorReturn => {
    const [text, setText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setText('');
        setLoading(false);
        setError(null);
    }, []);

    const extract = useCallback(async (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('Please upload a valid PDF file.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = new Uint8Array(await file.arrayBuffer());
            const loadingTask = getDocument({ data });
            const pdf: PDFDocumentProxy = await loadingTask.promise;
            
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .filter((item): item is TextItem => 'str' in item)
                    .map(item => item.str)
                    .join(' ');
                
                fullText += pageText + '\n\n';
            }

            const trimmedText = fullText.trim();
            
            if (!trimmedText) {
                throw new Error('No text could be extracted from the PDF.');
            }

            setText(trimmedText);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to extract text from PDF.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    return { text, loading, error, extract, reset };
};
