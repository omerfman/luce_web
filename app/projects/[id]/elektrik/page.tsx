'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import FileUpload from '@/components/projects/FileUpload';
import FileList from '@/components/projects/FileList';
import { getProjectFiles } from '@/lib/supabase/project-files';
import { ProjectFile } from '@/types';

export default function ElektrikPage() {
  const params = useParams();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, [params.id]);

  async function loadFiles() {
    try {
      const data = await getProjectFiles(params.id as string, 'elektrik');
      setFiles(data);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleUploadComplete = () => {
    loadFiles();
  };

  const handleFileDeleted = () => {
    loadFiles();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ⚡ Elektrik
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Elektrik projelerine ait dosyaları yükleyin ve yönetin
        </p>
      </div>

      <div className="mb-8">
        <FileUpload
          projectId={params.id as string}
          category="elektrik"
          onUploadComplete={handleUploadComplete}
        />
      </div>

      <div>
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">Yükleniyor...</div>
          </div>
        ) : (
          <FileList files={files} onFileDeleted={handleFileDeleted} />
        )}
      </div>
    </div>
  );
}
