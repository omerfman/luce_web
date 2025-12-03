'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { emailSchema } from '@/lib/validation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    
    setError('');
    setIsLoading(true);

    console.log('🔐 Login attempt started:', { email });

    // Validate email
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      console.warn('⚠️ Email validation failed');
      setError('Geçerli bir e-posta adresi giriniz');
      setIsLoading(false);
      return;
    }

    // Validate password
    if (password.length < 6) {
      console.warn('⚠️ Password too short');
      setError('Şifre en az 6 karakter olmalıdır');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('📨 Login response:', { 
        hasUser: !!data.user, 
        userId: data.user?.id,
        hasError: !!signInError,
        errorMessage: signInError?.message 
      });

      if (signInError) {
        console.error('❌ Sign in error:', signInError);
        throw signInError;
      }

      if (data.user) {
        console.log('✅ User authenticated successfully');
        console.log('🔄 Redirecting to dashboard in 500ms...');
        
        // Wait a moment for session to be saved
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use window.location for immediate redirect
        window.location.href = '/dashboard';
        return;
      }
      
      console.warn('⚠️ No user in response');
      setError('Giriş başarısız. Lütfen tekrar deneyin.');
    } catch (err: any) {
      console.error('💥 Login error:', err);
      
      if (err.message.includes('Invalid login credentials')) {
        setError('E-posta veya şifre hatalı');
      } else if (err.message.includes('Email not confirmed')) {
        setError('E-posta adresiniz doğrulanmamış. Lütfen e-postanızı kontrol edin.');
      } else {
        setError(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      }
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-50">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-secondary-900">Luce Mimarlık</h1>
          <p className="mt-2 text-sm text-secondary-600">İç İş Akışı Sistemi</p>
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700">
              Şifre
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
              autoComplete="current-password"
              minLength={6}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm">
          <Link
            href="/forgot-password"
            className="block text-primary-600 hover:text-primary-700"
          >
            Şifrenizi mi unuttunuz?
          </Link>
          <div className="text-secondary-600">
            Hesabınız yok mu?{' '}
            <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
              Kayıt Olun
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
