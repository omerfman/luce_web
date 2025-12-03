'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Project, Invoice } from '@/types';

export default function ProjectDetailPage() {
  const params = useParams();
  const { company } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.id && company) {
      loadProject();
      loadProjectInvoices();
    }
  }, [params.id, company]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id as string)
        .eq('company_id', company!.id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  }

  async function loadProjectInvoices() {
    try {
      const { data, error } = await supabase
        .from('invoice_project_links')
        .select(`
          *,
          invoice:invoices(*)
        `)
        .eq('project_id', params.id as string);

      if (error) throw error;
      setInvoices((data || []).map((link: any) => link.invoice));
    } catch (error) {
      console.error('Error loading project invoices:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const monthlyData = invoices.reduce((acc: Record<string, number>, inv) => {
    const month = new Date(inv.date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
    acc[month] = (acc[month] || 0) + inv.amount;
    return acc;
  }, {});

  const top5Invoices = [...invoices]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      </Sidebar>
    );
  }

  if (!project) {
    return (
      <Sidebar>
        <Card>
          <div className="py-12 text-center text-sm text-secondary-500">
            Proje bulunamadı
          </div>
        </Card>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Project Header */}
        <Card>
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            {project.description && (
              <CardDescription>{project.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-secondary-600">Başlangıç</p>
                <p className="text-lg font-semibold">
                  {project.start_date ? formatDate(project.start_date) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-secondary-600">Bitiş</p>
                <p className="text-lg font-semibold">
                  {project.end_date ? formatDate(project.end_date) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-secondary-600">Durum</p>
                <p className="text-lg font-semibold">{project.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Toplam Harcama</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary-600">
                {formatCurrency(totalAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fatura Sayısı</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-secondary-900">{invoices.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ortalama Fatura</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-secondary-900">
                {invoices.length > 0
                  ? formatCurrency(totalAmount / invoices.length)
                  : formatCurrency(0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>En Büyük 5 Fatura</CardTitle>
          </CardHeader>
          <CardContent>
            {top5Invoices.length === 0 ? (
              <p className="text-sm text-secondary-500">Henüz fatura bulunmuyor</p>
            ) : (
              <div className="space-y-2">
                {top5Invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between rounded-lg border border-secondary-200 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-secondary-900">
                        {(invoice.metadata as any)?.supplier || 'Tedarikçi belirtilmemiş'}
                      </p>
                      <p className="text-xs text-secondary-500">{formatDate(invoice.date)}</p>
                    </div>
                    <p className="text-lg font-semibold text-primary-600">
                      {formatCurrency(invoice.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Invoices */}
        <Card padding="none">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-secondary-900">Tüm Faturalar</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-secondary-200 bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">
                    Tarih
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">
                    Tedarikçi
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-secondary-600">
                    Tutar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-sm text-secondary-500">
                      Bu projeye henüz fatura atanmamış
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-secondary-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary-900">
                        {formatDate(invoice.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-900">
                        {(invoice.metadata as any)?.supplier || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-secondary-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Sidebar>
  );
}
