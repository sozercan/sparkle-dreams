// js/ui.js
import { AI_FEATURES_KEY, LOCAL_STORAGE_KEY, THEME_KEY } from './config.js';
import { formatTime, formatDurationForDisplay, parseTimeForUpdate, openModal, closeModal, adjustInputWidth, parseTimeToDate } from './utils.js'; // Added parseTimeToDate
import { fetchAIResponse } from './api.js';

// This module will handle UI updates, theme, and AI feature toggles that are UI-specific.

export function formatApiResponseToHtmlList(rawText, isCheckboxList = false, wakeWindowItemId = null) {
    let processedText = rawText.replace(/\|\s*\|(.*?)\|\s*\|/g, '<strong>$1</strong>');
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processedText = processedText.replace(/__(.*?)__/g, '<strong>$1</strong>');

    let htmlOutput = "";
    const contentBlocks = processedText.split(/\n\s*\n/);
    let introTextAccumulator = "";
    let listItemsHtml = "";
    let listStarted = false;

    function addListItem(content, bIndex, lIndex) {
        if(isCheckboxList) {
            const checkboxId = `activity-${wakeWindowItemId}-${bIndex}-${lIndex}`;
            listItemsHtml += `<div class="checkbox-item"><input type="checkbox" id="${checkboxId}" value="${content.replace(/<[^>]*>?/gm, '')}"><label for="${checkboxId}" class="ml-2">${content}</label></div>`;
        } else {
            listItemsHtml += `<li>${content.trim()}</li>`;
        }
    }

    contentBlocks.forEach((block, blockIndex) => {
        if (block.trim().length === 0) return;

        const lines = block.split('\n');
        let isCurrentBlockAList = false;
        let firstLineOfBlock = lines.find(l => l.trim().length > 0) || "";

        if (firstLineOfBlock.trim().match(/^(\*|-|\d+\.)\s+/)) {
            isCurrentBlockAList = true;
        }

        if (!isCurrentBlockAList && !listStarted) {
            introTextAccumulator += (introTextAccumulator ? "<br>" : "") + block.replace(/\n/g, '<br>');
        } else {
            listStarted = true;
            let currentItemContent = "";
            lines.forEach((line, lineIndex) => {
                const trimmedLine = line.trim();
                if (trimmedLine.length === 0) {
                     if (currentItemContent) {
                        addListItem(currentItemContent, blockIndex, lineIndex -1);
                        currentItemContent = "";
                    }
                    return;
                }

                const listMatch = trimmedLine.match(/^(\*|-|\d+\.)\s+/);
                if (listMatch) {
                    if (currentItemContent) {
                        addListItem(currentItemContent, blockIndex, lineIndex -1);
                    }
                    currentItemContent = trimmedLine.substring(listMatch[0].length);
                } else if (currentItemContent) {
                    currentItemContent += ' ' + trimmedLine;
                } else {
                    currentItemContent = trimmedLine;
                }
            });
            if (currentItemContent) {
                 addListItem(currentItemContent, blockIndex, lines.length -1);
            }
        }
    });

    if (introTextAccumulator) {
        htmlOutput += `<p class="mb-2">${introTextAccumulator}</p>`;
    }
    if (listItemsHtml) {
        htmlOutput += isCheckboxList ? listItemsHtml : `<ul>${listItemsHtml}</ul>`;
    }

    if (!htmlOutput.trim() && processedText.trim().length > 0) {
        return `<p>${processedText.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }
    if (!htmlOutput.trim()) {
         return '<p class="text-sm text-gray-500 dark:text-slate-400">No specific suggestions formatted.</p>';
    }
    return htmlOutput;
}

export async function fetchActivitySuggestions(durationMinutes, suggestionsContainerId, ageInMonths, wakeWindowItemId, currentUserLocation, onSuggestionsClosed, onActivitiesSaved) {
    const suggestionsContainer = document.getElementById(suggestionsContainerId);
    // activeSuggestionsBoxId will be managed in main.js based on onSuggestionsClosed callback

    suggestionsContainer.innerHTML = '<div class="loading-spinner"></div> <p class="text-center text-sm">✨ Fetching ideas...</p>';
    suggestionsContainer.classList.remove('hidden');

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.classList.add('suggestion-close-button');
    closeButton.onclick = () => {
        suggestionsContainer.classList.add('hidden');
        suggestionsContainer.innerHTML = '';
        if (onSuggestionsClosed) onSuggestionsClosed();
    };

    let locationInfo = "";
    if (currentUserLocation) {
        if (typeof currentUserLocation === 'string') {
            if (currentUserLocation.startsWith("Lat:")) {
                locationInfo = ` for the area around ${currentUserLocation}. In your response, please refer to this location using a general area name (like 'your local park' or 'your neighborhood') or as 'your general area', rather than stating the specific coordinates.`;
            } else {
                const locationName = currentUserLocation.split(',')[0].trim();
                if (locationName) locationInfo = ` near ${locationName}`;
            }
        } else if (currentUserLocation.name) {
            locationInfo = ` near ${currentUserLocation.name}`;
        }
    }

    let ageInfo = "";
    if (ageInMonths && !isNaN(ageInMonths) && ageInMonths >= 0) {
        ageInfo = ` for a ${ageInMonths}-month-old baby`;
    }

    const numSuggestions = localStorage.getItem('sparkleDreamsNumSuggestions') || 5; // Consider passing this from main if it becomes dynamic
    const prompt = `Suggest ${numSuggestions} distinct, engaging, and safe play activities${ageInfo} suitable for a ${formatDurationForDisplay(durationMinutes)} wake window${locationInfo}. Each suggested activity (or a combination of a few of them if they are shorter) should be substantial enough to help fill this wake window duration. If suggesting specific types of places (e.g., park, library), mention them generally. Focus on activities that mostly don't require special equipment beyond what one might find at such a place or at home. Format each suggestion as a simple list item starting with a dash or asterisk (e.g., '- **Activity Title:** Description.'). If you provide an introductory sentence, please ensure it is clearly separated from the list items (e.g., by a blank line). Ensure the full description for each activity is provided and not cut off.`;

    try {
        const result = await fetchAIResponse(prompt);
        suggestionsContainer.innerHTML = ''; // Clear loading spinner
        suggestionsContainer.appendChild(closeButton);

        if (result.error) {
            suggestionsContainer.insertAdjacentHTML('beforeend', `<p class="text-red-500 text-sm">Error: ${result.error}</p>`);
        } else if (result.text) {
            const formattedHtmlCheckboxes = formatApiResponseToHtmlList(result.text, true, wakeWindowItemId);
            suggestionsContainer.insertAdjacentHTML('beforeend', formattedHtmlCheckboxes);

            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save Selected Activities';
            saveButton.classList.add('save-activities-button', 'mt-3', 'w-full');
            saveButton.onclick = () => {
                const selectedActivities = [];
                suggestionsContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                    const label = document.querySelector(`label[for="${checkbox.id}"]`);
                    if(label) selectedActivities.push(label.innerHTML);
                });

                if (onActivitiesSaved) onActivitiesSaved(wakeWindowItemId, selectedActivities);

                suggestionsContainer.classList.add('hidden');
                suggestionsContainer.innerHTML = '';
                if (onSuggestionsClosed) onSuggestionsClosed(); // Also close the box logically in main
            };
            suggestionsContainer.appendChild(saveButton);
        } else {
            suggestionsContainer.insertAdjacentHTML('beforeend', '<p class="text-red-500 text-sm">Could not fetch suggestions (empty response).</p>');
        }
    } catch (error) {
        suggestionsContainer.innerHTML = ''; // Clear loading spinner
        suggestionsContainer.appendChild(closeButton);
        suggestionsContainer.insertAdjacentHTML('beforeend', `<p class="text-red-500 text-sm">Error: ${error.message}</p>`);
    }
    // No return needed for activeSuggestionsBoxId, main.js manages it via callbacks
}

