import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * POST /api/invoices/[id]/reject
 * Reject an invoice with a reason
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { rejection_reason } = body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return NextResponse.json(
        { error: 'Red sebebi gereklidir' },
        { status: 400 }
      );
    }

    const invoiceId = params.id;

    // Check if invoice exists and user has access to it
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, company_id, is_rejected')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: 'Fatura bulunamadı' },
        { status: 404 }
      );
    }

    // Check if already rejected
    if (invoice.is_rejected) {
      return NextResponse.json(
        { error: 'Fatura zaten reddedilmiş' },
        { status: 400 }
      );
    }

    // Update invoice with rejection info
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        is_rejected: true,
        rejection_reason: rejection_reason.trim(),
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting invoice:', updateError);
      return NextResponse.json(
        { error: 'Fatura reddedilemedi: ' + updateError.message },
        { status: 500 }
      );
    }

    // Log activity
    try {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        company_id: invoice.company_id,
        action: 'reject',
        target_type: 'invoice',
        target_id: invoiceId,
        description: `Fatura reddedildi: ${rejection_reason.trim()}`,
        metadata: {
          invoice_id: invoiceId,
          rejection_reason: rejection_reason.trim(),
        },
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Fatura başarıyla reddedildi',
    });
  } catch (error: any) {
    console.error('Error in reject invoice API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invoices/[id]/reject
 * Undo invoice rejection (restore invoice)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const invoiceId = params.id;

    // Check if invoice exists and user has access to it
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, company_id, is_rejected')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: 'Fatura bulunamadı' },
        { status: 404 }
      );
    }

    // Check if invoice is actually rejected
    if (!invoice.is_rejected) {
      return NextResponse.json(
        { error: 'Fatura zaten reddedilmemiş' },
        { status: 400 }
      );
    }

    // Restore invoice (undo rejection)
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        is_rejected: false,
        rejection_reason: null,
        rejected_by: null,
        rejected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error undoing invoice rejection:', updateError);
      return NextResponse.json(
        { error: 'Red geri alınamadı: ' + updateError.message },
        { status: 500 }
      );
    }

    // Log activity
    try {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        company_id: invoice.company_id,
        action: 'undo_rejection',
        target_type: 'invoice',
        target_id: invoiceId,
        description: 'Fatura reddi geri alındı',
        metadata: {
          invoice_id: invoiceId,
        },
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Faturanın reddi başarıyla geri alındı',
    });
  } catch (error: any) {
    console.error('Error in undo rejection API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
