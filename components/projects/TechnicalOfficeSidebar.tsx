'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TECHNICAL_CATEGORIES, TechnicalCategory } from '@/types';

interface TechnicalOfficeSidebarProps {
  projectId: string;
  fileCounts?: Record<string, { count: number; size: number }>;
}

const CATEGORY_ICONS: Record<TechnicalCategory, string> = {
  statik: '🏗️',
  mimari: '🏛️',
  mekanik: '⚙️',
  elektrik: '⚡',
  zemin_etudu: '🌍',
  geoteknik: '🪨',
  ic_tasarim: '🎨',
  '3d': '📐',
};

export default function TechnicalOfficeSidebar({ projectId, fileCounts = {} }: TechnicalOfficeSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  const categories = Object.keys(TECHNICAL_CATEGORIES) as TechnicalCategory[];

  return (
    <div className="bg-white border-r border-secondary-200 min-h-screen">
      <div className="p-4">
        {/* Accordion Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-primary-50 text-primary-900 rounded-lg hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <span className="text-xl">🏢</span>
            <span className="font-semibold">Teknik Ofis</span>
          </div>
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {/* Category Links */}
        {isOpen && (
          <nav className="mt-2 space-y-1">
            {categories.map((category) => {
              const href = `/projects/${projectId}/${category}`;
              const isActive = pathname === href;
              const categoryStats = fileCounts[category];
              const count = categoryStats?.count || 0;

              return (
                <Link
                  key={category}
                  href={href}
                  className={`
                    flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-primary-600 text-white' 
                      : 'text-secondary-700 hover:bg-secondary-100'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{CATEGORY_ICONS[category]}</span>
                    <span className="text-sm font-medium">
                      {TECHNICAL_CATEGORIES[category]}
                    </span>
                  </div>
                  {count > 0 && (
                    <span
                      className={`
                        px-2 py-0.5 text-xs font-medium rounded-full
                        ${isActive 
                          ? 'bg-white text-primary-600' 
                          : 'bg-secondary-200 text-secondary-700'
                        }
                      `}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