export async function fetchGeneralSleepTips(ageInMonths, domElements) { // domElements for sleepTipsModal, sleepTipsContent
    const { sleepTipsModal, sleepTipsContent } = domElements;
    openModal(sleepTipsModal.id);
    sleepTipsContent.innerHTML = '<div class="loading-spinner"></div> <p class="text-center text-sm">✨ Fetching tips...</p>';

    let ageInfo = "";
    if (ageInMonths && !isNaN(ageInMonths) && ageInMonths >= 0) {
        ageInfo = ` appropriate for a ${ageInMonths}-month-old baby`;
    }

    const prompt = `Provide 3 concise, actionable sleep tips${ageInfo}. Focus on environment, consistency, and cues. Format each as a distinct list item, starting with '*' or '-'. For titles or key phrases within each tip, use **double asterisks** for bolding.`;
    try {
        const result = await fetchAIResponse(prompt);
        if (result.text) {
            sleepTipsContent.innerHTML = formatApiResponseToHtmlList(result.text);
        } else {
            sleepTipsContent.innerHTML = '<p class="text-red-500 text-sm">Could not fetch tips (empty response).</p>';
        }
    } catch (error) {
        sleepTipsContent.innerHTML = `<p class="text-red-500 text-sm">Error: ${error.message}</p>`;
    }
}

