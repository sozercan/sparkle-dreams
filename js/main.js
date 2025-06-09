// Main application orchestration
import * as config from './config.js';
import * as utils from './utils.js';
import * as aiSettings from './aiSettings.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as schedule from './schedule.js';
import * as storage from './storage.js';

// --- Application State ---
let generatedScheduleData = [];
let durationChartInstance = null;
let userLocation = null;
let activeSuggestionsBoxId = null; // Tracks the ID of the currently open suggestions box
let timelineUpdateIntervalId = null; // Stores the interval ID for updating the timeline's active state
let currentTheme = 'light'; // Default theme
let aiFeaturesEnabled = false; // Default AI features state

// --- DOM Elements (to be populated in DOMContentLoaded) ---
const domElements = {
    // General Page & UI
    darkModeToggle: null,
    aiFeaturesToggle: null,
    aiSettingsButton: null,
    formErrorMessageArea: null,
    currentTimeDisplay: null,
    scheduleTimeline: null,
    timelineContainer: null,
    scheduleStatus: null,
    scheduleSummarySection: null,
    scheduleSummaryContent: null,
    durationChartCanvas: null,
    initialMessage: null,
    scheduleOutputContainer: null,

    // Settings Form
    scheduleSettingsForm: null, // The form itself
    babyAgeInput: null,
    planningModeRadios: null, // NodeList
    fullDayInputsContainer: null,
    fromNowInputsContainer: null,
    wakeUpTimeInput: null,
    desiredBedtimeInput: null,
    currentActivityEndTimeInput: null,
    currentActivityTypeSelect: null,
    wakeWindowInputsContainer: null,
    napInputsContainer: null,
    addWakeWindowButton: null,
    removeWakeWindowButton: null,
    addNapButton: null,
    removeNapButton: null,
    clearSettingsButton: null,
    applyAgeDefaultsButton: null,
    shareScheduleButton: null,
    locationInput: null, // ID for the one in the modal, main form might not have one or share it
    useGeolocationButton: null, // ID for the one in the modal
    locationStatus: null, // ID for the one in the modal

    // Modals & AI
    aiProviderModal: null,
    closeAiProviderModalButton: null,
    aiProviderSelect: null,
    geminiApiKeyInputContainer: null,
    geminiApiKeyInput: null,
    geminiModelInput: null,
    openaiCompatibleInputContainer: null,
    apiKeyInput: null,
    endpointInput: null,
    modelDeploymentInputContainer: null,
    modelDeploymentNameInput: null,
    numSuggestionsInput: null,
    saveAiProviderSettingsButton: null,
    sleepTipsModal: null,
    sleepTipsContent: null,
    closeSleepTipsModalButton: null,
    getSleepTipsButton: null,
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Populate DOM Elements
    for (const key in domElements) {
        const id = config.DOM_ELEMENT_IDS[key] || key;
        if (key === 'planningModeRadios') { // Special handling for radio button group
            domElements[key] = document.querySelectorAll(`input[name="${id}"]`);
        } else if (key === 'generateScheduleButton') { // Special handling for form
            domElements[key] = document.getElementById(id); // This is the form ID
        } else {
            domElements[key] = document.getElementById(id);
        }

        if (!domElements[key] || (domElements[key] instanceof NodeList && domElements[key].length === 0)) {
            if (key !== 'generateScheduleButton' && key !== 'planningModeRadios') { // Don't warn for form or radio group if main element found
                 // Conditional warning: only if not an optional element or a known case
                if (!['loadingOverlay', 'saveSettingsButton'].includes(key)) { // Example optional elements
                    console.warn(`DOM element not found for key: ${key} (tried ID: ${id})`);
                }
            }
        }
    }

    // Initialize UI elements and load settings
    ui.setInitialTheme(domElements.darkModeToggle);
    loadAndApplyInitialSettings(); // Will call storage.loadSettingsFromLocalStorage and apply them

    initializeEventListeners();

    const updateTimeDisplay = ui.initializeCurrentTimeDisplay(domElements.currentTimeDisplay);
    if (updateTimeDisplay) {
        setInterval(updateTimeDisplay, 1000); // Update time every second
    }

    // Start timeline active state updates
    if (timelineUpdateIntervalId) clearInterval(timelineUpdateIntervalId);
    timelineUpdateIntervalId = setInterval(updateTimelineActiveStates, 5000); // Check every 5 seconds

    console.log("Sparkle Dreams application initialized.");
});

