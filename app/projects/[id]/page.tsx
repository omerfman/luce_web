'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/types';
import { getProject } from '@/lib/supabase/projects';
import { getProjectFileStats } from '@/lib/supabase/project-files';
import { TECHNICAL_CATEGORIES } from '@/types';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [fileStats, setFileStats] = useState<{
    totalFiles: number;
    totalSize: number;
    byCategory: Record<string, { count: number; size: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjectData = async () => {
      try {
        const projectData = await getProject(params.id as string);
        if (!projectData) {
          router.push('/projects');
          return;
        }
        setProject(projectData);

        const stats = await getProjectFileStats(params.id as string);
        setFileStats(stats);
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      loadProjectData();
    }
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning':
        return 'Planlama';
      case 'in_progress':
        return 'Devam Ediyor';
      case 'completed':
        return 'Tamamlandı';
      default:
        return status;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Project Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {project.name}
          </h1>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(
              project.status
            )}`}
          >
            {getStatusText(project.status)}
          </span>
        </div>
        {project.description && (
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {project.description}
          </p>
        )}
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Dates Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📅 Tarihler
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Başlangıç Tarihi
              </p>
              <p className="text-gray-900 dark:text-white">
                {project.start_date
                  ? new Date(project.start_date).toLocaleDateString('tr-TR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bitiş Tarihi
              </p>
              <p className="text-gray-900 dark:text-white">
                {project.end_date
                  ? new Date(project.end_date).toLocaleDateString('tr-TR')
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* File Statistics Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📁 Dosya İstatistikleri
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toplam Dosya
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {fileStats?.totalFiles || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toplam Boyut
              </p>
              <p className="text-gray-900 dark:text-white">
                {fileStats?.totalSize
                  ? `${(fileStats.totalSize / (1024 * 1024)).toFixed(2)} MB`
                  : '0 MB'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🔗 Hızlı Bağlantılar
          </h2>
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/projects/${project.id}/edit`)}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              ✏️ Projeyi Düzenle
            </button>
            <button
              onClick={() => router.push('/projects')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              📋 Tüm Projeler
            </button>
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      {fileStats && fileStats.totalFiles > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📊 Kategorilere Göre Dosya Dağılımı
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(TECHNICAL_CATEGORIES).map(([key, label]) => {
              const categoryStats = fileStats.byCategory[key];
              if (!categoryStats || categoryStats.count === 0) return null;

              return (
                <div
                  key={key}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => router.push(`/projects/${project.id}/${key}`)}
                >
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {categoryStats.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(categoryStats.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {fileStats && fileStats.totalFiles === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Henüz Dosya Yüklenmemiş
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sol menüden bir kategori seçerek dosya yüklemeye başlayabilirsiniz.
          </p>
          <button
            onClick={() =>
              router.push(`/projects/${project.id}/${Object.keys(TECHNICAL_CATEGORIES)[0]}`)
            }
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Dosya Yükle
          </button>
        </div>
      )}
    </div>
  );
}
