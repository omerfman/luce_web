import { z } from 'zod';

/**
 * Validation schemas using Zod
 */

// Email validation
export const emailSchema = z.string().email('Geçerli bir e-posta adresi giriniz');

// Password validation (for future MFA/password features)
export const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalıdır')
  .regex(/[A-Z]/, 'En az bir büyük harf içermelidir')
  .regex(/[a-z]/, 'En az bir küçük harf içermelidir')
  .regex(/[0-9]/, 'En az bir rakam içermelidir');

// Login form
export const loginFormSchema = z.object({
  email: emailSchema,
});

// Project creation
export const createProjectSchema = z.object({
  name: z.string().min(3, 'Proje adı en az 3 karakter olmalıdır').max(100),
  description: z.string().max(500).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

// Invoice creation
export const createInvoiceSchema = z.object({
  amount: z.number().positive('Tutar pozitif olmalıdır'),
  date: z.string(),
  supplier: z.string().max(100).optional(),
  invoice_number: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});

// File upload
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'Dosya boyutu 5MB\'dan küçük olmalıdır')
    .refine(
      (file) => file.type === 'application/pdf',
      'Sadece PDF dosyaları yüklenebilir'
    ),
});

// User creation
export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(2, 'İsim en az 2 karakter olmalıdır').max(100),
  role_id: z.string().uuid('Geçerli bir rol seçiniz'),
});

// Role creation
export const createRoleSchema = z.object({
  name: z.string().min(2, 'Rol adı en az 2 karakter olmalıdır').max(50),
  permissions: z.array(
    z.object({
      resource: z.string(),
      action: z.string(),
      scope: z.string(),
    })
  ),
});

/**
 * Sanitize HTML input to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: string): string {
  // Remove leading/trailing whitespace
  let sanitized = input.trim();
  
  // Sanitize HTML
  sanitized = sanitizeHtml(sanitized);
  
  return sanitized;
}

/**
 * Type-safe form validation helper
 */
export function validateForm<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return { success: false, errors };
}