// --- Event Listener Initialization ---
function initializeEventListeners() {
    // Theme Toggle
    if (domElements.darkModeToggle) {
        domElements.darkModeToggle.addEventListener('click', () => {
            ui.toggleTheme(domElements.darkModeToggle, generatedScheduleData, domElements.durationChartCanvas, durationChartInstance, { updateChart: handleUpdateDurationChart });
            currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            saveCurrentSettings(); // Save theme preference with other settings
        });
    }

    // AI Features Toggle
    if (domElements.aiFeaturesToggle) {
        domElements.aiFeaturesToggle.addEventListener('click', () => {
            aiFeaturesEnabled = !aiFeaturesEnabled; // Toggle state
            const callbacks = {
                closeAllSuggestionBoxes: handleCloseAllSuggestionBoxes,
                rerenderTimeline: () => rerenderTimeline(true) // Force redraw
            };
            ui.applyAiFeaturesState(aiFeaturesEnabled, domElements, generatedScheduleData, callbacks);
            localStorage.setItem(config.AI_FEATURES_KEY, aiFeaturesEnabled.toString());
            // No need to call saveCurrentSettings() here as AI feature state is separate
        });
    }

    // AI Settings Modal
    if (domElements.aiSettingsButton) {
        domElements.aiSettingsButton.addEventListener('click', () => utils.openModal(config.MODAL_IDS.aiProviderModal));
    }
    if (domElements.closeAiProviderModalButton) {
        domElements.closeAiProviderModalButton.addEventListener('click', () => utils.closeModal(config.MODAL_IDS.aiProviderModal));
    }
    // Initialize and load AI settings
    if (domElements.aiProviderSelect) {
        aiSettings.initializeAiSettingsControls(domElements); // Pass all relevant DOM elements
        domElements.aiProviderSelect.addEventListener('change', aiSettings.handleAiProviderChange); // No argument needed
        // Load settings after controls are initialized
        aiSettings.loadAiProviderSettingsFromStorage(); // No argument needed
    }
    if (domElements.saveAiProviderSettingsButton) {
        domElements.saveAiProviderSettingsButton.addEventListener('click', () => {
            aiSettings.saveAiProviderSettingsToStorage(); // No argument needed
            // Optionally, provide user feedback that settings are saved
            // e.g., display a temporary message or change button text
            console.log("AI Provider settings saved.");
            // After saving, reload and apply settings to reflect any changes immediately
            // This might be redundant if the modal closes and UI updates elsewhere
            // loadAndApplyInitialSettings();
        });
    }

    // Sleep Tips Modal
    if (domElements.getSleepTipsButton) {
        domElements.getSleepTipsButton.addEventListener('click', () => {
            const age = parseInt(domElements.babyAgeInput.value, 10);
            ui.fetchGeneralSleepTips(age, { sleepTipsModal: domElements.sleepTipsModal, sleepTipsContent: domElements.sleepTipsContent });
        });
    }
    if (domElements.closeSleepTipsModalButton) {
        domElements.closeSleepTipsModalButton.addEventListener('click', () => utils.closeModal(config.MODAL_IDS.sleepTipsModal));
    }

    // Form Inputs & Schedule Generation
    if (domElements.addWakeWindowButton) {
        domElements.addWakeWindowButton.addEventListener('click', () => {
            const newWakeWindowInput = ui.addDurationInput(config.INPUT_CONTAINER_IDS.wakeWindowInputs, config.INPUT_CLASSES.wakeWindow, 'Wake Window', "", utils.adjustInputWidth, saveCurrentSettings);
            if (newWakeWindowInput) newWakeWindowInput.focus();
            ui.updateRemoveButtonState(config.INPUT_CONTAINER_IDS.wakeWindowInputs, { removeWakeWindowButton: domElements.removeWakeWindowButton });
            saveCurrentSettings(); // Save after adding
        });
    }
    if (domElements.removeWakeWindowButton) {
        domElements.removeWakeWindowButton.addEventListener('click', () => {
            const container = domElements.wakeWindowInputsContainer;
            if (container.children.length > 1) container.removeChild(container.lastChild);
            ui.updateRemoveButtonState(config.INPUT_CONTAINER_IDS.wakeWindowInputs, { removeWakeWindowButton: domElements.removeWakeWindowButton });
            saveCurrentSettings(); // Save after removing
        });
    }

    if (domElements.addNapButton) {
        domElements.addNapButton.addEventListener('click', () => {
            const newNapInput = ui.addDurationInput(config.INPUT_CONTAINER_IDS.napInputs, config.INPUT_CLASSES.nap, 'Nap', "", utils.adjustInputWidth, saveCurrentSettings);
            if (newNapInput) newNapInput.focus();
            ui.updateRemoveButtonState(config.INPUT_CONTAINER_IDS.napInputs, { removeNapButton: domElements.removeNapButton });
            saveCurrentSettings(); // Save after adding
        });
    }
    if (domElements.removeNapButton) {
        domElements.removeNapButton.addEventListener('click', () => {
            const container = domElements.napInputsContainer;
            if (container.children.length > 1) container.removeChild(container.lastChild);
            ui.updateRemoveButtonState(config.INPUT_CONTAINER_IDS.napInputs, { removeNapButton: domElements.removeNapButton });
            saveCurrentSettings(); // Save after removing
        });
    }

    if (domElements.generateScheduleButton) { // This is now the form element
        domElements.generateScheduleButton.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission
            handleGenerateSchedule();
        });
    }

    if (domElements.saveSettingsButton) {
        domElements.saveSettingsButton.addEventListener('click', () => {
            saveCurrentSettings();
            alert("Settings saved to browser!"); // More explicit feedback
        });
    }

    // "Reset to Defaults" button (formerly loadSettingsButton)
    if (domElements.clearSettingsButton) { // Changed from loadSettingsButton
        domElements.clearSettingsButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset all settings to their defaults? This will clear any saved schedule form data.")) {
                localStorage.removeItem(config.LOCAL_STORAGE_KEY); // Clear main settings
                // localStorage.removeItem(config.AI_FEATURES_KEY); // Keep AI feature toggle state
                // localStorage.removeItem(config.THEME_KEY); // Keep theme preference
                // AI provider settings are separate and not reset here.

                generatedScheduleData = []; // Clear current schedule data
                rerenderTimeline(true);
                handleUpdateDurationChart();
                if (domElements.scheduleSummarySection) domElements.scheduleSummarySection.classList.add('hidden');
                utils.displayFormError([], domElements.formErrorMessageArea);

                // Reset form fields to initial/default states
                if (domElements.babyAgeInput) domElements.babyAgeInput.value = '';
                if (domElements.wakeUpTimeInput) domElements.wakeUpTimeInput.value = '07:00';
                if (domElements.desiredBedtimeInput) domElements.desiredBedtimeInput.value = '19:30';
                if (domElements.currentActivityEndTimeInput) domElements.currentActivityEndTimeInput.value = '';
                if (domElements.currentActivityTypeSelect) domElements.currentActivityTypeSelect.value = 'awake';
                if (domElements.locationInput) domElements.locationInput.value = '';
                if (domElements.locationStatus) {
                    domElements.locationStatus.textContent = '';
                    domElements.locationStatus.className = 'text-xs mt-1';
                }
                userLocation = null;

                // Set planning mode to fullDay
                if (domElements.planningModeRadios) {
                    domElements.planningModeRadios.forEach(radio => {
                        radio.checked = radio.value === 'fullDay';
                    });
                    // Trigger change to update visibility of inputs
                    const event = new Event('change', { bubbles: true });
                    if (domElements.planningModeRadios[0]) domElements.planningModeRadios[0].dispatchEvent(event);
                }

                applyAgeBasedDefaults(); // This will populate wake/nap inputs based on (now cleared) age, or to one empty field
                saveCurrentSettings(); // Save the reset state
                alert("Settings have been reset to defaults.");
            }
        });
    }

    if (domElements.applyAgeDefaultsButton) {
        domElements.applyAgeDefaultsButton.addEventListener('click', handleBabyAgeChange);
    }

    // Planning Mode Toggle
    if (domElements.planningModeRadios && domElements.planningModeRadios.length > 0) {
       ui.initializePlanningModeToggle(
           domElements.planningModeRadios,
           domElements.fullDayInputsContainer,
           domElements.fromNowInputsContainer,
           domElements.currentActivityEndTimeInput,
           handlePlanningModeChange // Callback to save settings
       );
    }

    if (domElements.shareScheduleButton) {
        domElements.shareScheduleButton.addEventListener('click', () => ui.handleShareSchedule(domElements.scheduleTimeline, domElements.scheduleStatus, domElements.shareScheduleButton));
    }

    // Auto-adjust width for dynamic inputs
    document.querySelectorAll('.form-input-dynamic-width').forEach(input => {
        input.addEventListener('input', utils.adjustInputWidth);
        utils.adjustInputWidth({ target: input }); // Initial adjustment
    });

    // Event listeners for individual form fields to save on blur or specific changes
    if (domElements.babyAgeInput) {
        domElements.babyAgeInput.addEventListener('input', handleBabyAgeChange); // Update defaults on input
        domElements.babyAgeInput.addEventListener('blur', saveCurrentSettings); // Save on blur
    }
    if (domElements.wakeUpTimeInput) {
        domElements.wakeUpTimeInput.addEventListener('blur', saveCurrentSettings);
    }
    if (domElements.desiredBedtimeInput) {
        domElements.desiredBedtimeInput.addEventListener('blur', saveCurrentSettings);
    }
    if (domElements.currentActivityEndTimeInput) {
        domElements.currentActivityEndTimeInput.addEventListener('blur', saveCurrentSettings);
    }
    if (domElements.currentActivityTypeSelect) {
        domElements.currentActivityTypeSelect.addEventListener('change', saveCurrentSettings);
    }

    // Location Inputs
    if (domElements.locationInput) {
        domElements.locationInput.addEventListener('blur', saveCurrentSettings);
        domElements.locationInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                handleLocationSearch();
            }
        });
    }
    if (domElements.useGeolocationButton) {
        domElements.useGeolocationButton.addEventListener('click', handleUseGeolocation);
    }
}

