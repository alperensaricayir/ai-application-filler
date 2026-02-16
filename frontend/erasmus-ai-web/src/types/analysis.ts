export interface FormAnalysisRequest {
    formText: string;
}

export interface ProjectAnalysisRequest {
    projectText: string;
}

export interface FormAnalysisResponse {
    applicationType?: string;
    programTopic?: string;
    suggestedNotes?: string;
}

export interface ProjectAnalysisResponse {
    applicationType?: string;
    programTopic?: string;
}
