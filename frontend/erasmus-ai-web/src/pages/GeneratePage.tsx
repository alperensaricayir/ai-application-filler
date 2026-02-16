import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateAnswer, apiTest, localLlmTest, getAvailableModels, providerTest, getProviderStatus, ProviderType, ModelOption, chatWithAi } from '../api/ai';
import { analyzeForm, analyzeProject } from '../api/analysis';
import { AnswerGenerationRequest } from '../types/ai';
import { usePdfTextExtractor } from '../hooks/usePdfTextExtractor';
import { splitQuestions } from '../utils/splitQuestions';
import { QuestionCard } from '../components/QuestionCard';
import { exportTextAsPdf } from '../utils/exportPdf';
import useDarkMode from '../hooks/useDarkMode';
import { parseQuickModeInput } from '../utils/quickModeParser';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePersistence } from '../context/PersistenceContext';

interface GeneratedQuestion {
    id: string;
    question: string;
    answer: string | null;
    loading: boolean;
    error: string | null;
    usedFallback?: boolean; // Track if fallback was used
    trimmedContext?: string; // New field for reduced context
}

const DEFAULT_CV = `YOUR NAME
Location: City, Country
Email: you@example.com | Phone: +00 000 000 0000 | LinkedIn: https://linkedin.com/in/yourprofile

SUMMARY
- Short professional summary (2-4 lines)

EXPERIENCE
- Role — Company — Dates — Location
  - Impact / responsibility #1
  - Impact / responsibility #2

EDUCATION
- Degree — School — Dates

SKILLS
- Skill 1, Skill 2, Skill 3`;

const MOTIVATION_LETTER_PROMPT = "Write a comprehensive and professional motivation letter for this application. Structure it with a formal introduction, body paragraphs highlighting relevant experience and skills from my CV, and a strong conclusion expressing enthusiasm. Address it to the Selection Committee.";