// --- Core Logic Functions ---

function handleBabyAgeChange() {
    applyAgeBasedDefaults(); // This will repopulate wake/nap windows
    saveCurrentSettings(); // Save immediately after age change and defaults update
}

function loadAndApplyInitialSettings() {
    // Load AI feature state first
    const savedAiState = localStorage.getItem(config.AI_FEATURES_KEY);
    aiFeaturesEnabled = savedAiState === 'true';
    if (domElements.aiFeaturesToggle) { // Ensure toggle UI reflects loaded state
      const aiOnIcon = domElements.aiFeaturesToggle.querySelector('.ai-on-icon');
      const aiOffIcon = domElements.aiFeaturesToggle.querySelector('.ai-off-icon');
      if (aiOnIcon) aiOnIcon.classList.toggle('hidden', !aiFeaturesEnabled);
      if (aiOffIcon) aiOffIcon.classList.toggle('hidden', aiFeaturesEnabled);
    }
    const callbacks = {
        closeAllSuggestionBoxes: handleCloseAllSuggestionBoxes,
        rerenderTimeline: () => rerenderTimeline(true)
    };
    // Call applyAiFeaturesState to ensure UI elements like buttons/sections are correctly shown/hidden
    ui.applyAiFeaturesState(aiFeaturesEnabled, domElements, generatedScheduleData, callbacks);

    // Load main schedule settings
    const settings = storage.loadSettingsFromLocalStorage(domElements, setUiStateFromLoadedSettings);
    if (settings) {
        // userLocation is set within setUiStateFromLoadedSettings if available in storage
    } else {
        // Apply default age-based settings if nothing loaded
        applyAgeBasedDefaults(); // This will populate wake/nap inputs appropriately
    }

    // After all settings are loaded (including userLocation from storage via setUiStateFromLoadedSettings):
    if (aiFeaturesEnabled && !userLocation) {
        if (confirm("Sparkle Dreams can use your location to provide more relevant AI-powered activity suggestions. Would you like to enable this?")) {
            getUserLocation((newLocation, error) => {
                if (newLocation) {
                    saveCurrentSettings(); // Save if location was successfully fetched
                    rerenderTimeline(true); // Re-render timeline if location is now available
                } else if (error && domElements.locationStatus) {
                    // Error already displayed by getUserLocation, but ensure status is cleared if user declines later
                    // Or provide a generic message if they declined permission via browser prompt
                    domElements.locationStatus.textContent = "Location access denied or unavailable. Manual entry is still possible.";
                    domElements.locationStatus.className = 'text-xs mt-1 text-orange-500 dark:text-orange-400';
                }
            });
        }
    }
}

