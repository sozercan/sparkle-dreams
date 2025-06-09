// This file is intentionally blank as its contents have been refactored into modules in the js/ directory.

    if (selectedProvider === 'gemini') {
        geminiApiKeyInputContainer.classList.remove('hidden');
    } else if (selectedProvider === 'openai_compatible') {
        openaiCompatibleInputContainer.classList.remove('hidden');
    }
}

function loadAiProviderSettingsFromStorage() {
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

function saveAiProviderSettingsToStorage() {
    const selectedProvider = aiProviderSelect.value;
    localStorage.setItem(AI_PROVIDER_KEY, selectedProvider);
    localStorage.setItem(NUM_SUGGESTIONS_KEY, numSuggestionsInput.value);

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

const ageBasedDefaults = {
    "0-3": { wakeWindows: ["1h", "1h 15m", "1h 30m", "1h 15m", "1h"], naps: ["1h", "1h 15m", "1h", "45m", ""] },
    "4-6": { wakeWindows: ["2h", "2h 15m", "2h 30m", "2h 30m", ""], naps: ["1h 30m", "1h 15m", "45m", "", ""] },
    "7-9": { wakeWindows: ["2h 45m", "3h", "3h 15m", "", ""], naps: ["1h 30m", "1h 15m", "", "", ""] },
    "10-12": { wakeWindows: ["3h 15m", "3h 30m", "3h 45m", "", ""], naps: ["1h 15m", "1h", "", "", ""] },
    "13-17": { wakeWindows: ["4h 30m", "5h", "", "", ""], naps: ["2h", "", "", "", ""] },
    "18-24": { wakeWindows: ["5h", "5h 30m", "", "", ""], naps: ["2h", "", "", "", ""] },
    "25+": { wakeWindows: ["5h 30m", "6h", "", "", ""], naps: ["1h 30m", "", "", "", ""] }
};

function getAgeDefaults(ageInMonths) {
    if (ageInMonths <= 3) return ageBasedDefaults["0-3"];
    if (ageInMonths <= 6) return ageBasedDefaults["4-6"];
    if (ageInMonths <= 9) return ageBasedDefaults["7-9"];
    if (ageInMonths <= 12) return ageBasedDefaults["10-12"];
    if (ageInMonths <= 17) return ageBasedDefaults["13-17"];
    if (ageInMonths <= 24) return ageBasedDefaults["18-24"];
    return ageBasedDefaults["25+"];
}

function displayFormError(messages) {
    const errorArea = document.getElementById('formErrorMessageArea');
    if (!Array.isArray(messages)) messages = [messages];

    if (messages.length > 0) {
        errorArea.innerHTML = '<ul>' + messages.map(msg => `<li>- ${msg}</li>`).join('') + '</ul>';
        errorArea.classList.remove('hidden');
    } else {
        errorArea.classList.add('hidden');
        errorArea.innerHTML = '';
    }
}

function parseDurationToMinutes(durationStr, fieldName) {
    if (!durationStr || durationStr.trim() === "") return { value: null, error: null };
    let totalMinutes = 0;
    const hourMatch = durationStr.match(/(\d+)\s*h/);
    const minMatch = durationStr.match(/(\d+)\s*m/);
    if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) totalMinutes += parseInt(minMatch[1]);
    if (!hourMatch && !minMatch && !isNaN(parseInt(durationStr))) {
         totalMinutes = parseInt(durationStr);
    }
    if (totalMinutes > 0) return { value: totalMinutes, error: null };
    return { value: null, error: `Invalid format for ${fieldName}. Use 'Xh Ym' or 'Zm'.` };
}

function formatTime(dateObj, includeSeconds = false) {
    const options = { hour: 'numeric', minute: '2-digit' };
    if (includeSeconds) options.second = '2-digit';
    return dateObj.toLocaleTimeString(undefined, options);
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

function parseTimeToDate(timeStr, fieldName) {
    if (!timeStr) return { value: null, error: `${fieldName} is required.`};
    const parts = timeStr.split(':');
    if (parts.length !== 2) return {value: null, error: `Invalid time format for ${fieldName}.`};
    const [hours, minutes] = parts.map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return {value: null, error: `Invalid time value for ${fieldName}.`};
    }
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return {value: date, error: null};
}

function generateSchedule(planningMode, settings) {
    generatedScheduleData = [];
    let currentTime;
    let initialIsWakePeriod;
    let errors = [];

    const parsedWakeWindows = [];
    settings.wakeWindowDurations.forEach((ww, index) => {
        if (ww.trim() === "" && index > 0 && parsedWakeWindows[index-1] === null) return;
        const parsed = parseDurationToMinutes(ww, `Wake Window ${index + 1}`);
        if (parsed.error && ww.trim() !== "") errors.push(parsed.error);
        parsedWakeWindows.push(parsed.value);
    });
    const finalWakeWindows = parsedWakeWindows.filter(ww => ww !== null);
    if (finalWakeWindows.length === 0) errors.push("Please enter at least one valid wake window duration.");

    const parsedNaps = [];
    settings.napDurations.forEach((nd, index) => {
         if (nd.trim() === "" && index > 0 && parsedNaps[index-1] === null) return;
        const parsed = parseDurationToMinutes(nd, `Nap ${index + 1}`);
        if (parsed.error && nd.trim() !== "") errors.push(parsed.error);
        parsedNaps.push(parsed.value);
    });
    const finalNaps = parsedNaps.filter(nd => nd !== null);
    if (finalNaps.length === 0) errors.push("Please enter at least one valid nap duration.");


    if (planningMode === "fullDay") {
        const wakeUpResult = parseTimeToDate(settings.wakeUpTimeStr, "Wake-Up Time");
        if (wakeUpResult.error) errors.push(wakeUpResult.error);
        else currentTime = wakeUpResult.value;
        initialIsWakePeriod = true;
        if(currentTime) generatedScheduleData.push({
            id: `wakeup`, name: "Morning Wake Up", start: formatTime(currentTime),
            end: null, durationMinutes: null, type: "System"
        });
    } else {
        const activityEndResult = parseTimeToDate(settings.currentActivityEndTimeStr, "Current Activity End Time");
         if (activityEndResult.error) errors.push(activityEndResult.error);
        else currentTime = activityEndResult.value;
        initialIsWakePeriod = settings.currentActivityType === "napping";
        if(currentTime) generatedScheduleData.push({
            id: `startfromnow`, name: `Planning from ${settings.currentActivityType === "awake" ? "end of current wake window" : "end of current nap"}`,
            start: formatTime(currentTime),
            end: null, durationMinutes: null, type: "System"
        });
    }

    const bedtimeResult = parseTimeToDate(settings.desiredBedtimeStr, "Desired Bedtime");
    let bedtimeTarget;
    if(bedtimeResult.error) errors.push(bedtimeResult.error);
    else bedtimeTarget = bedtimeResult.value;

    if (errors.length > 0) {
        displayFormError(errors);
        return false;
    }
    displayFormError([]);

    if (bedtimeTarget <= currentTime) {
        bedtimeTarget.setDate(bedtimeTarget.getDate() + 1);
    }

    const scheduleLimit = new Date(currentTime);
    scheduleLimit.setDate(scheduleLimit.getDate() + 1);
    scheduleLimit.setHours(6, 0, 0, 0);

    let eventCounter = 1;
    let wakeWindowIndex = 0;
    let napIndex = 0;
    let isWakePeriod = initialIsWakePeriod;

    // Ensure currentTime and bedtimeTarget are defined before the loop
    if (!currentTime) {
        // This case should ideally be caught by initial validation if wakeUpTime or currentActivityEndTime is missing
        errors.push("Cannot determine schedule start time.");
        displayFormError(errors);
        return false;
    }
    if (!bedtimeTarget) {
        // This case should be caught if desiredBedtime is missing/invalid
        errors.push("Cannot determine desired bedtime for scheduling loop.");
        displayFormError(errors);
        return false;
    }

    while (currentTime < bedtimeTarget && currentTime < scheduleLimit) {
        const periodStart = new Date(currentTime);
        let periodEnd;
        let periodDuration;
        let periodName;
        let periodType;

        if (isWakePeriod) {
            if (wakeWindowIndex >= finalWakeWindows.length) {
                periodDuration = (bedtimeTarget.getTime() - currentTime.getTime()) / (60 * 1000);
                if (periodDuration <= 15) {
                    currentTime = new Date(periodStart);
                    break;
                }
                periodEnd = new Date(bedtimeTarget);
                periodName = `Wake Window (Final)`;
                periodType = "Wake";
                generatedScheduleData.push({
                    id: `${periodType.toLowerCase()}_final`, name: periodName, start: formatTime(periodStart),
                    end: formatTime(periodEnd), durationMinutes: Math.round(periodDuration), type: periodType
                });
                currentTime = periodEnd;
                break;
            }
            periodDuration = finalWakeWindows[wakeWindowIndex];
            periodEnd = addMinutes(currentTime, periodDuration);
            periodName = `Wake Window ${wakeWindowIndex + 1}`;
            periodType = "Wake";
        } else {
            if (napIndex >= finalNaps.length) {
                if (generatedScheduleData.length > 0) {
                    const lastEvent = generatedScheduleData[generatedScheduleData.length - 1];
                    if (lastEvent.type === "Wake") {
                        const lastWakeStart = parseTimeForUpdate(lastEvent.start);
                        const durationToBedtime = (bedtimeTarget.getTime() - lastWakeStart.getTime()) / (60 * 1000);
                        if (durationToBedtime > 15) {
                            lastEvent.durationMinutes = Math.round(durationToBedtime);
                            lastEvent.end = formatTime(bedtimeTarget);
                            lastEvent.name = lastEvent.name.replace(" (Final)", "") + " (Final)";
                        }
                    }
                }
                currentTime = new Date(bedtimeTarget);
                break;
            }

            const currentNapDuration = finalNaps[napIndex];
            const napEndTime = addMinutes(currentTime, currentNapDuration);
            let timeAvailableForNextWakeAfterThisNap = (bedtimeTarget.getTime() - napEndTime.getTime()) / (60 * 1000);

            if (napEndTime >= bedtimeTarget || timeAvailableForNextWakeAfterThisNap < 60 ) {
                if (generatedScheduleData.length > 0) {
                    const lastEvent = generatedScheduleData[generatedScheduleData.length - 1];
                    if (lastEvent.type === "Wake") {
                        const lastWakeStart = parseTimeForUpdate(lastEvent.start);
                        const durationToBedtime = (bedtimeTarget.getTime() - lastWakeStart.getTime()) / (60 * 1000);
                        if (durationToBedtime > 15) {
                            lastEvent.durationMinutes = Math.round(durationToBedtime);
                            lastEvent.end = formatTime(bedtimeTarget);
                            lastEvent.name = lastEvent.name.replace(" (Final)", "") + " (Final)";
                        }
                    }
                }
                currentTime = new Date(bedtimeTarget);
                break;
            }
            periodDuration = currentNapDuration;
            periodEnd = napEndTime;
            periodName = `Nap ${napIndex + 1}`;
            periodType = "Nap";
            napIndex++;
        }

        generatedScheduleData.push({
            id: `${periodType.toLowerCase()}${eventCounter}`, name: periodName, start: formatTime(periodStart),
            end: formatTime(periodEnd), durationMinutes: Math.round(periodDuration), type: periodType
        });

        currentTime = periodEnd;
        if(periodType === "Wake") wakeWindowIndex++;
        isWakePeriod = !isWakePeriod;
        eventCounter++;
    }

    let finalBedtimeEventTime = currentTime;
    if (generatedScheduleData.length > 0) {
        const lastEvent = generatedScheduleData[generatedScheduleData.length - 1];
        if (lastEvent.type === "Bedtime") generatedScheduleData.pop();
        finalBedtimeEventTime = parseTimeForUpdate(generatedScheduleData[generatedScheduleData.length-1].end || generatedScheduleData[generatedScheduleData.length-1].start);
        if (finalBedtimeEventTime > bedtimeTarget) finalBedtimeEventTime = bedtimeTarget;
    } else {
        finalBedtimeEventTime = bedtimeTarget;
    }

    // Loop ends, currentTime is the actual end time of the last scheduled activity.
    const actualCalculatedBedtime = new Date(currentTime.getTime());

    // If the last event in generatedScheduleData is already a "Bedtime" type (e.g., from a previous run, though unlikely), remove it.
    if (generatedScheduleData.length > 0 && generatedScheduleData[generatedScheduleData.length - 1].type === "Bedtime") {
        generatedScheduleData.pop();
    }

    // Add the Bedtime event to the schedule data, using the actual calculated bedtime
    generatedScheduleData.push({
        id: `bedtime`,
        name: "Bedtime",
        start: formatTime(actualCalculatedBedtime), // Use the actual calculated time
        end: null,
        durationMinutes: null,
        type: "Bedtime"
    });

    // Check if the actual bedtime is later than the desired bedtime (bedtimeTarget was used for loop termination)
    // bedtimeTarget is already a Date object, adjusted if it was in the past.
    if (bedtimeTarget && actualCalculatedBedtime.getTime() > bedtimeTarget.getTime()) {
        const desiredBedtimeFormatted = formatTime(bedtimeTarget); // Format the target bedtime
        const actualBedtimeFormatted = formatTime(actualCalculatedBedtime);
        const warningMessage = `Warning: Calculated bedtime (${actualBedtimeFormatted}) is later than desired bedtime (${desiredBedtimeFormatted}).`;
        // This will display the warning. If there were no initial errors, the error area was cleared.
        displayFormError([warningMessage]);
    }
    // If no warning, and error area was cleared, it remains hidden.

    return true;
}

function parseTimeForUpdate(timeStr) {
    const now = new Date();
    const amPmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (amPmMatch) {
        let hours = parseInt(amPmMatch[1]);
        const minutes = parseInt(amPmMatch[2]);
        const modifier = amPmMatch[3].toUpperCase();
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        now.setHours(hours, minutes, 0, 0);
        return now;
    }
    const twentyFourHourMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (twentyFourHourMatch) {
        const hours = parseInt(twentyFourHourMatch[1]);
        const minutes = parseInt(twentyFourHourMatch[2]);
        now.setHours(hours, minutes, 0, 0);
        return now;
    }
    console.error("Could not parse time for update:", timeStr);
    return new Date();
}

function formatDurationForDisplay(minutes) {
    if (minutes === null) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let durationStr = "";
    if (h > 0) durationStr += `${h}h `;
    if (m > 0) durationStr += `${m}min`;
    return durationStr.trim() || "0min";
}

function displayScheduleSummary(data) {
    const summaryContentEl = document.getElementById('scheduleSummaryContent');
    const summarySectionEl = document.getElementById('scheduleSummarySection');
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

    data.forEach(item => {
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
        const savedSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {};
        const wakeUpTimeStr = savedSettings.wakeUpTime;
        const desiredBedtimeStr = savedSettings.desiredBedtime;

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

function updateActiveTimelineStates() {
    const now = new Date();
    let currentActivityName = "Schedule complete or outside defined hours.";
    document.querySelectorAll('.timeline-item').forEach(itemDiv => {
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
        } else if (item.type === "Bedtime") {
            if (now >= startTime) {
                const nextDayStartPotential = new Date(startTime);
                nextDayStartPotential.setDate(startTime.getDate() + 1);
                nextDayStartPotential.setHours(6,0,0,0);
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
    document.getElementById('schedule-status').textContent = currentActivityName;
}


function updateTimeline(forceRedraw = false) {
    const currentDataSignature = JSON.stringify(generatedScheduleData);
    if (!forceRedraw && window.timelineLastRenderedDataSignature === currentDataSignature && document.getElementById('timelineContainer').innerHTML !== '') {
        updateActiveTimelineStates();
        return;
    }
    window.timelineLastRenderedDataSignature = currentDataSignature;

    const timelineContainer = document.getElementById('timelineContainer');
    const scheduleStatusEl = document.getElementById('schedule-status');
    timelineContainer.innerHTML = '';

    const babyAgeMonths = parseInt(document.getElementById('babyAge').value);
    const savedSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {};
    const aiFeaturesEnabled = localStorage.getItem(AI_FEATURES_KEY) === 'true';


    if (generatedScheduleData.length === 0 && !forceRedraw) {
        scheduleStatusEl.textContent = "Please generate a schedule first.";
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

        const activityKey = `wakeWindow_${item.id}_activities`;
        if (savedSettings[activityKey] && savedSettings[activityKey].length > 0) {
            let listHtml = '<strong>Selected Activities:</strong><ul>';
            savedSettings[activityKey].forEach(activityText => {
                listHtml += `<li>${activityText}</li>`;
            });
            listHtml += '</ul>';
            savedActivitiesContainer.innerHTML = listHtml;
            savedActivitiesContainer.classList.remove('hidden');
        }


        if (item.type === "Wake" && item.durationMinutes && aiFeaturesEnabled) {
            const activityButton = document.createElement('button');
            activityButton.classList.add('gemini-button', 'mt-2');
            activityButton.textContent = '✨ Suggest Activities';

            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `suggestions-${item.id}`;
            suggestionsDiv.classList.add('suggestions-container', 'hidden');

            activityButton.onclick = () => {
                if (activeSuggestionsBoxId && activeSuggestionsBoxId !== suggestionsDiv.id) {
                    const currentlyOpen = document.getElementById(activeSuggestionsBoxId);
                    if(currentlyOpen) {
                        currentlyOpen.classList.add('hidden');
                        currentlyOpen.innerHTML = '';
                    }
                }
                fetchActivitySuggestions(item.durationMinutes, `suggestions-${item.id}`, babyAgeMonths, item.id);
            };
            itemDiv.appendChild(activityButton);
            itemDiv.appendChild(suggestionsDiv);
        }

        timelineContainer.appendChild(itemDiv);
    });
    updateActiveTimelineStates();
}

function updateDurationChart() {
    const ctx = document.getElementById('durationChart').getContext('2d');
    const chartData = generatedScheduleData.filter(item => item.durationMinutes !== null && item.type !== "System");
    const isDarkMode = document.documentElement.classList.contains('dark');

    const labels = chartData.map(item => {
        const label = item.name;
        if (label.length > 16) {
            const words = label.split(' '); let currentLine = ''; const lines = [];
            for (const word of words) {
                if ((currentLine + word).length > 16 && currentLine.length > 0) { lines.push(currentLine.trim()); currentLine = ''; }
                currentLine += word + ' ';
            }
            lines.push(currentLine.trim()); return lines;
        }
        return label;
    });

    if (durationChartInstance) durationChartInstance.destroy();

    durationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duration (minutes)',
                data: chartData.map(item => item.durationMinutes),
                backgroundColor: isDarkMode ? '#38B2AC' : '#4FD1C5',
                borderColor: isDarkMode ? '#319795' : '#38B2AC',
                borderWidth: 1, borderRadius: 6,
                barPercentage: 0.7, categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Duration (minutes)', font: { size: 14, family: 'Poppins' }, color: isDarkMode ? '#A0AEC0' : '#4A5568'},
                    grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'},
                    ticks: { color: isDarkMode ? '#A0AEC0' : '#4A5568', font: {family: 'Poppins'}}
                },
                x: {
                    grid: { display: false },
                    ticks: {font: {family: 'Poppins'}, color: isDarkMode ? '#A0AEC0' : '#4A5568'}
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDarkMode ? '#1A202C' : '#2D3748',
                    titleColor: isDarkMode ? '#F7FAFC' : '#FFF',
                    bodyColor: isDarkMode ? '#CBD5E0' : '#E2E8F0',
                    titleFont: { size: 14, family: 'Poppins' },
                    bodyFont: { size: 12, family: 'Poppins' }, padding: 12,
                    callbacks: {
                        title: function(tooltipItems) {
                            const item = tooltipItems[0];
                            let label = item.chart.data.labels[item.dataIndex];
                            return Array.isArray(label) ? label.join(' ') : label;
                        }
                    }
                }
            }
        }
    });
}

function formatApiResponseToHtmlList(rawText, isCheckboxList = false, wakeWindowItemId = null) {
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

async function fetchAIResponse(prompt) {
    const provider = localStorage.getItem(AI_PROVIDER_KEY) || 'gemini';
    const geminiApiKey = localStorage.getItem(GEMINI_API_KEY_KEY);
    const geminiModel = localStorage.getItem(GEMINI_MODEL_KEY) || 'gemini-2.0-flash';
    const genericApiKey = localStorage.getItem(API_KEY_KEY);
    const endpoint = localStorage.getItem(ENDPOINT_KEY);
    const modelDeploymentName = localStorage.getItem(MODEL_DEPLOYMENT_NAME_KEY);

    let apiUrl = '';
    let headers = {};
    let body = {};
    const hardcodedMaxTokens = 1250;

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
            apiUrl = `${endpoint.replace(/\/$/, "")}/openai/deployments/${modelDeploymentName}/chat/completions?api-version=2023-05-15`;
            body = {
                messages: [{ role: "user", content: prompt }],
                max_tokens: hardcodedMaxTokens
            };
        } else if (endpoint) {
            apiUrl = `${endpoint.replace(/\/$/, "")}/v1/chat/completions`;
            body = {
                model: modelDeploymentName || "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: hardcodedMaxTokens
            };
        } else {
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
            return { error: `API request failed: ${errorData.message || response.statusText}` };
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
        return { error: 'Unknown error processing AI response.' };

    } catch (error) {
        console.error('Fetch error:', error);
        return { error: `Network or other error: ${error.message}` };
    }
}

async function fetchActivitySuggestions(durationMinutes, suggestionsContainerId, ageInMonths, wakeWindowItemId) {
    const suggestionsContainer = document.getElementById(suggestionsContainerId);
    activeSuggestionsBoxId = suggestionsContainerId;

    suggestionsContainer.innerHTML = '<div class="loading-spinner"></div> <p class="text-center text-sm">✨ Fetching ideas...</p>';
    suggestionsContainer.classList.remove('hidden');

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.classList.add('suggestion-close-button');
    closeButton.onclick = () => {
        suggestionsContainer.classList.add('hidden');
        suggestionsContainer.innerHTML = '';
        activeSuggestionsBoxId = null;
    };

    let locationInfo = "";
    if (userLocation) {
        if (typeof userLocation === 'string') {
            if (userLocation.startsWith("Lat:")) {
                locationInfo = ` for the area around ${userLocation}. In your response, please refer to this location using a general area name (like 'your local park' or 'your neighborhood') or as 'your general area', rather than stating the specific coordinates.`;
            } else {
                const locationName = userLocation.split(',')[0].trim();
                if (locationName) locationInfo = ` near ${locationName}`;
            }
        } else if (userLocation.name) {
            locationInfo = ` near ${userLocation.name}`;
        }
    }

    let ageInfo = "";
    if (ageInMonths && !isNaN(ageInMonths) && ageInMonths >= 0) {
        ageInfo = ` for a ${ageInMonths}-month-old baby`;
    }

    const numSuggestions = 5;
    const prompt = `Suggest ${numSuggestions} distinct, engaging, and safe play activities${ageInfo} suitable for a ${formatDurationForDisplay(durationMinutes)} wake window${locationInfo}. Each suggested activity (or a combination of a few of them if they are shorter) should be substantial enough to help fill this wake window duration. If suggesting specific types of places (e.g., park, library), mention them generally. Focus on activities that mostly don't require special equipment beyond what one might find at such a place or at home. Format each suggestion as a simple list item starting with a dash or asterisk (e.g., '- **Activity Title:** Description.'). If you provide an introductory sentence, please ensure it is clearly separated from the list items (e.g., by a blank line). Ensure the full description for each activity is provided and not cut off.`;

    try {
        const result = await fetchAIResponse(prompt);
        suggestionsContainer.innerHTML = '';
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

                const currentSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {};
                const activityKey = `wakeWindow_${wakeWindowItemId}_activities`;
                currentSettings[activityKey] = selectedActivities;
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentSettings));

                suggestionsContainer.classList.add('hidden');
                suggestionsContainer.innerHTML = '';
                activeSuggestionsBoxId = null;
                updateTimeline(true);
            };
            suggestionsContainer.appendChild(saveButton);
        } else {
            suggestionsContainer.insertAdjacentHTML('beforeend', '<p class="text-red-500 text-sm">Could not fetch suggestions (empty response).</p>');
        }
    } catch (error) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.appendChild(closeButton);
        suggestionsContainer.insertAdjacentHTML('beforeend', `<p class="text-red-500 text-sm">Error: ${error.message}</p>`);
    }
}

