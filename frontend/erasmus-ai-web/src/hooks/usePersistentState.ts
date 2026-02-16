import { useState, useEffect } from 'react';
import { usePersistence } from '../context/PersistenceContext';

export function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const { isKeepTextEnabled } = usePersistence();

    const [state, setState] = useState<T>(() => {
        if (isKeepTextEnabled) {
            try {
                const stored = localStorage.getItem(key);
                if (stored !== null) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.error(`Error parsing localStorage key "${key}":`, e);
            }
        }
        // If defaultValue is a function, call it (standard useState behavior)
        return defaultValue instanceof Function ? defaultValue() : defaultValue;
    });

    useEffect(() => {
        if (isKeepTextEnabled) {
            try {
                localStorage.setItem(key, JSON.stringify(state));
            } catch (e) {
                console.error(`Error writing localStorage key "${key}":`, e);
            }
        } else {
            // Requirement: When disabled: localStorage must be cleared.
            // We only clear the storage, we do NOT reset the UI state.
            localStorage.removeItem(key);
        }
    }, [key, state, isKeepTextEnabled]);

    return [state, setState];
}
