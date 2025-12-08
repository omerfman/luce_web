import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary/upload';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST - Upload file to Cloudinary and save metadata to database
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const category = formData.get('category') as string;
    const userId = formData.get('userId') as string;
    const companyId = formData.get('companyId') as string;

    console.log('Upload params:', { 
      fileName: file?.name, 
      projectId, 
      category, 
      userId, 
      companyId 
    });

    if (!file || !projectId || !category || !userId || !companyId) {
      console.log('Missing parameters');
      return NextResponse.json(
        { error: 'Eksik parametreler' },
        { status: 400 }
      );
    }

    // Upload to Cloudinary
    console.log('Uploading to Cloudinary...');
    const uploadResult = await uploadToCloudinary(file, projectId, category);
    console.log('Cloudinary upload successful:', uploadResult.publicId);

    // Save metadata to database
    console.log('Saving to database...');
    const { data, error } = await supabaseAdmin
      .from('project_files')
      .insert({
        project_id: projectId,
        category,
        file_name: uploadResult.fileName,
        file_url: uploadResult.url,
        file_type: uploadResult.fileType,
        file_size: uploadResult.fileSize,
        cloudinary_public_id: uploadResult.publicId,
        cloudinary_resource_type: uploadResult.resourceType,
        uploaded_by: userId,
        company_id: companyId,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      // If DB insert fails, delete from Cloudinary
      await deleteFromCloudinary(uploadResult.publicId, uploadResult.resourceType);
      throw error;
    }

    console.log('Upload completed successfully');
    return NextResponse.json({
      success: true,
      file: data,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Dosya yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete file from Cloudinary and database
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'Dosya ID gerekli' },
        { status: 400 }
      );
    }

    // Get file metadata from database
    const { data: file, error: fetchError } = await supabaseAdmin
      .from('project_files')
      .select('cloudinary_public_id, cloudinary_resource_type')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    // Delete from Cloudinary
    if (file.cloudinary_public_id) {
      const resourceType = (file.cloudinary_resource_type || 'raw') as 'image' | 'video' | 'raw';
      await deleteFromCloudinary(file.cloudinary_public_id, resourceType);
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('project_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Dosya başarıyla silindi',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Dosya silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
}
