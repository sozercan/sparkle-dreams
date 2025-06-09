import { parseDurationToMinutes, formatTime, addMinutes, parseTimeToDate, displayFormError, parseTimeForUpdate } from './utils.js';

let generatedScheduleData = []; // This will likely be managed outside and passed in or returned

export function generateSchedule(planningMode, settings) {
    generatedScheduleData = []; // Reset internal holder
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
        return { success: false, data: [], errorMessages: errors };
    }
    displayFormError([]); // Clear previous errors if any

    if (!currentTime) { // Should be caught by earlier checks, but as a safeguard
        errors.push("Cannot determine schedule start time.");
        displayFormError(errors);
        return { success: false, data: [], errorMessages: errors };
    }
    if (!bedtimeTarget) { // Should be caught by earlier checks
        errors.push("Cannot determine desired bedtime.");
        displayFormError(errors);
        return { success: false, data: [], errorMessages: errors };
    }

    if (bedtimeTarget <= currentTime) {
        bedtimeTarget.setDate(bedtimeTarget.getDate() + 1);
    }

    const scheduleLimit = new Date(currentTime);
    scheduleLimit.setDate(scheduleLimit.getDate() + 1);
    scheduleLimit.setHours(6, 0, 0, 0); // Don't schedule past 6 AM of the "next" day

    let eventCounter = 1;
    let wakeWindowIndex = 0;
    let napIndex = 0;
    let isWakePeriod = initialIsWakePeriod;

    while (currentTime < bedtimeTarget && currentTime < scheduleLimit) {
        const periodStart = new Date(currentTime);
        let periodEnd;
        let periodDuration;
        let periodName;
        let periodType;

        if (isWakePeriod) {
            if (wakeWindowIndex >= finalWakeWindows.length) { // No more defined wake windows
                // Calculate remaining time until bedtime as the final wake window
                periodDuration = (bedtimeTarget.getTime() - currentTime.getTime()) / (60 * 1000);
                if (periodDuration <= 15) { // If less than 15 mins, just end at bedtime
                    currentTime = new Date(bedtimeTarget); // Align currentTime to bedtimeTarget
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
                break; // End of schedule
            }
            periodDuration = finalWakeWindows[wakeWindowIndex];
            periodEnd = addMinutes(currentTime, periodDuration);
            periodName = `Wake Window ${wakeWindowIndex + 1}`;
            periodType = "Wake";
        } else { // Napping period
            if (napIndex >= finalNaps.length) { // No more defined naps, try to make last wake window go to bedtime
                 if (generatedScheduleData.length > 0) {
                    const lastEvent = generatedScheduleData[generatedScheduleData.length - 1];
                    if (lastEvent.type === "Wake") { // Adjust last wake window to go until bedtime
                        const lastWakeStart = parseTimeForUpdate(lastEvent.start);
                        const durationToBedtime = (bedtimeTarget.getTime() - lastWakeStart.getTime()) / (60 * 1000);
                        if (durationToBedtime > 15) { // Only adjust if it's a meaningful duration
                            lastEvent.durationMinutes = Math.round(durationToBedtime);
                            lastEvent.end = formatTime(bedtimeTarget);
                            lastEvent.name = lastEvent.name.replace(" (Final)", "") + " (Final)"; // Ensure it's marked final
                        } else {
                            // If the remaining time is too short, it might be better to remove the short wake window
                            // or let the previous nap extend. For now, we just break.
                        }
                    }
                }
                currentTime = new Date(bedtimeTarget); // Align currentTime to bedtimeTarget
                break; // End of schedule as no more naps to schedule
            }

            const currentNapDuration = finalNaps[napIndex];
            const napEndTime = addMinutes(currentTime, currentNapDuration);

            // Check if this nap would push us too close to or past bedtime, or if there's not enough time for a subsequent reasonable wake window
            let timeAvailableForNextWakeAfterThisNap = (bedtimeTarget.getTime() - napEndTime.getTime()) / (60 * 1000);
            const minNextWakeWindow = (wakeWindowIndex < finalWakeWindows.length) ? finalWakeWindows[wakeWindowIndex] : 60; // Default to 60 min if no specific next WW

            if (napEndTime >= bedtimeTarget || timeAvailableForNextWakeAfterThisNap < (minNextWakeWindow * 0.75) ) { // If nap ends too late or not enough time for ~75% of next WW
                // Don't schedule this nap. Instead, make the previous wake window go until bedtime.
                if (generatedScheduleData.length > 0) {
                    const lastEvent = generatedScheduleData[generatedScheduleData.length - 1];
                    if (lastEvent.type === "Wake") {
                        const lastWakeStart = parseTimeForUpdate(lastEvent.start);
                        const durationToBedtime = (bedtimeTarget.getTime() - lastWakeStart.getTime()) / (60 * 1000);
                        if (durationToBedtime > 15) { // Only adjust if it's a meaningful duration
                            lastEvent.durationMinutes = Math.round(durationToBedtime);
                            lastEvent.end = formatTime(bedtimeTarget);
                            lastEvent.name = lastEvent.name.replace(" (Final)", "") + " (Final)";
                        } else {
                            // If the remaining time for the wake window is too short, it might be better to remove it.
                            // For now, we let it be very short or rely on the loop break.
                        }
                    }
                }
                currentTime = new Date(bedtimeTarget); // Align currentTime to bedtimeTarget
                break; // End of schedule
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

    // Ensure currentTime reflects the end of the last actual event or desired bedtime if loop terminated early
    let actualCalculatedBedtime = new Date(currentTime.getTime());
    if (generatedScheduleData.length > 0) {
        const lastScheduledEvent = generatedScheduleData[generatedScheduleData.length - 1];
        if (lastScheduledEvent.type !== "System" && lastScheduledEvent.end) {
             actualCalculatedBedtime = parseTimeForUpdate(lastScheduledEvent.end);
        } else if (lastScheduledEvent.type === "System" && lastScheduledEvent.start) {
            // If only a system event exists, bedtime is effectively the start of planning
            actualCalculatedBedtime = parseTimeForUpdate(lastScheduledEvent.start);
        }
    }
    // If the loop finished because currentTime reached bedtimeTarget, actualCalculatedBedtime should be bedtimeTarget
    if (currentTime >= bedtimeTarget) {
        actualCalculatedBedtime = new Date(bedtimeTarget.getTime());
    }


    // Remove any existing "Bedtime" event before adding the final one
    const existingBedtimeIndex = generatedScheduleData.findIndex(event => event.type === "Bedtime");
    if (existingBedtimeIndex > -1) {
        generatedScheduleData.splice(existingBedtimeIndex, 1);
    }

    // Add the final Bedtime event
    generatedScheduleData.push({
        id: `bedtime`,
        name: "Bedtime",
        start: formatTime(actualCalculatedBedtime),
        end: null,
        durationMinutes: null,
        type: "Bedtime"
    });

    let warningMessage = null;
    if (bedtimeTarget && actualCalculatedBedtime.getTime() > bedtimeTarget.getTime() + (5 * 60000)) { // More than 5 mins past desired
        const desiredBedtimeFormatted = formatTime(bedtimeTarget);
        const actualBedtimeFormatted = formatTime(actualCalculatedBedtime);
        warningMessage = `Warning: Calculated bedtime (${actualBedtimeFormatted}) is later than desired bedtime (${desiredBedtimeFormatted}).`;
        displayFormError([warningMessage]); // Display warning
    }

    return { success: true, data: generatedScheduleData, warning: warningMessage };
}