async function fetchGeneralSleepTips(ageInMonths) {
    const tipsContent = document.getElementById('sleepTipsContent');
    openModal('sleepTipsModal');
    tipsContent.innerHTML = '<div class="loading-spinner"></div> <p class="text-center text-sm">✨ Fetching tips...</p>';

    let ageInfo = "";
    if (ageInMonths && !isNaN(ageInMonths) && ageInMonths >= 0) {
        ageInfo = ` appropriate for a ${ageInMonths}-month-old baby`;
    }

    const prompt = `Provide 3 concise, actionable sleep tips${ageInfo}. Focus on environment, consistency, and cues. Format each as a distinct list item, starting with '*' or '-'. For titles or key phrases within each tip, use **double asterisks** for bolding.`;
    try {
        const result = await fetchAIResponse(prompt);
        if (result.text) {
            tipsContent.innerHTML = formatApiResponseToHtmlList(result.text);
        } else {
            tipsContent.innerHTML = '<p class="text-red-500 text-sm">Could not fetch tips (empty response).</p>';
        }
    } catch (error) {
        tipsContent.innerHTML = `<p class="text-red-500 text-sm">Error: ${error.message}</p>`;
    }
}

function openModal(modalId) { document.getElementById(modalId).style.display = 'block'; }
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }

