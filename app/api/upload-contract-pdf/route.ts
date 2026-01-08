/**
 * API endpoint to upload contract payment PDF to Cloudinary
 * and update informal_payments record with PDF URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadPDFToCloudinary } from '@/lib/cloudinary/upload';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;
    const paymentId = formData.get('paymentId') as string;
    const companyId = formData.get('companyId') as string;
    const fileName = formData.get('fileName') as string;

    if (!pdfFile || !paymentId || !companyId || !fileName) {
      return NextResponse.json(
        { error: 'PDF, paymentId, companyId ve fileName gerekli' },
        { status: 400 }
      );
    }

    // Convert File to Blob
    const arrayBuffer = await pdfFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

    // Upload to Cloudinary
    const { url, publicId } = await uploadPDFToCloudinary(blob, fileName, companyId);

    // Update informal_payments record with PDF URL
    const supabase = await createServerClient();

    const { error: updateError } = await supabase
      .from('informal_payments')
      .update({ contract_pdf_url: url })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment with PDF URL:', updateError);
      throw new Error('PDF URL kaydedilemedi');
    }

    return NextResponse.json({ 
      success: true, 
      url,
      publicId 
    });
  } catch (error: any) {
    console.error('Error uploading contract PDF:', error);
    return NextResponse.json(
      { error: error.message || 'PDF yüklenemedi' },
      { status: 500 }
    );
  }
}
