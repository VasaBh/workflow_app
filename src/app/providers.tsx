'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, restoreSession } from '@/store/auth';
import { setAccessToken } from '@/lib/api';

function SessionRestorer({ children }: { children: React.ReactNode }) {
  const { setToken, setUser } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = restoreSession();
    if (session) {
      setAccessToken(session.token);
      setToken(session.token);
      setUser(session.user);
    }
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionRestorer>
        {children}
      </SessionRestorer>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '8px',
            background: '#1e293b',
            color: '#f1f5f9',
          },
        }}
      />
    </QueryClientProvider>
  );
}
