// js/aiSettings.js
import { AI_PROVIDER_KEY, GEMINI_API_KEY_KEY, GEMINI_MODEL_KEY, API_KEY_KEY, ENDPOINT_KEY, MODEL_DEPLOYMENT_NAME_KEY, NUM_SUGGESTIONS_KEY } from './config.js';
import { closeModal } from './utils.js';

// DOM Elements - these will be initialized in the main script after DOM is loaded
let aiProviderSelect,
    geminiApiKeyInputContainer, geminiApiKeyInput, geminiModelInput,
    openaiCompatibleInputContainer, apiKeyInput, endpointInput,
    modelDeploymentInputContainer, modelDeploymentNameInput,
    numSuggestionsInput;
    // saveAiProviderSettingsButton; // This button's event listener is set up in main.js

export function initializeAiSettingsControls(elements) {
    aiProviderSelect = elements.aiProviderSelect;
    geminiApiKeyInputContainer = elements.geminiApiKeyInputContainer;
    geminiApiKeyInput = elements.geminiApiKeyInput;
    geminiModelInput = elements.geminiModelInput;
    openaiCompatibleInputContainer = elements.openaiCompatibleInputContainer;
    apiKeyInput = elements.apiKeyInput;
    endpointInput = elements.endpointInput;
    modelDeploymentInputContainer = elements.modelDeploymentInputContainer;
    modelDeploymentNameInput = elements.modelDeploymentNameInput;
    numSuggestionsInput = elements.numSuggestionsInput;
    // saveAiProviderSettingsButton = elements.saveAiProviderSettingsButton;
}

export function handleEndpointChange() {
    // This function can be expanded if specific endpoint logic is needed later
    // For now, it's mostly a placeholder or for direct input handling if any.
    // console.log("Endpoint changed to:", endpointInput.value);
}

export function handleAiProviderChange() {
    if (!aiProviderSelect || !geminiApiKeyInputContainer || !openaiCompatibleInputContainer) {
        console.warn("AI provider change handler called before elements are initialized.");
        return;
    }
    const selectedProvider = aiProviderSelect.value;
    geminiApiKeyInputContainer.classList.add('hidden');
    openaiCompatibleInputContainer.classList.add('hidden');

    if (selectedProvider === 'gemini') {
        geminiApiKeyInputContainer.classList.remove('hidden');
    } else if (selectedProvider === 'openai_compatible') {
        openaiCompatibleInputContainer.classList.remove('hidden');
    }
}

export function loadAiProviderSettingsFromStorage() {
    if (!aiProviderSelect || !geminiApiKeyInput || !geminiModelInput || !apiKeyInput || !endpointInput || !modelDeploymentNameInput || !numSuggestionsInput) {
        console.warn("Load AI provider settings called before elements are initialized.");
        return;
    }
    const provider = localStorage.getItem(AI_PROVIDER_KEY) || 'gemini';
    aiProviderSelect.value = provider;
    geminiApiKeyInput.value = localStorage.getItem(GEMINI_API_KEY_KEY) || '';
    geminiModelInput.value = localStorage.getItem(GEMINI_MODEL_KEY) || '';
    apiKeyInput.value = localStorage.getItem(API_KEY_KEY) || '';
    endpointInput.value = localStorage.getItem(ENDPOINT_KEY) || '';
    modelDeploymentNameInput.value = localStorage.getItem(MODEL_DEPLOYMENT_NAME_KEY) || '';
    numSuggestionsInput.value = localStorage.getItem(NUM_SUGGESTIONS_KEY) || '3';

    handleAiProviderChange();
}

export function saveAiProviderSettingsToStorage() {
    if (!aiProviderSelect || !numSuggestionsInput || !geminiApiKeyInput || !geminiModelInput || !apiKeyInput || !endpointInput || !modelDeploymentNameInput) {
        console.warn("Save AI provider settings called before elements are initialized.");
        return;
    }
    const selectedProvider = aiProviderSelect.value;
    localStorage.setItem(AI_PROVIDER_KEY, selectedProvider);
    localStorage.setItem(NUM_SUGGESTIONS_KEY, numSuggestionsInput.value);

    // Clear all specific provider keys first
    localStorage.removeItem(GEMINI_API_KEY_KEY);
    localStorage.removeItem(GEMINI_MODEL_KEY);
    localStorage.removeItem(API_KEY_KEY);
    localStorage.removeItem(ENDPOINT_KEY);
    localStorage.removeItem(MODEL_DEPLOYMENT_NAME_KEY);

    if (selectedProvider === 'gemini') {
        if (geminiApiKeyInput.value.trim() !== '') {
            localStorage.setItem(GEMINI_API_KEY_KEY, geminiApiKeyInput.value.trim());
        }
        if (geminiModelInput.value.trim() !== '') {
            localStorage.setItem(GEMINI_MODEL_KEY, geminiModelInput.value.trim());
        }
    } else if (selectedProvider === 'openai_compatible') {
        if (apiKeyInput.value.trim() !== '') {
            localStorage.setItem(API_KEY_KEY, apiKeyInput.value.trim());
        }
        if (endpointInput.value.trim() !== '') {
            localStorage.setItem(ENDPOINT_KEY, endpointInput.value.trim());
        }
        if (modelDeploymentNameInput.value.trim() !== '') {
            localStorage.setItem(MODEL_DEPLOYMENT_NAME_KEY, modelDeploymentNameInput.value.trim());
        }
    }
    closeModal('aiProviderModal');
}
