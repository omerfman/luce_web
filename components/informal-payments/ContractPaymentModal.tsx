/**
 * Sözleşmeli Ödeme Modal Component
 * Gayri resmi ödeme + PDF sözleşme oluşturma
 */

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getSubcontractorSuppliers, createSubcontractor } from '@/lib/supabase/supplier-management';
import type { Supplier } from '@/types';
import { generateContractPaymentPDF, downloadContractPDF, previewContractPDF, type ContractPaymentData } from '@/lib/pdf/contract-generator';
import { numberToWords } from '@/lib/utils/number-to-words';

interface ContractPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  userId: string;
  onSuccess: () => void;
}

interface Project {
  id: string;
  name: string;
}

export function ContractPaymentModal({ isOpen, onClose, companyId, userId, onSuccess }: ContractPaymentModalProps) {
  // Form states
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string>('');
  const [newSubcontractorName, setNewSubcontractorName] = useState('');
  const [isNewSubcontractor, setIsNewSubcontractor] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Kasadan Nakit' | 'Kredi Kartı' | 'Banka Transferi' | 'Çek' | 'Senet' | 'Havale/EFT' | 'Cari'>('Kasadan Nakit');
  
  // Data states
  const [subcontractors, setSubcontractors] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubcontractorDropdown, setShowSubcontractorDropdown] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load data
  useEffect(() => {
    if (isOpen && companyId) {
      loadSubcontractors();
      loadProjects();
    }
  }, [isOpen, companyId]);

  const loadSubcontractors = async () => {
    try {
      const data = await getSubcontractorSuppliers(companyId);
      setSubcontractors(data);
    } catch (error) {
      console.error('Error loading subcontractors:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Filtered subcontractors based on search
  const filteredSubcontractors = subcontractors.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!isNewSubcontractor && !selectedSubcontractor) {
      newErrors.subcontractor = 'Lütfen bir taşeron seçin veya yeni taşeron adı girin';
    }

    if (isNewSubcontractor && !newSubcontractorName.trim()) {
      newErrors.newSubcontractor = 'Lütfen taşeron adı girin';
    }

    if (!jobDescription.trim()) {
      newErrors.jobDescription = 'Lütfen yapılan işi açıklayın';
    }

    if (!selectedProject) {
      newErrors.project = 'Lütfen bir proje seçin';
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Lütfen geçerli bir tutar girin (0&apos;dan büyük)';
    }

    if (amountNum > 999999999.99) {
      newErrors.amount = 'Tutar çok yüksek (maksimum 999,999,999.99)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      let subcontractorId = selectedSubcontractor;
      let subcontractorName = '';

      // Yeni taşeron ekleme
      if (isNewSubcontractor) {
        const newSupplier = await createSubcontractor(
          companyId,
          newSubcontractorName.trim()
        );
        subcontractorId = newSupplier.id;
        subcontractorName = newSupplier.name;
      } else {
        const supplier = subcontractors.find(s => s.id === subcontractorId);
        subcontractorName = supplier?.name || '';
      }

      // Ödeme kaydı oluştur
      const { data: payment, error: paymentError } = await supabase
        .from('informal_payments')
        .insert({
          company_id: companyId,
          supplier_id: subcontractorId,
          project_id: selectedProject || null, // Null seçilebilir
          description: jobDescription.trim(),
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0], // Sadece tarih, saat yok
          has_contract: true,
          created_by: userId
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Payment insert error:', paymentError);
        throw new Error(paymentError.message || 'Ödeme kaydedilirken hata oluştu');
      }

      // Proje bilgisini al
      const project = projects.find(p => p.id === selectedProject);
      
      // Makbuz numarası oluştur (örnek: MKB-20250123-001)
      const receiptNumber = `MKB-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${payment.id.slice(0, 6).toUpperCase()}`;

      // PDF oluştur
      const pdfData: ContractPaymentData = {
        receiptNumber,
        date: new Date().toLocaleDateString('tr-TR', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        companyName: 'Luce Mimarlık',
        companyAddress: 'Adres bilgisi buraya gelecek', // TODO: Company settings'den çek
        companyPhone: 'Telefon bilgisi buraya gelecek', // TODO: Company settings'den çek
        recipientName: subcontractorName,
        jobDescription: jobDescription.trim(),
        projectName: project?.name || 'Belirtilmemiş',
        amount: parseFloat(amount),
        paymentMethod: getPaymentMethodLabel(paymentMethod),
        createdBy: 'Yetkili İsmi' // TODO: User bilgisinden çek
      };

      const pdf = generateContractPaymentPDF(pdfData);

      // PDF'i önizle ve indir
      previewContractPDF(pdf); // Önizleme
      
      setTimeout(() => {
        downloadContractPDF(pdf, `${receiptNumber}.pdf`); // İndirme
      }, 500);

      // Başarılı
      alert('Ödeme kaydedildi ve sözleşme oluşturuldu!');
      onSuccess();
      handleClose();

    } catch (error: any) {
      console.error('Error creating contract payment:', error);
      
      // Kullanıcı dostu hata mesajları
      let errorMessage = 'Hata: ';
      
      if (error.code === '23503') {
        errorMessage += 'Taşeron kaydı bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.';
      } else if (error.code === '23505') {
        errorMessage += 'Bu kayıt zaten mevcut.';
      } else if (error.message?.includes('RLS')) {
        errorMessage += 'Yetkiniz yok. Lütfen yöneticinizle iletişime geçin.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Ödeme kaydedilemedi. Lütfen tekrar deneyin.';
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Ödeme yöntemi label
  const getPaymentMethodLabel = (method: string): string => {
    return method; // Artık direkt label kullanıyoruz
  };

  // Handle close
  const handleClose = () => {
    setSelectedSubcontractor('');
    setNewSubcontractorName('');
    setIsNewSubcontractor(false);
    setJobDescription('');
    setSelectedProject('');
    setAmount('');
    setPaymentMethod('Kasadan Nakit');
    setSearchQuery('');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 sm:text-xl">Sözleşmeli Ödeme Ekle</h3>
              <p className="text-xs text-gray-500 sm:text-sm">PDF sözleşme ile resmi ödeme kaydı</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 transition-colors hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body space-y-6 sm:space-y-7">
          {/* Taşeron Seçimi */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 sm:text-base">
              Ödeme Yapılacak Kişi/Firma <span className="text-red-500">*</span>
            </label>
            
            <div className="space-y-3">
              {/* Mevcut taşeron seç */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Taşeron ara veya seç..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSubcontractorDropdown(true);
                    setIsNewSubcontractor(false);
                  }}
                  onFocus={() => setShowSubcontractorDropdown(true)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                  disabled={isNewSubcontractor}
                />
                
                {showSubcontractorDropdown && !isNewSubcontractor && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredSubcontractors.length > 0 ? (
                      filteredSubcontractors.map((sub) => (
                        <div
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubcontractor(sub.id);
                            setSearchQuery(sub.name);
                            setShowSubcontractorDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                          <div className="font-medium">{sub.name}</div>
                          {sub.vkn && <div className="text-xs text-gray-500">VKN: {sub.vkn}</div>}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500 text-sm">Taşeron bulunamadı</div>
                    )}
                  </div>
                )}
              </div>

              {/* VEYA */}
              <div className="text-center text-sm text-gray-500">veya</div>

              {/* Yeni taşeron ekle */}
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNewSubcontractor}
                    onChange={(e) => {
                      setIsNewSubcontractor(e.target.checked);
                      if (e.target.checked) {
                        setSelectedSubcontractor('');
                        setSearchQuery('');
                        setShowSubcontractorDropdown(false);
                      }
                    }}
                    className="form-checkbox"
                  />
                  <span className="text-sm font-medium text-gray-700">Yeni kişi/firma ekle</span>
                </label>

                {isNewSubcontractor && (
                  <input
                    type="text"
                    placeholder="Ad Soyad veya Firma Adı"
                    value={newSubcontractorName}
                    onChange={(e) => setNewSubcontractorName(e.target.value)}
                    className="form-input w-full mt-2"
                  />
                )}
              </div>
            </div>

            {errors.subcontractor && (
              <p className="mt-1 text-sm text-red-600">{errors.subcontractor}</p>
            )}
            {errors.newSubcontractor && (
              <p className="mt-1 text-sm text-red-600">{errors.newSubcontractor}</p>
            )}
          </div>

          {/* Yapılan İş */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 sm:text-base">
              Yapılan İş <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="İş tanımını detaylı olarak yazın..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {errors.jobDescription && (
              <p className="mt-1 text-sm text-red-600">{errors.jobDescription}</p>
            )}
          </div>

          {/* Proje ve Tutar - Responsive Grid */}
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Proje */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900 sm:text-base">
                İlgili Proje <span className="text-red-500">*</span>
              </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="form-select w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Proje seçin...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
              {errors.project && (
                <p className="mt-1.5 text-sm text-red-600">{errors.project}</p>
              )}
            </div>

            {/* Ödeme Tutarı */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900 sm:text-base">
                Ödeme Tutarı <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-3 pl-4 pr-12 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <span className="text-base font-semibold text-gray-500">₺</span>
                </div>
              </div>
              {errors.amount && (
                <p className="mt-1.5 text-sm text-red-600">{errors.amount}</p>
              )}
            </div>
          </div>

          {/* Tutarı yazıyla göster - Full width below grid */}
          {amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <span className="font-semibold text-blue-900">Yazıyla:</span>
                  <span className="ml-2 text-blue-800">{numberToWords(parseFloat(amount))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Ödeme Yöntemi */}
          <div className="space-y-4">\
            <label className="block text-sm font-semibold text-gray-900 sm:text-base">
              Ödeme Yöntemi <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {[
                { value: 'Kasadan Nakit', label: 'Kasadan Nakit', icon: '💵' },
                { value: 'Kredi Kartı', label: 'Kredi Kartı', icon: '💳' },
                { value: 'Banka Transferi', label: 'Banka Transferi', icon: '🏦' },
                { value: 'Çek', label: 'Çek', icon: '📝' },
                { value: 'Senet', label: 'Senet', icon: '📄' },
                { value: 'Havale/EFT', label: 'Havale/EFT', icon: '💸' },
                { value: 'Cari', label: 'Cari', icon: '📊' }
              ].map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value as any)}
                  className={`
                    group relative flex min-h-[90px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 px-3 py-4 transition-all sm:min-h-[100px]
                    ${paymentMethod === method.value
                      ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-indigo-50 shadow-md ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50 hover:shadow-sm'
                    }
                  `}
                >
                  <span className={`text-3xl transition-transform sm:text-4xl ${
                    paymentMethod === method.value ? 'scale-110' : 'group-hover:scale-105'
                  }`}>{method.icon}</span>
                  <span className={`text-center text-xs font-semibold leading-tight sm:text-sm ${
                    paymentMethod === method.value ? 'text-primary-700' : 'text-gray-700 group-hover:text-gray-900'
                  }`}>{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bilgilendirme */}
          <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-sm sm:p-5">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="mb-1 text-sm font-bold text-amber-900 sm:text-base">Önemli Bilgilendirme</h4>
                <p className="text-xs leading-relaxed text-amber-800 sm:text-sm">
                  Ödeme kaydedildikten sonra resmi bir <strong>Ödeme Tutanağı</strong> PDF&apos;i oluşturulacak ve indirilebilir hale gelecektir. Bu belge imzalatılarak saklanmalıdır.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-full rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>İşleniyor...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Kaydet ve Sözleşme Oluştur</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
