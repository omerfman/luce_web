'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { emailSchema } from '@/lib/validation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    // Validate email
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      setError('Geçerli bir e-posta adresi giriniz');
      setIsLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setMessage(
        'Şifre sıfırlama linki e-posta adresinize gönderildi. Lütfen e-postanızı kontrol edin.'
      );
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-50">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-secondary-900">Şifremi Unuttum</h1>
          <p className="mt-2 text-sm text-secondary-600">
            E-posta adresinize şifre sıfırlama linki göndereceğiz
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary-700">
              E-posta Adresi
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              placeholder="ornek@lucemimarlik.com"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Gönderiliyor...' : 'Şifre Sıfırlama Linki Gönder'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary-600 hover:text-primary-700">
            ← Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  );
}
