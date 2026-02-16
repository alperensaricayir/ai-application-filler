import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PersistenceContextType {
    isKeepTextEnabled: boolean;
    toggleKeepText: () => void;
}

const PersistenceContext = createContext<PersistenceContextType | undefined>(undefined);

const KEEP_TEXT_MODE_KEY = 'erasmus_ai_keep_text_enabled';

export const PersistenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isKeepTextEnabled, setIsKeepTextEnabled] = useState<boolean>(() => {
        const stored = localStorage.getItem(KEEP_TEXT_MODE_KEY);
        return stored === 'true';
    });

    useEffect(() => {
        localStorage.setItem(KEEP_TEXT_MODE_KEY, String(isKeepTextEnabled));
    }, [isKeepTextEnabled]);

    const toggleKeepText = () => {
        setIsKeepTextEnabled(prev => !prev);
    };

    return (
        <PersistenceContext.Provider value={{ isKeepTextEnabled, toggleKeepText }}>
            {children}
        </PersistenceContext.Provider>
    );
};

export const usePersistence = (): PersistenceContextType => {
    const context = useContext(PersistenceContext);
    if (!context) {
        throw new Error('usePersistence must be used within a PersistenceProvider');
    }
    return context;
};
