'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { FileUploader } from '@/components/ui/FileUploader';
import { supabase } from '@/lib/supabase/client';
import { uploadInvoicePDF } from '@/lib/supabase/storage';
import { generateProjectInvoicesReport, downloadPdfBlob } from '@/lib/supabase/pdf-utils';
import { formatCurrency, formatDate, formatCurrencyInput, parseCurrencyInput } from '@/lib/utils';
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPaymentTypes, setSelectedPaymentTypes] = useState<Array<{type: string, amount: string}>>([{type: '', amount: ''}]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    supplierName: '',
    invoiceNumber: '',
    projectId: '',
  });

  const [formData, setFormData] = useState({
    amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    description: '',
    supplier_name: '',
    goods_services_total: '',
    vat_amount: '',
    withholding_amount: '',
  });

  const canCreate = hasPermission('invoices', 'create');
  const canUpdate = hasPermission('invoices', 'update');
  const canDelete = hasPermission('invoices', 'delete');
  const canAssign = hasPermission('invoices', 'assign') || hasPermission('*', '*');

  // Auto-calculate total amount when currency fields change
  useEffect(() => {
    const goods = parseCurrencyInput(formData.goods_services_total);
    const vat = parseCurrencyInput(formData.vat_amount);
    const withholding = parseCurrencyInput(formData.withholding_amount);
    
    // Formula: (Mal/Hizmet + KDV) - Tevkifat
    const total = goods + vat - withholding;
    
    // Only update if there's a calculated value and it's different from current
    if (total > 0) {
      const formattedTotal = formatCurrencyInput(total.toString().replace('.', ','));
      if (formattedTotal !== formData.amount) {
        setFormData(prev => ({ ...prev, amount: formattedTotal }));
      }
    }
  }, [formData.goods_services_total, formData.vat_amount, formData.withholding_amount]);

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
          ),
          payments(id, amount, payment_type, payment_date)
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

  async function loadPayments(invoiceId: string) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      console.error('Error loading payments:', error);
    }
  }

  function openPaymentModal(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setSelectedPaymentTypes([{type: '', amount: ''}]);
    loadPayments(invoice.id);
    setIsPaymentModalOpen(true);
  }

  function addPaymentType() {
    setSelectedPaymentTypes([...selectedPaymentTypes, {type: '', amount: ''}]);
  }

  function removePaymentType(index: number) {
    setSelectedPaymentTypes(selectedPaymentTypes.filter((_, i) => i !== index));
  }

  function updatePaymentType(index: number, field: 'type' | 'amount', value: string) {
    const updated = [...selectedPaymentTypes];
    updated[index][field] = value;
    setSelectedPaymentTypes(updated);
  }

  async function handleAddPayments(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice || !company) return;

    const validPayments = selectedPaymentTypes.filter(p => p.type && p.amount);
    if (validPayments.length === 0) {
      alert('Lütfen en az bir ödeme tipi ve tutar girin');
      return;
    }

    setIsUploading(true);

    try {
      const paymentsToInsert = validPayments.map(p => ({
        invoice_id: selectedInvoice.id,
        company_id: company.id,
        payment_type: p.type,
        amount: parseCurrencyInput(p.amount),
        payment_date: new Date().toISOString().split('T')[0],
        created_by: user!.id,
      }));

      const { error } = await supabase
        .from('payments')
        .insert(paymentsToInsert);

      if (error) throw error;

      setIsPaymentModalOpen(false);
      loadPayments(selectedInvoice.id);
      loadInvoices();
    } catch (error: any) {
      console.error('Error adding payments:', error);
      alert(error.message || 'Ödeme eklenirken hata oluştu');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm('Bu ödemeyi silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      if (selectedInvoice) {
        loadPayments(selectedInvoice.id);
        loadInvoices();
      }
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      alert(error.message || 'Ödeme silinirken hata oluştu');
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
        amount: parseCurrencyInput(formData.amount),
        invoice_date: formData.invoice_date,
        invoice_number: formData.invoice_number,
        description: formData.description || null,
        supplier_name: formData.supplier_name || null,
        goods_services_total: formData.goods_services_total ? parseCurrencyInput(formData.goods_services_total) : null,
        vat_amount: formData.vat_amount ? parseCurrencyInput(formData.vat_amount) : null,
        withholding_amount: formData.withholding_amount ? parseCurrencyInput(formData.withholding_amount) : null,
      });

      if (error) throw error;

      setFormData({
        amount: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        description: '',
        supplier_name: '',
        goods_services_total: '',
        vat_amount: '',
        withholding_amount: '',
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
      supplier_name: invoice.supplier_name || '',
      goods_services_total: invoice.goods_services_total ? invoice.goods_services_total.toString().replace('.', ',') : '',
      vat_amount: invoice.vat_amount ? invoice.vat_amount.toString().replace('.', ',') : '',
      withholding_amount: invoice.withholding_amount ? invoice.withholding_amount.toString().replace('.', ',') : '',
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
          amount: parseCurrencyInput(formData.amount),
          invoice_date: formData.invoice_date,
          invoice_number: formData.invoice_number,
          description: formData.description,
          supplier_name: formData.supplier_name || null,
          goods_services_total: formData.goods_services_total ? parseCurrencyInput(formData.goods_services_total) : null,
          vat_amount: formData.vat_amount ? parseCurrencyInput(formData.vat_amount) : null,
          withholding_amount: formData.withholding_amount ? parseCurrencyInput(formData.withholding_amount) : null,
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      setFormData({
        amount: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        description: '',
        supplier_name: '',
        goods_services_total: '',
        vat_amount: '',
        withholding_amount: '',
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
      // Get filtered assigned invoices with their projects
      const assignedInvoices = filteredInvoices.filter(
        inv => inv.project_links && inv.project_links.length > 0
      );

      if (assignedInvoices.length === 0) {
        alert('Filtrelenen faturalar arasında atanmış fatura bulunmuyor!');
        return;
      }

      // Prepare data for PDF generation
      // Group invoices by file_path to avoid duplicates
      const invoiceMap = new Map<string, {
        invoice_number: string;
        invoice_date: string;
        amount: number;
        file_path: string;
        project_names: string[];
        description?: string;
        company_name: string;
        payments: Array<{payment_type: string, amount: number}>;
      }>();

      assignedInvoices.forEach(invoice => {
        const key = invoice.file_path;
        
        if (!invoiceMap.has(key)) {
          invoiceMap.set(key, {
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            amount: invoice.amount,
            file_path: invoice.file_path,
            project_names: [],
            description: invoice.description || undefined,
            company_name: company?.name || '',
            payments: invoice.payments || [],
          });
        }
        
        const invoiceData = invoiceMap.get(key)!;
        invoice.project_links!.forEach((link: any) => {
          if (!invoiceData.project_names.includes(link.project.name)) {
            invoiceData.project_names.push(link.project.name);
          }
        });
      });

      // Convert map to array with comma-separated project names
      const projectInvoices = Array.from(invoiceMap.values()).map(inv => ({
        ...inv,
        project_names: inv.project_names.join(', '),
      }));

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
    
    // Tab filtering
    if (activeTab === 'pending' && hasProjects) return false;
    if (activeTab === 'assigned' && !hasProjects) return false;
    
    // Advanced filters
    if (filters.startDate && invoice.invoice_date < filters.startDate) return false;
    if (filters.endDate && invoice.invoice_date > filters.endDate) return false;
    if (filters.supplierName && !invoice.supplier_name?.toLowerCase().includes(filters.supplierName.toLowerCase())) return false;
    if (filters.invoiceNumber && !invoice.invoice_number.toLowerCase().includes(filters.invoiceNumber.toLowerCase())) return false;
    
    // Project filter
    if (filters.projectId) {
      const hasMatchingProject = invoice.project_links?.some((link: any) => link.project.id === filters.projectId);
      if (!hasMatchingProject) return false;
    }
    
    return true;
  });

  function handleClearFilters() {
    setFilters({
      startDate: '',
      endDate: '',
      supplierName: '',
      invoiceNumber: '',
      projectId: '',
    });
  }

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
            <Button 
              onClick={() => setShowFilters(!showFilters)}
              variant="ghost"
            >
              🔍 {showFilters ? 'Filtreleri Gizle' : 'Filtrele'}
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-secondary-900">Filtreler</h3>
                <Button 
                  onClick={handleClearFilters}
                  variant="ghost"
                  size="sm"
                >
                  Temizle
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Başlangıç Tarihi
                  </label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Bitiş Tarihi
                  </label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>

                {/* Supplier Name */}
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Firma Adı
                  </label>
                  <Input
                    type="text"
                    placeholder="Firma adı ara..."
                    value={filters.supplierName}
                    onChange={(e) => setFilters({ ...filters, supplierName: e.target.value })}
                  />
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Fatura No
                  </label>
                  <Input
                    type="text"
                    placeholder="Fatura no ara..."
                    value={filters.invoiceNumber}
                    onChange={(e) => setFilters({ ...filters, invoiceNumber: e.target.value })}
                  />
                </div>

                {/* Project */}
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Proje
                  </label>
                  <select
                    value={filters.projectId}
                    onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                    className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Tüm Projeler</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-secondary-200">
                <p className="text-sm text-secondary-600">
                  {filteredInvoices.length} fatura gösteriliyor
                </p>
              </div>
            </div>
          </Card>
        )}

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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Firma</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-secondary-600">Tutar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Ödeme Durumu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Projeler</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase text-secondary-600">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-secondary-500">
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
                        {invoice.supplier_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-600 max-w-xs truncate">
                        {invoice.description || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-secondary-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-600">
                        {(() => {
                          const totalPaid = invoice.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
                          const remaining = Number(invoice.amount) - totalPaid;
                          
                          if (totalPaid === 0) {
                            return (
                              <span className="inline-flex rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">
                                Ödenmedi
                              </span>
                            );
                          } else if (remaining <= 0.01) {
                            return (
                              <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                                Ödendi
                              </span>
                            );
                          } else {
                            return (
                              <div className="space-y-1">
                                <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                  Kısmi: {formatCurrency(totalPaid)}
                                </span>
                                <div className="text-xs text-secondary-500">
                                  Kalan: {formatCurrency(remaining)}
                                </div>
                              </div>
                            );
                          }
                        })()}
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
                        {canUpdate && (
                          <button
                            onClick={() => openPaymentModal(invoice)}
                            className="text-green-600 hover:text-green-700"
                          >
                            Ödeme
                          </button>
                        )}
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
          {/* File Upload */}
          <FileUploader onFileSelect={setSelectedFile} />
          
          {/* Firma Bilgileri */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-secondary-700 mb-3">Firma Bilgileri</h3>
            <Input
              label="Fatura Firma Adı"
              value={formData.supplier_name}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              placeholder="Tedarikçi firma adı"
            />
          </div>

          {/* Fatura Detayları */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-secondary-700 mb-3">Fatura Detayları</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Fatura No"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                required
                placeholder="FT-2024-001"
              />
              <Input
                label="Fatura Tarihi"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Tutar Bilgileri */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-secondary-700 mb-3">Tutar Bilgileri</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <CurrencyInput
                label="Mal ve Hizmet Toplamı (₺)"
                value={formData.goods_services_total}
                onChange={(value) => setFormData({ ...formData, goods_services_total: value })}
                placeholder="1.000.200,25"
              />
              <CurrencyInput
                label="KDV (₺)"
                value={formData.vat_amount}
                onChange={(value) => setFormData({ ...formData, vat_amount: value })}
                placeholder="180.000,50"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <CurrencyInput
                label="Tevkifat (₺)"
                value={formData.withholding_amount}
                onChange={(value) => setFormData({ ...formData, withholding_amount: value })}
                placeholder="50.000,00"
              />
              <CurrencyInput
                label="Toplam Tutar (₺)"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                required
                placeholder="Otomatik hesaplanır"
                readOnly
                className="bg-secondary-50"
              />
            </div>
          </div>

          {/* Açıklama */}
          <div className="border-t pt-4">
            <Input
              label="Açıklama (Opsiyonel)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ekstra notlar..."
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>İptal</Button>
            <Button type="submit" isLoading={isUploading} disabled={!selectedFile}>Fatura Ekle</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Fatura Düzenle" size="xl">
        <form onSubmit={handleEditSubmit} className="space-y-6">
          {/* Firma Bilgileri */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">Firma Bilgileri</h3>
            <Input
              label="Tedarikçi/Firma Adı"
              value={formData.supplier_name}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              placeholder="Örn: ABC İnşaat Ltd. Şti."
            />
          </div>

          {/* Fatura Detayları */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">Fatura Detayları</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Fatura Numarası"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                required
              />
              <Input
                label="Fatura Tarihi"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Tutar Bilgileri */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">Tutar Bilgileri</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <CurrencyInput
                label="Mal/Hizmet Toplam (₺)"
                value={formData.goods_services_total}
                onChange={(value) => setFormData({ ...formData, goods_services_total: value })}
                placeholder="1.000.200,25"
              />
              <CurrencyInput
                label="KDV Tutarı (₺)"
                value={formData.vat_amount}
                onChange={(value) => setFormData({ ...formData, vat_amount: value })}
                placeholder="180.000,50"
              />
              <CurrencyInput
                label="Tevkifat Tutarı (₺)"
                value={formData.withholding_amount}
                onChange={(value) => setFormData({ ...formData, withholding_amount: value })}
                placeholder="50.000,00"
              />
              <CurrencyInput
                label="Toplam Tutar (₺)"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                required
                placeholder="Otomatik hesaplanır"
                readOnly
                className="bg-secondary-50"
              />
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">Açıklama</h3>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Fatura ile ilgili ek notlar..."
            />
          </div>

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

      {/* Payment Modal */}
      <Modal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        title="Ödeme Ekle"
        size="lg"
      >
        <form onSubmit={handleAddPayments} className="space-y-4">
          <div className="rounded-lg bg-secondary-50 p-3">
            <p className="text-sm text-secondary-700">
              <span className="font-medium">Fatura:</span> {selectedInvoice?.invoice_number}
            </p>
            <p className="text-sm text-secondary-700">
              <span className="font-medium">Toplam Tutar:</span> {selectedInvoice && formatCurrency(selectedInvoice.amount)}
            </p>
          </div>

          {/* Existing Payments */}
          {payments.length > 0 && (
            <div className="rounded-lg border border-secondary-200 p-4">
              <h3 className="text-sm font-semibold text-secondary-900 mb-3">Mevcut Ödemeler</h3>
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-secondary-900">{payment.payment_type}</span>
                      <span className="ml-2 text-xs text-secondary-500">
                        {formatDate(payment.payment_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-secondary-900">
                        {formatCurrency(payment.amount)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Ödemeyi Sil"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="border-t border-secondary-300 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary-700">Toplam Ödenen:</span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(payments.reduce((sum, p) => sum + Number(p.amount), 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-medium text-secondary-700">Kalan:</span>
                    <span className="text-sm font-semibold text-red-600">
                      {selectedInvoice && formatCurrency(
                        Number(selectedInvoice.amount) - payments.reduce((sum, p) => sum + Number(p.amount), 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Payments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-secondary-900">Yeni Ödeme Ekle</h3>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={addPaymentType}
                className="text-xs"
              >
                + Ödeme Tipi Ekle
              </Button>
            </div>

            {selectedPaymentTypes.map((payment, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Ödeme Tipi
                  </label>
                  <select
                    value={payment.type}
                    onChange={(e) => updatePaymentType(index, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Seçiniz</option>
                    <option value="Kasadan Nakit">Kasadan Nakit</option>
                    <option value="Kredi Kartı">Kredi Kartı</option>
                    <option value="Banka Transferi">Banka Transferi</option>
                    <option value="Çek">Çek</option>
                    <option value="Senet">Senet</option>
                    <option value="Havale/EFT">Havale/EFT</option>
                    <option value="Cari">Cari</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Tutar (₺)
                  </label>
                  <CurrencyInput
                    value={payment.amount}
                    onChange={(value) => updatePaymentType(index, 'amount', value)}
                    required
                    placeholder="0,00"
                  />
                </div>
                {selectedPaymentTypes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePaymentType(index)}
                    className="mt-7 text-red-600 hover:text-red-700"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit" isLoading={isUploading}>
              Ödeme Ekle
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </Sidebar>
  );
}
