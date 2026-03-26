'use client';

import dynamic from 'next/dynamic';

// page.tsx must be a Client Component ('use client') to use dynamic with ssr:false
const MockGallery = dynamic(
  () => import('./MockGallery').then((m) => ({ default: m.MockGallery })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-zinc-400">
          <div className="h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Chargement de la galerie...</p>
        </div>
      </div>
    ),
  }
);

export default function MockViewsPage() {
  return <MockGallery />;
}