function saveSettingsToLocalStorage() {
    const settings = {
        planningMode: document.querySelector('input[name="planningMode"]:checked').value,
        wakeUpTime: document.getElementById('wakeUpTime').value,
        currentActivityType: document.getElementById('currentActivityType').value,
        currentActivityEndTime: document.getElementById('currentActivityEndTime').value,
        babyAge: document.getElementById('babyAge').value,
        location: document.getElementById('locationInput').value,
        wakeWindows: Array.from(document.querySelectorAll('#wakeWindowInputsContainer .wake-window-duration')).map(input => input.value),
        naps: Array.from(document.querySelectorAll('#napInputsContainer .nap-duration')).map(input => input.value),
        desiredBedtime: document.getElementById('desiredBedtime').value,
        aiFeaturesEnabled: localStorage.getItem(AI_FEATURES_KEY) === 'true'
    };
    const existingSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {};
    Object.keys(existingSettings).forEach(key => {
        if (key.includes('_activities')) {
            settings[key] = existingSettings[key];
        }
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    console.log("Settings saved:", settings);
}

function loadSettingsFromLocalStorage() {
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            console.log("Loaded settings from localStorage:", settings);

            const planningModeRadio = document.querySelector(`input[name="planningMode"][value="${settings.planningMode}"]`);
            if (planningModeRadio) planningModeRadio.checked = true;

            document.getElementById('wakeUpTime').value = settings.wakeUpTime || "07:00";
            document.getElementById('currentActivityType').value = settings.currentActivityType || "awake";
            document.getElementById('currentActivityEndTime').value = settings.currentActivityEndTime || "";
            document.getElementById('babyAge').value = settings.babyAge || "";
            document.getElementById('locationInput').value = settings.location || "";
            if(settings.location) {
                userLocation = settings.location;
                const locationStatus = document.getElementById('locationStatus');
                if (settings.location.startsWith("Lat:")) {
                    if(locationStatus) locationStatus.textContent = "Using saved geolocation.";
                    if(locationStatus) locationStatus.classList.add('text-green-500', 'dark:text-green-400');
                } else {
                    if(locationStatus) locationStatus.textContent = "Using saved manual location.";
                }
            }

            populateDurationInputs('wakeWindowInputsContainer', 'wake-window-duration', 'WW', settings.wakeWindows);
            populateDurationInputs('napInputsContainer', 'nap-duration', 'Nap', settings.naps);

            document.getElementById('desiredBedtime').value = settings.desiredBedtime || "19:30";

            if (settings.aiFeaturesEnabled !== undefined) {
                localStorage.setItem(AI_FEATURES_KEY, settings.aiFeaturesEnabled.toString());
            }

            const event = new Event('change');
            const planningModeChecked = document.querySelector('input[name="planningMode"]:checked');
            if(planningModeChecked) planningModeChecked.dispatchEvent(event);
            console.log("Settings applied to form.");

        } catch (e) {
            console.error("Error parsing settings from localStorage:", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            populateDurationInputs('wakeWindowInputsContainer', 'wake-window-duration', 'WW', []);
            populateDurationInputs('napInputsContainer', 'nap-duration', 'Nap', []);
        }
    } else {
        populateDurationInputs('wakeWindowInputsContainer', 'wake-window-duration', 'WW', []);
        populateDurationInputs('napInputsContainer', 'nap-duration', 'Nap', []);
    }
}

function setInitialTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.getElementById('darkModeToggle').querySelector('.light-mode-icon').classList.add('hidden');
        document.getElementById('darkModeToggle').querySelector('.dark-mode-icon').classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('darkModeToggle').querySelector('.light-mode-icon').classList.remove('hidden');
        document.getElementById('darkModeToggle').querySelector('.dark-mode-icon').classList.add('hidden');
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    document.getElementById('darkModeToggle').querySelector('.light-mode-icon').classList.toggle('hidden', isDark);
    document.getElementById('darkModeToggle').querySelector('.dark-mode-icon').classList.toggle('hidden', !isDark);
    if (durationChartInstance) updateDurationChart();
}

