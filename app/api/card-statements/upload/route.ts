/**
 * Card Statement Upload API
 * POST /api/card-statements/upload
 * 
 * Excel dosyasını parse eder, DB'ye kaydeder ve otomatik eşleştirme yapar
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseStatementExcel, validateParsedStatement } from '@/lib/excel-parser';
import { matchStatementItems, findMatchingCurrentAccountSuppliers, SUPPLIER_AUTO_MATCH_THRESHOLD } from '@/lib/statement-matcher';
import { checkApiPermission } from '@/lib/api/permissions';

// Server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // Auth & Permission check
    const authResult = await checkApiPermission(request, 'card_statements', 'create');
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { userId, companyId } = authResult.context;

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const cardLastFour = formData.get('cardLastFour') as string | null;
    const cardHolderName = formData.get('cardHolderName') as string | null;
    const statementMonth = formData.get('statementMonth') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file format. Only .xlsx and .xls files are supported.' },
        { status: 400 }
      );
    }

    console.log(`📊 Parsing statement file: ${file.name}`);

    // Parse Excel file
    let parsed;
    try {
      parsed = await parseStatementExcel(file);
    } catch (parseError: any) {
      console.error('Parse error:', parseError);
      return NextResponse.json(
        { error: `Excel parse hatası: ${parseError.message}` },
        { status: 400 }
      );
    }

    // Validate parsed data
    const validationErrors = validateParsedStatement(parsed);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Dosya doğrulama hatası',
          validationErrors
        },
        { status: 400 }
      );
    }

    console.log(`✅ Parsed ${parsed.items.length} items successfully`);

    // Use provided values or detected values
    const finalCardLastFour = cardLastFour || parsed.detectedCardNumber;
    const finalStatementMonth = statementMonth 
      ? `${statementMonth}-01` // YYYY-MM → YYYY-MM-01
      : parsed.detectedMonth;

    // Create statement record
    const { data: statement, error: statementError } = await supabaseAdmin
      .from('card_statements')
      .insert({
        company_id: companyId,
        uploaded_by_user_id: userId,
        file_name: file.name,
        card_last_four: finalCardLastFour,
        card_holder_name: cardHolderName,
        statement_month: finalStatementMonth,
        total_transactions: parsed.totalTransactions,
        total_amount: parsed.totalAmount,
        matched_count: 0, // Will be updated by triggers
      })
      .select()
      .single();

    if (statementError) {
      console.error('Statement creation error:', statementError);
      return NextResponse.json(
        { error: 'Ekstre kaydı oluşturulamadı' },
        { status: 500 }
      );
    }

    console.log(`✅ Statement created: ${statement.id}`);

    // Insert all items
    const itemsToInsert = parsed.items.map(item => ({
      statement_id: statement.id,
      row_number: item.rowNumber,
      transaction_name: item.transactionName,
      amount: item.amount,
      currency: item.currency,
      transaction_date: item.transactionDate,
      
      // İşlem tipi (YKB için)
      transaction_type: item.transactionType || 'expense',
      
      // Kart bilgileri
      card_last_four: item.cardLastFour,
      full_card_number: item.fullCardNumber || null,
      card_holder_name: item.cardHolderName || null,
      
      description: item.description,
      raw_data: item.rawData,
      is_matched: false,
      match_confidence: 0,
      
      // Taksit bilgileri
      is_installment: item.isInstallment || false,
      installment_current: item.installmentCurrent || null,
      installment_total: item.installmentTotal || null,
      installment_total_amount: item.installmentTotalAmount || null
    }));

    const { data: insertedItems, error: itemsError } = await supabaseAdmin
      .from('card_statement_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      console.error('Items insertion error:', itemsError);
      
      // Rollback: delete statement
      await supabaseAdmin
        .from('card_statements')
        .delete()
        .eq('id', statement.id);

      return NextResponse.json(
        { error: 'İşlem satırları kaydedilemedi' },
        { status: 500 }
      );
    }

    console.log(`✅ Inserted ${insertedItems.length} items`);

    // Ağır eşleştirmeyi bir sonraki event loop turuna al — önce HTTP 200 + JSON dönsün (istemci takılmasın)
    setTimeout(() => {
      performAutoMatching(statement.id, parsed.items, companyId).catch((err) => {
        console.error('Auto-matching error:', err);
      });
    }, 0);

    console.log(
      `[card-statements/upload] response → client | statementId=${statement.id} | file=${file.name} | items=${insertedItems.length} (auto-match queued)`
    );

    return NextResponse.json({
      success: true,
      statement: {
        id: statement.id,
        file_name: statement.file_name,
        total_transactions: statement.total_transactions,
        total_amount: statement.total_amount,
        card_last_four: statement.card_last_four,
        statement_month: statement.statement_month
      },
      message: 'Ekstre başarıyla yüklendi. Eşleştirme işlemi devam ediyor...'
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}

/**
 * Background automatic matching process
 */
