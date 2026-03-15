'use client';

import { BackgroundAALChecker } from '@/components/auth/background-aal-checker';
import { HeroSection as NewHeroSection } from '@/components/home/hero-section';

export default function Home() {
  return (
    <>
      <BackgroundAALChecker>
        <main className="w-full">
          {/* Hero is critical for LCP - load immediately */}
          <NewHeroSection />
        </main>
      </BackgroundAALChecker>
    </>
  );
}
