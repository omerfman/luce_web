'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PettyCashReceipt {
  id: string;
  transaction_name: string;
  amount: number;
  currency: string;
  transaction_date: string;
  notes: string | null;
  card_statements: {
    id: string;
    file_name: string;
    statement_month: string;
    card_last_four: string | null;
    card_holder_name: string | null;
  };
  projects: {
    id: string;
    name: string;
  };
}

interface PettyCashData {
  items: PettyCashReceipt[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalItems: number;
    totalExpense: string;
  };
}

export default function PettyCashPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [data, setData] = useState<PettyCashData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (user) {
      loadData();
      loadProjects();
    }
  }, [user, currentPage, selectedProject]);

  async function loadProjects() {
    try {
      const { supabase } = await import('@/lib/supabase/client');
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Load projects error:', error);
    }
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      const url = new URL('/api/petty-cash', window.location.origin);
      url.searchParams.set('page', currentPage.toString());
      if (selectedProject !== 'all') {
        url.searchParams.set('project_id', selectedProject);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData);
        throw new Error(errorData.details || errorData.error || 'Veriler yüklenemedi');
      }

      const result = await response.json();
      setData(result);
    } catch (error: any) {
      console.error('Load data error:', error);
      alert(`Veriler yüklenirken hata oluştu: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  if (!user || isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar><div /></Sidebar>
        <div className="flex-1 flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar><div /></Sidebar>
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              💼 Kasa Fişleri
            </h1>
            <p className="text-gray-600">
              Faturalarla eşleşmeyen ancak projelere atanmış harcamalar
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{data.stats.totalItems}</div>
                <div className="text-sm text-gray-600 mt-1">Toplam Kasa Fişi</div>
              </div>
            </Card>
            
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {formatCurrency(parseFloat(data.stats.totalExpense))}
                </div>
                <div className="text-sm text-gray-600 mt-1">Toplam Harcama</div>
              </div>
            </Card>
            
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{projects.length}</div>
                <div className="text-sm text-gray-600 mt-1">Aktif Proje</div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                Proje Filtresi:
              </label>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Projeler</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Petty Cash Receipts Table */}
          <Card>
            {data.items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600">Henüz kasa fişi bulunmuyor</p>
                <p className="text-sm text-gray-500 mt-1">
                  Kredi kartı ekstrelerinde harcamaları projelere atadığınızda burada görünecektir
                </p>
                <Button
                  className="mt-4"
                  onClick={() => router.push('/card-statements')}
                >
                  Ekstrelere Git
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem Adı</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tutar</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ekstre</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notlar</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{item.transaction_name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                              📁 {item.projects.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-red-600">
                              {formatCurrency(Math.abs(item.amount))}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(item.transaction_date)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => router.push(`/card-statements/${item.card_statements.id}`)}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {item.card_statements.file_name}
                            </button>
                            <div className="text-xs text-gray-500">
                              {item.card_statements.card_last_four && `****${item.card_statements.card_last_four}`}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.notes || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/card-statements/${item.card_statements.id}`)}
                            >
                              Görüntüle
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t mt-4">
                    <div className="text-sm text-gray-700">
                      Toplam <span className="font-medium">{data.pagination.total}</span> kayıt
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                      >
                        Önceki
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        Sayfa {currentPage} / {data.pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === data.pagination.totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                      >
                        Sonraki
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
