'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TechnicalOfficeSidebar from '@/components/projects/TechnicalOfficeSidebar';
import { getProjectFileStats } from '@/lib/supabase/project-files';

export default function MimariLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.id as string;
  const [fileCounts, setFileCounts] = useState<Record<string, { count: number; size: number }>>({});

  useEffect(() => {
    if (projectId) {
      loadFileStats();
    }
  }, [projectId]);

  async function loadFileStats() {
    try {
      const stats = await getProjectFileStats(projectId);
      setFileCounts(stats.byCategory);
    } catch (error) {
      console.error('Error loading file stats:', error);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white">
        <TechnicalOfficeSidebar projectId={projectId} fileCounts={fileCounts} />
      </div>
      <div className="flex-1 bg-gray-50">
        {children}
      </div>
    </div>
  );
}