function setUiStateFromLoadedSettings(settings) {
    // This function is called by storage.loadSettingsFromLocalStorage
    // It updates the UI based on the loaded settings
    if (domElements.babyAgeInput) domElements.babyAgeInput.value = settings.babyAge || '';

    if (domElements.planningModeRadios && settings.planningMode) {
        domElements.planningModeRadios.forEach(radio => {
            radio.checked = radio.value === settings.planningMode;
        });
        // Trigger change to update visibility of inputs
        const event = new Event('change', { bubbles: true });
       if(domElements.planningModeRadios[0]) domElements.planningModeRadios[0].dispatchEvent(event);
    }

    if (domElements.wakeUpTimeInput) domElements.wakeUpTimeInput.value = settings.wakeUpTime || '';
    if (domElements.desiredBedtimeInput) domElements.desiredBedtimeInput.value = settings.desiredBedtime || '';
    if (domElements.currentActivityEndTimeInput) domElements.currentActivityEndTimeInput.value = settings.currentActivityEndTime || '';
    if (domElements.currentActivityTypeSelect) domElements.currentActivityTypeSelect.value = settings.currentActivityType || 'awake';
    if (domElements.locationInput) domElements.locationInput.value = settings.location || '';

    // Update userLocation state and UI status
    if (settings.location) {
        userLocation = settings.location; // Update main.js state
        if (domElements.locationStatus) {
            if (settings.location.startsWith("Lat:")) {
                domElements.locationStatus.textContent = "Using saved geolocation.";
                domElements.locationStatus.className = 'text-xs mt-1 text-green-500 dark:text-green-400';
            } else if (settings.location.trim() !== '') {
                domElements.locationStatus.textContent = "Using saved manual location.";
                domElements.locationStatus.className = 'text-xs mt-1 text-blue-500 dark:text-blue-400';
            } else {
                domElements.locationStatus.textContent = '';
                 domElements.locationStatus.className = 'text-xs mt-1';
            }
        }
    } else {
        userLocation = null;
        if (domElements.locationStatus) {
            domElements.locationStatus.textContent = '';
            domElements.locationStatus.className = 'text-xs mt-1';
        }
    }

    ui.populateDurationInputs(config.INPUT_CONTAINER_IDS.wakeWindowInputs, config.INPUT_CLASSES.wakeWindow, 'Wake Window', settings.wakeWindows || [""], {removeWakeWindowButton: domElements.removeWakeWindowButton}, utils.adjustInputWidth, saveCurrentSettings);
    ui.populateDurationInputs(config.INPUT_CONTAINER_IDS.napInputs, config.INPUT_CLASSES.nap, 'Nap', settings.naps || [""], {removeNapButton: domElements.removeNapButton}, utils.adjustInputWidth, saveCurrentSettings);

    // Trigger initial adjustment for dynamically added inputs
    document.querySelectorAll('.form-input-dynamic-width').forEach(input => {
        utils.adjustInputWidth({ target: input });
    });
}

