'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';

/**
 * Client-side PKCE code exchange page.
 *
 * The magic link flow stores the PKCE code_verifier in browser localStorage.
 * Server-side route handlers can't access localStorage, so when they try to
 * exchange the code they get a "bad_code_verifier" error.
 *
 * This page solves that by running the exchange entirely in the browser
 * where localStorage (and thus the verifier) is available.
 */
function ExchangeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const next = searchParams.get('next') || '/dashboard';
    const termsAccepted = searchParams.get('terms_accepted') === 'true';

    if (!code) {
      router.replace('/auth?error=missing_code');
      return;
    }

    const supabase = createClient();

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error) {
        console.error('❌ Client-side code exchange failed:', error.message);
        setError(error.message);
        router.replace(`/auth?expired=true`);
        return;
      }

      // Save terms acceptance if needed
      if (data.user && termsAccepted) {
        const currentMetadata = data.user.user_metadata || {};
        if (!currentMetadata.terms_accepted_at) {
          await supabase.auth.updateUser({
            data: {
              ...currentMetadata,
              terms_accepted_at: new Date().toISOString(),
            },
          });
        }
      }

      // Redirect to destination
      router.replace(next);
    });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Authentication failed. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}

export default function ExchangePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ExchangeContent />
    </Suspense>
  );
}
