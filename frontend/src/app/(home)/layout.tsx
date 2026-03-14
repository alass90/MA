import { Metadata } from 'next';
import { HomeLayoutClient } from './layout-client';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

// Home pages use Navbar (useAuth, usePathname etc.) that require runtime context
export const dynamic = 'force-dynamic';

// Static metadata for SEO - rendered in initial HTML
export const metadata: Metadata = {
  title: 'Talos: Your Autonomous AI Worker',
  description: 'Built for complex tasks, designed for everything. The ultimate AI assistant that handles it all—from simple requests to mega-complex projects.',
  keywords: 'Talos, Autonomous AI Worker, AI Worker, Generalist AI, Open Source AI, Autonomous Agent, Complex Tasks, AI Assistant',
  openGraph: {
    title: 'Talos: Your Autonomous AI Worker',
    description: 'Built for complex tasks, designed for everything. The ultimate AI assistant that handles it all—from simple requests to mega-complex projects.',
    url: 'https://talos.ai',
    siteName: 'Talos',
    images: [{ url: '/banner.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Talos: Your Autonomous AI Worker',
    description: 'Built for complex tasks, designed for everything. The ultimate AI assistant that handles it all—from simple requests to mega-complex projects.',
    images: ['/banner.png'],
  },
};

export default async function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <HomeLayoutClient>{children}</HomeLayoutClient>
    </NextIntlClientProvider>
  );
}
