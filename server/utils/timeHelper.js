let mockTimeProvider = null;

/**
 * Set a mock date/time for testing. Pass null to reset to system time.
 * @param {Date|string|null} dateOrStr 
 */
export const setMockTime = (dateOrStr) => {
  mockTimeProvider = dateOrStr ? new Date(dateOrStr) : null;
};

/**
 * Gets the current Date object (system time or mock time).
 * @returns {Date}
 */
export const getCurrentTime = () => {
  return mockTimeProvider ? new Date(mockTimeProvider) : new Date();
};

/**
 * Extracts components of the time in the Asia/Kolkata (IST) timezone.
 * @param {Date} date 
 * @returns {{ hour: number, minute: number, second: number }}
 */
export const getISTTimeParts = (date = getCurrentTime()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const second = parseInt(parts.find(p => p.type === 'second').value, 10);
  return { hour, minute, second };
};

/**
 * Returns true if the current time is between 10:00:00 AM and 10:59:59.999 AM IST.
 * @param {Date} currentTime 
 * @returns {boolean}
 */
export const isPaymentWindowOpen = (currentTime = getCurrentTime()) => {
  const { hour } = getISTTimeParts(currentTime);
  return hour === 10;
};

/**
 * Returns a formatted string representation of the current IST time.
 * @param {Date} currentTime 
 * @returns {string}
 */
export const getCurrentISTTime = (currentTime = getCurrentTime()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true
  });
  return formatter.format(currentTime) + " IST";
};

export const PLAN_LIMITS = {
  Free: 1,
  Bronze: 5,
  Silver: 10,
  Gold: Infinity,
};

/**
 * Gets the daily question limit for a given plan.
 * @param {string} plan 
 * @returns {number}
 */
export const getDailyQuestionLimit = (plan) => {
  return PLAN_LIMITS[plan] !== undefined ? PLAN_LIMITS[plan] : PLAN_LIMITS.Free;
};

/**
 * Determines the active subscription plan for a user.
 * Paid plans (Bronze, Silver, Gold) are active only if active === true and endDate > currentTime.
 * Otherwise, the user is treated as Free.
 * @param {object} userRecord 
 * @param {Date} currentTime 
 * @returns {string}
 */
export const getActivePlan = (userRecord, currentTime = getCurrentTime()) => {
  if (!userRecord || !userRecord.subscription) {
    return "Free";
  }
  const { plan, active, endDate } = userRecord.subscription;
  if (!plan || plan === "Free") {
    return "Free";
  }
  // Paid plans: Bronze, Silver, Gold
  const isExpired = endDate ? new Date(endDate) <= currentTime : true;
  if (active === true && !isExpired) {
    return plan;
  }
  return "Free";
};

/**
 * Gets the start of today (00:00:00.000) in Asia/Kolkata (IST) timezone.
 * @param {Date} date 
 * @returns {Date}
 */
export const getISTStartOfToday = (date = getCurrentTime()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10);
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);

  // UTC midnight for the given date's year-month-day
  const utcMidnight = Date.UTC(year, month - 1, day);
  // IST is UTC+5:30, so midnight IST is 5.5 hours before midnight UTC.
  const istMidnight = new Date(utcMidnight - (5.5 * 60 * 60 * 1000));
  return istMidnight;
};

