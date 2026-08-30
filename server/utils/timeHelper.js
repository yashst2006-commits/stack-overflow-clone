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