function applyAgeBasedDefaults() {
    const age = parseInt(domElements.babyAgeInput.value, 10);
    if (isNaN(age) || age < 0) { // Don't apply if age is invalid or not set
        ui.populateDurationInputs(config.INPUT_CONTAINER_IDS.wakeWindowInputs, config.INPUT_CLASSES.wakeWindow, 'Wake Window', [""], {removeWakeWindowButton: domElements.removeWakeWindowButton}, utils.adjustInputWidth, saveCurrentSettings);
        ui.populateDurationInputs(config.INPUT_CONTAINER_IDS.napInputs, config.INPUT_CLASSES.nap, 'Nap', [""], {removeNapButton: domElements.removeNapButton}, utils.adjustInputWidth, saveCurrentSettings);
        return;
    }
    const defaults = config.getAgeDefaults(age);
    ui.populateDurationInputs(config.INPUT_CONTAINER_IDS.wakeWindowInputs, config.INPUT_CLASSES.wakeWindow, 'Wake Window', defaults.wakeWindows, {removeWakeWindowButton: domElements.removeWakeWindowButton}, utils.adjustInputWidth, saveCurrentSettings);
    ui.populateDurationInputs(config.INPUT_CONTAINER_IDS.napInputs, config.INPUT_CLASSES.nap, 'Nap', defaults.naps, {removeNapButton: domElements.removeNapButton}, utils.adjustInputWidth, saveCurrentSettings);
}

