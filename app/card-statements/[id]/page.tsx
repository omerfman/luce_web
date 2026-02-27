'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { checkPermission } from '@/lib/permissions';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import type { CardStatement, CardStatementItem, StatementInvoiceMatch } from '@/types/card-statement';

interface StatementDetail {
  statement: CardStatement;
  items: (CardStatementItem & { matches: StatementInvoiceMatch[] })[];
  stats: {
    total: number;
    autoMatched: number;
    suggested: number;
    noMatch: number;
    autoMatchRate: number;
    suggestionRate: number;
  };
}

export default function StatementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, permissions } = useAuth();
  const statementId = params.id as string;
  const userId = user?.id; // Extract ID to prevent full user object re-renders
  
  // Permission checks
  const canAssign = checkPermission(permissions, 'card_statements', 'assign');
  const canUpdate = checkPermission(permissions, 'card_statements', 'update');
  const canVerify = checkPermission(permissions, 'card_statements', 'verify');
  
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CardStatementItem | null>(null);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isSearchingManually, setIsSearchingManually] = useState(false);
  const [isBulkMatching, setIsBulkMatching] = useState(false);
  
  // Bulk matching progress tracking
  const [bulkMatchProgress, setBulkMatchProgress] = useState<{
    total: number;
    current: number;
    matched: number;
    suggested: number;
    failed: number;
  } | null>(null);
  
  // Notes editing state
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});
  const [savingNotes, setSavingNotes] = useState<{ [key: string]: boolean }>({});
  
  // Projects state (kasa fişleri için)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [assigningProject, setAssigningProject] = useState<{ [key: string]: boolean }>({});

  // PDF açma fonksiyonu (faturalar sayfasındaki gibi)
  async function openInvoicePDF(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from('invoices')
        .createSignedUrl(filePath, 3600);
      
      if (error) {
        console.error('Error creating signed URL:', error);
        alert('PDF açılırken hata oluştu');
        return;
      }
      
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error opening PDF:', error);
      alert('PDF açılırken hata oluştu');
    }
  }
  
  // Filtreleme state'leri
  const [filterTransactionType, setFilterTransactionType] = useState<'all' | 'expense' | 'payment'>('all');
  const [filterCardNumber, setFilterCardNumber] = useState<string>('all');
  const [filterMatchStatus, setFilterMatchStatus] = useState<'all' | 'matched' | 'suggested' | 'noMatch'>('all');
  const [filterProjectId, setFilterProjectId] = useState<string>('all'); // Yeni: Proje filtresi
  const [showOnlyPettyCash, setShowOnlyPettyCash] = useState(false); // Yeni: Sadece kasa fişleri
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false); // Yeni: Sadece atanmamış
  const [groupByCard, setGroupByCard] = useState<boolean>(false);

  // Initial load only - prevent unnecessary reloads
  useEffect(() => {
    if (userId && statementId) {
      console.log('🔄 [CardStatement] Initial load triggered - userId:', userId, 'statementId:', statementId);
      loadDetail();
      loadProjects();
    }
  }, [userId, statementId]); // Use userId instead of user object to prevent re-renders
  
  // Modal kapandığında arama sonuçlarını temizle
  useEffect(() => {
    if (!isMatchModalOpen) {
      setSearchInvoiceQuery('');
      setManualSearchResults([]);
    }
  }, [isMatchModalOpen]);

  async function loadDetail() {
    console.log('🔄 [LoadDetail] Starting');
    
    setIsLoading(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
      
      const response = await fetch(`/api/card-statements/${statementId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Detaylar yüklenemedi');
      }

      const data = await response.json();
      console.log('✅ [LoadDetail] Data loaded, setting detail state');
      setDetail(data);
    } catch (error) {
      console.error('❌ [LoadDetail] Error:', error);
      alert('Detaylar yüklenirken hata oluştu');
      router.push('/card-statements');
    } finally {
      setIsLoading(false);
      console.log('✅ [LoadDetail] Complete');
    }
  }
  
  async function loadProjects() {
    setIsLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Load projects error:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }
  
  async function handleProjectAssign(itemId: string, projectId: string | null) {
    console.log('🎯 [ProjectAssign] Starting for item:', itemId, 'project:', projectId);
    
    setAssigningProject(prev => ({ ...prev, [itemId]: true }));
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
      
      const response = await fetch(`/api/card-statements/${statementId}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ project_id: projectId })
      });
      
      if (!response.ok) {
        throw new Error('Proje ataması başarısız');
      }
      
      console.log('✅ [ProjectAssign] API call successful');
      
      // Optimistic UI update - update state directly without reloading
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => 
            item.id === itemId 
              ? { ...item, project_id: projectId }
              : item
          )
        };
      });
    } catch (error: any) {
      console.error('❌ [ProjectAssign] Error:', error);
      alert(`❌ ${error.message}`);
    } finally {
      setAssigningProject(prev => ({ ...prev, [itemId]: false }));
      console.log('✅ [ProjectAssign] Complete');
    }
  }

  async function loadSuggestions(item: CardStatementItem) {
    setIsLoadingSuggestions(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
      
      const response = await fetch(`/api/card-statements/${item.id}/suggestions`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Öneriler yüklenemedi');
      }

      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Load suggestions error:', error);
      alert('Öneriler yüklenirken hata oluştu');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  async function handleMatch(itemId: string, invoiceId: string, matchScore?: number, matchType?: string) {
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
      
      const response = await fetch('/api/card-statements/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          statementItemId: itemId,
          invoiceId,
          matchScore,
          matchType,
          notes: matchScore ? `Eşleştirme (Skor: %${Math.round(matchScore)})` : 'Manuel eşleştirme'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Eşleştirme başarısız');
      }

      const result = await response.json();
      const newMatch = result.match;
      
      // Optimistic UI update - update state directly without reloading
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => 
            item.id === itemId 
              ? { ...item, is_matched: true, matches: [newMatch] }
              : item
          ),
          stats: {
            ...prev.stats,
            autoMatched: prev.stats.autoMatched + 1,
            noMatch: Math.max(0, prev.stats.noMatch - 1)
          }
        };
      });
      
      setIsMatchModalOpen(false);
      setSelectedItem(null);
      setSuggestions(null);
      setSearchInvoiceQuery('');
      setManualSearchResults([]);
    } catch (error: any) {
      console.error('Match error:', error);
      alert(`❌ ${error.message}`);
    }
  }

  async function handleUnmatch(matchId: string) {
    if (!confirm('Bu eşleştirmeyi kaldırmak istediğinize emin misiniz?')) {
      return;
    }

    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
      
      const response = await fetch('/api/card-statements/match', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ matchId })
      });

      if (!response.ok) {
        throw new Error('Eşleştirme kaldırılamadı');
      }

      // Optimistic UI update - update state directly without reloading
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => {
            const hasThisMatch = item.matches?.some(m => m.id === matchId);
            return hasThisMatch
              ? { ...item, is_matched: false, matches: [] }
              : item;
          }),
          stats: {
            ...prev.stats,
            autoMatched: Math.max(0, prev.stats.autoMatched - 1),
            noMatch: prev.stats.noMatch + 1
          }
        };
      });
    } catch (error: any) {
      console.error('Unmatch error:', error);
      alert(`❌ ${error.message}`);
    }
  }

  async function searchInvoicesManually(query: string) {
    if (!query || query.trim().length < 2) {
      setManualSearchResults([]);
      return;
    }

    setIsSearchingManually(true);
    try {
      // Get company_id for the search
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user!.id)
        .single();

      if (!userData) return;

      // Tüm faturalarda ara (eşleşmiş olanlar dahil)
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', userData.company_id)
        .or(`invoice_number.ilike.%${query}%,supplier_name.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Search error:', error);
        return;
      }

      console.log(`🔍 Manuel arama: "${query}" için ${invoices?.length || 0} sonuç bulundu`);
      setManualSearchResults(invoices || []);
    } catch (error) {
      console.error('Manual search error:', error);
    } finally {
      setIsSearchingManually(false);
    }
  }

  async function handleBulkMatch(threshold: number) {
    if (!confirm(`%${threshold} ve üzeri skorlu eşleşmeleri otomatik kabul et. Daha düşük skorlar (%50+) öneri olarak kaydedilsin mi?`)) {
      return;
    }

    setIsBulkMatching(true);
    let matchedCount = 0;
    let savedSuggestionsCount = 0;
    let failedCount = 0;

    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();

      // Sadece eşleşmemiş items'ları al
      const unmatchedItems = items.filter(item => !item.is_matched);
      
      console.log(`🔄 Starting bulk match for ${unmatchedItems.length} unmatched items with threshold ${threshold}%`);

      // Initialize progress
      setBulkMatchProgress({
        total: unmatchedItems.length,
        current: 0,
        matched: 0,
        suggested: 0,
        failed: 0
      });

      for (let i = 0; i < unmatchedItems.length; i++) {
        const item = unmatchedItems[i];
        try {
          // Her item için suggestions çek
          const response = await fetch(`/api/card-statements/${item.id}/suggestions`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          });

          if (!response.ok) {
            console.error(`Failed to get suggestions for item ${item.id}`);
            failedCount++;
            continue;
          }

          const data = await response.json();
          
          // Tüm matches'leri birleştir (exact + suggested)
          const allMatches = [
            ...(data.exactMatches || []),
            ...(data.suggestedMatches || [])
          ];

          // En yüksek skorlu match'i bul
          const bestMatch = allMatches
            .sort((a, b) => b.matchScore - a.matchScore)[0];

          if (!bestMatch) {
            // Hiç öneri yoksa devam et
            continue;
          }

          // Threshold üzerindeyse eşleştir
          if (bestMatch.matchScore >= threshold) {
            const matchResponse = await fetch('/api/card-statements/match', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({
                statementItemId: item.id,
                invoiceId: bestMatch.invoice.id,
                matchScore: Math.round(bestMatch.matchScore),
                matchType: bestMatch.matchType,
                notes: `Otomatik eşleştirme (%${threshold} threshold, skor: ${Math.round(bestMatch.matchScore)})`
              })
            });

            if (matchResponse.ok) {
              matchedCount++;
              console.log(`✅ Matched item ${item.id} with invoice ${bestMatch.invoice.id} (score: ${Math.round(bestMatch.matchScore)})`);
            } else {
              failedCount++;
              console.error(`Failed to match item ${item.id}`);
            }
            
            // Update progress
            setBulkMatchProgress(prev => prev ? {
              ...prev,
              current: i + 1,
              matched: matchedCount,
              failed: failedCount
            } : null);
          } 
          // Threshold altında ama %50+ ise öneri olarak kaydet
          else if (bestMatch.matchScore >= 50) {
            const saveSuggestionResponse = await fetch(`/api/card-statements/${item.id}/save-suggestion`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({
                matchConfidence: Math.round(bestMatch.matchScore)
              })
            });

            if (saveSuggestionResponse.ok) {
              savedSuggestionsCount++;
              console.log(`💡 Saved suggestion for item ${item.id} (score: ${Math.round(bestMatch.matchScore)})`);
            } else {
              console.error(`Failed to save suggestion for item ${item.id}`);
            }
            
            // Update progress
            setBulkMatchProgress(prev => prev ? {
              ...prev,
              current: i + 1,
              suggested: savedSuggestionsCount,
              failed: failedCount
            } : null);
          }
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
          failedCount++;
        } finally {
          // Update progress even if there was an error
          setBulkMatchProgress(prev => prev ? {
            ...prev,
            current: i + 1,
            failed: failedCount
          } : null);
        }
      }

      // Sonuçları göster
      alert(`✅ Toplu tarama tamamlandı!\n\n` +
            `Eşleştirilen: ${matchedCount}\n` +
            `Öneri olarak kaydedilen: ${savedSuggestionsCount}\n` +
            `Başarısız: ${failedCount}\n` +
            `Toplam: ${unmatchedItems.length}`);

      // Reload data to show bulk changes
      await loadDetail();

    } catch (error: any) {
      console.error('Bulk match error:', error);
      alert(`❌ Toplu tarama hatası: ${error.message}`);
    } finally {
      setIsBulkMatching(false);
      // Clear progress after a short delay to show completion
      setTimeout(() => setBulkMatchProgress(null), 2000);
    }
  }
  
  // Not güncelleme
  async function handleUpdateNotes(itemId: string, notes: string) {
    setSavingNotes(prev => ({ ...prev, [itemId]: true }));
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();

      const response = await fetch(`/api/card-statements/${itemId}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ notes })
      });

      if (!response.ok) {
        throw new Error('Not kaydedilemedi');
      }

      // Optimistic UI update - update state directly without reloading
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => 
            item.id === itemId 
              ? { ...item, notes }
              : item
          )
        };
      });
      
      // Clear editing state
      setEditingNotes(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });

    } catch (error: any) {
      console.error('Update notes error:', error);
      alert(`❌ ${error.message}`);
    } finally {
      setSavingNotes(prev => ({ ...prev, [itemId]: false }));
    }
  }

  // Harcamayı onayla
  async function handleVerify(itemId: string) {
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();

      const response = await fetch(`/api/card-statements/${itemId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Onaylama başarısız');
      }

      // Optimistic UI update - update state directly without reloading
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => 
            item.id === itemId 
              ? { ...item, is_verified: true }
              : item
          )
        };
      });

    } catch (error: any) {
      console.error('Verify error:', error);
      alert(`❌ ${error.message}`);
    }
  }

  // Onayı kaldır
  async function handleUnverify(itemId: string) {
    try {
      const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();

      const response = await fetch(`/api/card-statements/${itemId}/verify`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Onay kaldırılamadı');
      }

      // Optimistic UI update - update state directly without reloading
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => 
            item.id === itemId 
              ? { ...item, is_verified: false }
              : item
          )
        };
      });

    } catch (error: any) {
      console.error('Unverify error:', error);
      alert(`❌ ${error.message}`);
    }
  }
  
  // Tablo satırını render eden helper fonksiyon
  function renderTableRow(item: CardStatementItem & { matches: StatementInvoiceMatch[] }) {
    const match = item.matches?.[0];
    
    const statusColor = item.is_matched 
      ? 'bg-green-100 text-green-800'
      : item.match_confidence > 0 
        ? 'bg-yellow-100 text-yellow-800' 
        : 'bg-gray-100 text-gray-800';
    
    const statusText = item.is_matched 
      ? match?.match_type === 'manual' ? '✅ Manuel' : '✅ Otomatik'
      : item.match_confidence > 0 
        ? '⚠️ Öneri Var' 
        : '❌ Eşleşmedi';
    
    // Background renkleri: Eşleşmiş (yeşil), Kasa Fişi (mor), Onaylı (yeşil), Normal (beyaz)
    const rowBgClass = item.is_matched || item.is_verified
      ? 'bg-green-50 hover:bg-green-100'
      : item.project_id && !item.is_matched 
        ? 'bg-purple-50 hover:bg-purple-100'
        : 'hover:bg-gray-50';
    
    // Proje bilgisi (kasa fişi için)
    const projectInfo = item.project_id 
      ? projects.find(p => p.id === item.project_id)
      : null;
    
    return (
      <tr key={item.id} className={rowBgClass}>
        <td className="px-2 py-2 text-xs text-gray-900">{item.row_number}</td>
        <td className="px-2 py-2">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-900">{item.transaction_name}</span>
            
            {/* Taksit badge */}
            {item.is_installment && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                📅 {item.installment_current}/{item.installment_total} Taksit
                {item.installment_total_amount && ` • Toplam: ${formatCurrency(item.installment_total_amount)}`}
              </span>
            )}
            
            {/* Transaction type badge (payment durumunda) */}
            {item.transaction_type === 'payment' && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                💰 Borç Ödemesi
              </span>
            )}
            
            {/* Kasa Fişi badge (projeye atanmış harcamalar) */}
            {item.project_id && !item.is_matched && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded" title={projectInfo?.name || ''}>
                💼 Kasa Fişi {projectInfo && `• ${projectInfo.name}`}
              </span>
            )}
            
            {/* Card holder (ek kart ise) */}
            {item.card_holder_name && (
              <span className="text-xs text-gray-500 mt-1">
                {item.card_holder_name}
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-xs text-right">
          <span className={item.amount < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            {formatCurrency(Math.abs(item.amount))}
          </span>
        </td>
        <td className="px-2 py-2 text-xs text-gray-600">
          {item.transaction_date ? formatDate(item.transaction_date) : '-'}
        </td>
        <td className="px-2 py-2 text-center">
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${statusColor}`}>
            {statusText}
          </span>
        </td>
        <td className="px-2 py-2 text-xs">
          {match ? (
            <div className="flex items-start gap-2">
              <div className="flex-1 flex flex-col">
                <span className="font-medium text-gray-900">
                  {match.invoice?.supplier_name || '(Tedarikçi belirtilmemiş)'}
                </span>
                <span className="text-xs text-gray-500">
                  {match.invoice?.invoice_number || '(Fatura no yok)'} • {formatCurrency(match.invoice?.amount || 0)}
                  {match.invoice?.invoice_date && ` • ${formatDate(match.invoice.invoice_date)}`}
                </span>
                <span className="text-xs text-green-600 font-medium">
                  Skor: %{match.match_score ? Math.round(Number(match.match_score)) : 100}
                </span>
              </div>
              {match.invoice?.file_path && (
                <button
                  onClick={() => {
                    const filePath = match.invoice?.file_path;
                    if (filePath) openInvoicePDF(filePath);
                  }}
                  className="flex-shrink-0 p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="PDF'i Aç"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        
        {/* Project Assignment Column (Kasa Fişi) */}
        <td className="px-2 py-2">
          {!item.is_matched && item.transaction_type !== 'payment' ? (
            item.project_id && projectInfo ? (
              // Projeye atanmış - Badge + Edit butonu
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800 flex-1">
                  📁 {projectInfo.name}
                </span>
                <button
                  onClick={() => handleProjectAssign(item.id, null)}
                  className="flex-shrink-0 p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Atamayı Kaldır"
                  disabled={assigningProject[item.id]}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              // Atanmamış - Dropdown
              <select
                value={item.project_id || ''}
                onChange={(e) => handleProjectAssign(item.id, e.target.value || null)}
                disabled={assigningProject[item.id] || isLoadingProjects}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="">Projeye ata...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )
          ) : (
            <span className="text-xs text-gray-400">
              {item.is_matched ? '(Faturalı)' : '-'}
            </span>
          )}
        </td>
        
        {/* Notes Column */}
        <td className="px-2 py-2">
          {editingNotes[item.id] !== undefined ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingNotes[item.id]}
                onChange={(e) => setEditingNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Açıklama..."
                autoFocus
              />
              <button
                onClick={() => handleUpdateNotes(item.id, editingNotes[item.id])}
                disabled={savingNotes[item.id]}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingNotes[item.id] ? '...' : '💾'}
              </button>
              <button
                onClick={() => setEditingNotes(prev => {
                  const newState = { ...prev };
                  delete newState[item.id];
                  return newState;
                })}
                className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {item.notes ? (
                <>
                  <span className="flex-1 text-sm text-gray-700">{item.notes}</span>
                  <button
                    onClick={() => setEditingNotes(prev => ({ ...prev, [item.id]: item.notes || '' }))}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    title="Düzenle"
                  >
                    ✏️
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingNotes(prev => ({ ...prev, [item.id]: '' }))}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  + Açıklama ekle
                </button>
              )}
            </div>
          )}
        </td>
        
        <td className="px-2 py-2 text-center">
          <div className="flex items-center justify-center gap-2">
            {/* Verification Button - Sadece eşleşmemiş itemlar için */}
            {!item.is_matched && (
              item.is_verified ? (
                <button
                  onClick={() => handleUnverify(item.id)}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                  title="Onayı Kaldır"
                >
                  ✓ Onaylı
                </button>
              ) : (
                <button
                  onClick={() => handleVerify(item.id)}
                  className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-1"
                  title="Onayla"
                >
                  Onayla
                </button>
              )
            )}
            
            {/* Match/Unmatch Button */}
            {item.transaction_type === 'payment' ? (
              <span className="text-xs text-gray-400">-</span>
            ) : item.is_matched && match ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnmatch(match.id)}
                className="text-red-600 hover:bg-red-50"
              >
                Kaldır
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedItem(item);
                  loadSuggestions(item);
                  setIsMatchModalOpen(true);
                }}
              >
                Eşleştir
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { statement, items, stats } = detail;
  
  // Kasa fişi istatistikleri hesapla
  const pettyCashItems = items.filter(item => !item.is_matched && item.project_id && item.transaction_type !== 'payment');
  const pettyCashCount = pettyCashItems.length;
  // const pettyCashTotal = pettyCashItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  // const pettyCashPercentage = stats.noMatch > 0 ? Math.round((pettyCashCount / stats.noMatch) * 100) : 0;
  
  // Unique card numbers'ı bul
  const uniqueCards = Array.from(
    new Set(items.map(item => item.full_card_number).filter(Boolean))
  ).sort();
  
  // Filtreleme logic
  let filteredItems = items;
  
  // Match status filter
  if (filterMatchStatus !== 'all') {
    filteredItems = filteredItems.filter(item => {
      if (filterMatchStatus === 'matched') {
        return item.is_matched;
      } else if (filterMatchStatus === 'suggested') {
        return !item.is_matched && item.match_confidence > 0;
      } else if (filterMatchStatus === 'noMatch') {
        return !item.is_matched && item.match_confidence === 0;
      }
      return true;
    });
  }
  
  // Transaction type filter
  if (filterTransactionType !== 'all') {
    filteredItems = filteredItems.filter(item => 
      item.transaction_type === filterTransactionType
    );
  }
  
  // Card number filter
  if (filterCardNumber !== 'all') {
    filteredItems = filteredItems.filter(item => 
      item.full_card_number === filterCardNumber
    );
  }
  
  // Proje filtresi
  if (filterProjectId !== 'all') {
    filteredItems = filteredItems.filter(item => 
      item.project_id === filterProjectId
    );
  }
  
  // Sadece kasa fişleri filtresi
  if (showOnlyPettyCash) {
    filteredItems = filteredItems.filter(item => 
      !item.is_matched && item.project_id && item.transaction_type !== 'payment'
    );
  }
  
  // Sadece atanmamış harcamalar filtresi
  if (showOnlyUnassigned) {
    filteredItems = filteredItems.filter(item => 
      !item.is_matched && !item.project_id && item.transaction_type !== 'payment'
    );
  }
  
  // Kart bazında gruplama
  const groupedByCard: Record<string, typeof filteredItems> = {};
  if (groupByCard) {
    filteredItems.forEach(item => {
      const cardKey = item.full_card_number || '(Kart Bilgisi Yok)';
      if (!groupedByCard[cardKey]) {
        groupedByCard[cardKey] = [];
      }
      groupedByCard[cardKey].push(item);
    });
  }

  return (
    <>
      <Sidebar>
        <div className="px-4 lg:px-6 py-4 lg:py-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => router.push('/card-statements')}
              className="mb-4"
            >
              ← Geri
            </Button>
            
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2 truncate">
              {statement.file_name}
            </h1>
            
            <div className="flex flex-wrap gap-3 lg:gap-6 text-xs lg:text-sm text-gray-600">
              {statement.card_last_four && (
                <span>Kart: ****{statement.card_last_four}</span>
              )}
              {statement.card_holder_name && (
                <span>Kart Sahibi: {statement.card_holder_name}</span>
              )}
              {statement.statement_month && (
                <span>Dönem: {new Date(statement.statement_month).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}</span>
              )}
              <span>Yükleme: {formatDate(statement.uploaded_at)}</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Card padding="sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-600 mt-1">Toplam İşlem</div>
              </div>
            </Card>
            
            <Card padding="sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.autoMatched}</div>
                <div className="text-xs text-gray-600 mt-1">Eşleşti</div>
              </div>
            </Card>
            
            <Card padding="sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{pettyCashCount}</div>
                <div className="text-xs text-gray-600 mt-1">💼 Kasa Fişi</div>
              </div>
            </Card>
            
            <Card padding="sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.suggested}</div>
                <div className="text-xs text-gray-600 mt-1">Öneri Var</div>
              </div>
            </Card>
            
            <Card padding="sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.noMatch - pettyCashCount}</div>
                <div className="text-xs text-gray-600 mt-1">Atanmadı</div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-4" padding="sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Filtrele ve Grupla</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              {/* Match Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durum
                </label>
                <select
                  value={filterMatchStatus}
                  onChange={(e) => setFilterMatchStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tümü</option>
                  <option value="matched">✅ Eşleşti</option>
                  <option value="suggested">⚠️ Öneri Var</option>
                  <option value="noMatch">❌ Eşleşmedi</option>
                </select>
              </div>
              
              {/* Transaction Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşlem Tipi
                </label>
                <select
                  value={filterTransactionType}
                  onChange={(e) => setFilterTransactionType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tümü</option>
                  <option value="expense">💸 Harcamalar</option>
                  <option value="payment">💰 Ödemeler (+)</option>
                </select>
              </div>
              
              {/* Proje Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proje
                </label>
                <select
                  value={filterProjectId}
                  onChange={(e) => setFilterProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tüm Projeler</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Card Filter */}
              {uniqueCards.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kart
                  </label>
                  <select
                    value={filterCardNumber}
                    onChange={(e) => setFilterCardNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tüm Kartlar</option>
                    {uniqueCards.map((cardNo) => (
                      <option key={cardNo} value={cardNo as string}>
                        {cardNo}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {/* Checkbox Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showOnlyPettyCash}
                  onChange={(e) => {
                    setShowOnlyPettyCash(e.target.checked);
                    if (e.target.checked) setShowOnlyUnassigned(false);
                  }}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 mr-1.5"
                />
                <span className="text-xs font-medium text-gray-700">
                  💼 Sadece Kasa Fişleri
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showOnlyUnassigned}
                  onChange={(e) => {
                    setShowOnlyUnassigned(e.target.checked);
                    if (e.target.checked) setShowOnlyPettyCash(false);
                  }}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500 mr-1.5"
                />
                <span className="text-xs font-medium text-gray-700">
                  ❌ Sadece Atanmamış
                </span>
              </label>
              
              {/* Group By Card */}
              {uniqueCards.length > 1 && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={groupByCard}
                    onChange={(e) => setGroupByCard(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1.5"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    Kart bazında grupla
                  </span>
                </label>
              )}
            </div>
            
            <div className="mt-3 text-xs text-gray-600 flex items-center justify-between flex-wrap gap-2">
              <span>Gösterilen: <strong>{filteredItems.length}</strong> / {items.length} işlem</span>
              {(filterMatchStatus !== 'all' || filterTransactionType !== 'all' || filterProjectId !== 'all' || filterCardNumber !== 'all' || showOnlyPettyCash || showOnlyUnassigned) && (
                <button
                  onClick={() => {
                    setFilterMatchStatus('all');
                    setFilterTransactionType('all');
                    setFilterProjectId('all');
                    setFilterCardNumber('all');
                    setShowOnlyPettyCash(false);
                    setShowOnlyUnassigned(false);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          </Card>

          {/* Bulk Matching Actions */}
          {canAssign && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900">Toplu Eşleştirme</h3>
                  <p className="text-xs text-blue-700 mt-0.5">
                    %35: Tüm öneriler | %60: Yüksek skorlu
                  </p>
                </div>
                <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkMatch(35)}
                  disabled={isBulkMatching || stats.noMatch + stats.suggested === 0}
                  className="border-yellow-300 bg-white hover:bg-yellow-50 text-yellow-700 text-xs"
                >
                  {isBulkMatching ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                      İşleniyor...
                    </>
                  ) : (
                    <>📊 Tüm Öneriler (%35+)</>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBulkMatch(60)}
                  disabled={isBulkMatching || stats.noMatch + stats.suggested === 0}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                >
                  {isBulkMatching ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      İşleniyor...
                    </>
                  ) : (
                    <>✅ Yüksek Güvenli (%60+)</>
                  )}
                </Button>
              </div>
              </div>
            
            {/* Progress Bar */}
            {bulkMatchProgress && (
              <div className="mt-2 pt-3 border-t border-blue-200">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-blue-900">
                    {bulkMatchProgress.current === bulkMatchProgress.total ? (
                      <>✅ İşlem Tamamlandı!</>
                    ) : (
                      <>🔄 İşleniyor...</>
                    )}
                  </span>
                  <span className="text-blue-700">
                    {bulkMatchProgress.current} / {bulkMatchProgress.total}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${(bulkMatchProgress.current / bulkMatchProgress.total) * 100}%` 
                    }}
                  />
                </div>
                
                {/* Stats */}
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-green-700">
                    ✅ Eşleşti: <strong>{bulkMatchProgress.matched}</strong>
                  </span>
                  <span className="text-yellow-700">
                    💡 Öneri: <strong>{bulkMatchProgress.suggested}</strong>
                  </span>
                  {bulkMatchProgress.failed > 0 && (
                    <span className="text-red-700">
                      ❌ Hata: <strong>{bulkMatchProgress.failed}</strong>
                    </span>
                  )}
                  <span className="text-gray-600">
                    ⏳ Kalan: <strong>{bulkMatchProgress.total - bulkMatchProgress.current}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Items Table */}
          <Card className="overflow-x-auto" padding="none">
            {groupByCard ? (
              <div className="space-y-6 p-6">
                {Object.entries(groupedByCard).map(([cardNo, cardItems]) => (
                  <div key={cardNo} className="border-b last:border-b-0 pb-6 last:pb-0">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      💳 {cardNo}
                      <span className="text text-sm font-normal text-gray-600">
                        ({cardItems.length} işlem)
                      </span>
                    </h3>
                    
                    <div className="overflow-x-auto -mx-6 px-6">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">#</th>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">İşlem Adı</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">Tutar</th>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Tarih</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500">Durum</th>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Eşleşen Fatura</th>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Proje</th>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Açıklama</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {cardItems.map((item) => renderTableRow(item))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Normal liste görünümü */
              <div className="overflow-x-auto p-6">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">#</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">İşlem Adı</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">Tutar</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Tarih</th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-500">Durum</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Eşleşen Fatura</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Proje</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Açıklama</th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-500">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredItems.map((item) => renderTableRow(item))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </Sidebar>

      {/* Match Modal */}
      <Modal
        isOpen={isMatchModalOpen}
        onClose={() => {
          setIsMatchModalOpen(false);
          setSelectedItem(null);
          setSuggestions(null);
        }}
        title="Fatura Eşleştir"
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4">
            {/* Item Info */}
            <Card className="bg-blue-50">
              <div className="text-sm">
                <div className="font-medium mb-1">{selectedItem.transaction_name}</div>
                <div className="text-gray-600">
                  {formatCurrency(selectedItem.amount)} - {formatDate(selectedItem.transaction_date)}
                </div>
              </div>
            </Card>

            {/* Suggestions */}
            {isLoadingSuggestions ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">Öneriler yükleniyor...</p>
              </div>
            ) : suggestions ? (
              <div className="space-y-4">
                {suggestions.exactMatches?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-green-700 mb-1">
                      🎯 Yüksek Güvenilirlik ({suggestions.exactMatches.length})
                    </h3>
                    <p className="text-xs text-gray-600 mb-2">
                      Eşleşme skoru %80 ve üzeri - Güvenle eşleştirebilirsiniz
                    </p>
                    <div className="space-y-2">
                      {suggestions.exactMatches.map((match: any) => (
                        <Card key={match.invoice.id} className="border-green-200">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-lg">{match.invoice.supplier_name || 'Bilinmeyen Tedarikçi'}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Fatura No:</span> {match.invoice.invoice_number || '-'}
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Tutar:</span> {formatCurrency(match.invoice.amount)} | 
                                <span className="font-medium ml-2">Tarih:</span> {formatDate(match.invoice.invoice_date || match.invoice.created_at)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Skor: <span className="font-bold text-green-600">%{Math.round(match.matchScore)}</span> | 
                                {' '}{match.reasons.join(', ')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {match.invoice.file_path && (
                                <button
                                  onClick={() => openInvoicePDF(match.invoice.file_path)}
                                  className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="PDF'i Aç"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleMatch(selectedItem.id, match.invoice.id, match.matchScore, match.matchType)}
                              >
                                Eşleştir
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.suggestedMatches?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-yellow-700 mb-1">
                      ⚠️ Öneriler ({suggestions.suggestedMatches.length})
                    </h3>
                    <p className="text-xs text-gray-600 mb-2">
                      Eşleşme skoru %50-79 arası - Kontrol ederek eşleştirebilirsiniz
                    </p>
                    <div className="space-y-2">
                      {suggestions.suggestedMatches.map((match: any) => (
                        <Card key={match.invoice.id} className="border-yellow-200">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-lg">{match.invoice.supplier_name || 'Bilinmeyen Tedarikçi'}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Fatura No:</span> {match.invoice.invoice_number || '-'}
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Tutar:</span> {formatCurrency(match.invoice.amount)} | 
                                <span className="font-medium ml-2">Tarih:</span> {formatDate(match.invoice.invoice_date || match.invoice.created_at)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Skor: <span className="font-bold text-yellow-600">%{Math.round(match.matchScore)}</span> | 
                                {' '}{match.reasons.join(', ')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {match.invoice.file_path && (
                                <button
                                  onClick={() => openInvoicePDF(match.invoice.file_path)}
                                  className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="PDF'i Aç"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMatch(selectedItem.id, match.invoice.id, match.matchScore, match.matchType)}
                              >
                                Eşleştir
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.noMatch && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-gray-700 font-medium mb-1">❌ Eşleşen fatura bulunamadı</p>
                    <p className="text-sm text-gray-500">Tutar ile yakın veya isimde benzerlik olan fatura yok.</p>
                    <p className="text-sm text-gray-500 mt-2">Manuel arama yapabilir veya önce faturayı sisteme yükleyebilirsiniz.</p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Manual Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manuel Arama
              </label>
              <Input
                type="text"
                placeholder="Fatura numarası veya tedarikçi adı..."
                value={searchInvoiceQuery}
                onChange={(e) => {
                  setSearchInvoiceQuery(e.target.value);
                  searchInvoicesManually(e.target.value);
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                {isSearchingManually ? 'Aranıyor...' : 'Tüm eşleşmemiş faturalarda arama yapılır'}
              </p>

              {/* Manual Search Results */}
              {searchInvoiceQuery && manualSearchResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {manualSearchResults.map((invoice) => (
                    <Card key={invoice.id} className="border-blue-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-lg">{invoice.supplier_name || 'Bilinmeyen Tedarikçi'}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Fatura No:</span> {invoice.invoice_number || '-'}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Tutar:</span> {formatCurrency(invoice.amount)} | 
                            <span className="font-medium ml-2">Tarih:</span> {formatDate(invoice.invoice_date || invoice.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {invoice.file_path && (
                            <button
                              onClick={() => openInvoicePDF(invoice.file_path)}
                              className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="PDF'i Aç"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              if (selectedItem) {
                                handleMatch(selectedItem.id, invoice.id, undefined, 'manual');
                              }
                            }}
                          >
                            Eşleştir
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {searchInvoiceQuery && !isSearchingManually && manualSearchResults.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  Sonuç bulunamadı
                </p>
              )}
            </div>
          </div>
        )}

        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsMatchModalOpen(false);
              setSelectedItem(null);
              setSuggestions(null);
              setSearchInvoiceQuery('');
              setManualSearchResults([]);
            }}
          >
            Kapat
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
