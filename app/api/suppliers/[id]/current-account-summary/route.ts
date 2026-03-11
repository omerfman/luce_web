import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Cari hesap hareket tipi
 */
interface CurrentAccountMovement {
  date: string;
  type: 'payment' | 'invoice';
  documentType: string;
  documentNo: string;
  debit: number; // Borç (faturalar)
  credit: number; // Alacak (sadece kredi kartı ödemeleri)
  balance: number; // Kümülatif bakiye
  notes?: string;
  relatedId: string;       // Fatura için: invoiceId | Ödeme için: statementItemId
  statementId?: string;    // Kredi kartı hareketi için: üst ekstrenin ID'si (/card-statements/[id])
  linkedInvoiceId?: string; // Kredi kartı hareketi faturaya bağlıysa faturasının ID'si
}

/**
 * Cari hesap özeti
 * NOT: Bakiye = Faturalar - Kredi Kartı Ödemeleri
 * Gayri resmi ödemeler bağımsız işlem olduğundan bakiyeye dahil EDİLMEZ
 */
interface CurrentAccountSummary {
  supplierId: string;
  supplierName: string;
  isCurrentAccount: boolean;
  totalCardPayments: number;   // Kredi kartı ödemeleri (bakiyeyi etkiler)
  totalInformalPayments: number; // Gayri resmi ödemeler (bağımsız, bakiyeyi etkilemez)
  totalInvoices: number;
  balance: number; // = totalInvoices - totalCardPayments
  balanceStatus: 'balanced' | 'overpaid' | 'underpaid';
  movements: CurrentAccountMovement[];
  lastMovementDate: string | null;
}

