'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

export default function DashboardPage() {
  const { user, company, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-secondary-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Hoş Geldiniz, {user?.name}!</CardTitle>
            <CardDescription>Luce Mimarlık İç İş Akışı Sistemi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-secondary-600">Şirket</p>
                <p className="text-lg font-semibold">{company?.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-secondary-600">Rol</p>
                <p className="text-lg font-semibold">{role?.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card hover>
            <CardHeader>
              <CardTitle className="text-base">Aktif Projeler</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary-600">-</p>
              <p className="mt-2 text-sm text-secondary-600">Yakında gelecek</p>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-base">Bekleyen Faturalar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-warning">-</p>
              <p className="mt-2 text-sm text-secondary-600">Yakında gelecek</p>
            </CardContent>
          </Card>

          <Card hover>
            <CardHeader>
              <CardTitle className="text-base">Bu Ay Toplam</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-success">-</p>
              <p className="mt-2 text-sm text-secondary-600">Yakında gelecek</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
}