const GeneratePage: React.FC = () => {
    const navigate = useNavigate();
    const { isKeepTextEnabled, toggleKeepText } = usePersistence();
    
    // PDF Extraction Hook
    const { text: pdfText, loading: pdfLoading, error: pdfError, extract: extractPdf } = usePdfTextExtractor();
    
    // Dark Mode Hook
    const { theme, toggleTheme } = useDarkMode();

    // Mode State
    const [mode, setMode] = useState<'structured' | 'quick' | 'application' | 'chat'>('structured');
    const [useContextCache, setUseContextCache] = useState(false);
    const [enableTextTrimmer, setEnableTextTrimmer] = useState(true);
    const [useQuestionMode, setUseQuestionMode] = useState(false);
    const [useAdvancedFormMode, setUseAdvancedFormMode] = useState(false);
    const [quickInputText, setQuickInputText] = usePersistentState<string>('erasmus_ai_quick_input', '');
    
    // Chat Mode State
    const [chatMessage, setChatMessage] = useState('');
    const [chatReply, setChatReply] = useState<string | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatResponseTime, setChatResponseTime] = useState<number | null>(null);
    const [chatError, setChatError] = useState<string | null>(null);
    
    // Application Mode State
    const [appModeCv, setAppModeCv] = usePersistentState<string>('erasmus_ai_app_cv', '');
    const [appModeProjectInfo, setAppModeProjectInfo] = usePersistentState<string>('erasmus_ai_app_project', '');
    const [appModeNotes, setAppModeNotes] = usePersistentState<string>('erasmus_ai_app_notes', '');
    const [appModeAnswers, setAppModeAnswers] = useState<Array<{question: string, answer: string, trimmedContext?: string}> | null>(null);
    const [appModeResult, setAppModeResult] = useState<string | null>(null);
    type ApplicationGeneratingMode = 'answers' | 'motivation' | null;
    const [appModeGenerating, setAppModeGenerating] = useState<ApplicationGeneratingMode>(null);
    const [appModeError, setAppModeError] = useState<string | null>(null);

    // Model Selection State
    const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
    const [activeModel, setActiveModel] = useState<string>('');
    const [modelLoading, setModelLoading] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);

    // Form State
    const [cvContent, setCvContent] = usePersistentState<string>('erasmus_ai_cv_content', DEFAULT_CV);
    const [cvInputType, setCvInputType] = useState<'text' | 'pdf'>('text');
    const [applicationType, setApplicationType] = useState('');
    const [programTopic, setProgramTopic] = useState('');
    const [fullQuestionText, setFullQuestionText] = usePersistentState<string>('erasmus_ai_questions', '');
    const [languageLevel, setLanguageLevel] = useState('A2 English'); // Default value
    const [characterLimit, setCharacterLimit] = useState<number | undefined>(undefined);
    const [additionalNotes, setAdditionalNotes] = usePersistentState<string>('erasmus_ai_notes', '');

    // Auto-fill Input States
    const [fullFormText, setFullFormText] = usePersistentState<string>('erasmus_ai_full_form', '');
    const [projectInfoText, setProjectInfoText] = usePersistentState<string>('erasmus_ai_project_info', '');
    
    // Loading States for Analysis
    const [analyzingForm, setAnalyzingForm] = useState(false);
    const [analyzingProject, setAnalyzingProject] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Questions State
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
    
    // Bulk Generation State
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

    // Trimmed Content State
    const [trimmedCv, setTrimmedCv] = useState<string | null>(null);
    const [trimmedProject, setTrimmedProject] = useState<string | null>(null);
    const [trimmedForm, setTrimmedForm] = useState<string | null>(null);

    // Motivation Letter State
    const [motivationLetter, setMotivationLetter] = useState<string | null>(null);
    const [motivationLoading, setMotivationLoading] = useState(false);
    const [motivationError, setMotivationError] = useState<string | null>(null);
    const [motivationCopied, setMotivationCopied] = useState(false);

    // Utility Bar State
    const [apiTestStatus, setApiTestStatus] = useState<{ loading: boolean; success: boolean | null; message: string | null }>({ loading: false, success: null, message: null });
    const [llmTestStatus, setLlmTestStatus] = useState<{ loading: boolean; success: boolean | null; message: string | null }>({ loading: false, success: null, message: null });
    const [providerTestStatus, setProviderTestStatus] = useState<{ loading: boolean; success: boolean | null; message: string | null }>({ loading: false, success: null, message: null });
    const [activeProvider, setActiveProvider] = useState<ProviderType>('Unknown');
    const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
    const [providerOffline, setProviderOffline] = useState(false);

    const isLocalProvider = activeProvider === 'Ollama';

    type ModelStatusResponse = { status: string; provider: ProviderType; model: string };

    const isHeavyOllamaModel = (model: string): boolean => {
        const m = model.toLowerCase();
        if (m.includes('llama3:8b')) return true;
        if (m.includes('mistral')) return true;
        return /\b(8b|9b|10b|11b|12b|13b|14b|15b|16b|20b|22b|27b|30b|32b|34b|70b)\b/.test(m);
    };

    const postAdminSetModel = async (model: string): Promise<ModelStatusResponse> => {
        const baseUrl = (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim())
            ? String(import.meta.env.VITE_API_BASE_URL)
            : 'http://localhost:5137';

        const res = await fetch(`${baseUrl}/api/admin/set-model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`set-model failed (${res.status}): ${text}`);
        }
        if (!contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error(`set-model returned non-JSON: ${text}`);
        }

        const json = (await res.json()) as unknown;
        if (!json || typeof json !== 'object') {
            throw new Error('set-model returned invalid JSON');
        }

        const obj = json as { status?: unknown; provider?: unknown; model?: unknown };
        const status = typeof obj.status === 'string' ? obj.status : 'OK';
        const provider = (obj.provider === 'Ollama' || obj.provider === 'Groq' || obj.provider === 'Unknown')
            ? obj.provider
            : 'Unknown';
        const returnedModel = typeof obj.model === 'string' ? obj.model : '';

        return { status, provider, model: returnedModel };
    };

    const handleModelChange = async (nextModel: string) => {
        try {
            if (activeProvider === 'Ollama' && isHeavyOllamaModel(nextModel)) {
                console.warn('Heavy model selected — may cause timeout.');
            }

            await postAdminSetModel(nextModel);
            const refreshed = await getProviderStatus();
            setActiveProvider(refreshed.provider);
            setActiveModel(refreshed.model);
        } catch (e) {
            console.error('Failed to set model', e);
        }
    };

    // Effect to sync provider + model from backend on mount
    useEffect(() => {
        const fetchData = async () => {
            setModelLoading(true);
            try {
                const status = await getProviderStatus();
                console.log("Provider status:", status);
                
                if (status.status === 'ERROR' || status.provider === 'error' || status.provider === 'Unknown') {
                    console.error("Provider status returned error or unknown state.");
                    setProviderOffline(true);
                    // Keep previous activeProvider or default if needed, but UI will show OFFLINE
                } else {
                    setProviderOffline(false);
                    setActiveProvider(status.provider);
                    setActiveModel(status.model);
                    setApiKeyConfigured(status.apiKeyConfigured);
                }

                if (status.provider === 'Ollama' && isHeavyOllamaModel(status.model)) {
                    console.warn('Heavy model selected — may cause timeout.');
                }

                const models = await getAvailableModels();
                setAvailableModels(models);

                const hasModel = models.some(m => m.id === status.model);
                const needsDefault = !status.model || status.model === 'Unknown' || !hasModel;

                if (needsDefault && models.length > 0 && status.provider !== 'Unknown' && status.provider !== 'error' && status.provider === 'Ollama') {
                    await postAdminSetModel(models[0].id);
                    const refreshed = await getProviderStatus();
                    setActiveProvider(refreshed.provider);
                    setActiveModel(refreshed.model);
                    setApiKeyConfigured(refreshed.apiKeyConfigured);
                }

            } catch (err) {
                console.error("Failed to fetch models", err);
                setProviderOffline(true);
                setModelError("Model list unavailable");
            } finally {
                setModelLoading(false);
            }
        };
        fetchData();
    }, []);

    // Effect to update CV content when PDF text is extracted
    useEffect(() => {
        if (pdfText) {
            setCvContent(pdfText);
        }
    }, [pdfText]);

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await extractPdf(file);
        }
    };

    const handleSplitQuestions = () => {
        if (!fullQuestionText.trim()) return;
        
        const split = splitQuestions(fullQuestionText);
        setQuestions(split.map((q, index) => ({
            id: `q-${index}-${Date.now()}`,
            question: q,
            answer: null,
            loading: false,
            error: null
        })));
    };

    const handleAutoFillForm = async () => {
        if (!fullFormText.trim()) return;

        setAnalyzingForm(true);
        setAnalysisError(null);

        try {
            const result = await analyzeForm({ formText: fullFormText });
            
            if (result.applicationType) setApplicationType(result.applicationType);
            if (result.programTopic) setProgramTopic(result.programTopic);
            const notes = result.suggestedNotes;
            if (typeof notes === 'string' && notes.trim()) {
                setAdditionalNotes(prev => (prev ? `${prev}\n\n${notes}` : notes));
            }
        } catch (err: any) {
            setAnalysisError(err.message || 'Failed to analyze form');
        } finally {
            setAnalyzingForm(false);
        }
    };

    const handleAutoFillProject = async () => {
        if (!projectInfoText.trim()) return;

        setAnalyzingProject(true);
        setAnalysisError(null);

        try {
            const result = await analyzeProject({ projectText: projectInfoText });
            
            if (result.applicationType) setApplicationType(result.applicationType);
            if (result.programTopic) setProgramTopic(result.programTopic);
        } catch (err: any) {
            setAnalysisError(err.message || 'Failed to analyze project info');
        } finally {
            setAnalyzingProject(false);
        }
    };

    const generateSingleQuestion = async (question: GeneratedQuestion) => {
        setQuestions(prev => prev.map(q => 
            q.id === question.id ? { ...q, loading: true, error: null } : q
        ));

        // Check if fallback is needed
        const isFallback = !applicationType || !programTopic;

        const requestData: AnswerGenerationRequest = {
                cvContent,
                applicationType: applicationType, // Backend handles empty string as fallback
                programTopic: programTopic,       // Backend handles empty string as fallback
                question: question.question,
                languageLevel,
                characterLimit: characterLimit || undefined,
                additionalNotes: additionalNotes || undefined,
                enableTextTrimmer,
            };

        try {
            const result = await generateAnswer(requestData);
            setQuestions(prev => prev.map(q => 
                q.id === question.id ? { 
                    ...q, 
                    answer: result.answer, 
                    loading: false, 
                    usedFallback: isFallback,
                    trimmedContext: result.debug?.trimmedContexts?.[0]?.trimmedContext
                } : q
            ));
            if (result.trimmedCv) setTrimmedCv(result.trimmedCv);
            if (result.trimmedProject) setTrimmedProject(result.trimmedProject);
            if (result.trimmedForm) setTrimmedForm(result.trimmedForm);
        } catch (err: any) {
            setQuestions(prev => prev.map(q => 
                q.id === question.id ? { ...q, error: err.message || 'Failed to generate', loading: false } : q
            ));
        }
    };

    const handleGenerateAnswer = async (questionId: string) => {
        const questionItem = questions.find(q => q.id === questionId);
        if (!questionItem) return;

        // Validation for missing application type or program topic is REMOVED
        // We now allow fallback generation
        
        await generateSingleQuestion(questionItem);
    };

    const handleBulkGenerate = async () => {
        if (questions.length === 0) return;
        if (!cvContent) {
            alert('Please provide CV content first.');
            return;
        }
        
        setIsBulkGenerating(true);
        setBulkProgress({ current: 0, total: questions.length });

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            if (question.answer) {
                setBulkProgress(prev => prev ? { ...prev, current: i + 1 } : null);
                continue;
            }

            // In Optimized Mode (UseContextCache), we could theoretically reduce once here 
            // and pass it down, but the current backend API expects context per request 
            // unless we refactor to a stateful backend (which we avoided).
            // So we rely on the backend's "Aggressive Reduction" flag.
            
            setQuestions(prev => prev.map(q => q.id === question.id ? { ...q, loading: true } : q));

            const requestData: AnswerGenerationRequest = {
                cvContent,
                applicationType: applicationType,
                programTopic: programTopic,
                question: question.question,
                languageLevel,
                characterLimit: characterLimit || undefined,
                additionalNotes: additionalNotes || undefined,
                useContextCache: useContextCache, // Send the toggle state
                enableTextTrimmer,
            };

            try {
                const result = await generateAnswer(requestData);
                setQuestions(prev => prev.map(q => {
                    // Match result debug context if available
                    // Since bulk generation handles multiple questions, we need to map debug contexts by index?
                    // But here we are iterating and calling generateAnswer for EACH question individually unless backend supports true batching.
                    // Wait, the backend supports batching but this frontend loop calls generateAnswer one by one?
                    // Ah, the loop iterates: `const requestData ... await generateAnswer(requestData)`.
                    // So each call is a single question call.
                    
                    if (q.id === question.id) {
                        return { 
                            ...q, 
                            answer: result.answer, 
                            loading: false,
                            trimmedContext: result.debug?.trimmedContexts?.[0]?.trimmedContext
                        };
                    }
                    return q;
                }));
                if (result.trimmedCv) setTrimmedCv(result.trimmedCv);
                if (result.trimmedProject) setTrimmedProject(result.trimmedProject);
                if (result.trimmedForm) setTrimmedForm(result.trimmedForm);
            } catch (err: any) {
                setQuestions(prev => prev.map(q => 
                    q.id === question.id ? { ...q, error: err.message || 'Failed', loading: false } : q
                ));
            }

            setBulkProgress(prev => prev ? { ...prev, current: i + 1 } : null);
        }

        setIsBulkGenerating(false);
        setBulkProgress(null);
    };

    const handleQuickGenerate = async () => {
        if (!quickInputText.trim()) return;
        
        // 1. Parse
        const { questions: parsedQuestions, applicationType: parsedType, programTopic: parsedTopic } = parseQuickModeInput(quickInputText);
        
        // 2. Update State
        setCvContent(quickInputText);
        if (parsedType) setApplicationType(parsedType);
        if (parsedTopic) setProgramTopic(parsedTopic);
        
        // 3. Set Questions
        const newQuestions = parsedQuestions.map((q, index) => ({
            id: `q-${index}-${Date.now()}`,
            question: q,
            answer: null,
            loading: false,
            error: null
        }));
        setQuestions(newQuestions);

        // 4. Generate
        setIsBulkGenerating(true);
        setBulkProgress({ current: 0, total: newQuestions.length });

        for (let i = 0; i < newQuestions.length; i++) {
            const questionObj = newQuestions[i];
            
            // Set loading for this question
            setQuestions(prev => prev.map(q => q.id === questionObj.id ? { ...q, loading: true } : q));

            try {
                const requestData: AnswerGenerationRequest = {
                    cvContent: quickInputText,
                    applicationType: parsedType || 'General Application',
                    programTopic: parsedTopic || 'General Topic',
                    question: questionObj.question,
                    languageLevel,
                    characterLimit: characterLimit || undefined,
                    additionalNotes: undefined,
                    enableTextTrimmer,
                };

                const result = await generateAnswer(requestData);
                
                setQuestions(prev => prev.map(q => q.id === questionObj.id ? { 
                    ...q, 
                    answer: result.answer, 
                    loading: false,
                    trimmedContext: result.debug?.trimmedContexts?.[0]?.trimmedContext
                } : q));
                if (result.trimmedCv) setTrimmedCv(result.trimmedCv);
                if (result.trimmedProject) setTrimmedProject(result.trimmedProject);
                if (result.trimmedForm) setTrimmedForm(result.trimmedForm);
            } catch (err: any) {
                setQuestions(prev => prev.map(q => q.id === questionObj.id ? { ...q, error: err.message || 'Failed', loading: false } : q));
            }
            
            setBulkProgress({ current: i + 1, total: newQuestions.length });
        }

        setIsBulkGenerating(false);
        setBulkProgress(null);
    };

    const handleApplicationModeGenerate = async (isMotivationLetter: boolean) => {
        if (!appModeCv.trim()) {
            alert('Please provide your CV content.');
            return;
        }
        if (!appModeProjectInfo.trim()) {
            alert('Please provide project or application details.');
            return;
        }

        setAppModeGenerating(isMotivationLetter ? 'motivation' : 'answers');
        setAppModeError(null);
        setAppModeResult(null);
        setAppModeAnswers(null);

        const requestData: AnswerGenerationRequest = {
            cvContent: appModeCv,
            applicationType: 'Application Mode',
            programTopic: 'Application Mode',
            question: isMotivationLetter ? 'Generate Motivation Letter' : 'Generate Application Answers',
            additionalNotes: appModeNotes || undefined,
            
            applicationContent: appModeProjectInfo,
            isMotivationLetter: isMotivationLetter,
            useQuestionMode: isMotivationLetter ? false : useQuestionMode,
            useAdvancedFormMode: isMotivationLetter ? false : useAdvancedFormMode,
            enableTextTrimmer
        };

        try {
            const result = await generateAnswer(requestData);
            setAppModeResult(result.answer);
            
            // If we have structured answers, map trimmed context to them
            if (result.answers && result.answers.length > 0 && !isMotivationLetter) {
                 const answersWithContext = result.answers.map((a, index) => ({
                     ...a,
                     trimmedContext: result.debug?.trimmedContexts?.[index]?.trimmedContext
                 }));
                 setAppModeAnswers(answersWithContext);
            }
            
            if (result.trimmedCv) setTrimmedCv(result.trimmedCv);
            if (result.trimmedProject) setTrimmedProject(result.trimmedProject);
            // Form is usually empty in this mode or same as Project
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to generate content';
            setAppModeError(message);
        } finally {
            setAppModeGenerating(null);
        }
    };

    const handleCopyAppResult = () => {
        if (appModeResult) {
            navigator.clipboard.writeText(appModeResult);
        }
    };

    const handleApiTest = async () => {
        setApiTestStatus({ loading: true, success: null, message: null });
        try {
            await apiTest();
            setApiTestStatus({ loading: false, success: true, message: 'Backend OK' });
        } catch (err: any) {
            setApiTestStatus({ loading: false, success: false, message: 'Failed' });
            console.error(err);
        }
    };

    const handleLlmTest = async () => {
        setLlmTestStatus({ loading: true, success: null, message: null });
        try {
            await localLlmTest('Hello');
            setLlmTestStatus({ loading: false, success: true, message: 'LLM OK' });
        } catch (err: any) {
            setLlmTestStatus({ loading: false, success: false, message: 'Failed' });
            console.error(err);
        }
    };

    const handleProviderTest = async () => {
        setProviderTestStatus({ loading: true, success: null, message: null });
        try {
            const success = await providerTest();
            if (success) {
                setProviderTestStatus({ loading: false, success: true, message: 'Provider OK' });
            } else {
                setProviderTestStatus({ loading: false, success: false, message: 'Provider Failed' });
            }
        } catch (err: any) {
            setProviderTestStatus({ loading: false, success: false, message: 'Error' });
            console.error(err);
        }
    };

    const handleCopyAllAnswers = () => {
        const allText = questions
            .filter(q => q.answer)
            .map((q, i) => `Question ${i + 1}:\n${q.question}\n\nAnswer:\n${q.answer}`)
            .join('\n\n-------------------\n\n');
        
        if (allText) {
            navigator.clipboard.writeText(allText);
            // You might want to show a temporary "Copied!" message here
        }
    };

    const handleGenerateMotivation = async () => {
        if (!cvContent) {
            alert('Please provide CV content first.');
            return;
        }
        // Removed strict validation for motivation letter too
        // Allowed fallback execution

        setMotivationLoading(true);
        setMotivationError(null);
        setMotivationLetter(null);

        const requestData: AnswerGenerationRequest = {
            cvContent,
            applicationType: applicationType, // Backend handles fallback
            programTopic: programTopic,       // Backend handles fallback
            question: MOTIVATION_LETTER_PROMPT,
            languageLevel,
            characterLimit: undefined, // Usually motivation letters are longer
            additionalNotes: additionalNotes || undefined,
            enableTextTrimmer,
        };

        try {
            const result = await generateAnswer(requestData);
            setMotivationLetter(result.answer);
            if (result.trimmedCv) setTrimmedCv(result.trimmedCv);
            if (result.trimmedProject) setTrimmedProject(result.trimmedProject);
        } catch (err: any) {
            setMotivationError(err.message || 'Failed to generate motivation letter');
        } finally {
            setMotivationLoading(false);
        }
    };

    const handleCopyMotivation = () => {
        if (motivationLetter) {
            navigator.clipboard.writeText(motivationLetter);
            setMotivationCopied(true);
            setTimeout(() => setMotivationCopied(false), 1500);
        }
    };

    const handleExportMotivation = () => {
        if (motivationLetter) {
            const title = `${applicationType} - Motivation Letter`;
            exportTextAsPdf(title, motivationLetter);
        }
    };

    const handleChatSubmit = async () => {
        if (!chatMessage.trim()) return;

        setChatLoading(true);
        setChatReply(null);
        setChatResponseTime(null);
        setChatError(null);

        try {
            const result = await chatWithAi(chatMessage);
            if (result.success) {
                setChatReply(result.response);
                setChatResponseTime(result.durationMs);
            } else {
                setChatError('Chat failed with unknown error');
            }
        } catch (err: any) {
            setChatError(err.message || 'Chat failed');
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Utility Bar */}
                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                    {/* Active Provider Badge */}
                    <div className={`px-2 py-1 rounded uppercase tracking-wide border ${
                        providerOffline ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200' :
                        activeProvider === 'Groq' ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200' :
                        activeProvider === 'Ollama' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200' :
                        activeProvider === 'Gemini' ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200' :
                        activeProvider === 'HuggingFace' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200' :
                        activeProvider === 'OpenAI' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200' :
                        'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                        <div className="text-xs font-bold">
                            ACTIVE PROVIDER: {providerOffline ? 'OFFLINE' : activeProvider.toUpperCase()}
                        </div>
                        <div className="text-sm opacity-70 mt-1 normal-case">
                            {providerOffline ? 'Backend Unreachable' : (
                                <>
                                    <div>Model: {activeModel || 'Unknown'}</div>
                                    {!isLocalProvider && (
                                        <div className="mt-0.5 font-semibold">
                                            API Key: {apiKeyConfigured ? 'CONFIGURED ✅' : 'NOT SET ❌'}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/admin')}
                        className="px-3 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                    >
                        Admin Panel
                    </button>
                    
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleApiTest}
                            disabled={apiTestStatus.loading}
                            className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                                apiTestStatus.success === true ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800' : 
                                apiTestStatus.success === false ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800' : 
                                'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                            }`}
                        >
                            {apiTestStatus.loading ? 'Testing...' : 'API Test'}
                        </button>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleLlmTest}
                            disabled={llmTestStatus.loading || !isLocalProvider}
                            title={!isLocalProvider ? 'Available only for Ollama' : ''}
                            className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                                !isLocalProvider ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-600' :
                                llmTestStatus.success === true ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800' : 
                                llmTestStatus.success === false ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800' : 
                                'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                            }`}
                        >
                             {llmTestStatus.loading ? 'Testing...' : 'Local LLM Test'}
                        </button>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleProviderTest}
                            disabled={providerTestStatus.loading}
                            className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                                providerTestStatus.success === true ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800' : 
                                providerTestStatus.success === false ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800' : 
                                'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                            }`}
                        >
                             {providerTestStatus.loading ? 'Testing...' : 'LLM API Test'}
                        </button>
                    </div>
                    
                    {/* Memory Mode Toggle */}
                    <button
                        onClick={toggleKeepText}
                        className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                            isKeepTextEnabled 
                                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800' 
                                : 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                        }`}
                        title="When enabled, your inputs are saved automatically."
                    >
                        {isKeepTextEnabled ? 'Keep Text On Refresh' : 'Keep Text Off'}
                    </button>
                    
                    {/* Model Selector */}
                    {isLocalProvider && (
                        <div className="relative">
                            <select
                                value={activeModel}
                                onChange={(e) => void handleModelChange(e.target.value)}
                                disabled={modelLoading || availableModels.length === 0}
                                className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-1 pl-3 pr-8 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {modelLoading ? (
                                    <option>Loading models...</option>
                                ) : modelError ? (
                                    <option>Offline</option>
                                ) : (
                                    availableModels.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name}
                                        </option>
                                    ))
                                )}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* Dark Mode Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full border bg-white border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                    >
                        {theme === 'light' ? (
                            // Moon Icon (for Light Mode)
                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        ) : (
                            // Sun Icon (for Dark Mode)
                            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        )}
                    </button>
                </div>

                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Erasmus AI Assistant</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Generate professional answers for your application forms.</p>
                </div>

                        {/* Mode Toggles */}
                        <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setMode('structured')}
                                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                                    mode === 'structured'
                                        ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                Structured Mode
                            </button>
                            <button
                                onClick={() => setMode('quick')}
                                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                                    mode === 'quick'
                                        ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                Quick Mode
                            </button>
                            <button
                                onClick={() => setMode('application')}
                                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                                    mode === 'application'
                                        ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                Application Mode
                            </button>
                            <button
                                onClick={() => setMode('chat')}
                                className={`pb-2 px-1 text-sm font-medium transition-colors ${
                                    mode === 'chat'
                                        ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                AI Chat (Test)
                            </button>
                        </div>

                {/* Conditional Content */}
                {mode === 'structured' ? (
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 sm:p-8 space-y-8 transition-colors duration-200 animate-fadeIn">
                        
                         {/* Text Trimmer Toggle for Structured Mode */}
                         <div className="flex justify-end">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Text Trimmer
                                </span>
                                <button 
                                    onClick={() => setEnableTextTrimmer(!enableTextTrimmer)}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${enableTextTrimmer ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <span className="sr-only">Enable Text Trimmer</span>
                                    <span
                                        aria-hidden="true"
                                        className={`${enableTextTrimmer ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* CV Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CV Content</label>
                                <div className="flex space-x-4 text-sm">
                                    <button
                                        type="button"
                                        onClick={() => setCvInputType('text')}
                                        className={`font-medium ${cvInputType === 'text' ? 'text-indigo-600 dark:text-indigo-400 underline' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                    >
                                        Paste Text
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCvInputType('pdf')}
                                        className={`font-medium ${cvInputType === 'pdf' ? 'text-indigo-600 dark:text-indigo-400 underline' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                    >
                                        Upload PDF
                                    </button>
                                </div>
                            </div>

                            {cvInputType === 'text' ? (
                                <textarea
                                    rows={6}
                                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="Paste your CV content here..."
                                    value={cvContent}
                                    onChange={(e) => setCvContent(e.target.value)}
                                />
                            ) : (
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                                <span>Upload a PDF</span>
                                                <input id="file-upload" name="file-upload" type="file" accept=".pdf" className="sr-only" onChange={handlePdfUpload} />
                                            </label>
                                            <p className="pl-1">or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">PDF up to 10MB</p>
                                    </div>
                                </div>
                            )}

                            {pdfLoading && <p className="text-sm text-indigo-600 dark:text-indigo-400">Extracting text from PDF...</p>}
                            {pdfError && <p className="text-sm text-red-600 dark:text-red-400">{pdfError}</p>}
                        </div>

                        {/* Auto-Analysis Section */}
                        <div className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Smart Auto-Fill</h3>
                            
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                {/* Full Form Analysis */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Paste Full Application Form</label>
                                    <textarea
                                        rows={4}
                                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                        placeholder="Paste the full application form text here to auto-detect type and topic..."
                                        value={fullFormText}
                                        onChange={(e) => setFullFormText(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAutoFillForm}
                                        disabled={analyzingForm || !fullFormText}
                                        className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${analyzingForm || !fullFormText ? 'bg-indigo-400 dark:bg-indigo-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                                    >
                                        {analyzingForm ? 'Analyzing...' : 'Auto Fill From Form'}
                                    </button>
                                </div>

                                {/* Project Info Analysis */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company / Project Information</label>
                                    <textarea
                                        rows={4}
                                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                        placeholder="Paste company, internship or youth exchange project description here..."
                                        value={projectInfoText}
                                        onChange={(e) => setProjectInfoText(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAutoFillProject}
                                        disabled={analyzingProject || !projectInfoText}
                                        className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${analyzingProject || !projectInfoText ? 'bg-indigo-400 dark:bg-indigo-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                                    >
                                        {analyzingProject ? 'Analyzing...' : 'Auto Fill From Project Info'}
                                    </button>
                                </div>
                            </div>

                            {analysisError && (
                            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4">
                                <p className="text-sm text-red-700 dark:text-red-400">{analysisError}</p>
                            </div>
                        )}
                        
                        {/* Soft Validation Warning */}
                        {(!applicationType || !programTopic) && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-md p-3 animate-fadeIn">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                            Some fields are empty
                                        </h3>
                                        <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                                            <p>
                                                We will generate answers using available information and intelligent fallbacks.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                        {/* Motivation Letter Section */}
                        <div className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Motivation Letter</h3>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={handleGenerateMotivation}
                                        disabled={motivationLoading || !cvContent || !applicationType || !programTopic}
                                        className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-all duration-200 ${motivationLoading || !cvContent || !applicationType || !programTopic ? 'bg-indigo-400 dark:bg-indigo-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-indigo-500 dark:to-purple-500 dark:hover:from-indigo-600 dark:hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                                    >
                                        {motivationLoading ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Generating Letter...
                                            </>
                                        ) : 'Generate Motivation Letter'}
                                    </button>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Uses your CV, Application Type, and Program Topic.
                                    </p>
                                </div>

                                {motivationError && (
                                    <div className="mt-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4 rounded-md">
                                        <p className="text-sm text-red-700 dark:text-red-400">{motivationError}</p>
                                    </div>
                                )}

                                {motivationLetter && (
                                    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden animate-fadeIn">
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated Letter</h4>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={handleCopyMotivation}
                                                    className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded shadow-sm transition-colors ${motivationCopied ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'}`}
                                                >
                                                    {motivationCopied ? (
                                                        <>
                                                            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            Copied!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="mr-1.5 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                            </svg>
                                                            Copy Text
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={handleExportMotivation}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                >
                                                    <svg className="mr-1.5 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Export PDF
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-6 prose prose-sm max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                            {motivationLetter}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>


                        {/* Basic Info Grid */}
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Application Type</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="e.g. Erasmus+ Internship"
                                    value={applicationType}
                                    onChange={(e) => setApplicationType(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Program Topic</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="e.g. AI Research"
                                    value={programTopic}
                                    onChange={(e) => setProgramTopic(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Language Level</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="e.g. B2 English"
                                    value={languageLevel}
                                    onChange={(e) => setLanguageLevel(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Character Limit</label>
                                <input
                                    type="number"
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="Optional"
                                    value={characterLimit || ''}
                                    onChange={(e) => setCharacterLimit(e.target.value ? parseInt(e.target.value) : undefined)}
                                />
                            </div>

                             <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Additional Notes</label>
                                <textarea
                                    rows={2}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="Any specific points to emphasize..."
                                    value={additionalNotes}
                                    onChange={(e) => setAdditionalNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Question Input Section */}
                        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Application Questions (Paste Full Text)</label>
                            <div className="mt-1">
                                <textarea
                                    rows={4}
                                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="Paste the full list of questions here..."
                                    value={fullQuestionText}
                                    onChange={(e) => setFullQuestionText(e.target.value)}
                                />
                            </div>
                            <div className="mt-3 flex justify-end space-x-3">
                                 <button
                                    type="button"
                                    onClick={handleSplitQuestions}
                                    disabled={!fullQuestionText.trim()}
                                    className={`relative group inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${!fullQuestionText.trim() ? 'bg-indigo-300 dark:bg-indigo-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                                >
                                    Split Questions
                                    {!fullQuestionText.trim() && (
                                        <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-gray-800 text-white text-xs rounded py-1 px-2">
                                            Please paste application form first.
                                        </div>
                                    )}
                                </button>
                            </div>
                            {questions.length > 0 && (
                                <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
                                    {questions.length} questions detected.
                                </p>
                            )}
                        </div>
                    </div>
                ) : mode === 'quick' ? (
                    // Quick Mode Content
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 sm:p-8 space-y-8 transition-colors duration-200 animate-fadeIn">
                         
                         {/* Text Trimmer Toggle for Quick Mode */}
                         <div className="flex justify-end">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Text Trimmer
                                </span>
                                <button 
                                    onClick={() => setEnableTextTrimmer(!enableTextTrimmer)}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${enableTextTrimmer ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <span className="sr-only">Enable Text Trimmer</span>
                                    <span
                                        aria-hidden="true"
                                        className={`${enableTextTrimmer ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                    />
                                </button>
                            </div>
                        </div>

                         <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Paste Everything (CV + Form + Project Info + Notes)</label>
                            <textarea
                                rows={12}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="Paste all available information here. We will automatically detect context and generate structured answers."
                                value={quickInputText}
                                onChange={(e) => setQuickInputText(e.target.value)}
                            />
                            
                            <div className="flex flex-col items-center space-y-2 pt-4">
                                <button
                                    onClick={handleQuickGenerate}
                                    disabled={isBulkGenerating || !quickInputText.trim()}
                                    title={!quickInputText.trim() ? "Please paste content first." : ""}
                                    className={`w-full sm:w-auto px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-all duration-200 transform hover:scale-105 ${isBulkGenerating || !quickInputText.trim() ? 'bg-indigo-400 dark:bg-indigo-500 cursor-not-allowed scale-100' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-indigo-500 dark:to-purple-500 dark:hover:from-indigo-600 dark:hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                                >
                                    {isBulkGenerating ? `Generating Answer ${bulkProgress?.current} of ${bulkProgress?.total}...` : 'Generate From Everything'}
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Quick Mode is ideal if you don’t want to manually fill fields.</p>
                            </div>
                        </div>
                    </div>
                ) : mode === 'application' ? (
                    // Application Mode Content
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 sm:p-8 space-y-8 transition-colors duration-200 animate-fadeIn">
                        
                        {/* Text Trimmer & Question Mode Toggle for Application Mode */}
                         <div className="flex justify-end space-x-6">
                            {/* Advanced Form Mode Toggle */}
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Advanced Form
                                </span>
                                <button 
                                    onClick={() => setUseAdvancedFormMode(!useAdvancedFormMode)}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 ${useAdvancedFormMode ? 'bg-pink-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                    title="Enable advanced extraction for forms without question marks (Name, Email, etc.)"
                                >
                                    <span className="sr-only">Enable Advanced Form Mode</span>
                                    <span
                                        aria-hidden="true"
                                        className={`${useAdvancedFormMode ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                    />
                                </button>
                            </div>

                            {/* Question Mode Toggle */}
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Question Mode
                                </span>
                                <button 
                                    onClick={() => setUseQuestionMode(!useQuestionMode)}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${useQuestionMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                    title="Switch to strictly extracting and answering questions (Q1... Answer...)"
                                >
                                    <span className="sr-only">Enable Question Mode</span>
                                    <span
                                        aria-hidden="true"
                                        className={`${useQuestionMode ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                    />
                                </button>
                            </div>

                            {/* Text Trimmer Toggle */}
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Text Trimmer
                                </span>
                                <button 
                                    onClick={() => setEnableTextTrimmer(!enableTextTrimmer)}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${enableTextTrimmer ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <span className="sr-only">Enable Text Trimmer</span>
                                    <span
                                        aria-hidden="true"
                                        className={`${enableTextTrimmer ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Section 1: CV */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                CV & About You
                            </label>
                            <textarea
                                rows={8}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="Paste your CV and everything about yourself."
                                value={appModeCv}
                                onChange={(e) => setAppModeCv(e.target.value)}
                            />
                        </div>

                        {/* Section 2: Application Info */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Project / Internship / Company Info
                            </label>
                            <textarea
                                rows={8}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="Paste project description, internship details, company info, full form questions, youth exchange description etc."
                                value={appModeProjectInfo}
                                onChange={(e) => setAppModeProjectInfo(e.target.value)}
                            />
                        </div>

                        {/* Section 3: Notes */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Additional Notes (Optional)
                            </label>
                            <textarea
                                rows={3}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="e.g. Write in A2 English, focus on leadership, be more emotional..."
                                value={appModeNotes}
                                onChange={(e) => setAppModeNotes(e.target.value)}
                            />
                        </div>

                        {/* Section 4: Actions */}
                        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => handleApplicationModeGenerate(false)}
                                disabled={appModeGenerating !== null || !appModeCv || !appModeProjectInfo}
                                className={`flex-1 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-all duration-200 ${appModeGenerating !== null || !appModeCv || !appModeProjectInfo ? 'bg-indigo-400 dark:bg-indigo-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                            >
                                {appModeGenerating === 'answers' ? 'Generating...' : 'Generate Answers'}
                            </button>
                            
                            <button
                                onClick={() => handleApplicationModeGenerate(true)}
                                disabled={appModeGenerating !== null || !appModeCv || !appModeProjectInfo}
                                className={`flex-1 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-all duration-200 ${appModeGenerating !== null || !appModeCv || !appModeProjectInfo ? 'bg-purple-400 dark:bg-purple-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'}`}
                            >
                                {appModeGenerating === 'motivation' ? 'Generating...' : 'Generate Motivation Letter'}
                            </button>
                        </div>

                        {/* Error Message */}
                        {appModeError && (
                            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4 rounded-md">
                                <p className="text-sm text-red-700 dark:text-red-400">{appModeError}</p>
                            </div>
                        )}

                        {/* Result Display */}
                        {appModeAnswers && useQuestionMode ? (
                            <div className="space-y-6 animate-fadeIn mt-8">
                                <h4 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">
                                    Generated Answers ({appModeAnswers.length})
                                </h4>
                                {appModeAnswers.map((item, idx) => (
                                    <QuestionCard
                                        key={idx}
                                        index={idx}
                                        question={item.question}
                                        answer={item.answer}
                                        loading={false}
                                        error={null}
                                        onGenerate={() => {}} // No regeneration for now
                                        trimmedContext={item.trimmedContext}
                                        readOnly={true} // New prop to hide generate button
                                    />
                                ))}
                            </div>
                        ) : appModeResult && (
                            <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden animate-fadeIn">
                                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-600 border-b border-gray-200 dark:border-gray-500 flex justify-between items-center">
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">Generated Content</h4>
                                    <button
                                        onClick={handleCopyAppResult}
                                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-500 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Copy Text
                                    </button>
                                </div>
                                <div className="p-6 prose prose-sm max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                    {appModeResult}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // Chat Mode Content
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 sm:p-8 space-y-8 transition-colors duration-200 animate-fadeIn">
                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">AI Chat (Performance Test)</h3>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Test response speed for {activeProvider}
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Message</label>
                                <textarea
                                    rows={4}
                                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="Ask anything..."
                                    value={chatMessage}
                                    onChange={(e) => setChatMessage(e.target.value)}
                                />
                            </div>
                            
                            <div className="flex justify-end">
                                <button
                                    onClick={handleChatSubmit}
                                    disabled={chatLoading || !chatMessage.trim()}
                                    className={`px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-all duration-200 ${chatLoading || !chatMessage.trim() ? 'bg-indigo-400 dark:bg-indigo-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                                >
                                    {chatLoading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Sending...
                                        </>
                                    ) : 'Send Message'}
                                </button>
                            </div>

                            {chatError && (
                                <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4 rounded-md animate-fadeIn">
                                    <p className="text-sm text-red-700 dark:text-red-400">{chatError}</p>
                                </div>
                            )}

                            {(chatReply || chatResponseTime !== null) && (
                                <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden animate-fadeIn">
                                    <div className="px-4 py-3 bg-gray-100 dark:bg-gray-600 border-b border-gray-200 dark:border-gray-500 flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">AI Response</h4>
                                        {chatResponseTime !== null && (
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                chatResponseTime < 1000 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                chatResponseTime < 3000 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                                Time: {chatResponseTime} ms
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-6 prose prose-sm max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                        {chatReply}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Bulk Generate Button (Only for Structured Mode) */}
                {mode === 'structured' && questions.length > 0 && (
                    <div className="flex flex-col items-center space-y-4 animate-fadeIn py-4">
                        
                        {/* Optimization Toggle */}
                        <div className="flex flex-col space-y-2 mb-2">
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => setUseContextCache(!useContextCache)}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${useContextCache ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <span className="sr-only">Use Optimized Mode</span>
                                    <span
                                        aria-hidden="true"
                                        className={`${useContextCache ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                    />
                                </button>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Optimized Mode (Faster, Reduces Context)
                                </span>
                            </div>

                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => setEnableTextTrimmer(!enableTextTrimmer)}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${enableTextTrimmer ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <span className="sr-only">Enable Text Trimmer</span>
                                    <span
                                        aria-hidden="true"
                                        className={`${enableTextTrimmer ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                    />
                                </button>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Text Trimmer (Saves Tokens, Removes Junk)
                                </span>
                            </div>
                        </div>

                        <div className="flex space-x-4">
                            <button
                                onClick={handleBulkGenerate}
                                disabled={isBulkGenerating || !cvContent}
                                className={`relative group w-full sm:w-auto px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-all duration-200 transform hover:scale-105 ${isBulkGenerating || !cvContent ? 'bg-indigo-400 dark:bg-indigo-500 cursor-not-allowed scale-100' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-indigo-500 dark:to-purple-500 dark:hover:from-indigo-600 dark:hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                            >
                                {isBulkGenerating ? `Generating Answer ${bulkProgress?.current} of ${bulkProgress?.total}...` : 'Generate All Answers'}
                                {(!cvContent) && (
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 bg-gray-800 text-white text-xs rounded py-1 px-2">
                                        Please provide CV content first.
                                    </div>
                                )}
                            </button>
                            
                            <button
                                onClick={handleCopyAllAnswers}
                                className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md shadow-sm font-medium transition-colors"
                            >
                                Copy All Answers
                            </button>
                        </div>
                    </div>
                )}

                {/* Trimmed Content Display (Read Only) */}
                {(trimmedCv || trimmedProject || trimmedForm) && enableTextTrimmer && (
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6 transition-colors duration-200 animate-fadeIn border border-indigo-100 dark:border-indigo-900">
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                            <h3 className="text-lg font-medium text-indigo-700 dark:text-indigo-300">
                                ✂️ Smart Context Reducer Output
                            </h3>
                            <button 
                                onClick={() => { setTrimmedCv(null); setTrimmedProject(null); setTrimmedForm(null); }}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Clear
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {trimmedCv && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Trimmed CV ({trimmedCv.length} chars)</label>
                                    <textarea
                                        readOnly
                                        rows={6}
                                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-mono p-2 resize-none"
                                        value={trimmedCv}
                                    />
                                </div>
                            )}
                            
                            {trimmedProject && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Trimmed Project ({trimmedProject.length} chars)</label>
                                    <textarea
                                        readOnly
                                        rows={6}
                                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-mono p-2 resize-none"
                                        value={trimmedProject}
                                    />
                                </div>
                            )}

                            {trimmedForm && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Extracted Questions ({trimmedForm.length} chars)</label>
                                    <textarea
                                        readOnly
                                        rows={6}
                                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-mono p-2 resize-none"
                                        value={trimmedForm}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Questions List (Visible in Both Modes) */}
                <div className="space-y-6">
                    {questions.map((q, index) => (
                        <QuestionCard
                            key={q.id}
                            index={index}
                            question={q.question}
                            answer={q.answer}
                            loading={q.loading}
                            error={q.error}
                            onGenerate={() => handleGenerateAnswer(q.id)}
                            trimmedContext={q.trimmedContext}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GeneratePage;
