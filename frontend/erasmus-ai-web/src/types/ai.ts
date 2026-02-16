export interface AnswerGenerationRequest {
    cvContent: string;
    applicationType: string;
    programTopic: string;
    question: string;
    questionCategory?: string;
    additionalNotes?: string;
    characterLimit?: number;
    languageLevel?: string;
    useContextCache?: boolean;
    modelName?: string;
    applicationContent?: string;
    isMotivationLetter?: boolean;
    useQuestionMode?: boolean;
    useAdvancedFormMode?: boolean;
    enableTextTrimmer?: boolean;
}
