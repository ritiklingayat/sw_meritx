/**
 * Centralized Examination Scheduling, Window Calculation & Status Engine
 * LGW-MERITX Examination Management System
 */

/**
 * Format a Date or ISO string into localized IST date-time string
 * Example: "15 Nov 2026, 10:00 AM"
 */
export function formatDateTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format Date only
 * Example: "15 Nov 2026"
 */
export function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format Time only
 * Example: "10:00 AM"
 */
export function formatTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format Date-Time range for exam window
 * Example: "15 Nov 2026 · 10:00 AM – 12:00 PM (120 mins window)"
 */
export function formatExamWindow(startIso, endIso) {
  if (!startIso) return "Schedule Pending";
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  if (isNaN(s.getTime())) return "Invalid Schedule";

  const dateStr = formatDate(startIso);
  const startTime = formatTime(startIso);
  const endTime = e && !isNaN(e.getTime()) ? formatTime(endIso) : "Open";
  return `${dateStr} · ${startTime} – ${endTime}`;
}

/**
 * Format milliseconds into readable countdown
 * Example: "14m 32s" or "2d 5h"
 */
export function formatCountdown(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const totalSecs = Math.floor(safe / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 1) {
    return `${days} days ${hours} hrs`;
  }
  if (days === 1) {
    return `1 day ${hours} hrs`;
  }
  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, "0")}m`;
  }
  return `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

/**
 * Parse an ISO date or local date string to datetime-local input value
 */
