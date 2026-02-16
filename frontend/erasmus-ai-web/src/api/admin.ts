import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface ProviderConfig {
    provider: string;
    model?: string | null;
}

export interface ModelOption {
    id: string;
    name: string;
}

export interface ApiKeyRequest {
    provider: string;
    key: string;
}

export interface OllamaModelInfo {
    name: string;
    installed: boolean;
}

export const getProviderConfig = async (): Promise<ProviderConfig> => {
    const response = await apiClient.get<ProviderConfig>('/api/admin/config');
    return response.data;
};

export const setProviderConfig = async (provider: string, model?: string): Promise<void> => {
    await apiClient.post('/api/admin/config', { provider, model });
};

export const setApiKey = async (provider: string, key: string): Promise<void> => {
    await apiClient.post('/api/admin/keys', { provider, key });
};

export const getOllamaModels = async (): Promise<OllamaModelInfo[]> => {
    const response = await apiClient.get<OllamaModelInfo[]>('/api/admin/ollama-models');
    return response.data;
};

export const getProviderModels = async (provider?: string): Promise<ModelOption[]> => {
    const response = await apiClient.get<ModelOption[]>('/api/ai/models', {
        params: provider ? { provider } : undefined
    });
    return response.data;
};
