import axios from 'axios';
import { AnswerGenerationRequest } from '../types/ai';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export type ProviderType = 'Ollama' | 'Groq' | 'HuggingFace' | 'Gemini' | 'OpenAI' | 'Unknown';

export interface ModelOption {
    id: string;
    name: string;
}

export interface ProviderStatus {
    status: string;
    provider: ProviderType;
    model: string;
    apiKeyConfigured: boolean;
}

export interface ModelStatus {
    status: string;
    provider: ProviderType;
    model: string;
}

function normalizeProvider(raw: unknown): ProviderType {
    if (typeof raw !== 'string') return 'Unknown';
    const v = raw.trim().toLowerCase();
    if (v === 'ollama') return 'Ollama';
    if (v === 'groq') return 'Groq';
    if (v === 'huggingface') return 'HuggingFace';
    if (v === 'gemini') return 'Gemini';
    if (v === 'openai') return 'OpenAI';
    return 'Unknown';
}

export async function getAiProviders(): Promise<string[]> {
    try {
        const response = await apiClient.get<string[]>('/api/ai/providers');
        if (response.status === 200 && Array.isArray(response.data)) {
            return response.data;
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch providers:", error);
        return [];
    }
}

export interface GenerateResponse {
    answer: string;
    answers?: Array<{
        question: string;
        answer: string;
    }>;
    trimmedCv?: string;
    trimmedProject?: string;
    trimmedForm?: string;
    debug?: {
        trimmedContexts?: Array<{
            index: number;
            question: string;
            trimmedContext: string;
        }>;
    };
}

export async function generateAnswer(data: AnswerGenerationRequest): Promise<GenerateResponse> {
    try {
        const response = await apiClient.post<any>('/api/ai/generate', data);
        
        if (response.data?.success === true) {
            let answer = '';
            
            // Handle "answers" array format (current backend)
            if (Array.isArray(response.data.answers) && response.data.answers.length > 0) {
                answer = response.data.answers.map((a: any) => 
                    response.data.answers.length > 1 ? `Q: ${a.question}\n\n${a.answer}` : a.answer
                ).join('\n\n-------------------\n\n');
            } 
            // Handle legacy "data" string format
            else if (typeof response.data.data === 'string') {
                answer = response.data.data;
            }

            return {
                answer,
                answers: response.data.answers, // Pass through the raw array
                trimmedCv: response.data.trimmedCv,
                trimmedProject: response.data.trimmedProject,
                trimmedForm: response.data.trimmedForm,
                debug: response.data.debug
            };
        }
        
        throw new Error(response.data?.error || 'Failed to generate answer');
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const responseData = error.response?.data as unknown;
            if (responseData && typeof responseData === 'object' && 'error' in responseData) {
                const err = (responseData as { error?: unknown }).error;
                if (typeof err === 'string' && err.trim()) throw new Error(err);
            }
            throw new Error(error.message || 'Failed to generate answer');
        }
        throw new Error('An unexpected error occurred');
    }
}

export async function getProviderStatus(): Promise<ProviderStatus> {
    const baseUrl = (API_BASE_URL && API_BASE_URL.trim()) ? API_BASE_URL : 'http://localhost:5137';
    try {
        const res = await fetch(`${baseUrl}/api/ai/provider-status`, { method: 'GET' });
        const contentType = res.headers.get('content-type') || '';

        if (!res.ok) {
            const text = await res.text();
            console.error('Provider status request failed:', res.status, text);
            return { status: 'ERROR', provider: 'Unknown', model: '' };
        }

        if (!contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Provider status non-JSON response:', contentType, text);
            return { status: 'ERROR', provider: 'Unknown', model: '' };
        }

        const json = (await res.json()) as unknown;
        if (json && typeof json === 'object') {
            const obj = json as { status?: unknown; provider?: unknown; activeProvider?: unknown; model?: unknown; apiKeyConfigured?: unknown };
            const providerRaw = obj.provider ?? obj.activeProvider;
            const provider = normalizeProvider(providerRaw);
            const model = typeof obj.model === 'string' ? obj.model : '';
            const status = typeof obj.status === 'string' ? obj.status : 'OK';
            const apiKeyConfigured = obj.apiKeyConfigured === true;
            return { status, provider, model, apiKeyConfigured };
        }
        return { status: 'ERROR', provider: 'Unknown', model: '', apiKeyConfigured: false };
    } catch (e) {
        console.error('Failed to fetch provider status', e);
        return { status: 'ERROR', provider: 'Unknown', model: '', apiKeyConfigured: false };
    }
}