export function toDateTimeLocal(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    // Format YYYY-MM-DDTHH:mm
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Convert local datetime string (from input) to ISO string with timezone
 */
export function fromDateTimeLocal(val) {
  if (!val) return null;
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
}

/**
 * Helper to normalize dates from an exam object
 */
export function extractExamSchedule(exam) {
  const schedule = exam.schedule || {};
  
  // Start Time
  let startsAt = schedule.startsAt || exam.startsAt || exam.examStartDate || null;
  if (!startsAt && exam.date) {
    // If exam has date and time e.g. "2026-11-15" and "10:00 AM"
    const timeStr = exam.time || "10:00 AM";
    const [tPart, modifier] = timeStr.trim().split(" ");
    let [h, m] = (tPart || "10:00").split(":").map(Number);
    if (modifier?.toUpperCase() === "PM" && h < 12) h += 12;
    if (modifier?.toUpperCase() === "AM" && h === 12) h = 0;
    const isoDate = `${exam.date}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00+05:30`;
    startsAt = new Date(isoDate).toISOString();
  }

  // End Time
  let endsAt = schedule.endsAt || exam.endsAt || exam.examEndDate || null;
  if (!endsAt && startsAt) {
    const durationMins = Number(exam.duration || 180);
    endsAt = new Date(new Date(startsAt).getTime() + durationMins * 60000).toISOString();
  }

  // Registration Window
  let registrationOpensAt = schedule.registrationOpensAt || exam.registrationOpensAt || exam.registrationStartDate || null;
  let registrationClosesAt = schedule.registrationClosesAt || exam.registrationClosesAt || exam.registrationEndDate || null;

  if (!registrationOpensAt && startsAt) {
    // Default: Opens 14 days before start
    registrationOpensAt = new Date(new Date(startsAt).getTime() - 14 * 86400000).toISOString();
  }
  if (!registrationClosesAt && startsAt) {
    // Default: Closes 1 hour before start
    registrationClosesAt = new Date(new Date(startsAt).getTime() - 3600000).toISOString();
  }

  const duration = Number(exam.duration || 60);

  return {
    startsAt,
    endsAt,
    registrationOpensAt,
    registrationClosesAt,
    duration,
  };
}

/**
 * Calculate dynamic status for an examination at reference timestamp
 * 
 * Registration Statuses:
 * - "Upcoming Registration" (now < registrationOpensAt)
 * - "Registration Open" (registrationOpensAt <= now <= registrationClosesAt)
 * - "Registration Closed" (now > registrationClosesAt)
 * 
 * Examination Statuses:
 * - "Cancelled" (if explicitly marked cancelled)
 * - "Completed" (now > endsAt)
 * - "Live" (startsAt <= now <= endsAt)
 * - "Starting Soon" (startsAt - now <= 30 mins && now < startsAt)
 * - "Scheduled" (now < startsAt)
 */
export function getExamScheduleInfo(exam, referenceDate = new Date()) {
  if (!exam) {
    return {
      registrationStatus: "Registration Closed",
      isRegistrationOpen: false,
      examStatus: "Scheduled",
      isLive: false,
      isStartingSoon: false,
      isCompleted: false,
      isCancelled: false,
      countdownMs: 0,
      countdownText: "",
    };
  }

  const nowMs = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
  const { startsAt, endsAt, registrationOpensAt, registrationClosesAt, duration } = extractExamSchedule(exam);

  const regStartMs = registrationOpensAt ? new Date(registrationOpensAt).getTime() : 0;
  const regEndMs = registrationClosesAt ? new Date(registrationClosesAt).getTime() : Infinity;
  const examStartMs = startsAt ? new Date(startsAt).getTime() : 0;
  const examEndMs = endsAt ? new Date(endsAt).getTime() : Infinity;

  // Window duration in minutes
  const windowDurationMins = examStartMs && examEndMs && isFinite(examEndMs)
    ? Math.max(1, Math.round((examEndMs - examStartMs) / 60000))
    : duration;

  // 1. Calculate Registration Status
  let registrationStatus = "Registration Open";
  let isRegistrationOpen = true;
  let regCountdownMs = 0;

  if (exam.registrationOpen === false) {
    registrationStatus = "Registration Closed";
    isRegistrationOpen = false;
  } else if (regStartMs && nowMs < regStartMs) {
    registrationStatus = "Upcoming Registration";
    isRegistrationOpen = false;
    regCountdownMs = regStartMs - nowMs;
  } else if (regEndMs && nowMs > regEndMs) {
    registrationStatus = "Registration Closed";
    isRegistrationOpen = false;
  } else {
    registrationStatus = "Registration Open";
    isRegistrationOpen = true;
    if (regEndMs && isFinite(regEndMs)) {
      regCountdownMs = regEndMs - nowMs;
    }
  }

  // 2. Calculate Examination Status
  let examStatus = "Scheduled";
  let isLive = false;
  let isStartingSoon = false;
  let isCompleted = false;
  let isCancelled = exam.status === "cancelled";
  let countdownMs = 0;
  let countdownText = "";

  if (isCancelled) {
    examStatus = "Cancelled";
  } else if (examEndMs && nowMs > examEndMs) {
    examStatus = "Completed";
    isCompleted = true;
    countdownText = "Examination Ended";
  } else if (examStartMs && nowMs >= examStartMs && (!examEndMs || nowMs <= examEndMs)) {
    examStatus = "Live";
    isLive = true;
    const remainingInWindow = examEndMs - nowMs;
    countdownMs = remainingInWindow;
    countdownText = `LIVE · Closes in ${formatCountdown(remainingInWindow)}`;
  } else if (examStartMs && (examStartMs - nowMs <= 30 * 60 * 1000) && nowMs < examStartMs) {
    examStatus = "Starting Soon";
    isStartingSoon = true;
    countdownMs = examStartMs - nowMs;
    countdownText = `Starting in ${formatCountdown(countdownMs)}`;
  } else if (examStartMs && nowMs < examStartMs) {
    examStatus = "Scheduled";
    countdownMs = examStartMs - nowMs;
    countdownText = `Starts on ${formatDateTime(startsAt)}`;
  } else {
    examStatus = exam.status === "completed" ? "Completed" : "Scheduled";
  }

  return {
    registrationStatus,
    isRegistrationOpen,
    regCountdownMs,
    examStatus,
    isLive,
    isStartingSoon,
    isCompleted,
    isCancelled,
    canStartExam: isLive && !isCancelled,
    countdownMs,
    countdownText,
    startsAt,
    endsAt,
    registrationOpensAt,
    registrationClosesAt,
    durationMins: duration,
    windowDurationMins,
    proctoringRequired: exam.proctoringRequired !== false,
  };
}

/**
 * Validate scheduling form input before saving in Admin panel
 */
export function validateExamSchedule(form) {
  const errors = [];

  if (!form.title || !form.title.trim()) {
    errors.push("Examination Title is required.");
  }

  const duration = Number(form.duration);
  if (isNaN(duration) || duration <= 0) {
    errors.push("Examination Duration must be greater than 0 minutes.");
  }

  const fee = Number(form.fee);
  if (isNaN(fee) || fee < 0) {
    errors.push("Registration fee cannot be negative.");
  }

  const marks = Number(form.marks);
  if (isNaN(marks) || marks <= 0) {
    errors.push("Total Marks must be greater than 0.");
  }

  const passingMarks = Number(form.passingMarks);
  if (isNaN(passingMarks) || passingMarks < 0) {
    errors.push("Passing Marks cannot be negative.");
  } else if (passingMarks > marks) {
    errors.push("Passing Marks cannot exceed Total Marks.");
  }

  const startsAt = form.schedule?.startsAt || form.startsAt;
  const endsAt = form.schedule?.endsAt || form.endsAt;
  const regOpens = form.schedule?.registrationOpensAt || form.registrationOpensAt;
  const regCloses = form.schedule?.registrationClosesAt || form.registrationClosesAt;

  if (!startsAt) {
    errors.push("Examination Start Date & Time is required.");
  }
  if (!endsAt) {
    errors.push("Examination End Date & Time is required.");
  }

  if (startsAt && endsAt) {
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      errors.push("Invalid Examination start or end date.");
    } else {
      if (endMs <= startMs) {
        errors.push("Examination End Time must be strictly after the Start Time.");
      } else {
        const windowMins = Math.round((endMs - startMs) / 60000);
        if (duration > windowMins) {
          errors.push(
            `Candidate Attempt Duration (${duration} mins) cannot exceed the total Examination Window (${windowMins} mins).`
          );
        }
      }
    }
  }

  if (regOpens && regCloses) {
    const regStartMs = new Date(regOpens).getTime();
    const regEndMs = new Date(regCloses).getTime();
    if (isNaN(regStartMs) || isNaN(regEndMs)) {
      errors.push("Invalid Registration start or closing date.");
    } else {
      if (regEndMs <= regStartMs) {
        errors.push("Registration Closing Date must be after Registration Opening Date.");
      }
      if (startsAt) {
        const startMs = new Date(startsAt).getTime();
        if (regEndMs > startMs) {
          errors.push("Registration must close on or before the Examination starts.");
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate the exact attempt deadline for a student starting now
 * 
 * Deadline = Earlier of:
 * - Attempt Start Time + Exam Duration
 * - Examination Window End Time
 */
export function calculateAttemptDeadline({ exam, attemptStartTime = new Date() }) {
  const startMs = attemptStartTime instanceof Date ? attemptStartTime.getTime() : new Date(attemptStartTime).getTime();
  const durationMins = Number(exam.duration || 60);
  const durationMs = durationMins * 60 * 1000;

  let deadlineMs = startMs + durationMs;

  const { endsAt } = extractExamSchedule(exam);
  if (endsAt) {
    const windowEndMs = new Date(endsAt).getTime();
    if (!isNaN(windowEndMs) && windowEndMs > startMs) {
      // Cannot exceed the exam closing time!
      deadlineMs = Math.min(deadlineMs, windowEndMs);
    }
  }

  const durationSeconds = Math.max(10, Math.round((deadlineMs - startMs) / 1000));
  return {
    deadlineAt: new Date(deadlineMs).toISOString(),
    durationSeconds,
    isTruncatedByWindow: deadlineMs < startMs + durationMs,
  };
}

/**
 * Standard Exam Duration Preset Options
 */
export const DURATION_PRESETS = [
  { label: "15 Mins", value: 15, text: "15 Minutes" },
  { label: "30 Mins", value: 30, text: "30 Minutes" },
  { label: "45 Mins", value: 45, text: "45 Minutes" },
  { label: "1 Hour", value: 60, text: "1 Hour (60 mins)" },
  { label: "1.5 Hours", value: 90, text: "1 Hour 30 Mins" },
  { label: "2 Hours", value: 120, text: "2 Hours (120 mins)" },
  { label: "3 Hours", value: 180, text: "3 Hours (180 mins)" },
  { label: "4 Hours", value: 240, text: "4 Hours (240 mins)" },
  { label: "Custom", value: "custom", text: "Custom Duration" },
];

/**
 * Human-readable duration formatting (e.g. 120 -> "2 Hours", 90 -> "1 Hour 30 Minutes")
 */
export function formatDurationHuman(minutes) {
  const m = Number(minutes) || 0;
  if (m <= 0) return "0 mins";
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours > 0 && mins > 0) {
    return `${hours} ${hours === 1 ? "Hour" : "Hours"} ${mins} Minutes`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? "Hour" : "Hours"}`;
  }
  return `${mins} Minutes`;
}

/**
 * Automatically calculate examination ending time from Date, Start Time and Duration
 * Handles midnight crossover seamlessly
 */
export function calculateEndTime({ examDate, startTime, durationMinutes }) {
  if (!examDate || !startTime || !durationMinutes || Number(durationMinutes) <= 0) {
    return {
      isValid: false,
      startsAtIso: null,
      endsAtIso: null,
      formattedDate: examDate ? formatDate(examDate) : "—",
      formattedStartTime: startTime || "—",
      formattedEndTime: "—",
      formattedDuration: formatDurationHuman(durationMinutes),
      isNextDay: false,
      displayWindow: "—",
      durationMinutes: Number(durationMinutes) || 0,
    };
  }

  try {
    const [yearStr, monthStr, dayStr] = examDate.split("-");
    const [hourStr, minStr] = startTime.split(":");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    const hours = parseInt(hourStr, 10);
    const minutes = parseInt(minStr, 10);

    const startDate = new Date(year, month, day, hours, minutes, 0, 0);
    if (isNaN(startDate.getTime())) {
      return {
        isValid: false,
        startsAtIso: null,
        endsAtIso: null,
        formattedDate: examDate,
        formattedStartTime: startTime,
        formattedEndTime: "—",
        formattedDuration: formatDurationHuman(durationMinutes),
        isNextDay: false,
        displayWindow: "—",
        durationMinutes: Number(durationMinutes) || 0,
      };
    }

    const startMs = startDate.getTime();
    const durationMs = Number(durationMinutes) * 60 * 1000;
    const endMs = startMs + durationMs;
    const endDate = new Date(endMs);

    const startsAtIso = startDate.toISOString();
    const endsAtIso = endDate.toISOString();

    const isNextDay =
      endDate.getDate() !== startDate.getDate() ||
      endDate.getMonth() !== startDate.getMonth() ||
      endDate.getFullYear() !== startDate.getFullYear();

    const formattedDate = formatDate(startsAtIso);
    const formattedStartTime = formatTime(startsAtIso);
    const formattedEndTimeOnly = formatTime(endsAtIso);

    const formattedEndTime = isNextDay
      ? `${formattedEndTimeOnly} (Next Day, ${formatDate(endsAtIso)})`
      : formattedEndTimeOnly;

    return {
      isValid: true,
      startsAtIso,
      endsAtIso,
      formattedDate,
      formattedStartTime,
      formattedEndTime,
      rawEndTime: formattedEndTimeOnly,
      formattedDuration: formatDurationHuman(durationMinutes),
      durationMinutes: Number(durationMinutes),
      isNextDay,
      displayWindow: `${formattedStartTime} – ${formattedEndTime}`,
    };
  } catch (err) {
    return {
      isValid: false,
      startsAtIso: null,
      endsAtIso: null,
      formattedDate: examDate,
      formattedStartTime: startTime,
      formattedEndTime: "—",
      formattedDuration: formatDurationHuman(durationMinutes),
      isNextDay: false,
      displayWindow: "—",
      durationMinutes: Number(durationMinutes) || 0,
    };
  }
}

/**
 * Extract fields for clean Create/Edit form from an exam object
 */
export function extractExamEditFields(exam) {
  if (!exam) return null;
  const schedule = extractExamSchedule(exam);
  let examDate = "";
  let startTime = "10:00";

  if (schedule.startsAt) {
    const d = new Date(schedule.startsAt);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      examDate = `${y}-${m}-${day}`;
      const h = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      startTime = `${h}:${mins}`;
    }
  }

  if (!examDate && exam.date) {
    examDate = exam.date;
  }
  if (!examDate) {
    const tomorrow = new Date(Date.now() + 86400000);
    examDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  }

  const duration = Number(exam.duration || 60);
  const matchedPreset = [15, 30, 45, 60, 90, 120, 180, 240].includes(duration);
  const durationPreset = matchedPreset ? duration : "custom";
  const customHours = Math.floor(duration / 60);
  const customMinutes = duration % 60;

  let regOpens = "";
  if (schedule.registrationOpensAt) {
    regOpens = toDateTimeLocal(schedule.registrationOpensAt);
  } else {
    try {
      const dt = new Date(`${examDate}T${startTime}:00`);
      const opensDate = new Date(dt.getTime() - 7 * 86400000);
      regOpens = toDateTimeLocal(opensDate.toISOString());
    } catch {
      regOpens = "";
    }
  }

  let regCloses = "";
  if (schedule.registrationClosesAt) {
    regCloses = toDateTimeLocal(schedule.registrationClosesAt);
  } else {
    try {
      regCloses = toDateTimeLocal(`${examDate}T${startTime}:00`);
    } catch {
      regCloses = "";
    }
  }

  const calculatedEnd = calculateEndTime({
    examDate,
    startTime,
    durationMinutes: duration,
  });

  return {
    examDate,
    startTime,
    duration,
    durationPreset,
    customHours,
    customMinutes,
    regOpens,
    regCloses,
    calculatedEnd,
  };
}