function applyAiFeaturesState(enabled) {
    localStorage.setItem(AI_FEATURES_KEY, enabled.toString());
    const aiToggle = document.getElementById('aiFeaturesToggle');
    const aiSettingsBtn = document.getElementById('aiSettingsButton');
    const aiOnIcon = aiToggle ? aiToggle.querySelector('.ai-on-icon') : null;
    const aiOffIcon = aiToggle ? aiToggle.querySelector('.ai-off-icon') : null;
    const geminiFeaturesSection = document.getElementById('gemini-features');

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
        if (activeSuggestionsBoxId) {
            const openBox = document.getElementById(activeSuggestionsBoxId);
            if (openBox) {
                openBox.classList.add('hidden');
                openBox.innerHTML = '';
                activeSuggestionsBoxId = null;
            }
        }
    }
    updateTimeline(true);
}

function toggleAiFeatures() {
    let aiEnabled = localStorage.getItem(AI_FEATURES_KEY) === 'true';
    aiEnabled = !aiEnabled;
    localStorage.setItem(AI_FEATURES_KEY, aiEnabled.toString());
    applyAiFeaturesState(aiEnabled);
    saveSettingsToLocalStorage();
}

function setInitialAiFeaturesState() {
    const savedAiState = localStorage.getItem(AI_FEATURES_KEY);
    const aiEnabled = savedAiState === 'true';
    localStorage.setItem(AI_FEATURES_KEY, aiEnabled.toString());
    applyAiFeaturesState(aiEnabled);
}