function collectCurrentSettings() {
    const wakeWindows = Array.from(domElements.wakeWindowInputsContainer.querySelectorAll('input')).map(input => input.value);
    const naps = Array.from(domElements.napInputsContainer.querySelectorAll('input')).map(input => input.value);
    const planningModeRadio = domElements.planningModeRadios ? Array.from(domElements.planningModeRadios).find(r => r.checked) : null;

    return {
        babyAge: domElements.babyAgeInput ? domElements.babyAgeInput.value : '',
        planningMode: planningModeRadio ? planningModeRadio.value : 'fullDay',
        wakeUpTimeStr: domElements.wakeUpTimeInput ? domElements.wakeUpTimeInput.value : '',
        desiredBedtimeStr: domElements.desiredBedtimeInput ? domElements.desiredBedtimeInput.value : '',
        currentActivityEndTimeStr: domElements.currentActivityEndTimeInput ? domElements.currentActivityEndTimeInput.value : '',
        currentActivityType: domElements.currentActivityTypeSelect ? domElements.currentActivityTypeSelect.value : 'awake',
        wakeWindowDurations: wakeWindows.filter(ww => ww.trim() !== ''), // Filter out empty strings before passing to schedule
        napDurations: naps.filter(n => n.trim() !== ''), // Filter out empty strings
        // For saving, keep all, even if empty, to repopulate form correctly
        rawWakeWindows: wakeWindows,
        rawNaps: naps,
        location: domElements.locationInput ? domElements.locationInput.value : null,
        theme: currentTheme, // Save current theme
        // aiFeaturesEnabled is saved directly to localStorage by its toggle
    };
}

function saveCurrentSettings() {
    const planningModeRadio = domElements.planningModeRadios ? Array.from(domElements.planningModeRadios).find(r => r.checked) : null;
    const settingsToSave = {
        babyAge: domElements.babyAgeInput ? domElements.babyAgeInput.value : '',
        planningMode: planningModeRadio ? planningModeRadio.value : 'fullDay',
        wakeUpTime: domElements.wakeUpTimeInput ? domElements.wakeUpTimeInput.value : '',
        desiredBedtime: domElements.desiredBedtimeInput ? domElements.desiredBedtimeInput.value : '',
        currentActivityEndTime: domElements.currentActivityEndTimeInput ? domElements.currentActivityEndTimeInput.value : '',
        currentActivityType: domElements.currentActivityTypeSelect ? domElements.currentActivityTypeSelect.value : 'awake',
        wakeWindows: domElements.wakeWindowInputsContainer ? Array.from(domElements.wakeWindowInputsContainer.querySelectorAll('input')).map(input => input.value) : [],
        naps: domElements.napInputsContainer ? Array.from(domElements.napInputsContainer.querySelectorAll('input')).map(input => input.value) : [],
        location: domElements.locationInput ? domElements.locationInput.value : null,
        // theme: currentTheme, // Theme is saved directly by toggleTheme to THEME_KEY
        // aiFeaturesEnabled is saved directly to AI_FEATURES_KEY
    };
    storage.saveSettingsToLocalStorage(settingsToSave); // Main settings
    localStorage.setItem(config.THEME_KEY, currentTheme); // Save theme separately
    // console.log("Settings saved by saveCurrentSettings:", settingsToSave);
}