export async function getModelStatus(): Promise<ModelStatus> {
    const baseUrl = (API_BASE_URL && API_BASE_URL.trim()) ? API_BASE_URL : 'http://localhost:5137';
    try {
        const res = await fetch(`${baseUrl}/api/ai/model-status`, { method: 'GET' });
        const contentType = res.headers.get('content-type') || '';

        if (!res.ok) {
            const text = await res.text();
            console.error('Model status request failed:', res.status, text);
            return { status: 'ERROR', provider: 'Unknown', model: '' };
        }

        if (!contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Model status non-JSON response:', contentType, text);
            return { status: 'ERROR', provider: 'Unknown', model: '' };
        }

        const json = (await res.json()) as unknown;
        if (json && typeof json === 'object') {
            const obj = json as { status?: unknown; provider?: unknown; model?: unknown };
            const provider = normalizeProvider(obj.provider);
            const model = typeof obj.model === 'string' ? obj.model : '';
            const status = typeof obj.status === 'string' ? obj.status : 'OK';
            return { status, provider, model };
        }

        return { status: 'ERROR', provider: 'Unknown', model: '' };
    } catch (e) {
        console.error('Failed to fetch model status', e);
        return { status: 'ERROR', provider: 'Unknown', model: '' };
    }
}

export async function setModel(model: string): Promise<ModelStatus> {
    const baseUrl = (API_BASE_URL && API_BASE_URL.trim()) ? API_BASE_URL : 'http://localhost:5137';
    try {
        const res = await fetch(`${baseUrl}/api/ai/set-model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
            const text = await res.text();
            console.error('Set model request failed:', res.status, text);
            return { status: 'ERROR', provider: 'Unknown', model: '' };
        }

        if (!contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Set model non-JSON response:', contentType, text);
            return { status: 'ERROR', provider: 'Unknown', model: '' };
        }

        const json = (await res.json()) as unknown;
        if (json && typeof json === 'object') {
            const obj = json as { status?: unknown; provider?: unknown; model?: unknown };
            const provider = normalizeProvider(obj.provider);
            const returnedModel = typeof obj.model === 'string' ? obj.model : '';
            const status = typeof obj.status === 'string' ? obj.status : 'OK';
            return { status, provider, model: returnedModel };
        }

        return { status: 'ERROR', provider: 'Unknown', model: '' };
    } catch (e) {
        console.error('Failed to set model', e);
        return { status: 'ERROR', provider: 'Unknown', model: '' };
    }
}

export interface ChatResponse {
    success: boolean;
    response: string;
    durationMs: number;
}

export async function chatWithAi(message: string): Promise<ChatResponse> {
    try {
        const res = await apiClient.post<ChatResponse>('/api/ai/chat', { message });
        return res.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.error || error.message || 'Chat Failed');
        }
        throw new Error('An unexpected error occurred during chat');
    }
}

export async function apiTest(): Promise<string> {
    try {
        const response = await apiClient.get<string>('/api/ai/api-test');
        if (response.status === 200) {
            return response.data; // Should be "Backend OK"
        }
        throw new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
         if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.error || error.message || 'API Test Failed');
        }
        throw new Error('An unexpected error occurred during API test');
    }
}

export async function localLlmTest(prompt: string = "Hello"): Promise<string> {
    try {
        const response = await apiClient.get<string>('/api/ai/llm-test', {
            params: { prompt }
        });
        if (response.status === 200) {
            return response.data;
        }
        throw new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.error || error.message || 'LLM Test Failed');
        }
        throw new Error('An unexpected error occurred during LLM test');
    }
}

export async function providerTest(): Promise<boolean> {
    try {
        const response = await apiClient.get<{ success: boolean }>('/api/ai/provider-test');
        return response.data.success === true;
    } catch (error) {
        console.error("Provider test failed:", error);
        return false;
    }
}

export async function getAvailableModels(): Promise<ModelOption[]> {
    try {
        const response = await apiClient.get<unknown>('/api/ai/models');
        if (response.status !== 200) return [];

        const data = response.data;
        if (Array.isArray(data))
        {
            // New format: [{id,name}]
            if (data.every(x => x && typeof x === 'object' && 'id' in x && 'name' in x))
            {
                return (data as Array<{ id: unknown; name: unknown }> )
                    .filter(m => typeof m.id === 'string' && typeof m.name === 'string')
                    .map(m => ({ id: m.id as string, name: m.name as string }));
            }

            // Backward-compatible format: ["llama3:8b", ...]
            if (data.every(x => typeof x === 'string'))
            {
                return (data as string[]).map(s => ({ id: s, name: s }));
            }
        }

        return [];
    } catch (error) {
        console.error("Failed to fetch models:", error);
        return [];
    }
}

// Deprecated: kept for compatibility if needed, but redirects to apiTest
export async function testApi(prompt: string): Promise<string> {
    void prompt;
    return apiTest();
}
