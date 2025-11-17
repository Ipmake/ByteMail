import { format } from 'date-fns';
import type { UserSettings } from '../types/settings';

/**
 * Format a date according to user's date format preference
 */
export const formatDateWithSettings = (
  date: Date | string,
  settings?: UserSettings | null
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!settings) {
    return format(dateObj, 'dd/MM/yyyy'); // default fallback
  }

  const { dateFormat } = settings.general;
  
  // Map user preference to date-fns format string
  const formatMap: Record<string, string> = {
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'YYYY-MM-DD': 'yyyy-MM-dd',
    'DD.MM.YYYY': 'dd.MM.yyyy',
  };

  return format(dateObj, formatMap[dateFormat] || 'dd/MM/yyyy');
};

/**
 * Format a time according to user's time format preference (12h/24h)
 */
export const formatTimeWithSettings = (
  date: Date | string,
  settings?: UserSettings | null
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!settings) {
    return format(dateObj, 'HH:mm'); // default 24h
  }

  const { timeFormat } = settings.general;
  
  return timeFormat === '12h' 
    ? format(dateObj, 'h:mm a')  // 3:45 PM
    : format(dateObj, 'HH:mm');   // 15:45
};

/**
 * Format a full date and time according to user's preferences
 */
export const formatDateTimeWithSettings = (
  date: Date | string,
  settings?: UserSettings | null
): string => {
  const dateStr = formatDateWithSettings(date, settings);
  const timeStr = formatTimeWithSettings(date, settings);
  
  return `${dateStr} ${timeStr}`;
};

/**
 * Format a date for email list (smart relative formatting)
 * - If today: show time only
 * - If this week: show day name
 * - Otherwise: show date
 */
export const formatEmailListDate = (
  date: Date | string,
  settings?: UserSettings | null
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  // Check if same day
  const isToday = 
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear();

  if (isToday) {
    return formatTimeWithSettings(dateObj, settings);
  }

  // Check if within last 7 days
  const daysDiff = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 7 && daysDiff >= 0) {
    return format(dateObj, 'EEE'); // Mon, Tue, etc.
  }

  // Otherwise show date
  return formatDateWithSettings(dateObj, settings);
};

/**
 * Format a full date and time for email viewer (long format)
 */
export const formatEmailViewerDateTime = (
  date: Date | string,
  settings?: UserSettings | null
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!settings) {
    return format(dateObj, 'PPpp'); // Default full format
  }

  const dateStr = formatDateWithSettings(dateObj, settings);
  const timeStr = formatTimeWithSettings(dateObj, settings);
  const dayName = format(dateObj, 'EEEE'); // Monday, Tuesday, etc.
  
  return `${dayName}, ${dateStr} at ${timeStr}`;
};
