import { AI_FEATURES_KEY, LOCAL_STORAGE_KEY } from './config.js';
import { populateDurationInputs } from './ui.js'; // Assuming populateDurationInputs is or will be in ui.js
import { parseTimeToDate, formatTime } from './utils.js'; // For date parsing in load

// This variable will be managed by the main script and passed to loadSettingsFromLocalStorage if needed for UI updates.
// let userLocation = null;

export function saveSettingsToLocalStorage(settingsToSave) {
    const currentSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {};

    // Preserve AI-suggested activities if they exist
    Object.keys(currentSettings).forEach(key => {
        if (key.includes('_activities')) {
            settingsToSave[key] = currentSettings[key];
        }
    });

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settingsToSave));
    console.log("Settings saved:", settingsToSave);
}

export function loadSettingsFromLocalStorage(elements, setUiStateCallback) {
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            console.log("Loaded settings from localStorage:", settings);

            if (elements.planningModeRadios && settings.planningMode) {
                const planningModeRadio = Array.from(elements.planningModeRadios).find(radio => radio.value === settings.planningMode);
                if (planningModeRadio) planningModeRadio.checked = true;
            }

            if (elements.wakeUpTime) elements.wakeUpTime.value = settings.wakeUpTime || "07:00";
            if (elements.currentActivityType) elements.currentActivityType.value = settings.currentActivityType || "awake";
            if (elements.currentActivityEndTime) elements.currentActivityEndTime.value = settings.currentActivityEndTime || "";
            if (elements.babyAge) elements.babyAge.value = settings.babyAge || "";
            if (elements.locationInput) elements.locationInput.value = settings.location || "";

            let userLocationForUpdate = null;
            if (settings.location) {
                userLocationForUpdate = settings.location;
                if (elements.locationStatus) {
                    if (settings.location.startsWith("Lat:")) {
                        elements.locationStatus.textContent = "Using saved geolocation.";
                        elements.locationStatus.classList.add('text-green-500', 'dark:text-green-400');
                    } else {
                        elements.locationStatus.textContent = "Using saved manual location.";
                         elements.locationStatus.classList.remove('text-green-500', 'dark:text-green-400');
                    }
                }
            }

            if (elements.wakeWindowInputsContainer && elements.napInputsContainer) {
                populateDurationInputs(elements.wakeWindowInputsContainer.id, 'wake-window-duration', 'WW', settings.wakeWindows || []);
                populateDurationInputs(elements.napInputsContainer.id, 'nap-duration', 'Nap', settings.naps || []);
            }

            if (elements.desiredBedtime) elements.desiredBedtime.value = settings.desiredBedtime || "19:30";

            if (settings.aiFeaturesEnabled !== undefined) {
                localStorage.setItem(AI_FEATURES_KEY, settings.aiFeaturesEnabled.toString());
            }

            // Callback to update UI state in main.js (e.g., userLocation, trigger planning mode change)
            if (setUiStateCallback) {
                setUiStateCallback({
                    userLocation: userLocationForUpdate,
                    planningMode: settings.planningMode,
                    aiFeaturesEnabled: localStorage.getItem(AI_FEATURES_KEY) === 'true'
                });
            }

            console.log("Settings applied to form.");
            return settings; // Return loaded settings for potential further use

        } catch (e) {
            console.error("Error parsing settings from localStorage:", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            if (elements.wakeWindowInputsContainer && elements.napInputsContainer) {
                populateDurationInputs(elements.wakeWindowInputsContainer.id, 'wake-window-duration', 'WW', []);
                populateDurationInputs(elements.napInputsContainer.id, 'nap-duration', 'Nap', []);
            }
            return null;
        }
    } else {
         if (elements.wakeWindowInputsContainer && elements.napInputsContainer) {
            populateDurationInputs(elements.wakeWindowInputsContainer.id, 'wake-window-duration', 'WW', []);
            populateDurationInputs(elements.napInputsContainer.id, 'nap-duration', 'Nap', []);
        }
        return null;
    }
}
