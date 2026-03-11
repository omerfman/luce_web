'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { emailSchema } from '@/lib/validation';
import { useSearchParams } from 'next/navigation';
// import { useRouter } from 'next/navigation'; // Reserved for future use
import Link from 'next/link';
import InstallPWAButton from '@/components/ui/InstallPWAButton';

function LoginForm() {
  // const router = useRouter(); // Reserved for future use
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for error parameter in URL
    const errorParam = searchParams.get('error');
    if (errorParam === 'inactive') {
      setError('Kullanıcı hesabınız pasif durumda. Lütfen yöneticinizle iletişime geçin.');
    }
  }, [searchParams]);

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
      <InstallPWAButton />
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
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete="current-password"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-secondary-50">
        <div className="card w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-secondary-900">Luce Mimarlık</h1>
            <p className="mt-2 text-sm text-secondary-600">Yükleniyor...</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
