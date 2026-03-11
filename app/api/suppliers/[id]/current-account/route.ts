import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * PATCH /api/suppliers/[id]/current-account
 * Firma'yı cari hesap olarak işaretle veya işareti kaldır
 */
export async function PATCH(
  req: NextRequest,
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

    // Request body'yi parse et
    const body = await req.json();
    const { is_current_account, current_account_notes } = body;

    if (typeof is_current_account !== 'boolean') {
      return NextResponse.json(
        { error: 'is_current_account boolean olmalı' },
        { status: 400 }
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

    // Supplier'ın bu company'ye ait olduğunu kontrol et
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, name, company_id')
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Firma bulunamadı veya yetkiniz yok' },
        { status: 404 }
      );
    }

    // Supplier'ı güncelle
    const { data: updatedSupplier, error: updateError } = await supabase
      .from('suppliers')
      .update({
        is_current_account,
        current_account_notes: current_account_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Güncelleme başarısız', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      supplier: updatedSupplier,
      message: is_current_account 
        ? `${supplier.name} cari hesap olarak işaretlendi` 
        : `${supplier.name} cari hesap işareti kaldırıldı`
    });

  } catch (error: any) {
    console.error('Current account update error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası', details: error.message },
      { status: 500 }
    );
  }
}
