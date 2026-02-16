import React from 'react';

interface QuestionCardProps {
    index: number;
    question: string;
    answer: string | null;
    loading: boolean;
    error: string | null;
    usedFallback?: boolean;
    onGenerate: () => Promise<void>;
    trimmedContext?: string; // New prop for showing reduced context
    readOnly?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
    index,
    question,
    answer,
    loading,
    error,
    usedFallback,
    onGenerate,
    trimmedContext,
    readOnly = false,
}) => {
    const [copied, setCopied] = React.useState(false);
    const [showContext, setShowContext] = React.useState(false);
    const [contextCopied, setContextCopied] = React.useState(false);

    const handleCopy = () => {
        if (answer) {
            navigator.clipboard.writeText(answer);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    const handleCopyContext = () => {
        if (trimmedContext) {
            navigator.clipboard.writeText(trimmedContext);
            setContextCopied(true);
            setTimeout(() => setContextCopied(false), 1500);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
            <div className="flex justify-between items-start">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                    <span className="text-gray-500 dark:text-gray-400 mr-2">Q{index + 1}:</span>
                    {question}
                </h4>
            </div>

            <div className="mt-4">
                {!answer && !loading && !error && !readOnly && (
                    <button
                        onClick={onGenerate}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Generate Answer
                    </button>
                )}

                {loading && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                        <svg className="animate-spin h-4 w-4 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Generating answer...</span>
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        Error: {error}
                        <button onClick={onGenerate} className="ml-2 underline hover:text-red-800 dark:hover:text-red-300">Retry</button>
                    </div>
                )}

                {answer && (
                    <div className="space-y-2 animate-fadeIn">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Answer</span>
                            <button
                                onClick={handleCopy}
                                className={`text-xs flex items-center ${copied ? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                        Copy
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="prose max-w-none p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap border border-gray-100 dark:border-gray-600 text-sm leading-relaxed">
                            {answer}
                        </div>
                        
                        {trimmedContext && (
                            <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-2">
                                <button
                                    onClick={() => setShowContext(!showContext)}
                                    className="flex items-center text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium focus:outline-none"
                                >
                                    <svg className={`w-3 h-3 mr-1 transform transition-transform ${showContext ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    {showContext ? 'Hide Context' : '▼ Trimmed Context Used'}
                                </button>
                                
                                {showContext && (
                                    <div className="mt-2 relative animate-fadeIn">
                                        <div className="absolute top-2 right-2">
                                            <button
                                                onClick={handleCopyContext}
                                                className={`text-xs px-2 py-1 rounded border ${contextCopied ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {contextCopied ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <textarea
                                            readOnly
                                            rows={6}
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-mono p-2 resize-none"
                                            value={trimmedContext}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {usedFallback && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic flex items-center justify-end">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Generated using fallback context
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
