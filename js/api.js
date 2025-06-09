// js/api.js
import { AI_PROVIDER_KEY, GEMINI_API_KEY_KEY, GEMINI_MODEL_KEY, API_KEY_KEY, ENDPOINT_KEY, MODEL_DEPLOYMENT_NAME_KEY } from './config.js';

export async function fetchAIResponse(prompt) {
    const provider = localStorage.getItem(AI_PROVIDER_KEY) || 'gemini';
    const geminiApiKey = localStorage.getItem(GEMINI_API_KEY_KEY);
    const geminiModel = localStorage.getItem(GEMINI_MODEL_KEY) || 'gemini-1.5-flash'; // Default model
    const genericApiKey = localStorage.getItem(API_KEY_KEY);
    const endpoint = localStorage.getItem(ENDPOINT_KEY);
    const modelDeploymentName = localStorage.getItem(MODEL_DEPLOYMENT_NAME_KEY);

    let apiUrl = '';
    let headers = {};
    let body = {};
    const hardcodedMaxTokens = 1250; // Consider making this configurable if needed

    if (provider === 'gemini') {
        if (!geminiApiKey) {
            console.error("Gemini API Key is missing.");
            return { error: "Gemini API Key is missing. Please configure it in settings." };
        }
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: hardcodedMaxTokens
            }
        };
    } else if (provider === 'openai_compatible') {
        if (!genericApiKey) {
            console.error("API Key is missing for OpenAI compatible provider.");
            return { error: "API Key is missing. Please configure it in settings." };
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${genericApiKey}`
        };

        if (endpoint && endpoint.toLowerCase().includes('azure.com')) {
            if (!modelDeploymentName) {
                console.error("Model/Deployment Name is missing for Azure.");
                return { error: "Model/Deployment Name is missing. Please configure it in settings." };
            }
            apiUrl = `${endpoint.replace(/\/$/, "")}/openai/deployments/${modelDeploymentName}/chat/completions?api-version=2023-05-15`; // Common Azure API version
            body = {
                messages: [{ role: "user", content: prompt }],
                max_tokens: hardcodedMaxTokens
            };
        } else if (endpoint) { // For other OpenAI compatible endpoints
            apiUrl = `${endpoint.replace(/\/$/, "")}/v1/chat/completions`;
            body = {
                model: modelDeploymentName || "gpt-3.5-turbo", // Default model if not specified
                messages: [{ role: "user", content: prompt }],
                max_tokens: hardcodedMaxTokens
            };
        } else { // Default to OpenAI official API
            apiUrl = 'https://api.openai.com/v1/chat/completions';
            body = {
                model: modelDeploymentName || "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: hardcodedMaxTokens
            };
        }
    } else {
        console.error("Invalid AI provider selected.");
        return { error: "Invalid AI provider selected. Please configure it in settings." };
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            console.error('API Error:', response.status, errorData);
            return { error: `API request failed: ${errorData.error?.message || errorData.message || response.statusText}` };
        }

        const data = await response.json();

        if (provider === 'gemini') {
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                return { text: data.candidates[0].content.parts[0].text };
            } else {
                console.error('Unexpected Gemini API response structure:', data);
                return { error: 'Could not parse Gemini response.' };
            }
        } else if (provider === 'openai_compatible') {
            if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                return { text: data.choices[0].message.content.trim() };
            } else {
                console.error('Unexpected OpenAI-compatible API response structure:', data);
                return { error: 'Could not parse OpenAI-compatible response.' };
            }
        }
        return { error: 'Unknown error processing AI response.' }; // Should not be reached

    } catch (error) {
        console.error('Fetch error:', error);
        return { error: `Network or other error: ${error.message}` };
    }
}
