import React from 'react';

interface CurrentAccountBadgeProps {
  isCurrentAccount: boolean;
  className?: string;
}

/**
 * Cari hesap badge component'i
 * Firma cari hesap olarak işaretliyse gösterir
 */
export function CurrentAccountBadge({ isCurrentAccount, className = '' }: CurrentAccountBadgeProps) {
  if (!isCurrentAccount) return null;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 ${className}`}>
      🔄 Cari Hesap
    </span>
  );
}
