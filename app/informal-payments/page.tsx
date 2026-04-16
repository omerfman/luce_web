'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ExcelJS from 'exceljs';
import { InformalPayment, Project, Supplier } from '@/types';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { ContractPaymentModal } from '@/components/informal-payments/ContractPaymentModal';
import {
  getInformalPayments,
  createInformalPayment,
  updateInformalPayment,
  deleteInformalPayment,
} from '@/lib/supabase/informal-payments';
import { getSubcontractorSuppliers, createSubcontractor } from '@/lib/supabase/supplier-management';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';

function InformalPaymentsContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [payments, setPayments] = useState<InformalPayment[]>([]);
  const [subcontractors, setSubcontractors] = useState<Supplier[]>([]); // Supplier tipine çevrildi
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<InformalPayment | null>(null);

  // Get project filter from URL
  const projectFilter = searchParams.get('project');

  // Filters
  const [filters, setFilters] = useState({
    supplierId: '',
    projectId: projectFilter || '',
    startDate: '',
    endDate: '',
    paymentMethod: '',
  });

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    field: 'date' | 'supplier' | 'project' | 'amount' | null;
    direction: 'asc' | 'desc';
  }>({
    field: 'date',
    direction: 'desc'
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    loadData();
  }, []);

  // Update filters when URL project parameter changes
  useEffect(() => {
    if (projectFilter) {
      setFilters((prev) => ({ ...prev, projectId: projectFilter }));
      // Trigger filter when project parameter is present
      const applyFilter = async () => {
        try {
          setLoading(true);
          const filteredPayments = await getInformalPayments({
            ...filters,
            projectId: projectFilter,
          });
          setPayments(filteredPayments);
        } catch (error) {
          console.error('Error filtering payments:', error);
        } finally {
          setLoading(false);
        }
      };
      if (user?.company_id) {
        applyFilter();
      }
    }
  }, [projectFilter, user?.company_id]);

  const loadData = async () => {
    if (!user?.company_id) return;

    try {
      setLoading(true);
      const [paymentsData, subcontractorSuppliersData, projectsData] = await Promise.all([
        getInformalPayments(),
        getSubcontractorSuppliers(user.company_id), // Yeni sistem kullanılıyor
        loadProjects(),
      ]);
      setPayments(paymentsData);
      setSubcontractors(subcontractorSuppliersData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (): Promise<Project[]> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading projects:', error);
      return [];
    }
  };

  const handleFilter = async () => {
    try {
      setLoading(true);
      const filteredPayments = await getInformalPayments(filters);
      setPayments(filteredPayments);
    } catch (error) {
      console.error('Error filtering payments:', error);
      alert('Filtreleme sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      supplierId: '',
      projectId: '',
      startDate: '',
      endDate: '',
      paymentMethod: '',
    });
    loadData();
  };

  const handleAddNew = () => {
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handleEdit = (payment: InformalPayment) => {
    setEditingPayment(payment);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu ödemeyi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await deleteInformalPayment(id);
      alert('Ödeme başarıyla silindi');
      loadData();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Ödeme silinirken hata oluştu');
    }
  };

  // PDF indirme fonksiyonu - Cloudinary URL'inden fetch edip Blob olarak indirir
  const handleDownloadPDF = async (pdfUrl: string, paymentDate: string) => {
    try {
      // Cloudinary URL'inden PDF'i fetch et
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error('PDF indirilemedi');
      }

      // Blob'a çevir
      const blob = await response.blob();

      // Blob URL oluştur ve indir
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Sozlesme-${paymentDate}.pdf`; // .pdf uzantısı ile
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('PDF indirme hatası:', error);
      alert('PDF indirilirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingPayment) {
        await updateInformalPayment(editingPayment.id, data);
        alert('Ödeme başarıyla güncellendi');
      } else {
        await createInformalPayment({
          ...data,
          created_by: user?.id || '',
          company_id: user?.company_id || '',
        });
        alert('Ödeme başarıyla eklendi');
      }
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Ödeme kaydedilirken hata oluştu');
    }
  };

  const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  // Sorting handler
  function handleSort(field: 'date' | 'supplier' | 'project' | 'amount') {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }

  // Apply sorting
  const sortedPayments = [...payments].sort((a, b) => {
    if (!sortConfig.field) return 0;
    
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    
    switch (sortConfig.field) {
      case 'date':
        return direction * (new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
      
      case 'supplier':
        const aSupplier = a.supplier?.name || '';
        const bSupplier = b.supplier?.name || '';
        return direction * aSupplier.localeCompare(bSupplier, 'tr');
      
      case 'project':
        const aProject = a.project?.name || '';
        const bProject = b.project?.name || '';
        return direction * aProject.localeCompare(bProject, 'tr');
      
      case 'amount':
        return direction * (Number(a.amount) - Number(b.amount));
      
      default:
        return 0;
    }
  });

  // Get selected project name for display
  const selectedProject = projects.find((p) => p.id === filters.projectId);
  const pageTitle = selectedProject
    ? `${selectedProject.name} - Gayri Resmi Ödemeler`
    : 'Gayri Resmi Ödemeler';

  // Pagination calculations
  const totalPages = Math.ceil(sortedPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPayments = sortedPayments.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  async function handleExportExcel() {
    try {
      const dataToExport = sortedPayments.map((payment, index) => {
        let sozlesmeDurumu = '-';
        if (payment.contract_pdf_url) sozlesmeDurumu = 'PDF Var';
        else if (payment.has_contract) sozlesmeDurumu = 'PDF Yok';

        const pdfEksik = Boolean(payment.has_contract && !payment.contract_pdf_url);

        return {
          sira: index + 1,
          tarih: formatDate(payment.payment_date),
          taseron: payment.supplier?.name || '-',
          proje: payment.project?.name || '-',
          tutar: Number(payment.amount),
          odemeYontemi: payment.payment_method || '-',
          sozlesme: sozlesmeDurumu,
          makbuzNo: payment.receipt_number || '-',
          aciklama: payment.description || '-',
          notlar: payment.notes || '-',
          pdfEksik,
        };
      });

      if (dataToExport.length === 0) {
        alert('Dışa aktarılacak ödeme bulunamadı!');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Gayri Resmi Ödemeler');

      const headers = [
        'Sıra',
        'Tarih',
        'Açıklama',
        'Taşeron',
        '',
        'Tutar',
        'Proje',
        'Ödeme Yöntemi',
        'Sözleşme',
        'Makbuz No',
        'Notlar',
      ];

      worksheet.columns = [
        { key: 'sira', width: 8 },
        { key: 'tarih', width: 13 },
        { key: 'aciklama', width: 40 },
        { key: 'taseron', width: 28 },
        { key: 'bos', width: 6 },
        { key: 'tutar', width: 16 },
        { key: 'proje', width: 28 },
        { key: 'odemeYontemi', width: 18 },
        { key: 'sozlesme', width: 14 },
        { key: 'makbuzNo', width: 16 },
        { key: 'notlar', width: 28 },
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 11,
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });

      let totalAmount = 0;
      dataToExport.forEach((rowData, index) => {
        totalAmount += typeof rowData.tutar === 'number' ? rowData.tutar : 0;

        const row = worksheet.addRow([
          rowData.sira,
          rowData.tarih,
          rowData.aciklama,
          rowData.taseron,
          '',
          rowData.tutar,
          rowData.proje,
          rowData.odemeYontemi,
          rowData.sozlesme,
          rowData.makbuzNo,
          rowData.notlar,
        ]);

        const pdfEksik = rowData.pdfEksik;
        const isEvenRow = (index + 1) % 2 === 0;
        const bgColor = pdfEksik ? 'FFFFEB9C' : isEvenRow ? 'FFF2F2F2' : 'FFFFFFFF';

        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };

          if (pdfEksik) {
            cell.font = {
              size: 10,
              color: { argb: 'FFB45309' },
              bold: true,
            };
          } else {
            cell.font = { size: 10 };
          }

          if (colNumber === 6) {
            cell.numFmt = '#,##0.00 "₺"';
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'right',
            };
          } else {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left',
              wrapText: colNumber === 3 || colNumber === 11,
            };
          }

          if (pdfEksik) {
            cell.border = {
              top: { style: 'medium', color: { argb: 'FFD97706' } },
              left: { style: 'medium', color: { argb: 'FFD97706' } },
              bottom: { style: 'medium', color: { argb: 'FFD97706' } },
              right: { style: 'medium', color: { argb: 'FFD97706' } },
            };
          } else {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
              left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
              bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
              right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            };
          }
        });
      });

      const totalRow = worksheet.addRow([
        '',
        '',
        '',
        '',
        'TOPLAM',
        totalAmount,
        '',
        '',
        '',
        '',
        '',
      ]);

      totalRow.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2E7D32' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 11,
        };

        if (colNumber === 6) {
          cell.numFmt = '#,##0.00 "₺"';
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'right',
          };
        } else if (colNumber === 5) {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'right',
          };
        } else {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
          };
        }

        cell.border = {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: dataToExport.length + 1, column: headers.length },
      };

      const date = new Date().toISOString().split('T')[0];
      let fileName = `GayriResmiOdemeler_${date}`;
      if (filters.projectId) {
        const project = projects.find((p) => p.id === filters.projectId);
        if (project) fileName += `_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      if (filters.supplierId) {
        const sub = subcontractors.find((s) => s.id === filters.supplierId);
        if (sub) fileName += `_Taseron_${sub.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      if (filters.paymentMethod) {
        fileName += `_Yontem_${filters.paymentMethod.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      if (filters.startDate) fileName += `_Baslangic_${filters.startDate}`;
      if (filters.endDate) fileName += `_Bitis_${filters.endDate}`;
      fileName += '.xlsx';

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Excel dosyası oluşturulurken bir hata oluştu');
    }
  }

  // Reset to page 1 when payments data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [payments.length, sortConfig.field, sortConfig.direction]);

  return (
    <Sidebar>
      <div className="p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Title and Stats */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                    <svg
                      className="h-5 w-5 text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      {selectedProject ? 'Proje Toplamı' : 'Toplam Ödeme'}
                    </p>
                    <p className="text-lg font-bold text-primary-600">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Kayıt Sayısı</p>
                    <p className="text-lg font-bold text-blue-600">{payments.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {payments.length > 0 && !loading && (
                <Button onClick={handleExportExcel} variant="ghost" className="justify-center">
                  📊 Excel İndir
                </Button>
              )}
              <button
                onClick={() => setIsContractModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Sözleşmeli Ödeme</span>
              </button>
              <button
                onClick={handleAddNew}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>Yeni Ödeme Ekle</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-700">
            Filtreler
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Taşeron</label>
              <select
                value={filters.supplierId}
                onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Tümü</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Proje</label>
              <select
                value={filters.projectId}
                onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Tümü</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Bitiş Tarihi</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Ödeme Yöntemi
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Tümü</option>
                <option value="Nakit">Nakit</option>
                <option value="Banka Transferi">Banka Transferi</option>
                <option value="Çek">Çek</option>
                <option value="Kredi Kartı">Kredi Kartı</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={handleFilter}
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Filtrele
            </button>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Temizle
            </button>
          </div>
        </div>

        {/* Sorting Controls */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary-700">Sıralama</h3>
            <div className="flex flex-wrap gap-2">
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
                onClick={() => handleSort('supplier')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortConfig.field === 'supplier'
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                }`}
              >
                👷 Taşerona Göre
                {sortConfig.field === 'supplier' && (
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
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="card py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <WalletIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Henüz ödeme yok</h3>
            <p className="mt-2 text-sm text-gray-500">Gayri resmi ödeme ekleyerek başlayın.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setIsContractModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Sözleşmeli Ödeme Ekle
              </button>
              <button
                onClick={handleAddNew}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <PlusIcon className="h-5 w-5" />
                Hızlı Ödeme Ekle
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Tarih
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Taşeron
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Proje
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Açıklama
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Tutar
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Yöntem
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Sözleşme
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {paginatedPayments.map((payment) => (
                      <tr key={payment.id} className="transition-colors hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {payment.supplier?.name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {payment.project?.name || '-'}
                        </td>
                        <td
                          className="max-w-xs truncate px-6 py-4 text-sm text-gray-600"
                          title={payment.description}
                        >
                          {payment.description}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-primary-600">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            {payment.payment_method || '-'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          {payment.contract_pdf_url ? (
                            <button
                              onClick={() =>
                                handleDownloadPDF(payment.contract_pdf_url!, payment.payment_date)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition-all hover:from-purple-600 hover:to-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                              title="PDF'i indir"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span>PDF</span>
                            </button>
                          ) : payment.has_contract ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>PDF Yok</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(payment)}
                              className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                              title="Düzenle"
                            >
                              <EditIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(payment.id)}
                              className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                              title="Sil"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="space-y-4 lg:hidden">
              {paginatedPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  {/* Header: Taşeron ve Tutar */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">
                        {payment.supplier?.name || 'Taşeron Bilgisi Yok'}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatDate(payment.payment_date)}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="text-lg font-bold text-primary-600">
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                  </div>

                  {/* Proje */}
                  {payment.project?.name && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-gray-500">Proje:</span>
                      <p className="mt-0.5 text-sm text-gray-900">{payment.project.name}</p>
                    </div>
                  )}

                  {/* Açıklama */}
                  <div className="mb-3">
                    <span className="text-xs font-medium text-gray-500">Açıklama:</span>
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-700">
                      {payment.description}
                    </p>
                  </div>

                  {/* Ödeme Yöntemi */}
                  {payment.payment_method && (
                    <div className="mb-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                        {payment.payment_method}
                      </span>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                    {/* PDF Butonu */}
                    <div className="flex-1">
                      {payment.contract_pdf_url ? (
                        <button
                          onClick={() =>
                            handleDownloadPDF(payment.contract_pdf_url!, payment.payment_date)
                          }
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-purple-600 hover:to-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span>Sözleşme PDF</span>
                        </button>
                      ) : payment.has_contract ? (
                        <div className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <span>PDF Bulunamadı</span>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-xs text-gray-400">Sözleşme yok</div>
                      )}
                    </div>

                    {/* Edit ve Delete Butonları */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(payment)}
                        className="rounded-lg p-2.5 text-blue-600 transition-colors hover:bg-blue-50 active:bg-blue-100"
                        title="Düzenle"
                      >
                        <EditIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="rounded-lg p-2.5 text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                        title="Sil"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {payments.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={sortedPayments.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}
          </>
        )}

        {/* Modal */}
        {isModalOpen && (
          <PaymentModal
            payment={editingPayment}
            subcontractors={subcontractors}
            projects={projects}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleSubmit}
          />
        )}

        {/* Contract Payment Modal */}
        {user?.company_id && user?.id && (
          <ContractPaymentModal
            isOpen={isContractModalOpen}
            onClose={() => setIsContractModalOpen(false)}
            companyId={user.company_id}
            userId={user.id}
            onSuccess={loadData}
          />
        )}
      </div>
    </Sidebar>
  );
}

// Modal Component
interface PaymentModalProps {
  payment: InformalPayment | null;
  subcontractors: Supplier[]; // Supplier tipine çevrildi
  projects: Project[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

function PaymentModal({ payment, subcontractors, projects, onClose, onSubmit }: PaymentModalProps) {
  const { user } = useAuth();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierVkn, setNewSupplierVkn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubcontractorDropdown, setShowSubcontractorDropdown] = useState(false);

  // Çoklu proje ödemeleri için array (edit modunda tek proje olacak)
  const [projectPayments, setProjectPayments] = useState<
    Array<{ projectId: string; amount: string }>
  >(() => {
    if (payment) {
      return [{ projectId: payment.project_id || '', amount: payment.amount?.toString() || '' }];
    }
    return [{ projectId: '', amount: '' }];
  });

  const [formData, setFormData] = useState({
    supplier_id: payment?.supplier_id || '',
    description: payment?.description || '',
    payment_date: payment?.payment_date || new Date().toISOString().split('T')[0],
    payment_method: payment?.payment_method || 'Kasadan Nakit',
    receipt_number: payment?.receipt_number || '',
    notes: payment?.notes || '',
  });

  // Filtered subcontractors based on search
  const filteredSubcontractors = subcontractors.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper: Proje ödemesi ekle
  const addProjectPayment = () => {
    setProjectPayments([...projectPayments, { projectId: '', amount: '' }]);
  };

  // Helper: Proje ödemesi kaldır
  const removeProjectPayment = (index: number) => {
    if (projectPayments.length === 1) return; // En az 1 tane olmalı
    setProjectPayments(projectPayments.filter((_, i) => i !== index));
  };

  // Helper: Proje ödemesini güncelle
  const updateProjectPayment = (index: number, field: 'projectId' | 'amount', value: string) => {
    const updated = [...projectPayments];
    updated[index][field] = value;
    setProjectPayments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      let supplierId = formData.supplier_id;

      // Eğer yeni kişi/firma ekleme aktifse
      if (isCreatingNew) {
        if (!newSupplierName.trim()) {
          alert('Lütfen kişi/firma adını giriniz');
          return;
        }

        if (!user?.company_id) {
          alert('Kullanıcı bilgisi bulunamadı');
          return;
        }

        // Yeni supplier oluştur
        const newSupplier = await createSubcontractor(
          user.company_id,
          newSupplierName.trim(),
          newSupplierVkn.trim() || undefined
        );

        supplierId = newSupplier.id;
      }

      // Validate required fields
      if (!supplierId) {
        alert('Lütfen taşeron seçiniz veya yeni kişi/firma ekleyiniz');
        return;
      }
      if (!formData.description.trim()) {
        alert('Lütfen yapılan işi açıklayınız');
        return;
      }

      // Eğer düzenleme modundaysa tek ödeme
      if (payment) {
        const projectId = projectPayments[0].projectId;
        const amount = projectPayments[0].amount;

        if (!amount || Number(amount) <= 0) {
          alert('Lütfen geçerli bir tutar giriniz');
          return;
        }

        onSubmit({
          ...formData,
          supplier_id: supplierId,
          project_id: projectId || null,
          amount: Number(amount),
        });
      } else {
        // Yeni ekleme modunda çoklu proje ödemeleri
        const validPayments = projectPayments.filter(
          (p) => p.projectId && p.amount && Number(p.amount) > 0
        );

        if (validPayments.length === 0) {
          alert('En az bir proje ve tutar girmelisiniz');
          return;
        }

        // Her proje için ayrı ödeme kaydı oluştur
        for (const projectPayment of validPayments) {
          await onSubmit({
            ...formData,
            supplier_id: supplierId,
            project_id: projectPayment.projectId,
            amount: Number(projectPayment.amount),
          });
        }
      }
    } catch (error: any) {
      console.error('Error creating payment:', error);
      alert(error.message || 'Ödeme eklenirken hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mx-4 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 shadow-md">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 sm:text-xl">
                {payment ? 'Ödeme Düzenle' : 'Hızlı Ödeme Ekle'}
              </h3>
              <p className="text-xs text-gray-500 sm:text-sm">
                {payment ? 'Mevcut ödeme kaydını güncelleyin' : 'Basit ve hızlı ödeme kaydı'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600">
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body space-y-6 sm:space-y-7">
          {/* Taşeron Seçimi */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 sm:text-base">
              Ödeme Yapılacak Kişi/Firma <span className="text-red-500">*</span>
            </label>

            {!payment && (
              <div className="relative">
                {/* Search/Select Input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Kişi/Firma adı yazın veya seçin..."
                    value={isCreatingNew ? newSupplierName : searchQuery}
                    onChange={(e) => {
                      if (isCreatingNew) {
                        setNewSupplierName(e.target.value);
                      } else {
                        setSearchQuery(e.target.value);
                        setShowSubcontractorDropdown(true);
                      }
                    }}
                    onFocus={() => {
                      if (!isCreatingNew) {
                        setShowSubcontractorDropdown(true);
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-24 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />

                  {/* Add New Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(!isCreatingNew);
                      if (!isCreatingNew) {
                        setFormData({ ...formData, supplier_id: '' });
                        setSearchQuery('');
                        setShowSubcontractorDropdown(false);
                        setNewSupplierName('');
                        setNewSupplierVkn('');
                      } else {
                        setNewSupplierName('');
                        setNewSupplierVkn('');
                      }
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      isCreatingNew
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    }`}
                  >
                    {isCreatingNew ? '↩ Seç' : '+ Yeni'}
                  </button>
                </div>

                {/* Dropdown Menu */}
                {showSubcontractorDropdown && !isCreatingNew && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                    {filteredSubcontractors.length > 0 ? (
                      <>
                        {filteredSubcontractors.map((sub) => (
                          <div
                            key={sub.id}
                            onClick={() => {
                              setFormData({ ...formData, supplier_id: sub.id });
                              setSearchQuery(sub.name);
                              setShowSubcontractorDropdown(false);
                            }}
                            className="cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-primary-50"
                          >
                            <div className="font-medium text-gray-900">{sub.name}</div>
                            {sub.vkn && (
                              <div className="mt-0.5 text-xs text-gray-500">VKN: {sub.vkn}</div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <div className="mb-2 text-gray-400">
                          <svg
                            className="mx-auto h-12 w-12"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        <p className="mb-3 text-sm text-gray-500">Sonuç bulunamadı</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingNew(true);
                            setNewSupplierName(searchQuery);
                            setShowSubcontractorDropdown(false);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          Yeni kişi/firma olarak ekle
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* VKN Input (only when adding new) */}
                {isCreatingNew && (
                  <div className="animate-in slide-in-from-top-2 mt-3 space-y-3 rounded-lg border border-primary-200 bg-primary-50 p-4 duration-200">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100">
                          <svg
                            className="h-4 w-4 text-primary-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="mb-1 text-sm font-semibold text-primary-900">
                          Yeni Kişi/Firma Ekleniyor
                        </h4>
                        <p className="mb-3 text-xs text-primary-700">
                          Bu kişi/firma sisteme kaydedilecek ve gelecekte tekrar
                          kullanabileceksiniz.
                        </p>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-primary-900">
                            VKN / TCKN{' '}
                            <span className="font-normal text-primary-400">(Opsiyonel)</span>
                          </label>
                          <input
                            type="text"
                            value={newSupplierVkn}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 11) {
                                setNewSupplierVkn(value);
                              }
                            }}
                            placeholder="10 veya 11 haneli numara"
                            className="w-full rounded-md border border-primary-300 bg-white px-3 py-2 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            maxLength={11}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Edit modunda sadece seçili taşeron göster */}
            {payment && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-sm font-medium text-gray-900">
                  {subcontractors.find((s) => s.id === formData.supplier_id)?.name ||
                    'Bilinmeyen Taşeron'}
                </div>
              </div>
            )}
          </div>

          {/* Yapılan İş */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 sm:text-base">
              Yapılan İş / Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="İş tanımını detaylı olarak yazın..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {/* Proje ve Tutar Bilgileri */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-900 sm:text-base">
                Proje ve Tutar Bilgileri <span className="text-red-500">*</span>
              </label>
              {!payment && (
                <button
                  type="button"
                  onClick={addProjectPayment}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Farklı Proje Ekle
                </button>
              )}
            </div>

            <div className="space-y-3">
              {projectPayments.map((projectPayment, index) => (
                <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Proje Seçimi */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Proje {projectPayments.length > 1 ? index + 1 : '(Opsiyonel)'}
                      </label>
                      <select
                        value={projectPayment.projectId}
                        onChange={(e) => updateProjectPayment(index, 'projectId', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      >
                        <option value="">Proje seçin...</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tutar Girişi */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Tutar (₺) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            required
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={projectPayment.amount}
                            onChange={(e) => updateProjectPayment(index, 'amount', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-sm font-semibold text-gray-500">₺</span>
                          </div>
                        </div>
                        {!payment && projectPayments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProjectPayment(index)}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                            title="Kaldır"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toplam Tutar Özeti */}
            {projectPayments.some((p) => p.amount && parseFloat(p.amount) > 0) && (
              <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-900">Toplam Tutar:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {projectPayments
                      .reduce((sum, p) => {
                        const amount = parseFloat(p.amount);
                        return sum + (isNaN(amount) ? 0 : amount);
                      }, 0)
                      .toFixed(2)}{' '}
                    ₺
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ödeme Tarihi */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 sm:text-base">
              Ödeme Tarihi <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {/* Ödeme Yöntemi */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-900 sm:text-base">
              Ödeme Yöntemi
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {[
                { value: 'Kasadan Nakit', label: 'Kasadan Nakit', icon: '💵' },
                { value: 'Kredi Kartı', label: 'Kredi Kartı', icon: '💳' },
                { value: 'Banka Transferi', label: 'Banka Transferi', icon: '🏦' },
                { value: 'Çek', label: 'Çek', icon: '📝' },
                { value: 'Senet', label: 'Senet', icon: '📄' },
                { value: 'Havale/EFT', label: 'Havale/EFT', icon: '💸' },
                { value: 'Cari', label: 'Cari', icon: '📊' },
              ].map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_method: method.value })}
                  className={`
                    group relative flex min-h-[90px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 px-3 py-4 transition-all sm:min-h-[100px]
                    ${
                      formData.payment_method === method.value
                        ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-indigo-50 shadow-md ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50 hover:shadow-sm'
                    }
                  `}
                >
                  <span
                    className={`text-3xl transition-transform sm:text-4xl ${
                      formData.payment_method === method.value
                        ? 'scale-110'
                        : 'group-hover:scale-105'
                    }`}
                  >
                    {method.icon}
                  </span>
                  <span
                    className={`text-center text-xs font-semibold leading-tight sm:text-sm ${
                      formData.payment_method === method.value
                        ? 'text-primary-700'
                        : 'text-gray-700 group-hover:text-gray-900'
                    }`}
                  >
                    {method.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Ek Bilgiler (Opsiyonel) */}
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-700">Ek Bilgiler (Opsiyonel)</h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Makbuz/Dekont No
                </label>
                <input
                  type="text"
                  value={formData.receipt_number}
                  onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Opsiyonel"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Notlar</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Ek notlar"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>İşleniyor...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{payment ? 'Güncelle' : 'Kaydet'}</span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}
export default function InformalPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      }
    >
      <InformalPaymentsContent />
    </Suspense>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