export function setInitialTheme(darkModeToggleElement) { // Pass the toggle element
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const lightIcon = darkModeToggleElement ? darkModeToggleElement.querySelector('.light-mode-icon') : null;
    const darkIcon = darkModeToggleElement ? darkModeToggleElement.querySelector('.dark-mode-icon') : null;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
        if (lightIcon) lightIcon.classList.add('hidden');
        if (darkIcon) darkIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        if (lightIcon) lightIcon.classList.remove('hidden');
        if (darkIcon) darkIcon.classList.add('hidden');
    }
}

export function toggleTheme(darkModeToggleElement, generatedScheduleData, chartCanvas, currentDurationChartInstance, callbacks) { // Pass elements and data
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    const lightIcon = darkModeToggleElement ? darkModeToggleElement.querySelector('.light-mode-icon') : null;
    const darkIcon = darkModeToggleElement ? darkModeToggleElement.querySelector('.dark-mode-icon') : null;

    if (lightIcon) lightIcon.classList.toggle('hidden', isDark);
    if (darkIcon) darkIcon.classList.toggle('hidden', !isDark);

    if (callbacks && callbacks.updateChart && chartCanvas) { // Check if chart needs update
      const chartData = generatedScheduleData.filter(item => item.durationMinutes !== null && item.type !== "System");
      callbacks.updateChart(chartData, chartCanvas, currentDurationChartInstance);
    }
}

export function applyAiFeaturesState(enabled, domElements, generatedScheduleData, callbacks) { // Pass elements, data, and callbacks
    localStorage.setItem(AI_FEATURES_KEY, enabled.toString());
    const { aiToggle, aiSettingsBtn, geminiFeaturesSection } = domElements;
    const aiOnIcon = aiToggle ? aiToggle.querySelector('.ai-on-icon') : null;
    const aiOffIcon = aiToggle ? aiToggle.querySelector('.ai-off-icon') : null;

    let newActiveSuggestionsBoxId = null; // This function will now trigger a callback to handle this in main.js

    if (enabled) {
        if (aiOnIcon) aiOnIcon.classList.remove('hidden');
        if (aiOffIcon) aiOffIcon.classList.add('hidden');
        if (geminiFeaturesSection) geminiFeaturesSection.classList.remove('hidden');
        if (aiSettingsBtn) aiSettingsBtn.classList.remove('hidden');
    } else {
        if (aiOnIcon) aiOnIcon.classList.add('hidden');
        if (aiOffIcon) aiOffIcon.classList.remove('hidden');
        if (geminiFeaturesSection) geminiFeaturesSection.classList.add('hidden');
        if (aiSettingsBtn) aiSettingsBtn.classList.add('hidden');
        if (callbacks && callbacks.closeAllSuggestionBoxes) {
            callbacks.closeAllSuggestionBoxes();
        }
    }
    if (callbacks && callbacks.rerenderTimeline) {
        callbacks.rerenderTimeline(); // Rerender timeline to show/hide suggestion buttons
    }
    // Return value for activeSuggestionsBoxId is removed, main.js handles it via callback.
}

export function initializeCurrentTimeDisplay(currentTimeEl) { // Pass the element
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(new Date(), true);
        return () => { currentTimeEl.textContent = formatTime(new Date(), true); }; // Return the update function
    }
    return null;
}

