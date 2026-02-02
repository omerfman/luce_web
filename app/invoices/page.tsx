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
import { Invoice, Project, InvoiceQRData } from '@/types';
import { getOrCreateSupplier } from '@/lib/supabase/suppliers';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

type TabType = 'pending' | 'assigned' | 'all';

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [qrMetadata, setQRMetadata] = useState<InvoiceQRData | null>(null); // QR'dan gelen tüm data
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPaymentTypes, setSelectedPaymentTypes] = useState<Array<{type: string, amount: string, payment_date: string, project_id: string}>>([{type: '', amount: '', payment_date: '', project_id: ''}]);
  const [splitEqually, setSplitEqually] = useState(false);
  
  // Get project filter from URL
  const projectFilter = searchParams.get('project');
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    supplierName: '',
    invoiceNumber: '',
    projectId: projectFilter || '',
  });
  
  const [sortConfig, setSortConfig] = useState<{
    field: 'date' | 'project' | 'amount' | 'supplier' | null;
    direction: 'asc' | 'desc';
  }>({
    field: 'date',
    direction: 'desc'
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [formData, setFormData] = useState({
    amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    description: '',
    supplier_name: '',
    supplier_vkn: '',
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

  // Update filters when URL project parameter changes
  useEffect(() => {
    if (projectFilter) {
      setFilters(prev => ({ ...prev, projectId: projectFilter }));
      setShowFilters(true); // Show filters when coming from project page
    }
  }, [projectFilter]);

  useEffect(() => {
    if (company) {
      loadInvoices();
      loadProjects();
    }
  }, [company]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortConfig.field, sortConfig.direction]);

  // Otomatik tutar hesaplama: Toplam = Mal/Hizmet + KDV - Tevkifat
  // SADECE QR okunmadığında çalışır (manuel girişte)
  useEffect(() => {
    // QR'dan veri geldiyse otomatik hesaplama yapma
    if (qrMetadata) {
      console.log('QR data mevcut, otomatik hesaplama devre dışı');
      return;
    }
    
    const goodsServices = formData.goods_services_total ? parseCurrencyInput(formData.goods_services_total) : 0;
    const vat = formData.vat_amount ? parseCurrencyInput(formData.vat_amount) : 0;
    const withholding = formData.withholding_amount ? parseCurrencyInput(formData.withholding_amount) : 0;
    
    const total = goodsServices + vat - withholding;
    
    // Sadece geçerli değerler varsa güncelle
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
    const defaultProjectId = invoice.project_links?.length === 1 ? invoice.project_links[0]?.project?.id || '' : '';
    setSelectedPaymentTypes([{type: '', amount: '', payment_date: '', project_id: defaultProjectId}]);
    setSplitEqually(false);
    loadPayments(invoice.id);
    setIsPaymentModalOpen(true);
  }

  function addPaymentType() {
    const defaultProjectId = selectedInvoice?.project_links?.length === 1 ? selectedInvoice.project_links[0]?.project?.id || '' : '';
    setSelectedPaymentTypes([...selectedPaymentTypes, {type: '', amount: '', payment_date: '', project_id: defaultProjectId}]);
  }

  function removePaymentType(index: number) {
    setSelectedPaymentTypes(selectedPaymentTypes.filter((_, i) => i !== index));
  }

  function updatePaymentType(index: number, field: 'type' | 'amount' | 'payment_date' | 'project_id', value: string) {
    const updated = [...selectedPaymentTypes];
    updated[index][field] = value;
    setSelectedPaymentTypes(updated);
  }

  async function handleAddPayments(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice || !company) return;

    const validPayments = selectedPaymentTypes.filter(p => p.type);
    if (validPayments.length === 0) {
      alert('Lütfen en az bir ödeme tipi seçin');
      return;
    }

    // Eğer fatura birden fazla projeye atanmışsa, her ödeme için proje seçimi zorunludur (eşit paylaştır seçili değilse)
    const hasMultipleProjects = (selectedInvoice.project_links?.length || 0) > 1;
    if (hasMultipleProjects && !splitEqually) {
      const missingProject = validPayments.some(p => !p.project_id);
      if (missingProject) {
        alert('Fatura birden fazla projeye atanmış. Lütfen her ödeme için proje seçin veya "Eşit Paylaştır" seçeneğini kullanın.');
        return;
      }
    }

    // Eşit paylaştır seçiliyse, tutar zorunludur
    if (splitEqually) {
      const missingAmount = validPayments.some(p => !p.amount);
      if (missingAmount) {
        alert('Eşit paylaştır seçeneği için tutar girmelisiniz.');
        return;
      }
    }

    setIsUploading(true);

    try {
      // Önceden ödenmiş toplam tutarı hesapla
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      // Şimdi girilecek manuel tutarları topla
      const manualTotal = validPayments.reduce((sum, p) => {
        return p.amount ? sum + parseCurrencyInput(p.amount) : sum;
      }, 0);
      
      // Gerçek kalan tutarı hesapla: Fatura - (Önceki Ödemeler + Yeni Manuel Tutarlar)
      const remainingAmount = Number(selectedInvoice.amount) - totalPaid - manualTotal;
      
      // Boş alan sayısını kontrol et
      const emptyFieldsCount = validPayments.filter(p => !p.amount).length;
      
      if (emptyFieldsCount > 1) {
        alert('Sadece bir ödeme tutarını boş bırakabilirsiniz. Lütfen diğer ödeme tutarlarını girin.');
        setIsUploading(false);
        return;
      }
      
      if (emptyFieldsCount === 1 && remainingAmount < 0) {
        alert(`Girdiğiniz tutarlar toplamı fatura tutarını aşıyor. Kalan tutar: ${formatCurrency(Number(selectedInvoice.amount) - totalPaid)} TL`);
        setIsUploading(false);
        return;
      }

      // Eşit paylaştır seçiliyse, her proje için ayrı ödeme kaydı oluştur
      let paymentsToInsert: any[] = [];
      
      if (splitEqually && hasMultipleProjects) {
        // Her ödeme tipini her projeye böl
        validPayments.forEach(p => {
          const totalAmount = p.amount ? parseCurrencyInput(p.amount) : remainingAmount;
          const projectCount = selectedInvoice.project_links?.length || 1;
          const amountPerProject = totalAmount / projectCount;
          
          selectedInvoice.project_links?.forEach((link: any) => {
            paymentsToInsert.push({
              invoice_id: selectedInvoice.id,
              company_id: company.id,
              payment_type: p.type,
              amount: amountPerProject,
              payment_date: p.payment_date || new Date().toISOString().split('T')[0],
              project_id: link.project.id,
              created_by: user!.id,
            });
          });
        });
      } else {
        // Normal ödeme kayıtları
        paymentsToInsert = validPayments.map(p => ({
          invoice_id: selectedInvoice.id,
          company_id: company.id,
          payment_type: p.type,
          // Tutar boşsa gerçek kalan tutarı kullan
          amount: p.amount ? parseCurrencyInput(p.amount) : remainingAmount,
          // Tarih boşsa bugünün tarihini kullan
          payment_date: p.payment_date || new Date().toISOString().split('T')[0],
          // Proje ID'sini ekle (tek proje veya çoklu proje durumunda)
          project_id: p.project_id || (selectedInvoice.project_links?.length === 1 ? selectedInvoice.project_links[0]?.project?.id || null : null),
          created_by: user!.id,
        }));
      }

      const { error } = await supabase
        .from('payments')
        .insert(paymentsToInsert);

      if (error) throw error;

      // Başarı mesajı
      if (splitEqually && hasMultipleProjects) {
        const projectCount = selectedInvoice.project_links?.length || 0;
        alert(`${paymentsToInsert.length} ödeme kaydı başarıyla oluşturuldu (${validPayments.length} ödeme tipi × ${projectCount} proje)`);
      }

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

  function handleQRDataExtracted(qrData: InvoiceQRData) {
    console.log('QR data extracted:', qrData);
    
    // Yeni QR geldiğinde önceki formu temizle (tevkifat gibi eski değerler kalmasın)
    setFormData({
      amount: '',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      description: '',
      supplier_name: '',
      supplier_vkn: '',
      goods_services_total: '',
      vat_amount: '',
      withholding_amount: '',
    });
    
    // Save full QR data for later use in metadata
    setQRMetadata(qrData);
    
    // Map QR data to form data
    const updates: any = {};
    
    if (qrData.invoiceNumber) {
      updates.invoice_number = qrData.invoiceNumber;
    }
    
    if (qrData.invoiceDate) {
      updates.invoice_date = qrData.invoiceDate;
    }
    
    if (qrData.supplierName) {
      updates.supplier_name = qrData.supplierName;
    }
    
    if (qrData.taxNumber) {
      updates.supplier_vkn = qrData.taxNumber;
    }
    
    if (qrData.goodsServicesTotal !== undefined) {
      // Convert number to Turkish format: 15090.4 → "15.090,40"
      updates.goods_services_total = numberToTurkishCurrency(qrData.goodsServicesTotal);
      console.log('Goods/Services:', qrData.goodsServicesTotal, '→', updates.goods_services_total);
    }
    
    if (qrData.vatAmount !== undefined) {
      // Convert number to Turkish format: 3018.08 → "3.018,08"
      updates.vat_amount = numberToTurkishCurrency(qrData.vatAmount);
      console.log('VAT Amount:', qrData.vatAmount, '→', updates.vat_amount);
    }
    
    if (qrData.withholdingAmount !== undefined) {
      updates.withholding_amount = numberToTurkishCurrency(qrData.withholdingAmount);
      console.log('Withholding:', qrData.withholdingAmount, '→', updates.withholding_amount);
    }
    
    // Always use totalAmount from QR (ödenecek miktar) directly as the total
    if (qrData.totalAmount !== undefined) {
      updates.amount = numberToTurkishCurrency(qrData.totalAmount);
      console.log('Total Amount (ödenecek):', qrData.totalAmount, '→', updates.amount);
    }
    
    // Auto-fill supplier name from VKN if available
    if (qrData.taxNumber && company) {
      console.log('VKN found, looking up supplier:', qrData.taxNumber);
      
      // Async lookup - don't block the form update
      getOrCreateSupplier(qrData.taxNumber, qrData.supplierName || 'Bilinmeyen Tedarikçi', company.id)
        .then(supplier => {
          if (supplier && supplier.name && supplier.name !== 'Bilinmeyen Tedarikçi') {
            console.log('Supplier found from cache:', supplier.name);
            setFormData(prev => ({
              ...prev,
              supplier_name: supplier.name
            }));
          } else if (qrData.supplierName) {
            console.log('Using supplier name from QR:', qrData.supplierName);
            setFormData(prev => ({
              ...prev,
              supplier_name: qrData.supplierName || ''
            }));
          }
        })
        .catch(err => {
          console.error('Error looking up supplier:', err);
          if (qrData.supplierName) {
            setFormData(prev => ({
              ...prev,
              supplier_name: qrData.supplierName || ''
            }));
          }
        });
    } else if (qrData.supplierName) {
      updates.supplier_name = qrData.supplierName;
    }
    
    // Update form data
    setFormData(prev => ({ ...prev, ...updates }));
    
    // Show success notification (using browser alert for now)
    const fieldsFound = Object.keys(updates).length;
    if (fieldsFound > 0) {
      console.log(`✅ QR kod başarıyla okundu! ${fieldsFound} alan dolduruldu.`);
      // Could add a toast notification here
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !company) return;

    // VKN validation
    if (!formData.supplier_vkn || !formData.supplier_vkn.trim()) {
      alert('⚠️ VKN (Vergi Kimlik Numarası) zorunludur!');
      return;
    }

    if (!/^\d{10,11}$/.test(formData.supplier_vkn.trim())) {
      alert('⚠️ VKN 10 veya 11 haneli rakam olmalıdır!');
      return;
    }

    setIsUploading(true);

    try {
      // Check for duplicate invoice number first
      const { data: existingInvoice, error: checkError } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('company_id', company.id)
        .eq('invoice_number', formData.invoice_number)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

      if (checkError) {
        console.error('Error checking for duplicate invoice:', checkError);
        // Continue anyway - let the insert fail with proper error if it's really duplicate
      }

      if (existingInvoice) {
        alert(`⚠️ Bu fatura numarası (${formData.invoice_number}) zaten kayıtlı! Lütfen farklı bir numara girin veya mevcut faturayı güncelleyin.`);
        setIsUploading(false);
        return;
      }

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
        // VKN (QR'dan veya manuel girişten)
        supplier_vkn: formData.supplier_vkn || qrMetadata?.taxNumber || null,
        buyer_vkn: qrMetadata?.buyerVKN || null,
        invoice_scenario: qrMetadata?.scenario || null,
        invoice_type: qrMetadata?.type || null,
        invoice_ettn: qrMetadata?.etag || null,
        currency: qrMetadata?.currency || 'TRY',
      }).select().single();

      if (error) throw error;

      // Update supplier name in cache if we have VKN and a real name
      const vknToUse = formData.supplier_vkn || qrMetadata?.taxNumber;
      if (vknToUse && formData.supplier_name && formData.supplier_name !== 'Bilinmeyen Tedarikçi') {
        console.log('Updating supplier cache with name:', formData.supplier_name);
        
        // Create or update supplier (VKN zorunlu)
        getOrCreateSupplier(vknToUse, formData.supplier_name, company.id)
          .then(supplier => {
            if (supplier) {
              console.log('✅ Supplier created/updated in cache');
            }
          })
          .catch(err => {
            console.error('Error creating/updating supplier:', err);
          });
      }

      setFormData({
        amount: '',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: '',
        description: '',
        supplier_name: '',
        supplier_vkn: '',
        goods_services_total: '',
        vat_amount: '',
        withholding_amount: '',
      });
      setSelectedFile(null);
      setQRMetadata(null); // QR metadata'yı temizle
      setIsModalOpen(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      
      // Better error messages
      if (error.code === '23505') {
        alert(`⚠️ Bu fatura numarası (${formData.invoice_number}) zaten kayıtlı! Lütfen farklı bir numara girin.`);
      } else {
        alert(error.message || 'Fatura oluşturulurken hata oluştu');
      }
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
      supplier_vkn: invoice.supplier_vkn || '',
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
          supplier_vkn: formData.supplier_vkn || null,
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
        supplier_vkn: '',
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

  async function handleExportExcel() {
    try {
      // Ekranda görünen sıralanmış faturaları al
      const dataToExport = sortedInvoices.map((invoice, index) => {
        // Ödeme bilgilerini hesapla
        const totalPaid = invoice.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
        const remaining = Number(invoice.amount) - totalPaid;
        const paymentStatus = remaining === 0 ? 'Ödendi' : totalPaid > 0 ? 'Kısmi Ödeme' : 'Ödenmedi';
        const withholdingAmount = Number(invoice.withholding_amount) || 0;
        
        // Proje isimlerini birleştir
        const projectNames = invoice.project_links?.map((link: any) => link.project?.name).filter(Boolean).join(', ') || 'Atanmadı';
        
        return [
          index + 1,
          invoice.invoice_number,
          formatDate(invoice.invoice_date),
          invoice.supplier_name || '-',
          Number(invoice.amount),
          totalPaid,
          remaining,
          withholdingAmount,
          paymentStatus,
          projectNames,
          invoice.description || '-',
        ];
      });

      if (dataToExport.length === 0) {
        alert('Dışa aktarılacak fatura bulunamadı!');
        return;
      }

      // ExcelJS ile çalışma kitabı oluştur
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Faturalar');

      // Sütun başlıkları
      const headers = ['Sıra', 'Fatura No', 'Tarih', 'Tedarikçi', 'Tutar', 'Ödenen', 'Kalan', 'Tevkifat', 'Ödeme Durumu', 'Projeler', 'Açıklama'];
      
      // Sütun genişlikleri
      worksheet.columns = [
        { key: 'sira', width: 8 },
        { key: 'faturaNo', width: 17 },
        { key: 'tarih', width: 13 },
        { key: 'tedarikci', width: 27 },
        { key: 'tutar', width: 16 },
        { key: 'odenen', width: 16 },
        { key: 'kalan', width: 16 },
        { key: 'tevkifat', width: 16 },
        { key: 'odemeDurumu', width: 17 },
        { key: 'projeler', width: 32 },
        { key: 'aciklama', width: 42 },
      ];

      // Başlık satırını ekle
      const headerRow = worksheet.addRow(headers);
      
      // Başlık satırı stili (koyu mavi arka plan, beyaz yazı, kalın, ortalanmış)
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

      // Veri satırlarını ekle ve toplamları hesapla
      let totalAmount = 0;
      let totalPaid = 0;
      let totalRemaining = 0;
      let totalWithholding = 0;

      dataToExport.forEach((rowData, index) => {
        const row = worksheet.addRow(rowData);
        
        // Toplamları hesapla
        totalAmount += rowData[4] || 0;
        totalPaid += rowData[5] || 0;
        totalRemaining += rowData[6] || 0;
        totalWithholding += rowData[7] || 0;
        
        // Zebra striping: Çift satırlar açık gri, tek satırlar beyaz
        const isEvenRow = (index + 1) % 2 === 0;
        const bgColor = isEvenRow ? 'FFF2F2F2' : 'FFFFFFFF';
        
        row.eachCell((cell, colNumber) => {
          // Arka plan rengi
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };
          
          // Para birimi formatı (Tutar, Ödenen, Kalan, Tevkifat: sütun 5, 6, 7, 8)
          if (colNumber >= 5 && colNumber <= 8) {
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
          
          // İnce gri çerçeveler
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

      // Toplam satırını ekle (yeşil arka plan, kalın, beyaz yazı)
      const totalRow = worksheet.addRow([
        '',
        '',
        '',
        'TOPLAM',
        totalAmount,
        totalPaid,
        totalRemaining,
        totalWithholding,
        '',
        '',
        ''
      ]);

      totalRow.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2E7D32' } // Koyu yeşil
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 11
        };
        
        // Para birimi formatı
        if (colNumber >= 5 && colNumber <= 8) {
          cell.numFmt = '#,##0.00 "₺"';
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'right'
          };
        } else if (colNumber === 4) {
          // "TOPLAM" yazısı
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

      // AutoFilter ekle (tüm sütunlara dropdown filtre - toplam satırı hariç)
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: dataToExport.length + 1, column: headers.length }
      };

      // Dosya adını oluştur (tarih + filtre bilgisi)
      const date = new Date().toISOString().split('T')[0];
      let fileName = `Faturalar_${date}`;
      
      if (activeTab === 'pending') fileName += '_AtanmayanFaturalar';
      else if (activeTab === 'assigned') fileName += '_AtananFaturalar';
      
      if (filters.projectId) {
        const project = projects.find(p => p.id === filters.projectId);
        if (project) fileName += `_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      
      fileName += '.xlsx';

      // Excel dosyasını indir
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
      
      console.log(`Excel export: ${dataToExport.length} fatura dışa aktarıldı`);
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

  // Apply sorting
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
      
      case 'supplier':
        const aSupplier = a.supplier_name || '';
        const bSupplier = b.supplier_name || '';
        return direction * aSupplier.localeCompare(bSupplier, 'tr');
      
      default:
        return 0;
    }
  });

  function handleSort(field: 'date' | 'project' | 'amount' | 'supplier') {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }

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

  // Pagination calculations
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

  // Get selected project name for display
  const selectedProject = projects.find(p => p.id === filters.projectId);
  const pageTitle = selectedProject 
    ? `${selectedProject.name} - Faturalar` 
    : 'Faturalar';

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
            {assignedCount > 0 && (
              <>
                <Button 
                  onClick={handleExportExcel}
                  variant="ghost"
                >
                  📊 Excel İndir
                </Button>
                <Button 
                  onClick={handleGenerateReport}
                  isLoading={isGeneratingReport}
                  variant="ghost"
                >
                  📥 PDF Rapor İndir
                </Button>
              </>
            )}
            {canCreate && (
              <>
                <Button onClick={() => setIsModalOpen(true)}>
                  + Yeni Fatura Ekle
                </Button>
                <Button 
                  onClick={() => router.push('/invoices/bulk')}
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
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortConfig.field === 'date'
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
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortConfig.field === 'project'
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
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortConfig.field === 'amount'
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
                onClick={() => handleSort('supplier')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortConfig.field === 'supplier'
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                }`}
              >
                🏢 Firmaya Göre
                {sortConfig.field === 'supplier' && (
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
                {sortedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-secondary-500">
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

          {/* Pagination */}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yeni Fatura Ekle" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload */}
          <FileUploader 
            onFileSelect={setSelectedFile}
            onFileRemove={() => {
              setQRMetadata(null);
              // Form'u da temizle (tevkifat gibi alanlar kalmasın)
              setFormData({
                amount: '',
                invoice_date: new Date().toISOString().split('T')[0],
                invoice_number: '',
                description: '',
                supplier_name: '',
                supplier_vkn: '',
                goods_services_total: '',
                vat_amount: '',
                withholding_amount: '',
              });
            }}
            onQRDataExtracted={handleQRDataExtracted}
            enableQRScanning={true}
          />
          
          {/* Firma Bilgileri */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-secondary-700 mb-3">Firma Bilgileri</h3>
            <div className="grid gap-4">
              <Input
                label="Fatura Firma Adı"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="Tedarikçi firma adı"
                required
              />
              <Input
                label="VKN (Vergi Kimlik Numarası)"
                value={formData.supplier_vkn}
                onChange={(e) => {
                  const vknValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                  setFormData({ ...formData, supplier_vkn: vknValue });
                }}
                placeholder="10 veya 11 haneli VKN"
                required
                maxLength={11}
              />
            </div>
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
                label="Toplam Tutar (₺) 🧮"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                required
                placeholder={qrMetadata ? "QR'dan gelen tutar" : "Otomatik hesaplanır veya manuel girin"}
                className={qrMetadata ? "bg-blue-50 font-semibold" : "bg-green-50 font-semibold"}
              />
            </div>
            {formData.amount && (
              <div className={`mt-3 rounded-lg border px-3 py-2 ${qrMetadata ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                {qrMetadata ? (
                  <p className="text-xs text-blue-700">
                    <span className="font-medium">🔷 QR Verisi:</span> Faturada yazdığı ödenecek tutar: <span className="font-bold text-blue-900">{formData.amount}</span> (Değiştirebilirsiniz)
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">💡 Otomatik Hesaplama:</span> Mal/Hizmet ({formData.goods_services_total || '0'}) + KDV ({formData.vat_amount || '0'}) - Tevkifat ({formData.withholding_amount || '0'}) = <span className="font-bold text-amber-900">{formData.amount}</span>
                  </p>
                )}
              </div>
            )}
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
            <div className="grid gap-4">
              <Input
                label="Tedarikçi/Firma Adı"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="Tedarikçi firma adı"
                required
              />
              <Input
                label="VKN (Vergi Kimlik Numarası)"
                value={formData.supplier_vkn}
                onChange={(e) => {
                  const vknValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                  setFormData({ ...formData, supplier_vkn: vknValue });
                }}
                placeholder="10 veya 11 haneli VKN"
                required
                maxLength={11}
              />
            </div>
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
                label="Toplam Tutar (₺) 🧮"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                required
                placeholder="Manuel girin veya otomatik hesaplansın"
                className="bg-amber-50 font-semibold"
              />
            </div>
            {formData.amount && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs text-amber-700">
                  <span className="font-medium">💡 Otomatik Hesaplama:</span> Mal/Hizmet ({formData.goods_services_total || '0'}) + KDV ({formData.vat_amount || '0'}) - Tevkifat ({formData.withholding_amount || '0'}) = <span className="font-bold text-amber-900">{formData.amount}</span>
                </p>
              </div>
            )}
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
            {selectedInvoice && (selectedInvoice.project_links?.length || 0) > 1 && (
              <p className="text-xs text-amber-700 mt-2 flex items-start gap-1">
                <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Bu fatura birden fazla projeye atanmış. Her ödeme için proje seçimi yapmanız gerekmektedir.</span>
              </p>
            )}
          </div>

          {/* Existing Payments */}
          {payments.length > 0 && (
            <div className="rounded-lg border border-secondary-200 p-4">
              <h3 className="text-sm font-semibold text-secondary-900 mb-3">Mevcut Ödemeler</h3>
              <div className="space-y-2">
                {payments.map((payment) => {
                  // Ödemenin bağlı olduğu projeyi bul
                  const paymentProject = payment.project_id 
                    ? selectedInvoice?.project_links?.find((link: any) => link.project.id === payment.project_id)?.project
                    : null;
                  
                  return (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-secondary-900">{payment.payment_type}</span>
                          {paymentProject && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                              {paymentProject.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-secondary-500">
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
                  );
                })}
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

          {/* Kalan tutar bilgisi - ödemeler yoksa */}
          {payments.length === 0 && selectedInvoice && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">Ödenecek Tutar:</span>
                <span className="text-base font-bold text-blue-600">
                  {formatCurrency(selectedInvoice.amount)}
                </span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                💡 Tutar alanını boş bırakırsanız bu tutarın tamamı ödenmiş olarak işaretlenir
              </p>
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

            {/* Eşit Paylaştır Seçeneği - sadece birden fazla proje varsa göster */}
            {selectedInvoice && (selectedInvoice.project_links?.length || 0) > 1 && (
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitEqually}
                    onChange={(e) => setSplitEqually(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-blue-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-blue-900">
                      Tutarı Projelere Eşit Paylaştır
                    </span>
                    <p className="text-xs text-blue-700 mt-1">
                      Bu seçenek aktifken, girdiğiniz tutar {selectedInvoice.project_links?.length || 0} projeye eşit olarak bölünecek ve her proje için ayrı ödeme kaydı oluşturulacak. Proje seçmenize gerek kalmayacak.
                    </p>
                  </div>
                </label>
              </div>
            )}

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
                {/* Proje seçimi - sadece birden fazla proje varsa ve eşit paylaştır kapalıysa göster */}
                {selectedInvoice && (selectedInvoice.project_links?.length || 0) > 1 && !splitEqually && (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary-700 mb-1">
                      Proje <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={payment.project_id}
                      onChange={(e) => updatePaymentType(index, 'project_id', e.target.value)}
                      className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Proje seçiniz</option>
                      {selectedInvoice.project_links?.map((link: any) => (
                        <option key={link.project.id} value={link.project.id}>
                          {link.project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Tutar (₺)
                  </label>
                  <CurrencyInput
                    value={payment.amount}
                    onChange={(value) => updatePaymentType(index, 'amount', value)}
                    placeholder="Boş bırakırsanız kalan tutar eklenir"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Ödeme Tarihi
                  </label>
                  <input
                    type="date"
                    value={payment.payment_date}
                    onChange={(e) => updatePaymentType(index, 'payment_date', e.target.value)}
                    className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-secondary-500 mt-1">Boş bırakırsanız bugünün tarihi kullanılır</p>
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

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-secondary-600">Yükleniyor...</div></div>}>
      <InvoicesContent />
    </Suspense>
  );
}