function handleGenerateSchedule() {
    utils.displayFormError([], domElements.formErrorMessageArea); // Clear previous errors
    const currentSettings = collectCurrentSettings();

    const scheduleResult = schedule.generateSchedule(currentSettings.planningMode, currentSettings, (messages) => utils.displayFormError(messages, domElements.formErrorMessageArea));

    if (scheduleResult.success) {
        generatedScheduleData = scheduleResult.data;
        rerenderTimeline(true); // Force redraw of timeline
        handleUpdateDurationChart(); // Update chart with new data

        if (domElements.scheduleSummarySection && domElements.scheduleSummaryContent) {
            const settingsForSummary = { // Re-fetch settings as they might be stored slightly differently
                wakeUpTime: currentSettings.wakeUpTimeStr,
                desiredBedtime: currentSettings.desiredBedtimeStr
            };
            ui.displayScheduleSummary(generatedScheduleData, domElements.scheduleSummaryContent, domElements.scheduleSummarySection, settingsForSummary);
            domElements.scheduleSummarySection.classList.remove('hidden');
        }
        if (scheduleResult.warning) {
             utils.displayFormError([scheduleResult.warning]); // Show warning from schedule generation
        }
    } else {
        generatedScheduleData = []; // Clear data on failure
        rerenderTimeline(true);
        handleUpdateDurationChart(); // Clear chart
        if (domElements.scheduleSummarySection) domElements.scheduleSummarySection.classList.add('hidden');
    }
}

function rerenderTimeline(forceRedraw = false) {
    // Simple check, can be expanded if window.timelineLastRenderedDataSignature is needed
    // For now, always redraw if forceRedraw is true or if data changed.
    // The ui.updateTimeline function itself can manage its internal signature check if needed.

    const babyAge = parseInt(domElements.babyAgeInput.value, 10);

    ui.updateTimeline(
        generatedScheduleData,
        { timelineContainer: domElements.timelineContainer, scheduleStatusEl: domElements.scheduleStatus },
        aiFeaturesEnabled,
        babyAge,
        userLocation,
        getSavedActivitiesForTimeline, // Callback to get saved activities
        handleTimelineSuggestionAction // Callback to handle suggestion box actions
    );
}

function getSavedActivitiesForTimeline(activityKey) {
    const allSettings = JSON.parse(localStorage.getItem(config.LOCAL_STORAGE_KEY)) || {};
    return allSettings[activityKey] || [];
}

function handleTimelineSuggestionAction(action) {
    if (action.type === 'open') {
        // Close any currently open suggestion box
        if (activeSuggestionsBoxId && activeSuggestionsBoxId !== `suggestions-${action.itemId}`) {
            const currentlyOpen = document.getElementById(activeSuggestionsBoxId);
            if (currentlyOpen) {
                currentlyOpen.classList.add('hidden');
                currentlyOpen.innerHTML = '';
            }
        }
        activeSuggestionsBoxId = `suggestions-${action.itemId}`;
        const suggestionsContainer = document.getElementById(activeSuggestionsBoxId);
        if (suggestionsContainer) {
            const babyAge = parseInt(domElements.babyAgeInput.value, 10);
            ui.fetchActivitySuggestions(
                action.durationMinutes,
                activeSuggestionsBoxId,
                babyAge,
                action.itemId,
                userLocation,
                () => { activeSuggestionsBoxId = null; }, // onSuggestionsClosed
                handleSaveActivitySelection // onActivitiesSaved
            );
        }
    }
    // 'close' and 'save' are handled by callbacks within fetchActivitySuggestions now
}

function handleSaveActivitySelection(wakeWindowItemId, selectedActivities) {
    const currentSettings = JSON.parse(localStorage.getItem(config.LOCAL_STORAGE_KEY)) || {};
    const activityKey = `wakeWindow_${wakeWindowItemId}_activities`;
    currentSettings[activityKey] = selectedActivities;
    localStorage.setItem(config.LOCAL_STORAGE_KEY, JSON.stringify(currentSettings));
    activeSuggestionsBoxId = null; // Ensure it's reset
    rerenderTimeline(true); // Re-render timeline to show saved activities
}

