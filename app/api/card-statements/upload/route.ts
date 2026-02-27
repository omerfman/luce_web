/**
 * Card Statement Upload API
 * POST /api/card-statements/upload
 * 
 * Excel dosyasını parse eder, DB'ye kaydeder ve otomatik eşleştirme yapar
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseStatementExcel, validateParsedStatement } from '@/lib/excel-parser';
import { matchStatementItems } from '@/lib/statement-matcher';
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

    // Automatic matching (async, don't wait)
    console.log('🔄 Starting automatic matching...');
    
    // Run matching in background (fire and forget)
    performAutoMatching(statement.id, parsed.items, companyId).catch(err => {
      console.error('Auto-matching error:', err);
    });

    // Return success immediately
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
          matchScore: bestMatch.matchScore,
          notes: bestMatch.reasons.join('; ')
        });
      }
    });

    if (matchesToInsert.length === 0) {
      console.log('⚠️  No auto-matches found (all scores < 80)');
      return;
    }
    
    console.log(`📝 Preparing to insert ${matchesToInsert.length} matches...`);

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

    // Insert matches
    const matchRecords = matchesToInsert
      .map(match => ({
        statement_item_id: rowToId.get(match.rowNumber),
        invoice_id: match.invoiceId,
        match_type: match.matchType,
        match_score: match.matchScore,
        notes: match.notes
      }))
      .filter(m => m.statement_item_id); // Only valid mappings

    if (matchRecords.length > 0) {
      const { error } = await supabaseAdmin
        .from('statement_invoice_matches')
        .insert(matchRecords);

      if (error) {
        console.error('Match insertion error:', error);
      } else {
        console.log(`✅ Auto-matched ${matchRecords.length} items`);
      }
    }

  } catch (error) {
    console.error('Auto-matching background error:', error);
  }
}
