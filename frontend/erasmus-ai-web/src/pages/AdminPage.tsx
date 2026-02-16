import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProviderConfig, setProviderConfig, setApiKey, getOllamaModels, OllamaModelInfo, getProviderModels, ModelOption } from '../api/admin';
import { getAiProviders } from '../api/ai';

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
    groq: 'llama-3.1-8b-instant',
    huggingface: 'mistralai/Mistral-7B-Instruct-v0.2',
    gemini: 'gemini-1.5-flash',
    ollama: 'llama3:8b'
};

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [provider, setProvider] = useState<string>('ollama');
    const [availableProviders, setAvailableProviders] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // API Key State
    const [keyProvider, setKeyProvider] = useState<string>('gemini');
    const [apiKey, setApiKeyValue] = useState('');
    
    // Ollama State
    const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([]);
    const [ollamaLoading, setOllamaLoading] = useState(false);

    // Provider Models
    const [providerModels, setProviderModels] = useState<ModelOption[]>([]);
    const [providerModelsLoading, setProviderModelsLoading] = useState(false);

    useEffect(() => {
        const init = async () => {
            await fetchProviders();
            await fetchConfig();
        };
        init();
    }, []);

    useEffect(() => {
        fetchModelsForProvider();
        if (provider === 'ollama') fetchOllamaModels();
    }, [provider]);

    const fetchProviders = async () => {
        try {
            const providers = await getAiProviders();
            if (providers && providers.length > 0) {
                setAvailableProviders(providers);
                // Ensure keyProvider is in the list (if default 'gemini' is not there)
                if (!providers.includes(keyProvider) && providers.length > 0) {
                     // Find first non-ollama provider for key default
                     const firstKeyProvider = providers.find(p => p !== 'ollama');
                     if (firstKeyProvider) setKeyProvider(firstKeyProvider);
                }
            }
        } catch (err) {
            console.error('Failed to fetch providers', err);
            setError('Failed to load available providers');
        }
    };

    const fetchConfig = async () => {
        try {
            const config = await getProviderConfig();
            setProvider(config.provider);
            if (config.model) {
                setSelectedModel(config.model);
            } else {
                const fallback = DEFAULT_MODEL_BY_PROVIDER[config.provider] || '';
                if (fallback) setSelectedModel(fallback);
            }
        } catch (err) {
            console.error('Failed to fetch config', err);
            setError('Failed to load configuration');
        }
    };

    const fetchModelsForProvider = async () => {
        setProviderModelsLoading(true);
        try {
            if (provider === 'ollama' || provider === 'groq') {
                const models = await getProviderModels(provider);
                setProviderModels(models);
                if (!selectedModel && models.length > 0) {
                    setSelectedModel(models[0].id);
                }
                if (selectedModel && models.every(m => m.id !== selectedModel) && models.length > 0) {
                    setSelectedModel(models[0].id);
                }
                return;
            }

            setProviderModels([]);
            if (!selectedModel) {
                // Do NOT auto-fill fallback for manual providers
                // const fallback = DEFAULT_MODEL_BY_PROVIDER[provider] || '';
                // if (fallback) setSelectedModel(fallback);
            }
        } catch (err) {
            console.error('Failed to fetch provider models', err);
            setProviderModels([]);
        } finally {
            setProviderModelsLoading(false);
        }
    };

    const fetchOllamaModels = async () => {
        setOllamaLoading(true);
        try {
            const models = await getOllamaModels();
            setOllamaModels(models);
        } catch (err) {
            console.error('Failed to fetch Ollama models', err);
        } finally {
            setOllamaLoading(false);
        }
    };

    const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProvider = e.target.value;
        setProvider(newProvider);
        // Do NOT auto-reset model or auto-select default. User must enter manually for non-dropdown providers.
        if (newProvider === 'ollama' || newProvider === 'groq') {
             // For dropdown-based providers, we might clear it to force user selection, 
             // but let's keep it empty so they pick from the list.
             setSelectedModel(''); 
        } else {
             // For manual entry providers (HuggingFace, Gemini, OpenAI), keep the box empty 
             // or let them type. Do NOT auto-inject defaults.
             setSelectedModel('');
        }
    };

    const saveProvider = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await setProviderConfig(provider, selectedModel);
            setSuccess(`Provider switched to ${provider} successfully.`);
        } catch (err) {
            setError('Failed to update provider.');
        } finally {
            setLoading(false);
        }
    };

    const saveApiKey = async () => {
        if (!apiKey) {
            setError('API Key is required');
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await setApiKey(keyProvider, apiKey);
            setSuccess(`API Key for ${keyProvider} saved securely.`);
            setApiKeyValue('');
        } catch (err) {
            setError('Failed to save API Key.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Admin Panel</h1>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        Back to Generator
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}
                
                {success && (
                    <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-400 p-4">
                        <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
                    </div>
                )}

                {/* Section 1: Provider Selection */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">AI Provider Selection</h2>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:space-x-4">
                        <select
                            value={provider}
                            onChange={handleProviderChange}
                            className="block w-full max-w-xs rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            {availableProviders.map(p => (
                                <option key={p} value={p}>{p.toUpperCase()}</option>
                            ))}
                        </select>

                        {provider === 'ollama' ? (
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={providerModelsLoading || providerModels.length === 0}
                                className="block w-full max-w-xs rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            >
                                {providerModelsLoading ? (
                                    <option>Loading models...</option>
                                ) : (
                                    providerModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))
                                )}
                            </select>
                        ) : provider === 'groq' ? (
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={providerModelsLoading || providerModels.length === 0}
                                className="block w-full max-w-xs rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            >
                                {providerModelsLoading ? (
                                    <option>Loading models...</option>
                                ) : (
                                    providerModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))
                                )}
                            </select>
                        ) : provider === 'gemini' ? (
                            // Hide model input for Gemini
                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                Model: Auto (Gemini 1.5 Flash)
                            </span>
                        ) : (
                            <input
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="block w-full max-w-xs rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder={DEFAULT_MODEL_BY_PROVIDER[provider] || 'Enter model id'}
                            />
                        )}

                        <button
                            onClick={saveProvider}
                            disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Changes apply immediately. No restart required.
                    </p>
                </div>

                {/* Section 2: API Keys */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">API Key Management</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
                            <select
                                value={keyProvider}
                                onChange={(e) => setKeyProvider(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                {availableProviders.filter(p => p !== 'ollama').map(p => (
                                    <option key={p} value={p}>{p.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKeyValue(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="Enter API Key securely"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button
                            onClick={saveApiKey}
                            disabled={loading || !apiKey}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Securely'}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Keys are encrypted using DPAPI/AES and stored locally. They are never exposed to the frontend after saving.
                    </p>
                </div>

                {/* Section 3: Ollama Models */}
                {provider === 'ollama' && (
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 animate-fadeIn">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Ollama Models</h2>
                            <button 
                                onClick={fetchOllamaModels}
                                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                            >
                                Refresh
                            </button>
                        </div>
                        
                        {ollamaLoading ? (
                            <p className="text-gray-500 dark:text-gray-400">Loading models...</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Model Name</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {ollamaModels.map((model) => (
                                            <tr key={model.name}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {model.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        model.installed 
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                    }`}>
                                                        {model.installed ? 'Available' : 'Not Installed'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {ollamaModels.length === 0 && (
                                            <tr>
                                                <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                                    No models found or Ollama is unreachable.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