function handleCloseAllSuggestionBoxes() {
    if (activeSuggestionsBoxId) {
        const openBox = document.getElementById(activeSuggestionsBoxId);
        if (openBox) {
            openBox.classList.add('hidden');
            openBox.innerHTML = '';
        }
        activeSuggestionsBoxId = null;
    }
}

function handleUpdateDurationChart() {
    if (!domElements.durationChartCanvas) return;
    const chartData = generatedScheduleData.filter(item => item.durationMinutes !== null && item.type !== "System");
    const newInstance = ui.updateDurationChart(chartData, domElements.durationChartCanvas, durationChartInstance);
    if (newInstance) {
        durationChartInstance = newInstance;
    }
}

function updateTimelineActiveStates() {
    if (generatedScheduleData.length > 0 && domElements.scheduleStatus) {
        ui.updateActiveTimelineStates(generatedScheduleData, domElements.scheduleStatus);
    }
}

function handlePlanningModeChange(newMode) {
    // This function is called when planning mode changes.
    // We can save settings or perform other actions here.
    // For now, let's just log it. In a real app, you might save settings.
    console.log("Planning mode changed to:", newMode);
    saveCurrentSettings(); // Save settings when mode changes
}

// --- Helper to get user location (example) ---
function getUserLocation(callback) {
    if (domElements.locationStatus) {
        domElements.locationStatus.textContent = "Fetching location...";
        domElements.locationStatus.className = 'text-xs mt-1 text-gray-500 dark:text-slate-400';
    }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude.toFixed(5);
            const lon = position.coords.longitude.toFixed(5);
            userLocation = `Lat:${lat}, Lon:${lon}`;
            if (domElements.locationInput) domElements.locationInput.value = userLocation; // Update input field as well
            if (domElements.locationStatus) {
                domElements.locationStatus.textContent = "Geolocation captured!";
                domElements.locationStatus.className = 'text-xs mt-1 text-green-500 dark:text-green-400';
            }
            if (callback) callback(userLocation, null);
        }, error => {
            console.warn("Could not get user location:", error.message);
            // userLocation = ""; // Don't clear userLocation here, it might hold a manually entered value
            // if (domElements.locationInput) domElements.locationInput.value = ''; // Don't clear input if error, user might want to keep manual entry
            if (domElements.locationStatus) {
                domElements.locationStatus.textContent = `Location error: ${error.message}. You can enter manually.`;
                domElements.locationStatus.className = 'text-xs mt-1 text-red-500 dark:text-red-400';
            }
            if (callback) callback(null, error.message);
        });
    } else {
        const errorMsg = "Geolocation not supported by this browser.";
        // userLocation = "";
        // if (domElements.locationInput) domElements.locationInput.value = '';
        if (domElements.locationStatus) {
            domElements.locationStatus.textContent = errorMsg;
            domElements.locationStatus.className = 'text-xs mt-1 text-red-500 dark:text-red-400';
        }
        if (callback) callback(null, errorMsg);
    }
}

function handleUseGeolocation() {
    getUserLocation((newLocation, error) => {
        if (newLocation) {
            // userLocation is already set by getUserLocation
            // domElements.locationInput.value is also set
            saveCurrentSettings(); // Save settings now that location is updated
        } else {
            // Error message is already displayed by getUserLocation
            // Do not save settings if location fetch failed, keep previous manual input or empty
        }
    });
}

function handleLocationSearch() {
    // This function is called when Enter is pressed in the location input.
    // For now, it just means the user has manually entered/confirmed a location.
    userLocation = domElements.locationInput.value;
    if (domElements.locationStatus) {
        if (userLocation.trim() !== '') {
            domElements.locationStatus.textContent = "Manual location set.";
            domElements.locationStatus.className = 'text-xs mt-1 text-blue-500 dark:text-blue-400';
        } else {
            domElements.locationStatus.textContent = '';
            domElements.locationStatus.className = 'text-xs mt-1';
        }
    }
    saveCurrentSettings();
}

console.log('main.js loaded');
