'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { emailSchema } from '@/lib/validation';
// import { useRouter } from 'next/navigation'; // Reserved for future use
import Link from 'next/link';

export default function SignupPage() {
  // const router = useRouter(); // Reserved for future use
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    // Validate name
    if (name.trim().length < 2) {
      setError('İsim en az 2 karakter olmalıdır');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        setMessage(
          'Kayıt başarılı! E-posta adresinize doğrulama linki gönderildi. Lütfen e-postanızı kontrol edin.'
        );
        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setName('');
      }
    } catch (err: any) {
      if (err.message.includes('already registered')) {
        setError('Bu e-posta adresi zaten kayıtlı');
      } else {
        setError(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-50 py-12">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-secondary-900">Kayıt Ol</h1>
          <p className="mt-2 text-sm text-secondary-600">Luce Mimarlık İç İş Akışı Sistemi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-secondary-700">
              Ad Soyad
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              placeholder="Ahmet Yılmaz"
              required
              disabled={isLoading}
              autoComplete="name"
            />
          </div>

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
                autoComplete="new-password"
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
            <p className="mt-1 text-xs text-secondary-500">En az 6 karakter</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700">
              Şifre Tekrar
            </label>
            <div className="relative mt-1">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete="new-password"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 focus:outline-none"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
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

          {message && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-secondary-600">
          Zaten hesabınız var mı?{' '}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Giriş Yapın
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-secondary-500">
          Kayıt olduktan sonra yönetici tarafından rol atanması gereklidir.
        </div>
      </div>
    </div>
  );
}