function initializeCurrentTimeDisplay() {
    const currentTimeEl = document.getElementById('currentTimeDisplay');
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(new Date(), true);
        setInterval(() => {
            currentTimeEl.textContent = formatTime(new Date(), true);
        }, 1000);
    }
}

function initializePlanningModeToggle() {
    const planningModeRadios = document.querySelectorAll('input[name="planningMode"]');
    const fullDayInputs = document.getElementById('fullDayInputs');
    const fromNowInputs = document.getElementById('fromNowInputs');

    function toggleInputs(mode) {
        if (mode === 'fullDay') {
            fullDayInputs.classList.remove('hidden');
            fromNowInputs.classList.add('hidden');
        } else {
            fullDayInputs.classList.add('hidden');
            fromNowInputs.classList.remove('hidden');
            const currentActivityEndTimeInput = document.getElementById('currentActivityEndTime');
            if (!currentActivityEndTimeInput.value) {
                const now = new Date();
                currentActivityEndTimeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
        }
    }
    planningModeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            toggleInputs(event.target.value);
            saveSettingsToLocalStorage();
        });
    });
    const currentMode = document.querySelector('input[name="planningMode"]:checked').value;
    toggleInputs(currentMode);
}

function initializeEventListeners() {
    document.getElementById('scheduleSettingsForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const planningMode = document.querySelector('input[name="planningMode"]:checked').value;
        const settings = {
            wakeUpTimeStr: document.getElementById('wakeUpTime').value,
            currentActivityType: document.getElementById('currentActivityType').value,
            currentActivityEndTimeStr: document.getElementById('currentActivityEndTime').value,
            wakeWindowDurations: Array.from(document.querySelectorAll('#wakeWindowInputsContainer .wake-window-duration')).map(input => input.value),
            napDurations: Array.from(document.querySelectorAll('#napInputsContainer .nap-duration')).map(input => input.value),
            desiredBedtimeStr: document.getElementById('desiredBedtime').value,
            babyAge: parseInt(document.getElementById('babyAge').value)
        };

        if (generateSchedule(planningMode, settings)) {
            document.getElementById('scheduleOutputContainer').classList.remove('hidden');
            document.getElementById('initialMessage').classList.add('hidden');
            updateTimeline(true);
            updateDurationChart();
            displayScheduleSummary(generatedScheduleData);
            saveSettingsToLocalStorage();
            if (timelineUpdateIntervalId) clearInterval(timelineUpdateIntervalId);
            timelineUpdateIntervalId = setInterval(updateActiveTimelineStates, 30000);
        } else {
            document.getElementById('scheduleOutputContainer').classList.add('hidden');
            document.getElementById('initialMessage').classList.remove('hidden');
        }
    });

    document.getElementById('applyAgeDefaultsButton').addEventListener('click', () => {
        const ageInput = document.getElementById('babyAge');
        const ageInMonths = parseInt(ageInput.value);
        if (isNaN(ageInMonths) || ageInMonths < 0) {
            displayFormError(["Please enter a valid age in months."]);
            return;
        }
        displayFormError([]);
        const defaults = getAgeDefaults(ageInMonths);

        const wakeWindows = defaults.wakeWindows.filter(ww => ww.trim() !== "");
        const naps = defaults.naps.filter(n => n.trim() !== "");

        populateDurationInputs('wakeWindowInputsContainer', 'wake-window-duration', 'WW', wakeWindows);
        populateDurationInputs('napInputsContainer', 'nap-duration', 'Nap', naps);
        saveSettingsToLocalStorage();
    });

    document.getElementById('addWakeWindowButton').addEventListener('click', () => {
        addDurationInput('wakeWindowInputsContainer', 'wake-window-duration', 'WW');
        updateRemoveButtonState('wakeWindowInputsContainer');
    });

    document.getElementById('removeWakeWindowButton').addEventListener('click', () => {
        const container = document.getElementById('wakeWindowInputsContainer');
        if (container.children.length > 0) {
            const lastInputWrapper = container.lastElementChild;
            if (lastInputWrapper) container.removeChild(lastInputWrapper);
        }
        updateRemoveButtonState('wakeWindowInputsContainer');
        if (container.children.length === 0) {
            addDurationInput('wakeWindowInputsContainer', 'wake-window-duration', 'WW');
            updateRemoveButtonState('wakeWindowInputsContainer');
        }
    });

    document.getElementById('addNapButton').addEventListener('click', () => {
        addDurationInput('napInputsContainer', 'nap-duration', 'Nap');
        updateRemoveButtonState('napInputsContainer');
    });

    document.getElementById('removeNapButton').addEventListener('click', () => {
        const container = document.getElementById('napInputsContainer');
        if (container.children.length > 0) {
            const lastInputWrapper = container.lastElementChild;
            if (lastInputWrapper) container.removeChild(lastInputWrapper);
        }
        updateRemoveButtonState('napInputsContainer');
        if (container.children.length === 0) {
            addDurationInput('napInputsContainer', 'nap-duration', 'Nap');
            updateRemoveButtonState('napInputsContainer');
        }
    });

    document.getElementById('useCurrentLocationButton').addEventListener('click', () => {
        const locationStatusEl = document.getElementById('locationStatus');
        if (navigator.geolocation) {
            locationStatusEl.textContent = "Fetching location...";
            navigator.geolocation.getCurrentPosition(position => {
                userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                document.getElementById('locationInput').value = `Lat: ${userLocation.latitude.toFixed(4)}, Lon: ${userLocation.longitude.toFixed(4)}`;
                locationStatusEl.textContent = "Location captured! Suggestions will use this.";
                locationStatusEl.classList.add('text-green-500', 'dark:text-green-400');
                saveSettingsToLocalStorage();
            }, error => {
                console.error("Error getting location:", error);
                userLocation = null;
                locationStatusEl.textContent = `Error: ${error.message}. You can enter manually.`;
                locationStatusEl.classList.remove('text-green-500', 'dark:text-green-400');
            });
        } else {
            locationStatusEl.textContent = "Geolocation is not supported by your browser.";
        }
    });

    document.getElementById('locationInput').addEventListener('change', () => {
        userLocation = document.getElementById('locationInput').value;
        document.getElementById('locationStatus').textContent = "Manual location entered.";
        document.getElementById('locationStatus').classList.remove('text-green-500', 'dark:text-green-400');
        saveSettingsToLocalStorage();
    });


    document.getElementById('getSleepTipsButton').addEventListener('click', () => {
        const ageInMonths = parseInt(document.getElementById('babyAge').value);
        fetchGeneralSleepTips(isNaN(ageInMonths) ? null : ageInMonths);
    });

    document.getElementById('darkModeToggle').addEventListener('click', toggleTheme);
    document.getElementById('aiFeaturesToggle').addEventListener('click', toggleAiFeatures);

    document.getElementById('clearSettingsButton').addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all saved settings and reset the form?")) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            document.getElementById('scheduleSettingsForm').reset();

            loadSettingsFromLocalStorage();

            generatedScheduleData = [];
            updateTimeline(true);
            if(durationChartInstance) { durationChartInstance.destroy(); durationChartInstance = null; }
            document.getElementById('scheduleOutputContainer').classList.add('hidden');
            document.getElementById('initialMessage').classList.remove('hidden');
            const summaryContent = document.getElementById('scheduleSummaryContent');
            if(summaryContent) summaryContent.innerHTML = '';
            const summarySection = document.getElementById('scheduleSummarySection');
            if(summarySection) summarySection.classList.add('hidden');
            displayFormError([]);

            const event = new Event('change');
            const planningModeChecked = document.querySelector('input[name="planningMode"]:checked');
            if(planningModeChecked) planningModeChecked.dispatchEvent(event);

            initializeCurrentTimeDisplay();
        }
    });
}