export function addDurationInput(containerId, inputClass, placeholderPrefix, value = "", onInputCallback, onBlurCallback) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found in addDurationInput`);
        return null;
    }

    const inputWrapper = document.createElement('div');
    inputWrapper.classList.add('input-field-wrapper');

    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.classList.add('form-input', inputClass, 'form-input-dynamic-width');
    newInput.placeholder = `${placeholderPrefix} ${container.querySelectorAll('.' + inputClass).length + 1}`;
    newInput.value = value;

    if (onInputCallback) {
        newInput.addEventListener('input', onInputCallback);
    } else { // Default to adjustInputWidth if no specific input callback is provided
        newInput.addEventListener('input', adjustInputWidth);
    }

    if (onBlurCallback) {
        newInput.addEventListener('blur', onBlurCallback);
    }

    inputWrapper.appendChild(newInput);
    container.appendChild(inputWrapper);
    adjustInputWidth({ target: newInput }); // Adjust width after appending
    return newInput; // Return the created input element
}

export function updateRemoveButtonState(containerId, domElements) { // Pass relevant remove button
    console.log(`[ui.js] updateRemoveButtonState called for ${containerId}. domElements param:`, JSON.stringify(domElements)); // ADD LOGGING (stringify to see structure if complex)
    const container = document.getElementById(containerId);
    let removeButton;

    if (!domElements) {
        console.error(`[ui.js] CRITICAL: domElements parameter is undefined in updateRemoveButtonState for ${containerId}`);
        if (container) { // Attempt to disable button if container exists but domElements is bad
            // This part is tricky as we don't know WHICH button to disable without domElements
            // We might have to find a generic button if one exists or just log and return.
            console.warn(`[ui.js] Cannot determine which remove button to update for ${containerId} due to undefined domElements.`);
        }
        return; // Avoid crash
    }

    if (containerId === 'wakeWindowInputsContainer') {
        removeButton = domElements.removeWakeWindowButton;
    } else if (containerId === 'napInputsContainer') {
        removeButton = domElements.removeNapButton;
    } else {
        return;
    }

    if (removeButton && container) {
        removeButton.disabled = container.children.length <= 1;
    } else if (!removeButton && domElements) {
        console.warn(`[ui.js] removeButton is undefined in updateRemoveButtonState for ${containerId} (e.g., domElements.removeWakeWindowButton was not found or was null/undefined). domElements object was:`, JSON.stringify(domElements));
    }
}

export function populateDurationInputs(containerId, inputClass, placeholderPrefix, values, domElementsForRemoveBtn, onInputCallback, onBlurCallback) {
    console.log(`[ui.js] populateDurationInputs called for ${containerId}. domElementsForRemoveBtn:`, JSON.stringify(domElementsForRemoveBtn)); // ADD LOGGING (stringify to see structure if complex)
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID ${containerId} not found for populating inputs.`);
        return;
    }
    container.innerHTML = ''; // Clear existing inputs

    const valuesToRender = (Array.isArray(values) && values.length > 0) ? values : [""]; // Ensure at least one input

    valuesToRender.forEach(val => {
        addDurationInput(containerId, inputClass, placeholderPrefix, typeof val === 'string' ? val : "", onInputCallback, onBlurCallback);
    });

    // Ensure at least one input field is present after populating
    if (container.children.length === 0) {
        addDurationInput(containerId, inputClass, placeholderPrefix, "", onInputCallback, onBlurCallback);
    }
    updateRemoveButtonState(containerId, domElementsForRemoveBtn); // Pass relevant button from main.js
}

export function initializePlanningModeToggle(planningModeRadios, fullDayInputs, fromNowInputs, currentActivityEndTimeInput, onModeChangeCallback) {
    function toggleInputs(mode) {
        if (mode === 'fullDay') {
            fullDayInputs.classList.remove('hidden');
            fromNowInputs.classList.add('hidden');
        } else {
            fullDayInputs.classList.add('hidden');
            fromNowInputs.classList.remove('hidden');
            if (currentActivityEndTimeInput && !currentActivityEndTimeInput.value) {
                const now = new Date();
                currentActivityEndTimeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
        }
    }

    planningModeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            toggleInputs(event.target.value);
            if (onModeChangeCallback) onModeChangeCallback(event.target.value);
        });
    });

    // Initial state based on checked radio
    const currentModeRadio = Array.from(planningModeRadios).find(r => r.checked);
    if (currentModeRadio) {
        toggleInputs(currentModeRadio.value);
    }
}

