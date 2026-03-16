'use client';

import { Navbar } from '@/components/home/navbar';
import { FooterSection } from '@/components/home/footer-section';

export default function CampusPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full">
      <div className="w-full flex flex-col items-center justify-center py-32 px-6">
        <h1 className="text-4xl md:text-6xl font-medium tracking-tighter text-center mb-6">
          Campus
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl">
          Coming soon. Explore our campus and see where the future of autonomous AI is built.
        </p>
      </div>
      <FooterSection />
    </main>
  );
}