function populateDurationInputs(containerId, inputClass, placeholderPrefix, values) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID ${containerId} not found for populating inputs.`);
        return;
    }
    container.innerHTML = '';

    const valuesToRender = (Array.isArray(values) && values.length > 0) ? values : [""];

    valuesToRender.forEach(val => {
        addDurationInput(containerId, inputClass, placeholderPrefix, typeof val === 'string' ? val : "");
    });

    if (container.children.length === 0) {
        addDurationInput(containerId, inputClass, placeholderPrefix, "");
    }
    updateRemoveButtonState(containerId);
}

function addDurationInput(containerId, inputClass, placeholderPrefix, value = "") {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found in addDurationInput`);
        return;
    }

    const inputWrapper = document.createElement('div');
    inputWrapper.classList.add('input-field-wrapper');

    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.classList.add('form-input', inputClass, 'form-input-dynamic-width');
    newInput.placeholder = `${placeholderPrefix} ${container.querySelectorAll('.' + inputClass).length + 1}`;
    newInput.value = value;
    newInput.addEventListener('input', adjustInputWidth);
    adjustInputWidth({ target: newInput });

    inputWrapper.appendChild(newInput);
    container.appendChild(inputWrapper);
}

function updateRemoveButtonState(containerId) {
    const container = document.getElementById(containerId);
    let removeButtonId;
    if (containerId === 'wakeWindowInputsContainer') {
        removeButtonId = 'removeWakeWindowButton';
    } else if (containerId === 'napInputsContainer') {
        removeButtonId = 'removeNapButton';
    } else {
        return;
    }

    const removeButton = document.getElementById(removeButtonId);
    if (removeButton) {
        removeButton.disabled = container.children.length <= 1;
    }
}

