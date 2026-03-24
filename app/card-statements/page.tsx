'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CardStatement } from '@/types/card-statement';

export default function CardStatementsPage() {
  const router = useRouter();
  const { user, company, hasPermission } = useAuth();
  const userId = user?.id; // Extract ID to prevent full user object re-renders
  const companyId = company?.id; // Extract ID to prevent full company object re-renders
  
  // Permission checks - hasPermission içinde super admin kontrolü var
  const canRead = hasPermission('card_statements', 'read');
  const canCreate = hasPermission('card_statements', 'create');
  const canDelete = hasPermission('card_statements', 'delete');
  
  // Debug logging
  useEffect(() => {
    if (user) {
      console.log('🔐 [CardStatements] Permission check:', {
        canRead,
        canCreate,
        canDelete,
        userId: user.id
      });
    }
  }, [canRead, canCreate, canDelete, user]);
  
  const [statements, setStatements] = useState<CardStatement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cardFilter, setCardFilter] = useState('');
  
  // Bulk upload state
  interface UploadFile {
    file: File;
    id: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
    message?: string;
  }
  
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [commonCardLastFour, setCommonCardLastFour] = useState('');
  const [commonCardHolderName, setCommonCardHolderName] = useState('');

  useEffect(() => {
    if (userId && companyId) {
      console.log('📊 [CardStatements] Initial load triggered - userId:', userId);
      loadStatements();
    }
  }, [userId, companyId]); // Use userId and companyId instead of full objects to prevent re-renders

  async function loadStatements() {
    setIsLoading(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
      
      const response = await fetch('/api/card-statements', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ekstreler yüklenemedi');
      }

      const data = await response.json();
      setStatements(data.statements || []);
    } catch (error) {
      console.error('Load statements error:', error);
    } finally {
      setIsLoading(false);
    }
  }
  
  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Create UploadFile objects
    const newFiles: UploadFile[] = Array.from(files).map((file, index) => ({
      file,
      id: `${Date.now()}-${index}`,
      status: 'pending' as const
    }));
    
    setUploadFiles(prev => [...prev, ...newFiles]);
    setUploadError(null);
  }
  
  function removeFile(fileId: string) {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  }

  async function handleBulkUpload() {
    if (uploadFiles.length === 0) {
      setUploadError('Lütfen en az bir dosya seçin');
      return;
    }

    // Validate common card last four (if provided)
    if (commonCardLastFour && !/^\d{4}$/.test(commonCardLastFour)) {
      setUploadError('Kart numarası son 4 hane rakam olmalı');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    
    let successCount = 0;
    let errorCount = 0;

    // Process files sequentially
    for (const uploadFile of uploadFiles) {
      // Skip already processed files
      if (uploadFile.status === 'success' || uploadFile.status === 'error') {
        if (uploadFile.status === 'success') successCount++;
        if (uploadFile.status === 'error') errorCount++;
        continue;
      }
      
      // Update status to uploading
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
      ));

      try {
        const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
        
        const formData = new FormData();
        formData.append('file', uploadFile.file);
        if (commonCardLastFour) formData.append('cardLastFour', commonCardLastFour);
        if (commonCardHolderName) formData.append('cardHolderName', commonCardHolderName);

        const response = await fetch('/api/card-statements/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          // Log validation errors to console if present
          if (data.validationErrors && data.validationErrors.length > 0) {
            console.error('Validation errors:', data.validationErrors);
          }
          throw new Error(data.error || 'Yükleme başarısız');
        }

        // Success
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'success' as const, message: data.message } 
            : f
        ));
        successCount++;
        
      } catch (error: any) {
        console.error(`Upload error for ${uploadFile.file.name}:`, error);
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error' as const, error: error.message } 
            : f
        ));
        errorCount++;
      }
    }

    setIsUploading(false);
    
    // Show summary
    const totalFiles = uploadFiles.length;
    const summary = `✅ Toplu yükleme tamamlandı!\n\n` +
                    `Başarılı: ${successCount}/${totalFiles}\n` +
                    `Hatalı: ${errorCount}/${totalFiles}`;
    
    alert(summary);
    
    // Reload statements if at least one success
    if (successCount > 0) {
      loadStatements();
    }
  }

  function resetUploadForm() {
    setUploadFiles([]);
    setCommonCardLastFour('');
    setCommonCardHolderName('');
    setUploadError(null);
  }

  async function handleDelete(statementId: string) {
    if (!confirm('Bu ekstre ve tüm eşleştirmeleri silinecek. Emin misiniz?')) {
      return;
    }

    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
      
      const response = await fetch(`/api/card-statements/${statementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Silme işlemi başarısız');
      }

      loadStatements();
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`❌ ${error.message}`);
    }
  }

  // Filter statements
  const filteredStatements = statements.filter(stmt => {
    if (searchQuery && !stmt.file_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !stmt.card_holder_name?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    if (cardFilter && stmt.card_last_four !== cardFilter) {
      return false;
    }
    
    return true;
  });

  // Get unique card numbers for filter
  const uniqueCards = Array.from(new Set(
    statements.map(s => s.card_last_four).filter(Boolean)
  ));

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }

  // Permission check
  if (!canRead) {
    return (
      <Sidebar>
        <div className="px-4 lg:px-6 py-4 lg:py-6">
          <Card className="text-center py-12">
            <p className="text-red-600 font-medium mb-2">Yetkiniz Bulunmuyor</p>
            <p className="text-gray-600">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
          </Card>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="px-4 lg:px-6 py-4 lg:py-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">
              Kredi Kartı Ekstreleri
            </h1>
            <p className="text-sm text-gray-600">
              Kredi kartı ekstrelerini yükleyip faturalarla eşleştirin
            </p>
          </div>

          {/* Actions & Filters */}
          <div className="mb-4 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex gap-2">
              <Input
                type="text"
                placeholder="Dosya adı veya kart sahibi ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              
              {uniqueCards.length > 0 && (
                <select
                  value={cardFilter}
                  onChange={(e) => setCardFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tüm Kartlar</option>
                  {uniqueCards.map(card => (
                    <option key={card} value={card}>****{card}</option>
                  ))}
                </select>
              )}
            </div>
            
            {canCreate && (
              <Button onClick={() => setIsUploadModalOpen(true)} size="sm" className="text-sm">
                + Ekstre Yükle
              </Button>
            )}
          </div>

          {/* Statements List */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Yükleniyor...</p>
            </div>
          ) : filteredStatements.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {searchQuery || cardFilter ? 'Arama kriterlerine uygun ekstre bulunamadı' : 'Henüz ekstre yüklenmemiş'}
              </p>
              {!searchQuery && !cardFilter && (
                <Button onClick={() => setIsUploadModalOpen(true)}>
                  İlk Ekstreyi Yükle
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredStatements.map((stmt: any) => {
                const matchPercentage = stmt.match_percentage || 0;
                const total = stmt.total_transactions || 0;
                const matched = stmt.matched_count || 0;
                const pettyCash = stmt.petty_cash_count || 0;
                const verified = stmt.verified_count || 0;
                const remaining = stmt.remaining_count ?? Math.max(0, total - matched - pettyCash);

                // İlerleme çubuğu için yüzdeler
                const matchedPct = total > 0 ? (matched / total) * 100 : 0;
                const pettyCashPct = total > 0 ? (pettyCash / total) * 100 : 0;
                const remainingPct = total > 0 ? (remaining / total) * 100 : 0;

                // Tamamlanma rengi
                const completionColor = matchPercentage >= 80
                  ? 'text-green-600'
                  : matchPercentage >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600';

                return (
                  <Card key={stmt.id} className="hover:shadow-lg transition-shadow" padding="sm">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Başlık satırı */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {stmt.file_name}
                          </h3>
                          {stmt.card_last_four && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                              ****{stmt.card_last_four}
                            </span>
                          )}
                          {remaining === 0 && total > 0 && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                              ✓ Tamamlandı
                            </span>
                          )}
                        </div>

                        {/* Meta bilgiler */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-gray-500">Dönem:</span>
                            <span className="ml-1.5 font-medium">
                              {stmt.statement_month
                                ? new Date(stmt.statement_month).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })
                                : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Toplam İşlem:</span>
                            <span className="ml-1.5 font-medium">{total}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Tutar:</span>
                            <span className="ml-1.5 font-medium">{formatCurrency(stmt.total_amount)}</span>
                          </div>
                        </div>

                        {/* İstatistik pilleri */}
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-xs">
                            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                            <span className="text-gray-600">Eşleşti:</span>
                            <span className={`font-bold ${completionColor}`}>
                              {matched}/{total}
                            </span>
                            <span className={`font-semibold ${completionColor}`}>(%{matchPercentage})</span>
                          </div>

                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs">
                            <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></span>
                            <span className="text-gray-600">Kasa Fişi:</span>
                            <span className="font-bold text-purple-700">{pettyCash}</span>
                          </div>

                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs">
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                            <span className="text-gray-600">Onaylanan:</span>
                            <span className="font-bold text-blue-700">{verified}</span>
                          </div>

                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${remaining > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${remaining > 0 ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                            <span className="text-gray-600">Kalan:</span>
                            <span className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-gray-500'}`}>{remaining}</span>
                          </div>
                        </div>

                        {/* İlerleme çubuğu */}
                        {total > 0 && (
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden flex">
                            <div
                              className="bg-green-500 h-full transition-all"
                              style={{ width: `${matchedPct}%` }}
                              title={`Eşleşti: ${matched}`}
                            />
                            <div
                              className="bg-purple-400 h-full transition-all"
                              style={{ width: `${pettyCashPct}%` }}
                              title={`Kasa Fişi: ${pettyCash}`}
                            />
                            <div
                              className="bg-red-300 h-full transition-all"
                              style={{ width: `${remainingPct}%` }}
                              title={`Kalan: ${remaining}`}
                            />
                          </div>
                        )}

                        {stmt.card_holder_name && (
                          <p className="text-xs text-gray-600">
                            Kart Sahibi: {stmt.card_holder_name}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-400">
                          Yüklenme: {formatDate(stmt.uploaded_at)}
                        </p>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/card-statements/${stmt.id}`)}
                          className="text-xs"
                        >
                          Detay
                        </Button>

                        {canDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(stmt.id)}
                            className="text-xs text-red-600 hover:bg-red-50"
                          >
                            Sil
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        <Modal
        isOpen={isUploadModalOpen}
        onClose={() => {
          if (!isUploading) {
            setIsUploadModalOpen(false);
            resetUploadForm();
          }
        }}
        title="Toplu Ekstre Yükle"
      >
        <div className="space-y-4">
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {uploadError}
            </div>
          )}
          
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excel Dosyaları Seç *
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={handleFileSelection}
              disabled={isUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              .xlsx veya .xls formatında birden fazla dosya seçebilirsiniz
            </p>
          </div>
          
          {/* Common Metadata */}
          {uploadFiles.length > 0 && (
            <>
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Tüm Dosyalar İçin Ortak Bilgiler (opsiyonel)
                </p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Kart Numarası Son 4 Hane
                    </label>
                    <Input
                      type="text"
                      placeholder="1234"
                      maxLength={4}
                      value={commonCardLastFour}
                      onChange={(e) => setCommonCardLastFour(e.target.value.replace(/\D/g, ''))}
                      disabled={isUploading}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Kart Sahibi
                    </label>
                    <Input
                      type="text"
                      placeholder="Ahmet Yılmaz"
                      value={commonCardHolderName}
                      onChange={(e) => setCommonCardHolderName(e.target.value)}
                      disabled={isUploading}
                    />
                  </div>
                </div>
                
                <p className="mt-2 text-xs text-gray-500">
                  💡 Dönem bilgisi her dosya için otomatik tespit edilir
                </p>
              </div>
              
              {/* Files List */}
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Yüklenecek Dosyalar ({uploadFiles.length})
                </p>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {uploadFiles.map((uploadFile) => {
                    const statusColors = {
                      pending: 'bg-gray-100 text-gray-700',
                      uploading: 'bg-blue-100 text-blue-700',
                      success: 'bg-green-100 text-green-700',
                      error: 'bg-red-100 text-red-700'
                    };
                    
                    const statusIcons = {
                      pending: '⏳',
                      uploading: '📤',
                      success: '✅',
                      error: '❌'
                    };
                    
                    const statusTexts = {
                      pending: 'Bekliyor',
                      uploading: 'Yükleniyor...',
                      success: 'Başarılı',
                      error: 'Hata'
                    };
                    
                    return (
                      <div
                        key={uploadFile.id}
                        className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[uploadFile.status]}`}>
                              {statusIcons[uploadFile.status]} {statusTexts[uploadFile.status]}
                            </span>
                            <span className="text-gray-700 truncate font-medium">
                              {uploadFile.file.name}
                            </span>
                          </div>
                          
                          <div className="mt-1 text-xs text-gray-500">
                            {(uploadFile.file.size / 1024).toFixed(1)} KB
                          </div>
                          
                          {uploadFile.message && uploadFile.status === 'success' && (
                            <div className="mt-1 text-xs text-green-600">
                              {uploadFile.message}
                            </div>
                          )}
                          
                          {uploadFile.error && uploadFile.status === 'error' && (
                            <div className="mt-1 text-xs text-red-600">
                              {uploadFile.error}
                            </div>
                          )}
                        </div>
                        
                        {!isUploading && uploadFile.status === 'pending' && (
                          <button
                            onClick={() => removeFile(uploadFile.id)}
                            className="flex-shrink-0 p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Kaldır"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsUploadModalOpen(false);
              resetUploadForm();
            }}
            disabled={isUploading}
          >
            {isUploading ? 'Yükleme Devam Ediyor...' : 'İptal'}
          </Button>
          <Button
            onClick={handleBulkUpload}
            disabled={uploadFiles.length === 0 || isUploading}
          >
            {isUploading 
              ? `Yükleniyor... (${uploadFiles.filter(f => f.status === 'success').length}/${uploadFiles.length})`
              : `${uploadFiles.length} Dosya Yükle`
            }
          </Button>
        </ModalFooter>
      </Modal>
    </Sidebar>
  );
}