export async function handleShareSchedule(scheduleTimelineElement, scheduleStatusElement, shareButtonElement) {
    if (!scheduleTimelineElement) {
        console.error('Schedule timeline element not found (id: schedule-timeline).');
        alert('Could not find the schedule to share. Element not found.');
        return;
    }

    if (typeof html2canvas === 'undefined') {
        console.error('html2canvas library is not loaded.');
        alert('Sharing library (html2canvas) not loaded. Please try again in a moment or check console.');
        return;
    }

    let originalStatusDisplay = '';

    try {
        if (shareButtonElement) shareButtonElement.style.display = 'none';
        if (scheduleStatusElement) {
            originalStatusDisplay = scheduleStatusElement.style.display;
            scheduleStatusElement.style.display = 'none';
        }

        const canvas = await html2canvas(scheduleTimelineElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff',
            onclone: (clonedDoc) => {
                const clonedTimeline = clonedDoc.getElementById('schedule-timeline'); // ID of the element passed to html2canvas
                if (clonedTimeline) {
                    // Try to find the title within the cloned element if it exists
                    const originalTitle = clonedTimeline.querySelector('h2'); // Assuming title is h2
                    if (originalTitle) originalTitle.style.display = 'none';

                    clonedTimeline.style.paddingTop = '20px'; // Add padding for new title
                    const titleElement = clonedDoc.createElement('h2');
                    titleElement.textContent = "Today's Plan"; // Generic title
                    titleElement.style.textAlign = 'center';
                    titleElement.style.fontSize = '1.5rem';
                    titleElement.style.fontWeight = '600';
                    titleElement.style.marginBottom = '1.5rem';
                    titleElement.style.color = document.documentElement.classList.contains('dark') ? '#60A5FA' : '#3B82F6';

                    // Insert title at the beginning of the cloned element
                    clonedTimeline.insertBefore(titleElement, clonedTimeline.firstChild);
                }

                const suggestButtons = clonedDoc.querySelectorAll('.gemini-button');
                suggestButtons.forEach(btn => {
                    if (btn.textContent.includes('Suggest Activities')) {
                        btn.style.display = 'none';
                    }
                });

                const activeSuggestionBoxes = clonedDoc.querySelectorAll('.suggestions-container');
                activeSuggestionBoxes.forEach(box => box.style.display = 'none');
            }
        });

        if (shareButtonElement) shareButtonElement.style.display = '';
        if (scheduleStatusElement) scheduleStatusElement.style.display = originalStatusDisplay;

        const imageDataUrl = canvas.toDataURL('image/png');

        if (navigator.share && navigator.canShare) {
            const blob = await (await fetch(imageDataUrl)).blob();
            const file = new File([blob], "sparkle-dreams-schedule.png", { type: "image/png" });

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'My Baby Schedule from Sparkle Dreams',
                    text: 'Check out this baby schedule I generated with Sparkle Dreams!',
                    files: [file],
                });
            } else {
                downloadImage(imageDataUrl, 'sparkle-dreams-schedule.png');
                alert('Schedule image downloaded! Web Share API cannot share this file type.');
            }
        } else {
            downloadImage(imageDataUrl, 'sparkle-dreams-schedule.png');
            alert('Schedule image downloaded! You can share it from your downloads.');
        }
    } catch (error) {
        console.error('Error during schedule image generation or sharing:', error);
        alert('Sorry, there was an error creating the schedule image. Check console for details.');
        if (shareButtonElement) shareButtonElement.style.display = '';
        if (scheduleStatusElement) scheduleStatusElement.style.display = originalStatusDisplay;
    }
}

