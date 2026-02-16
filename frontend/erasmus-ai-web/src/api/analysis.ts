import axios from 'axios';
import { 
    FormAnalysisRequest, 
    FormAnalysisResponse, 
    ProjectAnalysisRequest, 
    ProjectAnalysisResponse 
} from '../types/analysis';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export async function analyzeForm(data: FormAnalysisRequest): Promise<FormAnalysisResponse> {
    try {
        const response = await apiClient.post<FormAnalysisResponse>('/api/ai/analyze-form', data);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.title || error.message || 'Failed to analyze form');
        }
        throw new Error('An unexpected error occurred during form analysis');
    }
}

export async function analyzeProject(data: ProjectAnalysisRequest): Promise<ProjectAnalysisResponse> {
    try {
        const response = await apiClient.post<ProjectAnalysisResponse>('/api/ai/analyze-project', data);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.title || error.message || 'Failed to analyze project info');
        }
        throw new Error('An unexpected error occurred during project analysis');
    }
}
