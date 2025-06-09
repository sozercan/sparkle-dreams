// js/config.js
export const LOCAL_STORAGE_KEY = 'sparkleDreamsSettings';
export const THEME_KEY = 'sparkleDreamsTheme';
export const AI_FEATURES_KEY = 'sparkleDreamsAiEnabled';

// AI Provider Settings Keys
export const AI_PROVIDER_KEY = 'sparkleDreamsAiProvider';
export const GEMINI_API_KEY_KEY = 'sparkleDreamsGeminiApiKey';
export const GEMINI_MODEL_KEY = 'sparkleDreamsGeminiModel';
export const API_KEY_KEY = 'sparkleDreamsApiKey'; // Generic API Key
export const ENDPOINT_KEY = 'sparkleDreamsEndpoint'; // Generic Endpoint
export const MODEL_DEPLOYMENT_NAME_KEY = 'sparkleDreamsModelDeploymentName'; // Unified key for OpenAI/Azure model/deployment
export const NUM_SUGGESTIONS_KEY = 'sparkleDreamsNumSuggestions'; // Key for number of suggestions

export const DOM_ELEMENT_IDS = {
    // General Page & UI
    darkModeToggle: 'darkModeToggle',
    aiFeaturesToggle: 'aiFeaturesToggle',
    aiSettingsButton: 'aiSettingsButton',
    // loadingOverlay: 'loadingOverlay', // If you have one
    formErrorMessageArea: 'formErrorMessageArea',
    currentTimeDisplay: 'currentTimeDisplay',
    scheduleTimeline: 'schedule-timeline', // This is the section, timelineContainer is the div inside
    timelineContainer: 'timelineContainer',
    scheduleStatus: 'schedule-status',
    scheduleSummarySection: 'scheduleSummarySection',
    scheduleSummaryContent: 'scheduleSummaryContent',
    durationChartCanvas: 'durationChart',
    initialMessage: 'initialMessage',
    scheduleOutputContainer: 'scheduleOutputContainer',

    // Settings Form
    babyAgeInput: 'babyAge',
    planningModeRadios: 'planningMode', // Name attribute for radio group
    fullDayInputsContainer: 'fullDayInputs',
    fromNowInputsContainer: 'fromNowInputs',
    wakeUpTimeInput: 'wakeUpTime',
    desiredBedtimeInput: 'desiredBedtime',
    currentActivityEndTimeInput: 'currentActivityEndTime',
    currentActivityTypeSelect: 'currentActivityType',
    wakeWindowInputsContainer: 'wakeWindowInputsContainer',
    napInputsContainer: 'napInputsContainer',
    addWakeWindowButton: 'addWakeWindowButton',
    removeWakeWindowButton: 'removeWakeWindowButton',
    addNapButton: 'addNapButton',
    removeNapButton: 'removeNapButton',
    generateScheduleButton: 'scheduleSettingsForm', // The form itself, button is type=submit
    // saveSettingsButton: 'saveSettingsButton', // No explicit save button, auto-save
    clearSettingsButton: 'clearSettingsButton', // Renamed from loadSettingsButton
    applyAgeDefaultsButton: 'applyAgeDefaultsButton',
    shareScheduleButton: 'shareScheduleButton',
    locationInput: 'locationInput', // In modal and potentially main form if duplicated
    useGeolocationButton: 'useCurrentLocationButton', // ID in modal
    locationStatus: 'locationStatus', // In modal

    // Modals & AI
    aiProviderModal: 'aiProviderModal',
    closeAiProviderModalButton: 'closeAiProviderModalButton', // Assuming you add IDs to close buttons
    aiProviderSelect: 'aiProviderSelect',
    geminiApiKeyInputContainer: 'geminiApiKeyInputContainer',
    geminiApiKeyInput: 'geminiApiKeyInput',
    geminiModelInput: 'geminiModelInput',
    openaiCompatibleInputContainer: 'openaiCompatibleInputContainer',
    apiKeyInput: 'apiKeyInput',
    endpointInput: 'endpointInput',
    modelDeploymentInputContainer: 'modelDeploymentInputContainer',
    modelDeploymentNameInput: 'modelDeploymentNameInput',
    numSuggestionsInput: 'numSuggestionsInput',
    saveAiProviderSettingsButton: 'saveAiProviderSettings',
    sleepTipsModal: 'sleepTipsModal',
    sleepTipsContent: 'sleepTipsContent',
    closeSleepTipsModalButton: 'closeSleepTipsModalButton', // Assuming you add IDs to close buttons
    getSleepTipsButton: 'getSleepTipsButton',
};

export const MODAL_IDS = {
    aiProviderModal: 'aiProviderModal',
    sleepTipsModal: 'sleepTipsModal',
};

export const INPUT_CONTAINER_IDS = {
    wakeWindowInputs: 'wakeWindowInputsContainer',
    napInputs: 'napInputsContainer',
};

export const INPUT_CLASSES = {
    wakeWindow: 'wake-window-input', // Example class, adjust if needed
    nap: 'nap-input', // Example class, adjust if needed
};

export const ageBasedDefaults = {
    "0-3": { wakeWindows: ["1h", "1h 15m", "1h 30m", "1h 15m", "1h"], naps: ["1h", "1h 15m", "1h", "45m", ""] },
    "4-6": { wakeWindows: ["2h", "2h 15m", "2h 30m", "2h 30m", ""], naps: ["1h 30m", "1h 15m", "45m", "", ""] },
    "7-9": { wakeWindows: ["2h 45m", "3h", "3h 15m", "", ""], naps: ["1h 30m", "1h 15m", "", "", ""] },
    "10-12": { wakeWindows: ["3h 15m", "3h 30m", "3h 45m", "", ""], naps: ["1h 15m", "1h", "", "", ""] },
    "13-17": { wakeWindows: ["4h 30m", "5h", "", "", ""], naps: ["2h", "", "", "", ""] },
    "18-24": { wakeWindows: ["5h", "5h 30m", "", "", ""], naps: ["2h", "", "", "", ""] },
    "25+": { wakeWindows: ["5h 30m", "6h", "", "", ""], naps: ["1h 30m", "", "", "", ""] }
};

export function getAgeDefaults(ageInMonths) {
    if (ageInMonths <= 3) return ageBasedDefaults["0-3"];
    if (ageInMonths <= 6) return ageBasedDefaults["4-6"];
    if (ageInMonths <= 9) return ageBasedDefaults["7-9"];
    if (ageInMonths <= 12) return ageBasedDefaults["10-12"];
    if (ageInMonths <= 17) return ageBasedDefaults["13-17"];
    if (ageInMonths <= 24) return ageBasedDefaults["18-24"];
    return ageBasedDefaults["25+"];
}
