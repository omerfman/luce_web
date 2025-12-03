'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { FileUploader } from '@/components/ui/FileUploader';
import { supabase } from '@/lib/supabase/client';
import { uploadInvoicePDF } from '@/lib/supabase/storage';
import { generateProjectInvoicesReport, downloadPdfBlob } from '@/lib/supabase/pdf-utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Invoice, Project } from '@/types';

type TabType = 'pending' | 'assigned' | 'all';

export default function InvoicesPage() {
  const { user, company, hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  const [formData, setFormData] = useState({
    amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    description: '',
  });

  const canCreate = hasPermission('invoices', 'create');
  const canUpdate = hasPermission('invoices', 'update');
  const canDelete = hasPermission('invoices', 'delete');
  const canAssign = hasPermission('invoices', 'assign') || hasPermission('*', '*');

  async function getSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, 3600);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return '#';
    }
    
    return data.signedUrl;
  }

  useEffect(() => {
    if (company) {
      loadInvoices();
      loadProjects();
    }
  }, [company]);

  async function loadInvoices() {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          project_links:invoice_project_links(
            id,
            project:projects(id, name)
          )
        `)
        .eq('company_id', company!.id)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', company!.id)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  function openAssignModal(invoice: Invoice) {
    setSelectedInvoice(invoice);
    const assignedProjects = invoice.project_links?.map((link: any) => link.project.id) || [];
    setSelectedProjects(assignedProjects);
    setIsAssignModalOpen(true);
  }

  async function handleAssignProjects() {
    if (!selectedInvoice) return;

    try {
      const currentLinks = selectedInvoice.project_links?.map((link: any) => link.project.id) || [];
      const toAdd = selectedProjects.filter(p => !currentLinks.includes(p));
      const toRemove = currentLinks.filter((p: string) => !selectedProjects.includes(p));

      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('invoice_project_links')
          .delete()
          .eq('invoice_id', selectedInvoice.id)
          .in('project_id', toRemove);

        if (deleteError) throw deleteError;
      }

      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('invoice_project_links')
          .insert(toAdd.map(projectId => ({
            invoice_id: selectedInvoice.id,
            project_id: projectId,
          })));

        if (insertError) throw insertError;
      }

      setIsAssignModalOpen(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Error assigning projects:', error);
      alert(error.message || 'Proje atama sırasında hata oluştu');
    }
  }

  function toggleProject(projectId: string) {
    if (selectedProjects.includes(projectId)) {
      setSelectedProjects(selectedProjects.filter(id => id !== projectId));
    } else {
      setSelectedProjects([...selectedProjects, projectId]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !company) return;

    setIsUploading(true);

    try {
      const uploadResult = await uploadInvoicePDF(selectedFile, company.id);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      const { error } = await supabase.from('invoices').insert({
        company_id: company.id,
        uploaded_by: user!.id,
        file_path: uploadResult.url!,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        amount: parseFloat(formData.amount),
        invoice_date: formData.invoice_date,
        invoice_number: formData.invoice_number,
        description: formData.description,
      });

      if (error) throw error;

      setFormData({
        amount: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        description: '',
      });
      setSelectedFile(null);
      setIsModalOpen(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      alert(error.message || 'Fatura oluşturulurken hata oluştu');
    } finally {
      setIsUploading(false);
    }
  }

  function openEditModal(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setFormData({
      amount: invoice.amount.toString(),
      invoice_date: invoice.invoice_date,
      invoice_number: invoice.invoice_number,
      description: invoice.description || '',
    });
    setIsEditModalOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;

    setIsUploading(true);

    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          amount: parseFloat(formData.amount),
          invoice_date: formData.invoice_date,
          invoice_number: formData.invoice_number,
          description: formData.description,
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      setFormData({
        amount: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        description: '',
      });
      setSelectedInvoice(null);
      setIsEditModalOpen(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      alert(error.message || 'Fatura güncellenirken hata oluştu');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(invoice: Invoice) {
    if (!confirm('Bu faturayı silmek istediğinizden emin misiniz?')) return;

    try {
      // Delete invoice (will cascade delete project links)
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      loadInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      alert(error.message || 'Fatura silinirken hata oluştu');
    }
  }

  async function handleGenerateReport() {
    setIsGeneratingReport(true);

    try {
      // Get all assigned invoices with their projects
      const assignedInvoices = invoices.filter(
        inv => inv.project_links && inv.project_links.length > 0
      );

      if (assignedInvoices.length === 0) {
        alert('Atanmış fatura bulunmuyor!');
        return;
      }

      // Prepare data for PDF generation
      const projectInvoices = assignedInvoices.flatMap(invoice =>
        invoice.project_links!.map((link: any) => ({
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          amount: invoice.amount,
          file_path: invoice.file_path,
          project_name: link.project.name,
        }))
      );

      // Generate combined PDF
      const pdfBlob = await generateProjectInvoicesReport(projectInvoices);

      if (!pdfBlob) {
        alert('PDF oluşturulurken hata oluştu!');
        return;
      }

      // Download the PDF
      const today = new Date().toISOString().split('T')[0];
      downloadPdfBlob(pdfBlob, `fatura-raporu-${today}.pdf`);
    } catch (error: any) {
      console.error('Error generating report:', error);
      alert(error.message || 'Rapor oluşturulurken hata oluştu');
    } finally {
      setIsGeneratingReport(false);
    }
  }

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      </Sidebar>
    );
  }

  const filteredInvoices = invoices.filter(invoice => {
    const hasProjects = invoice.project_links && invoice.project_links.length > 0;
    if (activeTab === 'pending') return !hasProjects;
    if (activeTab === 'assigned') return hasProjects;
    return true;
  });

  const pendingCount = invoices.filter(inv => !inv.project_links || inv.project_links.length === 0).length;
  const assignedCount = invoices.filter(inv => inv.project_links && inv.project_links.length > 0).length;

  return (
    <Sidebar>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Faturalar</h1>
            <p className="mt-1 text-sm text-secondary-600">
              {pendingCount} bekleyen, {assignedCount} atanmış fatura
            </p>
          </div>
          <div className="flex gap-3">
            {assignedCount > 0 && (
              <Button 
                onClick={handleGenerateReport}
                isLoading={isGeneratingReport}
                variant="ghost"
              >
                📥 PDF Rapor İndir
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setIsModalOpen(true)}>
                + Yeni Fatura Ekle
              </Button>
            )}
          </div>
        </div>

        <div className="border-b border-secondary-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'pending'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:border-secondary-300 hover:text-secondary-700'
              }`}
            >
              Bekleyen Atamalar
              {pendingCount > 0 && (
                <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'assigned'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:border-secondary-300 hover:text-secondary-700'
              }`}
            >
              Atanmış Faturalar
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                {assignedCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'all'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:border-secondary-300 hover:text-secondary-700'
              }`}
            >
              Tüm Faturalar
              <span className="ml-2 text-xs text-secondary-500">
                {invoices.length}
              </span>
            </button>
          </nav>
        </div>

        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-secondary-200 bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Fatura No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-secondary-600">Tutar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Projeler</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase text-secondary-600">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-secondary-500">
                      {activeTab === 'pending' && 'Bekleyen fatura bulunmuyor'}
                      {activeTab === 'assigned' && 'Atanmış fatura bulunmuyor'}
                      {activeTab === 'all' && 'Henüz fatura bulunmuyor'}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-secondary-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary-900">
                        {formatDate(invoice.invoice_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-900">
                        {invoice.invoice_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-900">
                        {invoice.description || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-secondary-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.project_links && invoice.project_links.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {invoice.project_links.map((link: any) => (
                              <span
                                key={link.id}
                                className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                              >
                                {link.project.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-yellow-600">Atama bekleniyor</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm space-x-3">
                        <button
                          onClick={async () => {
                            const url = await getSignedUrl(invoice.file_path);
                            window.open(url, '_blank');
                          }}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          PDF
                        </button>
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(invoice)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            Düzenle
                          </button>
                        )}
                        {canAssign && (
                          <button
                            onClick={() => openAssignModal(invoice)}
                            className="text-primary-600 hover:text-primary-700"
                          >
                            Proje
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(invoice)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Sil
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yeni Fatura Ekle" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FileUploader onFileSelect={setSelectedFile} />
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Tutar"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            <Input
              label="Tarih"
              type="date"
              value={formData.invoice_date}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              required
            />
          </div>
          <Input
            label="Fatura Numarası"
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            required
          />
          <Input
            label="Açıklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>İptal</Button>
            <Button type="submit" isLoading={isUploading} disabled={!selectedFile}>Fatura Ekle</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Fatura Düzenle" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Tutar"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            <Input
              label="Tarih"
              type="date"
              value={formData.invoice_date}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              required
            />
          </div>
          <Input
            label="Fatura Numarası"
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            required
          />
          <Input
            label="Açıklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>İptal</Button>
            <Button type="submit" isLoading={isUploading}>Güncelle</Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Proje Ata" size="md">
        <div className="space-y-4">
          <p className="text-sm text-secondary-600">
            {selectedInvoice?.invoice_number && `Fatura: ${selectedInvoice.invoice_number}`}
          </p>
          {projects.length === 0 ? (
            <div className="rounded-lg border border-secondary-200 p-8 text-center">
              <p className="text-sm text-secondary-500">Henüz proje bulunmuyor. Önce proje oluşturun.</p>
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-secondary-200 p-4">
              {projects.map((project) => (
                <label key={project.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-secondary-50">
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-secondary-900">{project.name}</p>
                    {project.description && <p className="text-xs text-secondary-500">{project.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>İptal</Button>
            <Button type="button" onClick={handleAssignProjects} disabled={projects.length === 0}>
              {selectedProjects.length === 0 ? 'Atamaları Kaldır' : `${selectedProjects.length} Proje Ata`}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </Sidebar>
  );
}
