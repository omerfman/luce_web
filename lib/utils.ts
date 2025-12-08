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
 * Format number with thousand separators and decimals (for input fields)
 * Supports both integers and decimals with Turkish formatting (1.234,56)
 */
export function formatNumberInput(value: string | number): string {
  if (!value && value !== 0) return '';
  
  // Convert to string and normalize
  let strValue = typeof value === 'number' ? value.toString() : value;
  
  // Remove all non-numeric characters except comma and dot
  strValue = strValue.replace(/[^\d,.-]/g, '');
  
  // Replace comma with dot for parsing (TR format uses comma for decimals)
  strValue = strValue.replace(',', '.');
  
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