function downloadImage(dataUrl, filename) { // This is a local helper, not exported
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- NEWLY MOVED FUNCTIONS ---

export function displayScheduleSummary(generatedScheduleData, summaryContentEl, summarySectionEl, savedSettingsData) {
    if (!summaryContentEl || !summarySectionEl) {
        console.error("Schedule summary elements not found in DOM.");
        return;
    }

    let totalNaps = 0;
    let totalNapTimeMinutes = 0;
    let totalWakeTimeMinutes = 0;
    let longestNapMinutes = 0;
    let longestWakeWindowMinutes = 0;
    let actualNapCountForAverage = 0;
    let actualWakeWindowCountForAverage = 0;

    generatedScheduleData.forEach(item => {
        if (item.type === "Nap" && typeof item.durationMinutes === 'number') {
            totalNaps++;
            totalNapTimeMinutes += item.durationMinutes;
            longestNapMinutes = Math.max(longestNapMinutes, item.durationMinutes);
            if (item.durationMinutes > 0) {
                actualNapCountForAverage++;
            }
        } else if (item.type === "Wake" && typeof item.durationMinutes === 'number') {
            totalWakeTimeMinutes += item.durationMinutes;
            longestWakeWindowMinutes = Math.max(longestWakeWindowMinutes, item.durationMinutes);
            if (item.durationMinutes > 0) {
                actualWakeWindowCountForAverage++;
            }
        }
    });

    const averageNapDuration = actualNapCountForAverage > 0 ? Math.round(totalNapTimeMinutes / actualNapCountForAverage) : 0;
    const averageWakeWindowDuration = actualWakeWindowCountForAverage > 0 ? Math.round(totalWakeTimeMinutes / actualWakeWindowCountForAverage) : 0;

    let targetNighttimeSleepMinutes = null;
    let totalExpectedSleepMinutes = null;

    try {
        const wakeUpTimeStr = savedSettingsData.wakeUpTime;
        const desiredBedtimeStr = savedSettingsData.desiredBedtime;

        if (wakeUpTimeStr && desiredBedtimeStr) {
            const bedtimeResult = parseTimeToDate(desiredBedtimeStr, 'Desired Bedtime for Summary');
            const wakeupResult = parseTimeToDate(wakeUpTimeStr, 'Wake Up Time for Summary');

            if (bedtimeResult.value && wakeupResult.value) {
                const currentBedtime = new Date(bedtimeResult.value.getTime());
                let nextWakeup = new Date(wakeupResult.value.getTime());

                if (nextWakeup.getHours() < currentBedtime.getHours() ||
                    (nextWakeup.getHours() === currentBedtime.getHours() && nextWakeup.getMinutes() <= currentBedtime.getMinutes())) {
                    nextWakeup.setDate(nextWakeup.getDate() + 1);
                }

                let diffMs = nextWakeup.getTime() - currentBedtime.getTime();

                if (diffMs < 0) {
                    console.warn("Calculated negative nighttime sleep duration, might indicate inconsistent time settings.", diffMs);
                    targetNighttimeSleepMinutes = 0;
                } else {
                    targetNighttimeSleepMinutes = Math.round(diffMs / (1000 * 60));
                }


                if (targetNighttimeSleepMinutes !== null && targetNighttimeSleepMinutes >= 0) {
                    totalExpectedSleepMinutes = totalNapTimeMinutes + targetNighttimeSleepMinutes;
                } else {
                    targetNighttimeSleepMinutes = null;
                }
            } else {
                console.warn("Could not parse wakeUpTime or desiredBedtime for summary calculation.");
                targetNighttimeSleepMinutes = null;
            }
        } else {
            console.warn("wakeUpTime or desiredBedtime not found in saved settings for summary calculation.");
            targetNighttimeSleepMinutes = null;
        }
    } catch (e) {
        console.error("Error calculating extended sleep summary metrics:", e);
    }

    summaryContentEl.innerHTML = `
        <p><strong>Total Naps:</strong> ${totalNaps}</p>
        <p><strong>Total Nap Time:</strong> ${formatDurationForDisplay(totalNapTimeMinutes)}</p>
        <p><strong>Average Nap Duration:</strong> ${formatDurationForDisplay(averageNapDuration)}</p>
        <p><strong>Longest Nap:</strong> ${formatDurationForDisplay(longestNapMinutes)}</p>
        <hr class="my-2 border-slate-300 dark:border-slate-600">
        <p><strong>Total Scheduled Wake Time:</strong> ${formatDurationForDisplay(totalWakeTimeMinutes)}</p>
        <p><strong>Average Wake Window:</strong> ${formatDurationForDisplay(averageWakeWindowDuration)}</p>
        <p><strong>Longest Wake Window:</strong> ${formatDurationForDisplay(longestWakeWindowMinutes)}</p>
        <hr class="my-2 border-slate-300 dark:border-slate-600">
        <p><strong>Target Nighttime Sleep:</strong> ${targetNighttimeSleepMinutes !== null ? formatDurationForDisplay(targetNighttimeSleepMinutes) : 'N/A'}</p>
        <p><strong>Total Expected Sleep (24h):</strong> ${totalExpectedSleepMinutes !== null ? formatDurationForDisplay(totalExpectedSleepMinutes) : 'N/A'}</p>
    `;
    summarySectionEl.classList.remove('hidden');
}

export function updateActiveTimelineStates(generatedScheduleData, scheduleStatusEl, timelineItemsSelector = '.timeline-item') {
    const now = new Date();
    let currentActivityName = "Schedule complete or outside defined hours.";
    const timelineItems = document.querySelectorAll(timelineItemsSelector);

    timelineItems.forEach(itemDiv => {
        itemDiv.classList.remove('active');
        itemDiv.removeAttribute('data-icon-active');

        const itemId = itemDiv.id.replace('timeline-', '');
        const item = generatedScheduleData.find(d => d.id === itemId);
        if (!item || item.type === "System") return;

        const startTime = parseTimeForUpdate(item.start);
        const endTime = item.end ? parseTimeForUpdate(item.end) : null;
        let isActive = false;

        if (endTime) {
            if (now >= startTime && now < endTime) isActive = true;
        } else if (item.type === "Bedtime") { // Bedtime is ongoing until next morning (e.g. 6 AM)
            if (now >= startTime) {
                const nextDayStartPotential = new Date(startTime);
                nextDayStartPotential.setDate(startTime.getDate() + 1);
                nextDayStartPotential.setHours(6,0,0,0); // Assuming "morning" starts around 6 AM
                if (now < nextDayStartPotential) isActive = true;
            }
        }

        if(isActive){
            itemDiv.classList.add('active');
            if(item.type === "Wake") itemDiv.setAttribute('data-icon-active', '☀️');
            else if (item.type === "Nap") itemDiv.setAttribute('data-icon-active', '😴');
            else if (item.type === "Bedtime") itemDiv.setAttribute('data-icon-active', '🌙');
            currentActivityName = `Currently: ${item.name}`;
        }
    });
    if (scheduleStatusEl) {
        scheduleStatusEl.textContent = currentActivityName;
    }
}


export function updateTimeline(
    generatedScheduleData,
    domElements, // { timelineContainer, scheduleStatusEl }
    aiFeaturesEnabled,
    babyAgeMonths, // for fetchActivitySuggestions
    currentUserLocation, // for fetchActivitySuggestions
    getSavedActivitiesCallback, // (activityKey) => savedActivitiesArray
    onSuggestionAction // { type: 'open', itemId, durationMinutes } | { type: 'close' } | { type: 'save', itemId, activities }
) {
    const { timelineContainer, scheduleStatusEl } = domElements;
    timelineContainer.innerHTML = ''; // Clear previous timeline

    if (generatedScheduleData.length === 0) {
        if (scheduleStatusEl) scheduleStatusEl.textContent = "Please generate a schedule first.";
        return;
    }

    generatedScheduleData.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('timeline-item', 'pb-8');
        itemDiv.id = `timeline-${item.id}`;

        const timeDiv = document.createElement('div');
        timeDiv.classList.add('text-sm', 'font-semibold', 'accent-text');
        timeDiv.textContent = `${item.start}${item.end ? ' - ' + item.end : ''}`;
         if (item.type === "System") {
            timeDiv.textContent = item.start;
        }

        const nameDiv = document.createElement('h3');
        nameDiv.classList.add('text-xl', 'font-semibold', 'mt-1');
        nameDiv.textContent = item.name;
         if (item.type === "System") {
            nameDiv.classList.add('italic', 'text-gray-500', 'dark:text-slate-400');
        }

        const durationDiv = document.createElement('p');
        durationDiv.classList.add('text-sm', 'text-gray-600', 'dark:text-slate-300');
        if (item.durationMinutes) {
            durationDiv.textContent = `Duration: ${formatDurationForDisplay(item.durationMinutes)}`;
        } else if (item.type === "Bedtime") {
            durationDiv.textContent = `Approximate bedtime.`;
        } else if (item.type === "System") {
            durationDiv.textContent = "";
        }

        itemDiv.appendChild(timeDiv); itemDiv.appendChild(nameDiv); itemDiv.appendChild(durationDiv);

        let iconChar = '•';
        if (item.type === "Wake" || (item.type === "System" && item.name.toLowerCase().includes("wake up"))) {
            iconChar = '☀️';
        } else if (item.type === "Nap") {
            iconChar = '😴';
        } else if (item.type === "Bedtime") {
            iconChar = '🌙';
        }
        itemDiv.setAttribute('data-icon', iconChar);

        const savedActivitiesContainerId = `saved-activities-${item.id}`;
        const savedActivitiesContainer = document.createElement('div');
        savedActivitiesContainer.id = savedActivitiesContainerId;
        savedActivitiesContainer.classList.add('saved-activities-list', 'mt-2', 'hidden');
        itemDiv.appendChild(savedActivitiesContainer);

        if (getSavedActivitiesCallback) {
            const activityKey = `wakeWindow_${item.id}_activities`;
            const savedActivities = getSavedActivitiesCallback(activityKey);
            if (savedActivities && savedActivities.length > 0) {
                let listHtml = '<strong>Selected Activities:</strong><ul>';
                savedActivities.forEach(activityText => {
                    listHtml += `<li>${activityText}</li>`; // Assuming activityText is HTML-safe or plain text
                });
                listHtml += '</ul>';
                savedActivitiesContainer.innerHTML = listHtml;
                savedActivitiesContainer.classList.remove('hidden');
            }
        }


        if (item.type === "Wake" && item.durationMinutes && aiFeaturesEnabled) {
            const activityButton = document.createElement('button');
            activityButton.classList.add('gemini-button', 'mt-2');
            activityButton.textContent = '✨ Suggest Activities';

            const suggestionsDivId = `suggestions-${item.id}`;
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = suggestionsDivId;
            suggestionsDiv.classList.add('suggestions-container', 'hidden');

            activityButton.onclick = () => {
                if (onSuggestionAction) {
                     // Notify main.js to handle opening this box (and closing others)
                    onSuggestionAction({ type: 'open', itemId: item.id, durationMinutes: item.durationMinutes });
                    // Actual fetching and display will be triggered by main.js calling fetchActivitySuggestions
                }
            };
            itemDiv.appendChild(activityButton);
            itemDiv.appendChild(suggestionsDiv);
        }
        timelineContainer.appendChild(itemDiv);
    });
    updateActiveTimelineStates(generatedScheduleData, scheduleStatusEl); // Call directly
}


