// js/utils.js
export function parseDurationToMinutes(durationStr, fieldName) {
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

export function formatTime(dateObj, includeSeconds = false) {
    const options = { hour: 'numeric', minute: '2-digit' };
    if (includeSeconds) options.second = '2-digit';
    return dateObj.toLocaleTimeString(undefined, options);
}

export function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

export function parseTimeToDate(timeStr, fieldName) {
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

export function parseTimeForUpdate(timeStr) {
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
    return new Date(); // Fallback, though ideally this should not be reached if inputs are validated
}

export function formatDurationForDisplay(minutes) {
    if (minutes === null) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let durationStr = "";
    if (h > 0) durationStr += `${h}h `;
    if (m > 0) durationStr += `${m}min`;
    return durationStr.trim() || "0min";
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        // For accessibility, consider managing focus when modal opens
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        // For accessibility, consider returning focus to the element that opened the modal
    }
}

export function displayFormError(messages, errorAreaElement) {
    if (!errorAreaElement) {
        console.warn("displayFormError called without an errorAreaElement.");
        return;
    }
    if (!Array.isArray(messages)) messages = [messages];

    if (messages.length > 0 && messages.some(msg => msg && msg.trim() !== '')) {
        errorAreaElement.innerHTML = '<ul>' + messages.filter(msg => msg && msg.trim() !== '').map(msg => `<li>- ${msg}</li>`).join('') + '</ul>';
        errorAreaElement.classList.remove('hidden');
    } else {
        errorAreaElement.classList.add('hidden');
        errorAreaElement.innerHTML = '';
    }
}

export function adjustInputWidth(event) {
    const input = event.target;
    input.style.width = 'auto'; // Reset width to get natural width
    const placeholderWidth = input.placeholder.length * 8 + 10; // Approximate width for placeholder
    const valueWidth = input.value.length * 8 + 20; // Approximate width for value, +20 for padding/border
    input.style.width = Math.max(placeholderWidth, valueWidth, 70) + 'px'; // Ensure a minimum width
}
