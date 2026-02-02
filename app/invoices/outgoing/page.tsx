'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { FileUploader } from '@/components/ui/FileUploader';
import { supabase } from '@/lib/supabase/client';
import { uploadInvoicePDF } from '@/lib/supabase/storage';
import { generateProjectInvoicesReport, downloadPdfBlob } from '@/lib/supabase/pdf-utils';
import { formatCurrency, formatDate, parseCurrencyInput, numberToTurkishCurrency } from '@/lib/utils';
import { Project, InvoiceQRData } from '@/types';
import { getOrCreateCustomer } from '@/lib/supabase/customers';
import ExcelJS from 'exceljs';

type TabType = 'pending' | 'assigned' | 'all';

interface OutgoingInvoice {
  id: string;
  company_id: string;
  customer_id?: string;
  invoice_number: string;
  invoice_date: string;
  amount: number;
  description?: string;
  customer_name?: string;
  customer_vkn?: string;
  file_path: string;
  file_name: string;
  goods_services_total?: number;
  vat_amount?: number;
  withholding_amount?: number;
  created_at: string;
  project_links?: Array<{
    id: string;
    project: {
      id: string;
      name: string;
    };
  }>;
}

function OutgoingInvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, company, hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<OutgoingInvoice | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [qrMetadata, setQRMetadata] = useState<InvoiceQRData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [showFilters, setShowFilters] = useState(false);

  const projectFilter = searchParams.get('project');

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    customerName: '',
    invoiceNumber: '',
    projectId: projectFilter || '',
  });

  const [sortConfig, setSortConfig] = useState<{
    field: 'date' | 'project' | 'amount' | 'customer' | null;
    direction: 'asc' | 'desc';
  }>({
    field: 'date',
    direction: 'desc'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [formData, setFormData] = useState({
    amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    description: '',
    customer_name: '',
    customer_vkn: '',
    goods_services_total: '',
    vat_amount: '',
    withholding_amount: '',
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
    if (projectFilter) {
      setFilters(prev => ({ ...prev, projectId: projectFilter }));
      setShowFilters(true);
    }
  }, [projectFilter]);

  useEffect(() => {
    if (company) {
      loadInvoices();
      loadProjects();
    }
  }, [company]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortConfig.field, sortConfig.direction]);

  // Otomatik tutar hesaplama (QR olmadığında)
  useEffect(() => {
    if (qrMetadata) return;

    const goodsServices = formData.goods_services_total ? parseCurrencyInput(formData.goods_services_total) : 0;
    const vat = formData.vat_amount ? parseCurrencyInput(formData.vat_amount) : 0;
    const withholding = formData.withholding_amount ? parseCurrencyInput(formData.withholding_amount) : 0;

    const total = goodsServices + vat - withholding;

    if (goodsServices > 0 || vat > 0 || withholding > 0) {
      setFormData(prev => ({
        ...prev,
        amount: numberToTurkishCurrency(total)
      }));
    }
  }, [formData.goods_services_total, formData.vat_amount, formData.withholding_amount, qrMetadata]);

  async function loadInvoices() {
    try {
      const { data, error } = await supabase
        .from('outgoing_invoices')
        .select(`
          *,
          project_links:outgoing_invoice_project_links(
            id,
            project:projects(id, name)
          )
        `)
        .eq('company_id', company!.id)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading outgoing invoices:', error);
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

  function openAssignModal(invoice: OutgoingInvoice) {
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
          .from('outgoing_invoice_project_links')
          .delete()
          .in('project_id', toRemove)
          .eq('outgoing_invoice_id', selectedInvoice.id);

        if (deleteError) throw deleteError;
      }

      if (toAdd.length > 0) {
        const linksToAdd = toAdd.map(projectId => ({
          outgoing_invoice_id: selectedInvoice.id,
          project_id: projectId,
        }));

        const { error: insertError } = await supabase
          .from('outgoing_invoice_project_links')
          .insert(linksToAdd);

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

  function handleQRDataExtracted(qrData: InvoiceQRData) {
    console.log('QR data extracted:', qrData);

    setFormData({
      amount: '',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      description: '',
      customer_name: '',
      customer_vkn: '',
      goods_services_total: '',
      vat_amount: '',
      withholding_amount: '',
    });

    setQRMetadata(qrData);

    const updates: any = {};

    if (qrData.invoiceNumber) {
      updates.invoice_number = qrData.invoiceNumber;
    }

    if (qrData.invoiceDate) {
      updates.invoice_date = qrData.invoiceDate;
    }

    // GİDEN FATURA için ALICI bilgilerini kullan (buyerVKN)
    if (qrData.buyerVKN) {
      updates.customer_vkn = qrData.buyerVKN;
    }

    // Alıcı adı varsa kullan
    if (qrData.buyerName) {
      updates.customer_name = qrData.buyerName;
    }

    if (qrData.goodsServicesTotal !== undefined) {
      updates.goods_services_total = numberToTurkishCurrency(qrData.goodsServicesTotal);
    }

    if (qrData.vatAmount !== undefined) {
      updates.vat_amount = numberToTurkishCurrency(qrData.vatAmount);
    }

    if (qrData.withholdingAmount !== undefined) {
      updates.withholding_amount = numberToTurkishCurrency(qrData.withholdingAmount);
    }

    if (qrData.totalAmount !== undefined) {
      updates.amount = numberToTurkishCurrency(qrData.totalAmount);
    }

    // Müşteri adını VKN'den getir
    if (qrData.buyerVKN && company) {
      getOrCreateCustomer(qrData.buyerVKN, qrData.buyerName || 'Bilinmeyen Müşteri', company.id)
        .then(customer => {
          if (customer && customer.name && customer.name !== 'Bilinmeyen Müşteri') {
            setFormData(prev => ({
              ...prev,
              customer_name: customer.name
            }));
          } else if (qrData.buyerName) {
            setFormData(prev => ({
              ...prev,
              customer_name: qrData.buyerName || ''
            }));
          }
        })
        .catch(err => {
          console.error('Error looking up customer:', err);
          if (qrData.buyerName) {
            setFormData(prev => ({
              ...prev,
              customer_name: qrData.buyerName || ''
            }));
          }
        });
    } else if (qrData.buyerName) {
      updates.customer_name = qrData.buyerName;
    }

    setFormData(prev => ({ ...prev, ...updates }));

    const fieldsFound = Object.keys(updates).length;
    if (fieldsFound > 0) {
      console.log(`✅ QR kod başarıyla okundu! ${fieldsFound} alan dolduruldu.`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !company) return;

    if (!formData.customer_vkn || !formData.customer_vkn.trim()) {
      alert('⚠️ Müşteri VKN zorunludur!');
      return;
    }

    if (!/^\d{10,11}$/.test(formData.customer_vkn.trim())) {
      alert('⚠️ VKN 10 veya 11 haneli rakam olmalıdır!');
      return;
    }

    setIsUploading(true);

    try {
      // Check for duplicate invoice number
      const { data: existingInvoice } = await supabase
        .from('outgoing_invoices')
        .select('id, invoice_number')
        .eq('company_id', company.id)
        .eq('invoice_number', formData.invoice_number)
        .maybeSingle();

      if (existingInvoice) {
        alert(`⚠️ Bu fatura numarası (${formData.invoice_number}) zaten kayıtlı!`);
        setIsUploading(false);
        return;
      }

      const uploadResult = await uploadInvoicePDF(selectedFile, company.id);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      // Get or create customer
      let customer = null;
      if (formData.customer_vkn && formData.customer_name) {
        customer = await getOrCreateCustomer(
          formData.customer_vkn,
          formData.customer_name,
          company.id
        );
      }

      const { error } = await supabase.from('outgoing_invoices').insert({
        company_id: company.id,
        uploaded_by: user!.id,
        file_path: uploadResult.url!,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        amount: parseCurrencyInput(formData.amount),
        invoice_date: formData.invoice_date,
        invoice_number: formData.invoice_number,
        description: formData.description || null,
        customer_name: formData.customer_name || null,
        customer_vkn: formData.customer_vkn || null,
        customer_id: customer?.id || null,
        goods_services_total: formData.goods_services_total ? parseCurrencyInput(formData.goods_services_total) : null,
        vat_amount: formData.vat_amount ? parseCurrencyInput(formData.vat_amount) : null,
        withholding_amount: formData.withholding_amount ? parseCurrencyInput(formData.withholding_amount) : null,
        buyer_vkn: qrMetadata?.buyerVKN || formData.customer_vkn,
        invoice_scenario: qrMetadata?.scenario || null,
        invoice_type: qrMetadata?.type || null,
        invoice_ettn: qrMetadata?.etag || null,
        currency: qrMetadata?.currency || 'TRY',
        qr_metadata: qrMetadata || null,
      });

      if (error) throw error;

      setFormData({
        amount: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        description: '',
        customer_name: '',
        customer_vkn: '',
        goods_services_total: '',
        vat_amount: '',
        withholding_amount: '',
      });
      setSelectedFile(null);
      setQRMetadata(null);
      setIsModalOpen(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Error creating outgoing invoice:', error);
      if (error.code === '23505') {
        alert(`⚠️ Bu fatura numarası (${formData.invoice_number}) zaten kayıtlı!`);
      } else {
        alert(error.message || 'Fatura oluşturulurken hata oluştu');
      }
    } finally {
      setIsUploading(false);
    }
  }

  function openEditModal(invoice: OutgoingInvoice) {
    setSelectedInvoice(invoice);
    setFormData({
      amount: invoice.amount.toString(),
      invoice_date: invoice.invoice_date,
      invoice_number: invoice.invoice_number,
      description: invoice.description || '',
      customer_name: invoice.customer_name || '',
      customer_vkn: invoice.customer_vkn || '',
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
        .from('outgoing_invoices')
        .update({
          amount: parseCurrencyInput(formData.amount),
          invoice_date: formData.invoice_date,
          invoice_number: formData.invoice_number,
          description: formData.description,
          customer_name: formData.customer_name || null,
          customer_vkn: formData.customer_vkn || null,
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
        customer_name: '',
        customer_vkn: '',
        goods_services_total: '',
        vat_amount: '',
        withholding_amount: '',
      });
      setSelectedInvoice(null);
      setIsEditModalOpen(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Error updating outgoing invoice:', error);
      alert(error.message || 'Fatura güncellenirken hata oluştu');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(invoice: OutgoingInvoice) {
    if (!confirm('Bu faturayı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('outgoing_invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      loadInvoices();
    } catch (error: any) {
      console.error('Error deleting outgoing invoice:', error);
      alert(error.message || 'Fatura silinirken hata oluştu');
    }
  }

  async function handleGenerateReport() {
    setIsGeneratingReport(true);

    try {
      // Get filtered assigned invoices with their projects
      const assignedInvoices = sortedInvoices.filter(
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
      downloadPdfBlob(pdfBlob, `giden-fatura-raporu-${today}.pdf`);
    } catch (error: any) {
      console.error('Error generating report:', error);
      alert(error.message || 'Rapor oluşturulurken hata oluştu');
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function handleExportExcel() {
    try {
      const dataToExport = sortedInvoices.map((invoice, index) => {
        const withholdingAmount = Number(invoice.withholding_amount) || 0;
        const projectNames = invoice.project_links?.map((link: any) => link.project?.name).filter(Boolean).join(', ') || 'Atanmadı';

        return [
          index + 1,
          invoice.invoice_number,
          formatDate(invoice.invoice_date),
          invoice.customer_name || '-',
          Number(invoice.amount),
          withholdingAmount,
          projectNames,
          invoice.description || '-',
        ];
      });

      if (dataToExport.length === 0) {
        alert('Dışa aktarılacak fatura bulunamadı!');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Giden Faturalar');

      const headers = ['Sıra', 'Fatura No', 'Tarih', 'Müşteri', 'Tutar', 'Tevkifat', 'Projeler', 'Açıklama'];

      worksheet.columns = [
        { key: 'sira', width: 8 },
        { key: 'faturaNo', width: 17 },
        { key: 'tarih', width: 13 },
        { key: 'musteri', width: 27 },
        { key: 'tutar', width: 16 },
        { key: 'tevkifat', width: 16 },
        { key: 'projeler', width: 32 },
        { key: 'aciklama', width: 42 },
      ];

      const headerRow = worksheet.addRow(headers);

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 11
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      let totalAmount = 0;
      let totalWithholding = 0;

      dataToExport.forEach((rowData, index) => {
        const row = worksheet.addRow(rowData);

        totalAmount += typeof rowData[4] === 'number' ? rowData[4] : 0;
        totalWithholding += typeof rowData[5] === 'number' ? rowData[5] : 0;

        const isEvenRow = (index + 1) % 2 === 0;
        const bgColor = isEvenRow ? 'FFF2F2F2' : 'FFFFFFFF';

        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };

          if (colNumber === 5 || colNumber === 6) {
            cell.numFmt = '#,##0.00 "₺"';
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'right'
            };
          } else {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left'
            };
          }

          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
          };

          cell.font = {
            size: 10
          };
        });
      });

      const totalRow = worksheet.addRow([
        '',
        '',
        '',
        'TOPLAM',
        totalAmount,
        totalWithholding,
        '',
        ''
      ]);

      totalRow.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2E7D32' }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 11
        };

        if (colNumber === 5 || colNumber === 6) {
          cell.numFmt = '#,##0.00 "₺"';
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'right'
          };
        } else if (colNumber === 4) {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'right'
          };
        } else {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };
        }

        cell.border = {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: dataToExport.length + 1, column: headers.length }
      };

      const date = new Date().toISOString().split('T')[0];
      let fileName = `GidenFaturalar_${date}`;

      if (activeTab === 'pending') fileName += '_AtanmayanFaturalar';
      else if (activeTab === 'assigned') fileName += '_AtananFaturalar';

      if (filters.projectId) {
        const project = projects.find(p => p.id === filters.projectId);
        if (project) fileName += `_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }

      fileName += '.xlsx';

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);

      console.log(`Excel export: ${dataToExport.length} giden fatura dışa aktarıldı`);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Excel dosyası oluşturulurken bir hata oluştu');
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

    if (activeTab === 'pending' && hasProjects) return false;
    if (activeTab === 'assigned' && !hasProjects) return false;

    if (filters.startDate && invoice.invoice_date < filters.startDate) return false;
    if (filters.endDate && invoice.invoice_date > filters.endDate) return false;
    if (filters.customerName && !invoice.customer_name?.toLowerCase().includes(filters.customerName.toLowerCase())) return false;
    if (filters.invoiceNumber && !invoice.invoice_number.toLowerCase().includes(filters.invoiceNumber.toLowerCase())) return false;

    if (filters.projectId) {
      const hasMatchingProject = invoice.project_links?.some((link: any) => link.project.id === filters.projectId);
      if (!hasMatchingProject) return false;
    }

    return true;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (!sortConfig.field) return 0;

    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    switch (sortConfig.field) {
      case 'date':
        return direction * (new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime());

      case 'project':
        const aProject = a.project_links?.[0]?.project?.name || '';
        const bProject = b.project_links?.[0]?.project?.name || '';
        return direction * aProject.localeCompare(bProject, 'tr');

      case 'amount':
        return direction * (Number(a.amount) - Number(b.amount));

      case 'customer':
        const aCustomer = a.customer_name || '';
        const bCustomer = b.customer_name || '';
        return direction * aCustomer.localeCompare(bCustomer, 'tr');

      default:
        return 0;
    }
  });

  function handleSort(field: 'date' | 'project' | 'amount' | 'customer') {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }

  function handleClearFilters() {
    setFilters({
      startDate: '',
      endDate: '',
      customerName: '',
      invoiceNumber: '',
      projectId: '',
    });
  }

  const pendingCount = invoices.filter(inv => !inv.project_links || inv.project_links.length === 0).length;
  const assignedCount = invoices.filter(inv => inv.project_links && inv.project_links.length > 0).length;

  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = sortedInvoices.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const selectedProject = projects.find(p => p.id === filters.projectId);
  const pageTitle = selectedProject
    ? `${selectedProject.name} - Giden Faturalar`
    : 'Giden Faturalar';

  return (
    <Sidebar>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">{pageTitle}</h1>
            <p className="mt-1 text-sm text-secondary-600">
              {selectedProject ? (
                <>
                  {sortedInvoices.length} fatura bu projeye atanmış
                </>
              ) : (
                <>
                  {pendingCount} bekleyen, {assignedCount} atanmış fatura
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleExportExcel}
              variant="ghost"
              disabled={assignedCount === 0}
            >
              📊 Excel İndir
            </Button>
            <Button
              onClick={handleGenerateReport}
              isLoading={isGeneratingReport}
              variant="ghost"
              disabled={assignedCount === 0}
            >
              📥 PDF Rapor İndir
            </Button>
            {canCreate && (
              <>
                <Button onClick={() => setIsModalOpen(true)}>
                  + Yeni Fatura Ekle
                </Button>
                <Button
                  onClick={() => router.push('/invoices/outgoing/bulk')}
                  variant="secondary"
                >
                  📦 Toplu Fatura Ekle
                </Button>
              </>
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

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Müşteri Adı
                  </label>
                  <Input
                    type="text"
                    placeholder="Müşteri adı ara..."
                    value={filters.customerName}
                    onChange={(e) => setFilters({ ...filters, customerName: e.target.value })}
                  />
                </div>

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
                  {sortedInvoices.length} fatura gösteriliyor
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Sorting Controls */}
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary-700">Sıralama</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleSort('date')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${sortConfig.field === 'date'
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
              >
                📅 Tarihe Göre
                {sortConfig.field === 'date' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => handleSort('project')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${sortConfig.field === 'project'
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
              >
                📁 Projeye Göre
                {sortConfig.field === 'project' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => handleSort('amount')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${sortConfig.field === 'amount'
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
              >
                💰 Tutara Göre
                {sortConfig.field === 'amount' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => handleSort('customer')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${sortConfig.field === 'customer'
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
              >
                🏢 Müşteriye Göre
                {sortConfig.field === 'customer' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </div>
          </div>
        </Card>

        <div className="border-b border-secondary-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'pending'
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
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'assigned'
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
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'all'
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Müşteri</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-secondary-600">Tutar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-secondary-600">Projeler</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase text-secondary-600">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {sortedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-secondary-500">
                      {activeTab === 'pending' && 'Bekleyen fatura bulunmuyor'}
                      {activeTab === 'assigned' && 'Atanmış fatura bulunmuyor'}
                      {activeTab === 'all' && 'Henüz fatura bulunmuyor'}
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-secondary-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary-900">
                        {formatDate(invoice.invoice_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-900">
                        {invoice.invoice_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-900">
                        {invoice.customer_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary-600 max-w-xs truncate">
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

          {sortedInvoices.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedInvoices.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </Card>
      </div>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yeni Giden Fatura Ekle" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FileUploader
            onFileSelect={setSelectedFile}
            onFileRemove={() => {
              setQRMetadata(null);
              setFormData({
                amount: '',
                invoice_date: new Date().toISOString().split('T')[0],
                invoice_number: '',
                description: '',
                customer_name: '',
                customer_vkn: '',
                goods_services_total: '',
                vat_amount: '',
                withholding_amount: '',
              });
            }}
            onQRDataExtracted={handleQRDataExtracted}
            enableQRScanning={true}
          />

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-secondary-700 mb-3">Müşteri Bilgileri</h3>
            <div className="grid gap-4">
              <Input
                label="Müşteri Firma Adı"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Müşteri firma adı"
                required
              />
              <Input
                label="Müşteri VKN"
                value={formData.customer_vkn}
                onChange={(e) => {
                  const vknValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                  setFormData({ ...formData, customer_vkn: vknValue });
                }}
                placeholder="10 veya 11 haneli VKN"
                required
                maxLength={11}
              />
            </div>
          </div>

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
                label="Toplam Tutar (₺) 🧮"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                required
                placeholder={qrMetadata ? "QR'dan gelen tutar" : "Otomatik hesaplanır"}
                className={qrMetadata ? "bg-blue-50 font-semibold" : "bg-green-50 font-semibold"}
              />
            </div>
            {formData.amount && (
              <div className={`mt-3 rounded-lg border px-3 py-2 ${qrMetadata ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                {qrMetadata ? (
                  <p className="text-xs text-blue-700">
                    <span className="font-medium">🔷 QR Verisi:</span> Faturada yazdığı ödenecek tutar: <span className="font-bold text-blue-900">{formData.amount}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">💡 Otomatik Hesaplama:</span> Mal/Hizmet ({formData.goods_services_total || '0'}) + KDV ({formData.vat_amount || '0'}) - Tevkifat ({formData.withholding_amount || '0'}) = <span className="font-bold text-amber-900">{formData.amount}</span>
                  </p>
                )}
              </div>
            )}
          </div>

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

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Fatura Düzenle" size="xl">
        <form onSubmit={handleEditSubmit} className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">Müşteri Bilgileri</h3>
            <div className="grid gap-4">
              <Input
                label="Müşteri Firma Adı"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Müşteri firma adı"
                required
              />
              <Input
                label="Müşteri VKN"
                value={formData.customer_vkn}
                onChange={(e) => {
                  const vknValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                  setFormData({ ...formData, customer_vkn: vknValue });
                }}
                placeholder="10 veya 11 haneli VKN"
                required
                maxLength={11}
              />
            </div>
          </div>

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
                label="Toplam Tutar (₺) 🧮"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                required
                placeholder="Manuel girin veya otomatik hesaplansın"
                className="bg-amber-50 font-semibold"
              />
            </div>
          </div>

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

      {/* Assign Projects Modal */}
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

export default function OutgoingInvoicesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-secondary-600">Yükleniyor...</div></div>}>
      <OutgoingInvoicesContent />
    </Suspense>
  );
}
