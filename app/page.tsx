import { redirect } from 'next/navigation';

export default function HomePage() {
  // Ana sayfa -> login'e yönlendir (auth olmadan erişilmemeli)
  redirect('/login');
}
