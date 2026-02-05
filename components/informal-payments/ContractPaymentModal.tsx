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
  const [newSubcontractorVkn, setNewSubcontractorVkn] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  // Çoklu proje ödemeleri için array
  const [projectPayments, setProjectPayments] = useState<Array<{projectId: string, amount: string}>>([{projectId: '', amount: ''}]);
  const [paymentMethod, setPaymentMethod] = useState<'Kasadan Nakit' | 'Kredi Kartı' | 'Banka Transferi' | 'Çek' | 'Senet' | 'Havale/EFT' | 'Cari'>('Kasadan Nakit');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
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

    if (!isAddingNew && !selectedSubcontractor) {
      newErrors.subcontractor = 'Lütfen bir kişi/firma seçin veya yeni ekleyin';
    }

    if (isAddingNew && !newSubcontractorName.trim()) {
      newErrors.newSubcontractor = 'Lütfen kişi/firma adı girin';
    }

    if (isAddingNew && newSubcontractorVkn.trim() && !/^\d{10,11}$/.test(newSubcontractorVkn.trim())) {
      newErrors.newSubcontractorVkn = 'VKN/TCKN 10 veya 11 haneli olmalıdır';
    }

    if (!jobDescription.trim()) {
      newErrors.jobDescription = 'Lütfen yapılan işi açıklayın';
    }

    // Çoklu proje ödemelerini kontrol et
    const validPayments = projectPayments.filter(p => p.projectId && p.amount);
    if (validPayments.length === 0) {
      newErrors.projectPayments = 'En az bir proje ve tutar girmelisiniz';
    }

    // Her ödeme tutarını kontrol et
    projectPayments.forEach((payment, index) => {
      if (payment.projectId || payment.amount) {
        if (!payment.projectId) {
          newErrors[`project_${index}`] = 'Proje seçiniz';
        }
        if (!payment.amount) {
          newErrors[`amount_${index}`] = 'Tutar giriniz';
        } else {
          const amountNum = parseFloat(payment.amount);
          if (isNaN(amountNum) || amountNum <= 0) {
            newErrors[`amount_${index}`] = 'Geçerli bir tutar girin';
          }
          if (amountNum > 999999999.99) {
            newErrors[`amount_${index}`] = 'Tutar çok yüksek';
          }
        }
      }
    });

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
      if (isAddingNew) {
        const newSupplier = await createSubcontractor(
          companyId,
          newSubcontractorName.trim(),
          newSubcontractorVkn.trim() || undefined
        );
        subcontractorId = newSupplier.id;
        subcontractorName = newSupplier.name;
      } else {
        const supplier = subcontractors.find(s => s.id === subcontractorId);
        subcontractorName = supplier?.name || '';
      }

      // Geçerli proje ödemelerini filtrele
      const validPayments = projectPayments.filter(p => p.projectId && p.amount);
      
      // Her proje için ayrı ödeme kaydı oluştur
      const paymentRecords = [];
      
      for (const payment of validPayments) {
        const { data: paymentRecord, error: paymentError } = await supabase
          .from('informal_payments')
          .insert({
            company_id: companyId,
            supplier_id: subcontractorId,
            project_id: payment.projectId,
            description: jobDescription.trim(),
            amount: parseFloat(payment.amount),
            payment_method: paymentMethod,
            payment_date: paymentDate,
            has_contract: true,
            created_by: userId
          })
          .select()
          .single();

        if (paymentError) {
          console.error('Payment insert error:', paymentError);
          throw new Error(paymentError.message || 'Ödeme kaydedilirken hata oluştu');
        }
        
        paymentRecords.push(paymentRecord);
      }

      // Toplam tutar hesapla
      const totalAmount = validPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      
      // Makbuz numarası oluştur
      const receiptNumber = `MKB-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${paymentRecords[0].id.slice(0, 6).toUpperCase()}`;

      // PDF için proje listesi oluştur
      const projectDetails = validPayments.map(p => {
        const project = projects.find(pr => pr.id === p.projectId);
        return {
          projectName: project?.name || 'Belirtilmemiş',
          amount: parseFloat(p.amount)
        };
      });

      // PDF oluştur (çoklu proje için)
      const selectedDate = new Date(paymentDate + 'T00:00:00');
      const pdfData: ContractPaymentData = {
        receiptNumber,
        date: selectedDate.toLocaleDateString('tr-TR', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        companyName: 'Luce Mimarlık',
        companyAddress: 'Adres bilgisi buraya gelecek',
        companyPhone: 'Telefon bilgisi buraya gelecek',
        recipientName: subcontractorName,
        jobDescription: jobDescription.trim(),
        projectName: projectDetails.length === 1 
          ? projectDetails[0].projectName 
          : `${projectDetails.length} Proje (Toplam)`,
        amount: totalAmount,
        paymentMethod: getPaymentMethodLabel(paymentMethod),
        createdBy: 'Yetkili İsmi',
        projectDetails: projectDetails.length > 1 ? projectDetails : undefined // Çoklu proje bilgisi
      };

      const pdfBlob = await generateContractPaymentPDF(pdfData);

      // PDF'i Cloudinary'ye yükle ve URL'yi kaydet
      try {
        const pdfFile = new File([pdfBlob], `${receiptNumber}.pdf`, { type: 'application/pdf' });
        const uploadFormData = new FormData();
        uploadFormData.append('pdf', pdfFile);
        uploadFormData.append('paymentId', paymentRecords[0].id); // İlk ödeme kaydının ID'sini kullan
        uploadFormData.append('companyId', companyId);
        uploadFormData.append('fileName', receiptNumber);

        const uploadResponse = await fetch('/api/upload-contract-pdf', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          console.error('PDF upload failed:', await uploadResponse.text());
          // Upload başarısız olsa bile devam et
        } else {
          const uploadResult = await uploadResponse.json();
          console.log('PDF uploaded successfully:', uploadResult.url);
          
          // Tüm ödeme kayıtlarını aynı PDF URL ile güncelle
          for (let i = 1; i < paymentRecords.length; i++) {
            await supabase
              .from('informal_payments')
              .update({ contract_pdf_url: uploadResult.url })
              .eq('id', paymentRecords[i].id);
          }
        }
      } catch (uploadError) {
        console.error('Error uploading PDF to Cloudinary:', uploadError);
        // Upload başarısız olsa bile devam et
      }

      // PDF'i önizle ve indir
      await previewContractPDF(pdfBlob);
      
      setTimeout(async () => {
        await downloadContractPDF(pdfBlob, `${receiptNumber}.pdf`);
      }, 500);

      // Başarılı
      alert(`${validPayments.length} proje için ödeme kaydedildi ve sözleşme oluşturuldu!`);
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
    return method;
  };

  // Helper: Proje ödemesi ekle
  const addProjectPayment = () => {
    setProjectPayments([...projectPayments, {projectId: '', amount: ''}]);
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

  // Handle close
  const handleClose = () => {
    setSelectedSubcontractor('');
    setNewSubcontractorName('');
    setNewSubcontractorVkn('');
    setIsAddingNew(false);
    setJobDescription('');
    setProjectPayments([{projectId: '', amount: ''}]);
    setPaymentMethod('Kasadan Nakit');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setSearchQuery('');
    setShowSubcontractorDropdown(false);
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
            
            <div className="relative">
              {/* Search/Select Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Kişi/Firma adı yazın veya seçin..."
                  value={isAddingNew ? newSubcontractorName : searchQuery}
                  onChange={(e) => {
                    if (isAddingNew) {
                      setNewSubcontractorName(e.target.value);
                    } else {
                      setSearchQuery(e.target.value);
                      setShowSubcontractorDropdown(true);
                    }
                  }}
                  onFocus={() => {
                    if (!isAddingNew) {
                      setShowSubcontractorDropdown(true);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-24 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                
                {/* Add New Toggle Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(!isAddingNew);
                    if (!isAddingNew) {
                      setSelectedSubcontractor('');
                      setSearchQuery('');
                      setShowSubcontractorDropdown(false);
                      setNewSubcontractorName('');
                      setNewSubcontractorVkn('');
                    } else {
                      setNewSubcontractorName('');
                      setNewSubcontractorVkn('');
                    }
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    isAddingNew
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  }`}
                >
                  {isAddingNew ? '↩ Seç' : '+ Yeni'}
                </button>
              </div>
              
              {/* Dropdown Menu */}
              {showSubcontractorDropdown && !isAddingNew && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredSubcontractors.length > 0 ? (
                    <>
                      {filteredSubcontractors.map((sub) => (
                        <div
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubcontractor(sub.id);
                            setSearchQuery(sub.name);
                            setShowSubcontractorDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-primary-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{sub.name}</div>
                          {sub.vkn && (
                            <div className="text-xs text-gray-500 mt-0.5">VKN: {sub.vkn}</div>
                          )}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <div className="text-gray-400 mb-2">
                        <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">Sonuç bulunamadı</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNew(true);
                          setNewSubcontractorName(searchQuery);
                          setShowSubcontractorDropdown(false);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Yeni kişi/firma olarak ekle
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* VKN Input (only when adding new) */}
            {isAddingNew && (
              <div className="rounded-lg bg-primary-50 border border-primary-200 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100">
                      <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-primary-900 mb-1">Yeni Kişi/Firma Ekleniyor</h4>
                    <p className="text-xs text-primary-700 mb-3">
                      Bu kişi/firma sisteme kaydedilecek ve gelecekte tekrar kullanabileceksiniz.
                    </p>
                    
                    <div>
                      <label className="block text-xs font-medium text-primary-900 mb-1.5">
                        VKN / TCKN <span className="text-primary-400 font-normal">(Opsiyonel)</span>
                      </label>
                      <input
                        type="text"
                        value={newSubcontractorVkn}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 11) {
                            setNewSubcontractorVkn(value);
                          }
                        }}
                        placeholder="10 veya 11 haneli numara"
                        className="w-full rounded-md border border-primary-300 bg-white px-3 py-2 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        maxLength={11}
                      />
                      {errors.newSubcontractorVkn && (
                        <p className="mt-1 text-xs text-red-600">{errors.newSubcontractorVkn}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {errors.subcontractor && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.subcontractor}
              </p>
            )}
            {errors.newSubcontractor && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.newSubcontractor}
              </p>
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

          {/* Çoklu Proje Ödemeleri */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-900 sm:text-base">
                Proje ve Tutar Bilgileri <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addProjectPayment}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ödeme Ekle
              </button>
            </div>

            {errors.projectPayments && (
              <p className="text-sm text-red-600">{errors.projectPayments}</p>
            )}

            <div className="space-y-3">
              {projectPayments.map((payment, index) => (
                <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Proje Seçimi */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Proje {index + 1}
                      </label>
                      <select
                        value={payment.projectId}
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
                      {errors[`project_${index}`] && (
                        <p className="text-xs text-red-600">{errors[`project_${index}`]}</p>
                      )}
                    </div>

                    {/* Tutar Girişi */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Tutar (₺)
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={payment.amount}
                            onChange={(e) => updateProjectPayment(index, 'amount', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="text-sm font-semibold text-gray-500">₺</span>
                          </div>
                        </div>
                        {projectPayments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProjectPayment(index)}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                            title="Kaldır"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {errors[`amount_${index}`] && (
                        <p className="text-xs text-red-600">{errors[`amount_${index}`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toplam Tutar Özeti */}
            {projectPayments.some(p => p.amount && parseFloat(p.amount) > 0) && (
              <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-900">Toplam Tutar:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {projectPayments.reduce((sum, p) => {
                        const amount = parseFloat(p.amount);
                        return sum + (isNaN(amount) ? 0 : amount);
                      }, 0).toFixed(2)} ₺
                    </span>
                  </div>
                  {projectPayments.reduce((sum, p) => {
                    const amount = parseFloat(p.amount);
                    return sum + (isNaN(amount) ? 0 : amount);
                  }, 0) > 0 && (
                    <div className="flex items-start gap-2 border-t border-blue-200 pt-2">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs">
                        <span className="font-medium text-blue-900">Yazıyla:</span>
                        <span className="ml-1.5 text-blue-800">
                          {numberToWords(projectPayments.reduce((sum, p) => {
                            const amount = parseFloat(p.amount);
                            return sum + (isNaN(amount) ? 0 : amount);
                          }, 0))}
                        </span>
                      </div>
                    </div>
                  )}
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
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <p className="text-xs text-gray-500">
              PDF sözleşmede bu tarih görünecektir
            </p>
          </div>

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
