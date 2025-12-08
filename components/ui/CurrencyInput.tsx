'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Currency input component with Turkish formatting
 * Formats as user types: 1000256,15 -> 1.000.256,15
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, label, error, helperText, value = '', onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      
      // Remove all non-digit and non-comma characters
      const cleaned = input.replace(/[^\d,]/g, '');
      
      // Split by comma
      const parts = cleaned.split(',');
      
      // Get integer and decimal parts
      const integerPart = parts[0] || '';
      const hasComma = parts.length > 1;
      const decimalPart = hasComma ? parts.slice(1).join('').substring(0, 2) : '';
      
      // Format integer part with dots every 3 digits
      let formatted = '';
      if (integerPart) {
        const reversed = integerPart.split('').reverse().join('');
        const grouped = reversed.match(/.{1,3}/g) || [];
        formatted = grouped.join('.').split('').reverse().join('');
      }
      
      // Build result
      let result = formatted;
      if (hasComma) {
        result += ',';
        if (decimalPart) {
          result += decimalPart;
        }
      }
      
      if (onChange) {
        onChange(result);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="mb-1 block text-sm font-medium text-secondary-700">
            {label}
            {props.required && <span className="ml-1 text-error">*</span>}
          </label>
        )}
        <input
          type="text"
          inputMode="decimal"
          className={cn(
            'input',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
            className
          )}
          ref={ref}
          value={value}
          onChange={handleChange}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-secondary-500">{helperText}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