export function updateDurationChart(chartData, chartCanvas, currentChartInstance) {
    if (!chartCanvas || !chartCanvas.getContext) {
        console.error("Chart canvas element not found or invalid.");
        return null;
    }
    const ctx = chartCanvas.getContext('2d');
    const isDarkMode = document.documentElement.classList.contains('dark');

    const labels = chartData.map(item => {
        const label = item.name;
        if (label.length > 16) { // Simple check for multi-line labels
            const words = label.split(' '); let currentLine = ''; const lines = [];
            for (const word of words) {
                if ((currentLine + word).length > 16 && currentLine.length > 0) { lines.push(currentLine.trim()); currentLine = ''; }
                currentLine += word + ' ';
            }
            lines.push(currentLine.trim()); return lines;
        }
        return label;
    });

    if (currentChartInstance) {
        currentChartInstance.destroy();
    }

    // Ensure Chart is available (loaded from CDN)
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded.");
        return null;
    }

    const newChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duration (minutes)',
                data: chartData.map(item => item.durationMinutes),
                backgroundColor: isDarkMode ? '#38B2AC' : '#4FD1C5', // Teal shades
                borderColor: isDarkMode ? '#319795' : '#38B2AC',
                borderWidth: 1,
                borderRadius: 6, // Rounded bars
                barPercentage: 0.7, // Adjust bar width
                categoryPercentage: 0.8 // Adjust spacing between bars
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Duration (minutes)', font: { size: 14, family: 'Poppins' }, color: isDarkMode ? '#A0AEC0' : '#4A5568'},
                    grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'}, // Lighter grid lines
                    ticks: { color: isDarkMode ? '#A0AEC0' : '#4A5568', font: {family: 'Poppins'}}
                },
                x: {
                    grid: { display: false }, // No x-axis grid lines
                    ticks: {font: {family: 'Poppins'}, color: isDarkMode ? '#A0AEC0' : '#4A5568'}
                }
            },
            plugins: {
                legend: { display: false }, // Hide legend
                tooltip: {
                    backgroundColor: isDarkMode ? '#1A202C' : '#2D3748', // Darker tooltip
                    titleColor: isDarkMode ? '#F7FAFC' : '#FFF',
                    bodyColor: isDarkMode ? '#CBD5E0' : '#E2E8F0',
                    titleFont: { size: 14, family: 'Poppins' },
                    bodyFont: { size: 12, family: 'Poppins' },
                    padding: 12,
                    callbacks: {
                        title: function(tooltipItems) { // Handle multi-line labels in tooltips
                            const item = tooltipItems[0];
                            let label = item.chart.data.labels[item.dataIndex];
                            return Array.isArray(label) ? label.join(' ') : label;
                        }
                    }
                }
            }
        }
    });
    return newChartInstance;
}
