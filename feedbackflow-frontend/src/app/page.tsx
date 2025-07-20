'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