async function performAutoMatching(
  statementId: string,
  items: any[],
  companyId: string
) {
  try {
    console.log(`🔄 Running auto-match for ${items.length} items...`);
    
    // Run matcher with admin client
    const matchResults = await matchStatementItems(items, companyId, 80, supabaseAdmin);
    
    console.log(`📊 Match results: ${matchResults.size} items processed`);
    
    // Prepare matches to insert
    const matchesToInsert: any[] = [];
    
    matchResults.forEach((result, rowNumber) => {
      // Auto-match: only insert if score >= 80
      if (result.exact.length > 0) {
        const bestMatch = result.exact[0]; // Take highest score
        
        console.log(`✅ Auto-match found for row ${rowNumber}: Invoice ${bestMatch.invoice.id} (score: ${bestMatch.matchScore})`);
        
        matchesToInsert.push({
          rowNumber,
          invoiceId: bestMatch.invoice.id,
          matchType: bestMatch.matchType,
          matchScore: Math.round(bestMatch.matchScore),
          notes: bestMatch.reasons.join('; ')
        });
      }
    });

    // ======================================
    // 2. PASS: Cari hesap firma eşleştirmesi (fatura eşleşmeyen satırlar için)
    // ======================================
    const matchedRowNumbers = new Set(matchesToInsert.map((m: any) => m.rowNumber));
    const supplierMatchesToInsert: any[] = [];

    for (const item of items) {
      if (matchedRowNumbers.has(item.rowNumber)) continue; // Faturayla zaten eşleşti
      if (item.transactionType === 'payment') continue;    // Borç ödemesini atla

      const supplierMatches = await findMatchingCurrentAccountSuppliers(item, companyId, supabaseAdmin);
      const best = supplierMatches.find(m => m.matchType === 'current_account_auto');

      if (best) {
        console.log(`🏢 Cari hesap oto-eşleşme: satır ${item.rowNumber} → "${best.supplier.name}" (%${best.matchScore})`);
        supplierMatchesToInsert.push({
          rowNumber: item.rowNumber,
          supplierId: best.supplier.id,
          matchScore: Math.round(best.matchScore),
          notes: `Cari hesap otomatik eşleşme: ${best.reasons.join('; ')}`
        });
      }
    }

    // ======================================
    // 3. KAYIT: Fatura ve cari eşleştirmeleri DB'ye yaz
    // ======================================
    const allToInsert = [...matchesToInsert, ...supplierMatchesToInsert]; // combined

    if (allToInsert.length === 0) {
      console.log('⚠️  No auto-matches found (invoice or supplier)');
      return;
    }
    
    console.log(`📝 Preparing to insert: ${matchesToInsert.length} invoice + ${supplierMatchesToInsert.length} supplier match(es)...`);

    // Get item IDs
    const { data: statementItems } = await supabaseAdmin
      .from('card_statement_items')
      .select('id, row_number')
      .eq('statement_id', statementId);

    if (!statementItems) return;

    // Map row numbers to IDs
    const rowToId = new Map(
      statementItems.map(item => [item.row_number, item.id])
    );

    // Insert invoice matches
    const matchRecords = matchesToInsert
      .map((match: any) => ({
        statement_item_id: rowToId.get(match.rowNumber),
        invoice_id: match.invoiceId,
        supplier_id: null,
        match_type: match.matchType,
        match_score: match.matchScore,
        notes: match.notes
      }))
      .filter((m: any) => m.statement_item_id);

    if (matchRecords.length > 0) {
      const { error } = await supabaseAdmin
        .from('statement_invoice_matches')
        .insert(matchRecords);

      if (error) {
        console.error('Invoice match insertion error:', error);
      } else {
        console.log(`✅ Auto-matched ${matchRecords.length} items to invoices`);
      }
    }

    // Insert supplier (cari hesap) matches
    const supplierMatchRecords = supplierMatchesToInsert
      .map((match: any) => ({
        statement_item_id: rowToId.get(match.rowNumber),
        invoice_id: null,
        supplier_id: match.supplierId,
        match_type: 'current_account_auto',
        match_score: match.matchScore,
        notes: match.notes
      }))
      .filter((m: any) => m.statement_item_id);

    if (supplierMatchRecords.length > 0) {
      const { error: supplierError } = await supabaseAdmin
        .from('statement_invoice_matches')
        .insert(supplierMatchRecords);

      if (supplierError) {
        console.error('Supplier match insertion error:', supplierError);
      } else {
        console.log(`✅ Auto-assigned ${supplierMatchRecords.length} items to current account suppliers`);
      }
    }

  } catch (error) {
    console.error('Auto-matching background error:', error);
  }
}
