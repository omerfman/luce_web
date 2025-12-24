import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET - Download file with correct filename
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const filename = searchParams.get('filename');

    if (!url || !filename) {
      return NextResponse.json(
        { error: 'URL ve dosya adı gerekli' },
        { status: 400 }
      );
    }

    // Fetch file from Cloudinary
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Dosya indirilemedi');
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    // Return file with correct headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error.message || 'Dosya indirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}
