'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: 'login' | 'logout' | 'heartbeat';
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  metadata: Record<string, any> | null;
  user: {
    name: string;
    email: string;
  };
}

export default function ActivityLogsPage() {
  const { role, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'login' | 'logout' | 'offline'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = role?.name === 'Super Admin' && role?.company_id === null;

  useEffect(() => {
    // Redirect if not Super Admin
    if (!authLoading && !isSuperAdmin) {
      router.push('/');
      return;
    }

    if (isSuperAdmin) {
      fetchActivityLogs();
      
      // Run offline detection every 5 minutes
      const detectOffline = async () => {
        try {
          await supabase.rpc('detect_and_log_offline_users');
        } catch (error) {
          console.error('Error detecting offline users:', error);
        }
      };

      // Initial detection
      detectOffline();

      // Set up interval
      const interval = setInterval(() => {
        detectOffline();
        fetchActivityLogs(); // Refresh logs
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [isSuperAdmin, authLoading, router]);

  async function fetchActivityLogs() {
    try {
      setIsLoading(true);

      let query = supabase
        .from('user_activity_logs')
        .select(`
          *,
          user:users(name, email)
        `)
        .order('timestamp', { ascending: false })
        .limit(500); // Last 500 activities

      if (filter !== 'all') {
        query = query.eq('activity_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      fetchActivityLogs();
    }
  }, [filter, isSuperAdmin]);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.user?.name?.toLowerCase().includes(searchLower) ||
      log.user?.email?.toLowerCase().includes(searchLower) ||
      log.activity_type.toLowerCase().includes(searchLower)
    );
  });

  function getActivityIcon(type: string) {
    switch (type) {
      case 'login':
        return '🟢';
      case 'logout':
        return '🔴';
      case 'offline':
        return '⚫';
      case 'heartbeat':
        return '💓';
      default:
        return '⚪';
    }
  }

  function getActivityColor(type: string) {
    switch (type) {
      case 'login':
        return 'bg-green-100 text-green-800';
      case 'logout':
        return 'bg-red-100 text-red-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'heartbeat':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  if (authLoading || !isSuperAdmin) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-secondary-900">Kullanıcı Aktivite Logları</h1>
            <p className="text-secondary-600 mt-1">
              Tüm kullanıcı giriş/çıkış ve aktivite kayıtları
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Aktivite Geçmişi</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Kullanıcı ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-64"
                />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">Tüm Aktiviteler</option>
                  <option value="login">Giriş</option>
                  <option value="logout">Çıkış</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-secondary-600">Yükleniyor...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-secondary-600">
                Henüz aktivite kaydı bulunmuyor
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-secondary-200">
                  <thead className="bg-secondary-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                        Kullanıcı
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                        Aktivite
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                        Zaman
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                        Detaylar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-secondary-200">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-secondary-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-secondary-900">
                              {log.user?.name || 'Unknown'}
                            </div>
                            <div className="text-sm text-secondary-500">
                              {log.user?.email || '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActivityColor(
                              log.activity_type
                            )}`}
                          >
                            {getActivityIcon(log.activity_type)} {log.activity_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                          {new Date(log.timestamp).toLocaleString('tr-TR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm text-secondary-600">
                          {log.metadata?.page && (
                            <div className="text-xs">Sayfa: {log.metadata.page}</div>
                          )}
                          {log.user_agent && (
                            <div className="text-xs truncate max-w-xs" title={log.user_agent}>
                              {log.user_agent.substring(0, 50)}...
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
}