function adjustInputWidth(event) {
    const input = event.target;
    input.style.width = 'auto';
    const placeholderWidth = input.placeholder.length * 8 + 10;
    const valueWidth = input.value.length * 8 + 20;
    input.style.width = Math.max(placeholderWidth, valueWidth, 70) + 'px';
}

document.addEventListener('DOMContentLoaded', () => {
    setInitialTheme();
    setInitialAiFeaturesState();
    loadSettingsFromLocalStorage();
    initializeCurrentTimeDisplay();
    initializePlanningModeToggle();
    initializeEventListeners();

    const currentYearEl = document.getElementById('currentYear');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear().toString();
    }

    const wakeContainer = document.getElementById('wakeWindowInputsContainer');
    if (wakeContainer && wakeContainer.children.length === 0) {
        console.warn("DOMContentLoaded: Wake window inputs container is empty, forcing add.");
        addDurationInput('wakeWindowInputsContainer', 'wake-window-duration', 'WW');
        updateRemoveButtonState('wakeWindowInputsContainer');
    }
    const napContainer = document.getElementById('napInputsContainer');
    if (napContainer && napContainer.children.length === 0) {
        console.warn("DOMContentLoaded: Nap inputs container is empty, forcing add.");
        addDurationInput('napInputsContainer', 'nap-duration', 'Nap');
        updateRemoveButtonState('napInputsContainer');
    }

    aiProviderSelect = document.getElementById('aiProviderSelect');

    geminiApiKeyInputContainer = document.getElementById('geminiApiKeyInputContainer');
    geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    geminiModelInput = document.getElementById('geminiModelInput');

    openaiCompatibleInputContainer = document.getElementById('openaiCompatibleInputContainer');
    apiKeyInput = document.getElementById('apiKeyInput');
    endpointInput = document.getElementById('endpointInput');
    modelDeploymentInputContainer = document.getElementById('modelDeploymentInputContainer');
    modelDeploymentNameInput = document.getElementById('modelDeploymentNameInput');
    numSuggestionsInput = document.getElementById('numSuggestionsInput');
    saveAiProviderSettingsButton = document.getElementById('saveAiProviderSettings');

    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', handleAiProviderChange);
    }
    if (endpointInput) {
        endpointInput.addEventListener('input', handleEndpointChange);
    }
    if (saveAiProviderSettingsButton) {
        saveAiProviderSettingsButton.addEventListener('click', saveAiProviderSettingsToStorage);
    }

    loadAiProviderSettingsFromStorage();

    if (typeof generatedScheduleData !== 'undefined' && generatedScheduleData.length >= 0) {
        updateTimeline(true);
    }

    // Add html2canvas script for image generation
    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    html2canvasScript.crossOrigin = 'anonymous';
    html2canvasScript.referrerPolicy = 'no-referrer';
    document.head.appendChild(html2canvasScript);

    loadSettingsFromLocalStorage();
    setInitialTheme(); // Correct function to call for initial theme setting
    applyAiFeaturesState(localStorage.getItem(AI_FEATURES_KEY) !== 'false'); // Default to true if not set
    updateTimeline(true); // Initial draw with placeholder or empty state

    if (timelineUpdateIntervalId) clearInterval(timelineUpdateIntervalId);
    timelineUpdateIntervalId = setInterval(updateActiveTimelineStates, 5000); // Update active states every 5 seconds

    // Share Schedule Button Event Listener
    const shareScheduleButton = document.getElementById('shareScheduleButton');
    if (shareScheduleButton) {
        shareScheduleButton.addEventListener('click', handleShareSchedule);
    }
});

