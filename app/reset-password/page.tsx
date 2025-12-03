'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if we have a valid session from the reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('Geçersiz veya süresi dolmuş şifre sıfırlama linki');
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    // Validate password
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      setIsLoading(false);
      return;
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setMessage('Şifreniz başarıyla güncellendi! Giriş sayfasına yönlendiriliyorsunuz...');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
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
          <h1 className="text-3xl font-bold text-secondary-900">Yeni Şifre Belirle</h1>
          <p className="mt-2 text-sm text-secondary-600">
            Yeni şifrenizi girin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700">
              Yeni Şifre
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
              placeholder="••••••••"
              required
              disabled={isLoading}
              autoComplete="new-password"
              minLength={6}
            />
            <p className="mt-1 text-xs text-secondary-500">En az 6 karakter</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700">
              Yeni Şifre Tekrar
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input mt-1"
              placeholder="••••••••"
              required
              disabled={isLoading}
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
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