/**
 * GET /api/suppliers/[id]/current-account-summary
 * Firma'nın cari hesap özet bilgilerini ve hareket tablosunu getir
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    
    // Kullanıcı oturumunu kontrol et
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Oturum bulunamadı' },
        { status: 401 }
      );
    }

    // Kullanıcının company_id'sini al
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Kullanıcı bilgisi alınamadı' },
        { status: 404 }
      );
    }

    // Supplier bilgisini al
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, name, vkn, is_current_account, current_account_notes, company_id')
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Firma bulunamadı' },
        { status: 404 }
      );
    }

    // Eğer cari hesap değilse, basit özet dön
    if (!supplier.is_current_account) {
      return NextResponse.json({
        supplierId: supplier.id,
        supplierName: supplier.name,
        isCurrentAccount: false,
        totalPayments: 0,
        totalInvoices: 0,
        balance: 0,
        balanceStatus: 'balanced',
        movements: [],
        lastMovementDate: null
      });
    }

    // ======================================
    // 1. ÖDEMELERİ TOPLA (Kredi kartı + Gayri resmi)
    // ======================================
    
    // Kredi kartı ödemelerini al (statement_invoice_matches üzerinden)
    // A) Faturaya bağlı eşleştirmeler (eski yöntem)
    const { data: cardPaymentsViaInvoice, error: cardPaymentsError1 } = await supabase
      .from('statement_invoice_matches')
      .select(`
        id,
        matched_at,
        notes,
        statement_item:card_statement_items!inner(
          id,
          statement_id,
          transaction_name,
          amount,
          transaction_date
        ),
        invoice:invoices!inner(
          id,
          supplier_id,
          invoice_number
        )
      `)
      .eq('invoice.supplier_id', params.id)
      .order('matched_at', { ascending: true });

    if (cardPaymentsError1) {
      console.error('Card payments (via invoice) error:', cardPaymentsError1);
    }

    // B) Doğrudan firmaya bağlı eşleştirmeler (YENİ: faturasız)
    const { data: cardPaymentsViaSupplier, error: cardPaymentsError2 } = await supabase
      .from('statement_invoice_matches')
      .select(`
        id,
        matched_at,
        notes,
        supplier_id,
        statement_item:card_statement_items!inner(
          id,
          statement_id,
          transaction_name,
          amount,
          transaction_date
        )
      `)
      .eq('supplier_id', params.id)
      .is('invoice_id', null)
      .order('matched_at', { ascending: true });

    if (cardPaymentsError2) {
      console.error('Card payments (via supplier) error:', cardPaymentsError2);
    }

    // İki diziyi birleştir
    const cardPayments = [
      ...(cardPaymentsViaInvoice || []),
      ...(cardPaymentsViaSupplier || [])
    ];

    console.log('📊 [Current Account] Card payments loaded:', {
      viaInvoiceCount: cardPaymentsViaInvoice?.length || 0,
      viaSupplierCount: cardPaymentsViaSupplier?.length || 0,
      totalCount: cardPayments.length,
      samplePayment: cardPayments[0]
    });

    // Gayri resmi ödemeleri al
    const { data: informalPayments, error: informalError } = await supabase
      .from('informal_payments')
      .select('id, amount, payment_date, notes')
      .eq('supplier_id', params.id)
      .eq('company_id', userData.company_id)
      .order('payment_date', { ascending: true });

    if (informalError) {
      console.error('Informal payments error:', informalError);
    }

    console.log('📊 [Current Account] Informal payments loaded:', {
      count: informalPayments?.length || 0,
      samplePayment: informalPayments?.[0]
    });

    // ======================================
    // 2. FATURALARI TOPLA
    // ======================================
    
    // Fatura sorgusunu supplier_id, VKN veya name ile yap (geriye uyumluluk için)
    let invoices: any[] = [];
    let invoicesError: any = null;
    
    console.log('🔍 [Current Account] Starting invoice search:', {
      supplierId: params.id,
      supplierVkn: supplier.vkn,
      supplierName: supplier.name,
      companyId: userData.company_id
    });
    
    // Önce supplier_id ile dene
    const { data: invoicesBySupplier, error: error1 } = await supabase
      .from('invoices')
      .select('id, invoice_date, amount, invoice_number')
      .eq('supplier_id', params.id)
      .eq('company_id', userData.company_id)
      .order('invoice_date', { ascending: true });
    
    console.log('🔍 [Invoice Search] By supplier_id:', {
      found: invoicesBySupplier?.length || 0,
      error: error1?.message || null
    });
    
    if (!error1 && invoicesBySupplier && invoicesBySupplier.length > 0) {
      invoices = invoicesBySupplier;
      console.log('✅ [Invoice Search] Using supplier_id results');
    } else if (supplier.vkn) {
      // VKN ile dene
      const { data: invoicesByVkn, error: error2 } = await supabase
        .from('invoices')
        .select('id, invoice_date, amount, invoice_number')
        .eq('supplier_vkn', supplier.vkn)
        .eq('company_id', userData.company_id)
        .order('invoice_date', { ascending: true });
      
      console.log('🔍 [Invoice Search] By VKN:', {
        vkn: supplier.vkn,
        found: invoicesByVkn?.length || 0,
        error: error2?.message || null
      });
      
      if (!error2 && invoicesByVkn) {
        invoices = invoicesByVkn || [];
        console.log('✅ [Invoice Search] Using VKN results');
      }
      invoicesError = error2;
    } else if (supplier.name) {
      // İsim ile dene (tam eşleşme)
      const { data: invoicesByName, error: error3 } = await supabase
        .from('invoices')
        .select('id, invoice_date, amount, invoice_number')
        .eq('supplier_name', supplier.name)
        .eq('company_id', userData.company_id)
        .order('invoice_date', { ascending: true });
      
      console.log('🔍 [Invoice Search] By exact name:', {
        name: supplier.name,
        found: invoicesByName?.length || 0,
        error: error3?.message || null
      });
      
      if (!error3 && invoicesByName) {
        invoices = invoicesByName || [];
        console.log('✅ [Invoice Search] Using name results');
      }
      invoicesError = error3;
    }

    if (invoicesError) {
      console.error('❌ [Invoices Error]:', invoicesError);
    }

    console.log('📊 [Current Account] Final invoices:', {
      count: invoices?.length || 0,
      totalAmount: invoices?.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0,
      sampleInvoice: invoices?.[0]
    });

    // ======================================
    // 3. HAREKETLERİ BİRLEŞTİR VE SIRALAMA
    // ======================================
    
    const movements: CurrentAccountMovement[] = [];

    // Faturaları ekle (BORÇ)
    if (invoices) {
      invoices.forEach((inv: any) => {
        movements.push({
          date: inv.invoice_date || inv.date,
          type: 'invoice',
          documentType: 'Fatura',
          documentNo: inv.invoice_number || '-',
          debit: inv.amount,
          credit: 0,
          balance: 0, // Hesaplanacak
          notes: '',
          relatedId: inv.id
        });
      });
    }

    // Kredi kartı ödemelerini ekle (ALACAK)
    if (cardPayments) {
      cardPayments.forEach((match: any) => {
        const statementItem = match.statement_item;
        const invoice = match.invoice;
        
        // Belge numarasını belirle
        let documentNo: string;
        if (invoice) {
          // Faturaya bağlı eşleştirme
          documentNo = `${statementItem.transaction_name} → ${invoice.invoice_number}`;
        } else {
          // Doğrudan firmaya bağlı eşleştirme (faturasız)
          documentNo = `${statementItem.transaction_name} (Cari Hesap)`;
        }
        
        // Kredi kartı ekstresinde tutarlar negatif gelir (borçlandırma), Math.abs() ile pozitife çeviriyoruz
        movements.push({
          date: statementItem.transaction_date,
          type: 'payment',
          documentType: 'Kredi Kartı Ödemesi',
          documentNo,
          debit: 0,
          credit: Math.abs(statementItem.amount),
          balance: 0, // Hesaplanacak
          notes: match.notes || '',
          relatedId: statementItem.id,
          statementId: statementItem.statement_id,    // Ekstre detay sayfası için
          linkedInvoiceId: invoice?.id || undefined   // Faturaya bağlıysa faturasının ID'si
        });
      });
    }

    // NOT: Gayri resmi ödemeler movements'a EKLENMEZ.
    // Bunlar bağımsız işlemlerdir ve fatura bakiyesini ETKİLEMEZ.
    // Mevcut UI'daki ayrı "Gayri Resmi Ödemeler" bölümünde gösterilirler.

    // Tarihe göre sırala (aynı tarihtekiler: önce fatura sonra ödeme)
    movements.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      // Aynı tarihte: fatura önce (type: invoice < payment)
      return a.type === 'invoice' ? -1 : 1;
    });

    console.log('📊 [Current Account] Movements created:', {
      totalMovements: movements.length,
      invoiceMovements: movements.filter(m => m.type === 'invoice').length,
      paymentMovements: movements.filter(m => m.type === 'payment').length,
      sampleMovements: movements.slice(0, 3)
    });

    // ======================================
    // 4. KÜMÜLATİF BAKİYE HESAPLA
    // ======================================
    
    let runningBalance = 0;
    movements.forEach(movement => {
      // Borç ekle, alacak çıkar
      runningBalance += movement.debit - movement.credit;
      movement.balance = runningBalance;
    });

    // ======================================
    // 5. TOPLAM HESAPLAMALAR
    // ======================================
    
    // Kredi kartı ödemeleri (movements içinden) — Bakiyeyi ETKİLER
    const totalCardPayments = movements
      .filter(m => m.type === 'payment')
      .reduce((sum, m) => sum + m.credit, 0);

    // Gayri resmi ödemeler (bağımsız, bakiyeyi ETKİLEMEZ)
    const totalInformalPayments = informalPayments
      ? informalPayments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0)
      : 0;

    const totalInvoices = movements
      .filter(m => m.type === 'invoice')
      .reduce((sum, m) => sum + m.debit, 0);

    // Bakiye = Faturalar - Kredi Kartı Ödemeleri (gayri resmi dahil DEĞİL)
    const balance = totalInvoices - totalCardPayments;

    console.log('💰 [Current Account] Calculations:', {
      totalCardPayments,
      totalInformalPayments,
      totalInvoices,
      balance,
      cardPaymentMovementsCount: movements.filter(m => m.type === 'payment').length,
      invoiceMovementsCount: movements.filter(m => m.type === 'invoice').length,
      samplePaymentMovement: movements.find(m => m.type === 'payment'),
      sampleInvoiceMovement: movements.find(m => m.type === 'invoice')
    });

    // Bakiye durumu (±50₺ tolerance)
    // balance = totalInvoices - totalPayments
    // balance > 0 → fatura > ödeme → borcumuz var → underpaid
    // balance < 0 → ödeme > fatura → bakiyemiz var → overpaid
    let balanceStatus: 'balanced' | 'overpaid' | 'underpaid';
    if (Math.abs(balance) <= 50) {
      balanceStatus = 'balanced'; // Denk
    } else if (balance > 0) {
      balanceStatus = 'underpaid'; // Fatura > Ödeme → Borcumuz var
    } else {
      balanceStatus = 'overpaid'; // Ödeme > Fatura → Bakiyemiz var
    }

    // Son hareket tarihi
    const lastMovementDate = movements.length > 0 
      ? movements[movements.length - 1].date 
      : null;

    // ======================================
    // 6. RESPONSE
    // ======================================
    
    const summary: CurrentAccountSummary = {
      supplierId: supplier.id,
      supplierName: supplier.name,
      isCurrentAccount: true,
      totalCardPayments,
      totalInformalPayments,
      totalInvoices,
      balance,
      balanceStatus,
      movements,
      lastMovementDate
    };

    console.log('📤 [Current Account] Response summary:', {
      totalCardPayments,
      totalInformalPayments,
      totalInvoices,
      balance,
      balanceStatus,
      movementsCount: movements.length,
      invoiceMovements: movements.filter(m => m.type === 'invoice').length,
      cardPaymentMovements: movements.filter(m => m.type === 'payment').length
    });

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('Current account summary error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası', details: error.message },
      { status: 500 }
    );
  }
}