async function handleShareSchedule() {
    const scheduleTimelineElement = document.getElementById('schedule-timeline');

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

    try {
        const shareButton = document.getElementById('shareScheduleButton');
        if (shareButton) {
            shareButton.style.display = 'none';
        }

        // Temporarily remove or adjust elements that might interfere with layout
        const scheduleStatusElement = document.getElementById('schedule-status');
        let originalStatusDisplay = '';
        if (scheduleStatusElement) {
            originalStatusDisplay = scheduleStatusElement.style.display;
            scheduleStatusElement.style.display = 'none';
        }

        const canvas = await html2canvas(scheduleTimelineElement, {
            scale: 2,
            useCORS: true,
            logging: false, // Disable extensive logging from html2canvas itself
            backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff', // Adjusted dark bg
            onclone: (clonedDoc) => {
                const clonedTimeline = clonedDoc.getElementById('schedule-timeline');
                if (clonedTimeline) {
                    // Hide the original H2 title if it exists in the clone
                    const originalTitle = clonedTimeline.querySelector('h2');
                    if (originalTitle) {
                        originalTitle.style.display = 'none';
                    }

                    clonedTimeline.style.paddingTop = '20px';
                    const titleElement = clonedDoc.createElement('h2');
                    titleElement.textContent = "Today's Plan";
                    titleElement.style.textAlign = 'center';
                    titleElement.style.fontSize = '1.5rem';
                    titleElement.style.fontWeight = '600';
                    titleElement.style.marginBottom = '1.5rem';

                    // Determine accent color based on theme for the title
                    // This attempts to match the .accent-text color dynamically
                    let accentTextColor = '#3B82F6'; // Default blue for light mode
                    if (document.documentElement.classList.contains('dark')) {
                        // Attempt to get the computed style of an element with .accent-text
                        // This is a bit of a hack for html2canvas, as direct class application might not work
                        // We'll use a known dark mode accent color as a fallback
                        accentTextColor = '#60A5FA'; // Default blue for dark mode (tailwind blue-400)
                        // A more robust way would be to have these colors defined in JS or CSS variables accessible here
                    }
                    titleElement.style.color = accentTextColor;

                    const timelineContainerInClone = clonedDoc.getElementById('timelineContainer');
                    if (timelineContainerInClone && timelineContainerInClone.parentNode === clonedTimeline) {
                         clonedTimeline.insertBefore(titleElement, timelineContainerInClone);
                    } else {
                        clonedTimeline.insertBefore(titleElement, clonedTimeline.firstChild);
                    }
                }

                const suggestButtons = clonedDoc.querySelectorAll('.gemini-button');
                suggestButtons.forEach(btn => {
                    if (btn.textContent.includes('Suggest Activities')) {
                        btn.style.display = 'none';
                    }
                });
            }
        });

        if (shareButton) {
            shareButton.style.display = '';
        }
        if (scheduleStatusElement) {
            scheduleStatusElement.style.display = originalStatusDisplay;
        }

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
                // Fallback for when files cannot be shared
                const link = document.createElement('a');
                link.href = imageDataUrl;
                link.download = 'sparkle-dreams-schedule.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                alert('Schedule image downloaded! Web Share API cannot share this file type.');
            }
        } else {
            // Fallback for when Web Share API is not available
            const link = document.createElement('a');
            link.href = imageDataUrl;
            link.download = 'sparkle-dreams-schedule.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert('Schedule image downloaded! You can share it from your downloads.');
        }
    } catch (error) {
        console.error('Error during schedule image generation or sharing:', error);
        alert('Sorry, there was an error creating the schedule image. Check console for details.');
        const shareButton = document.getElementById('shareScheduleButton');
        if (shareButton) {
            shareButton.style.display = '';
        }
        const scheduleStatusElement = document.getElementById('schedule-status');
        if (scheduleStatusElement) {
            scheduleStatusElement.style.display = originalStatusDisplay;
        }
    }
}
window.closeModal = closeModal;
