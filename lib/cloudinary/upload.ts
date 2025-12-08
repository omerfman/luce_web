import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log('Cloudinary Config:', {
  cloud_name: cloudName,
  api_key: apiKey ? `${apiKey.substring(0, 5)}...` : 'undefined',
  api_secret: apiSecret ? 'set' : 'undefined',
});

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

// Allowed file types
const ALLOWED_FILE_TYPES = {
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  
  // CAD files
  'application/acad': '.dwg',
  'application/dxf': '.dxf',
  'image/vnd.dwg': '.dwg',
  'image/vnd.dxf': '.dxf',
  
  // Images
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  
  // Archives
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed': '.7z',
  
  // 3D Models (optional)
  'application/octet-stream': '.obj,.fbx,.3ds', // Generic binary
};

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_3D_FILE_SIZE = 100 * 1024 * 1024; // 100MB for 3D files

/**
 * Determine Cloudinary resource type based on MIME type
 */
function getResourceType(mimeType: string): 'image' | 'video' | 'raw' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw'; // For PDFs, documents, DWG, etc.
}

export interface UploadResult {
  url: string;
  publicId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  resourceType: 'image' | 'video' | 'raw';
}

/**
 * Upload file to Cloudinary
 */
export async function uploadToCloudinary(
  file: File,
  projectId: string,
  category: string
): Promise<UploadResult> {
  console.log('Cloudinary upload started:', { fileName: file.name, size: file.size, type: file.type });
  
  // Validate file type
  if (!ALLOWED_FILE_TYPES[file.type] && file.type !== 'application/octet-stream') {
    console.error('Invalid file type:', file.type);
    throw new Error(`Desteklenmeyen dosya tipi: ${file.type}`);
  }

  // Validate file size
  const maxSize = category === '3d' ? MAX_3D_FILE_SIZE : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    console.error('File too large:', { size: file.size, maxSize });
    throw new Error(`Dosya boyutu çok büyük. Maksimum: ${maxSizeMB}MB`);
  }

  console.log('Converting file to base64...');
  // Convert File to base64 for upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const dataURI = `data:${file.type};base64,${base64}`;

  // Create folder path: luce_web/projects/{projectId}/{category}
  const folder = `luce_web/projects/${projectId}/${category}`;
  console.log('Uploading to folder:', folder);

  const resourceType = getResourceType(file.type);
  
  try {
    // Upload to Cloudinary
    console.log('Calling Cloudinary API...', { resourceType });
    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      access_mode: 'public', // Make files publicly accessible
    });

    console.log('Cloudinary upload result:', { publicId: result.public_id, url: result.secure_url });
    
    // Fix URL for non-image files (Cloudinary sometimes returns wrong resource type in URL)
    let finalUrl = result.secure_url;
    if (resourceType === 'raw' && finalUrl.includes('/image/upload/')) {
      finalUrl = finalUrl.replace('/image/upload/', '/raw/upload/');
    } else if (resourceType === 'video' && finalUrl.includes('/image/upload/')) {
      finalUrl = finalUrl.replace('/image/upload/', '/video/upload/');
    }
    
    return {
      url: finalUrl,
      publicId: result.public_id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      resourceType,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Dosya yüklenirken bir hata oluştu');
  }
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<void> {
  try {
    console.log('Deleting from Cloudinary:', { publicId, resourceType });
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log('Delete successful');
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Dosya silinirken bir hata oluştu');
  }
}

/**
 * Get optimized image URL with transformations
 */
export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale';
    quality?: number;
  } = {}
): string {
  const { width = 800, height, crop = 'fit', quality = 80 } = options;

  return cloudinary.url(publicId, {
    transformation: [
      { width, height, crop, quality, fetch_format: 'auto' },
    ],
  });
}

export { cloudinary };
