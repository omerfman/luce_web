import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency (Turkish Lira)
 */
export function formatCurrency(amount: number, currency: string = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format currency input in real-time with Turkish formatting
 * User types: 1000256,15 → Display: 1.000.256,15
 * Adds thousand separators automatically while preserving cursor position
 */
export function formatCurrencyInput(value: string): string {
  if (!value) return '';
  
  // Remove all non-digit and non-comma characters (including existing dots)
  const cleaned = value.replace(/[^\d,]/g, '');
  
  // Split by comma to handle integer and decimal parts separately
  const parts = cleaned.split(',');
  
  // Keep only first comma, join rest to integer part
  const integerPart = parts[0];
  const hasComma = parts.length > 1;
  const decimalPart = hasComma ? parts.slice(1).join('') : '';
  
  // Format integer part with thousand separators (dots)
  let formattedInteger = '';
  if (integerPart) {
    // Reverse, add dots every 3 digits, reverse back
    const reversed = integerPart.split('').reverse().join('');
    const grouped = reversed.match(/.{1,3}/g) || [];
    formattedInteger = grouped.join('.').split('').reverse().join('');
  }
  
  // Build final result
  let result = formattedInteger;
  
  if (hasComma) {
    // User typed comma, add it
    result += ',';
    // Add decimal part (max 2 digits)
    if (decimalPart) {
      result += decimalPart.substring(0, 2);
    }
  }
  
  return result;
}

/**
 * Parse formatted currency input to number
 * Handles: 1.000.256,15 -> 1000256.15
 */
export function parseCurrencyInput(value: string): number {
  if (!value) return 0;
  
  // Remove thousand separators (dots) and replace comma with dot
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Clean and normalize number input while typing
 * Allows user to type freely, only validates characters
 */
export function cleanNumberInput(value: string): string {
  if (!value) return '';
  
  // Only allow digits, comma, and dot
  let cleaned = value.replace(/[^\d,.]/g, '');
  
  // Allow only one decimal separator (comma or dot)
  const commaCount = (cleaned.match(/,/g) || []).length;
  
  // If user is typing decimals with comma
  if (commaCount > 0) {
    // Remove all dots (they're thousand separators to be cleaned)
    cleaned = cleaned.replace(/\./g, '');
    // Keep only the first comma
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      cleaned = parts[0] + ',' + parts.slice(1).join('');
    }
  }
  
  return cleaned;
}

/**
 * Format number with thousand separators and decimals (for display/blur)
 * Supports both integers and decimals with Turkish formatting (1.234,56)
 */
export function formatNumberInput(value: string | number): string {
  if (!value && value !== 0) return '';
  
  // Convert to string and normalize
  let strValue = typeof value === 'number' ? value.toString() : value;
  
  // Remove all non-numeric characters except comma and dot
  strValue = strValue.replace(/[^\d,.]/g, '');
  
  // Handle Turkish format: replace comma with dot for parsing
  // Remove existing dots (thousand separators)
  strValue = strValue.replace(/\./g, '').replace(',', '.');
  
  const num = parseFloat(strValue);
  if (isNaN(num)) return '';
  
  // Format with Turkish locale (uses dot for thousands, comma for decimals)
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parse formatted number input to number
 * Handles Turkish format: 1.234.567,89 -> 1234567.89
 */
export function parseNumberInput(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Remove thousand separators (dots in TR format)
  // Replace decimal separator (comma in TR format) with dot
  const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format date to Turkish locale
 */
export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'long') {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(d);
  }
  
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
  }).format(d);
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Generate random ID
 */
export function generateId(prefix: string = ''): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
