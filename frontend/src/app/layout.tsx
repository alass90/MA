import { ThemeProvider } from '@/components/home/theme-provider';
import { siteConfig } from '@/lib/site';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ReactQueryProvider } from './react-query-provider';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';
import { PostHogIdentify } from '@/components/posthog-identify';
import '@/lib/polyfills';
import { PlanSelectionModal } from '@/components/billing/pricing/plan-selection-modal';
import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';


export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    'AI assistant',
    'open source AI',
    'artificial intelligence',
    'AI worker',
    'browser automation',
    'web scraping',
    'file management',
    'research assistant',
    'data analysis',
    'task automation',
    'Talos',
    'generalist AI',
  ],
  authors: [
    {
      name: 'Talos Team',
      url: 'https://talos.local'
    }
  ],
  creator: 'Talos Team',
  publisher: 'Talos Team',
  category: 'Technology',
  applicationName: 'Talos',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    title: 'Talos - Open Source Generalist AI Worker',
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: 'Talos',
    locale: 'en_US',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Talos - Open Source Generalist AI Worker',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Talos - Open Source Generalist AI Worker',
    description: siteConfig.description,
    creator: '@Talos',
    site: '@Talos',
    images: ['/banner.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: 'any' },
      { url: '/favicon-light.png', sizes: 'any', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  manifest: '/manifest.json',
  alternates: {
    canonical: siteConfig.url,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Structured Data for Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Talos',
              alternateName: ['Talos', 'Talos AI'],
              url: 'https://talos.local',
              logo: 'https://talos.local/favicon.png',
              description: siteConfig.description,
              foundingDate: '2024',
              sameAs: [
                'https://github.com/Talos-ai',
                'https://x.com/Talos',
                'https://linkedin.com/company/Talos',
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Customer Support',
                url: 'https://talos.local',
              },
            }),
          }}
        />

        {/* Structured Data for Software Application */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Talos',
              alternateName: 'Talos',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web, macOS, Windows, Linux',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '1000',
              },
            }),
          }}
        />

        <Script id="google-tag-manager" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-PCHSN4M2');`}
        </Script>
        <Script async src="https://cdn.tolt.io/tolt.js" data-tolt={process.env.NEXT_PUBLIC_TOLT_REFERRAL_ID}></Script>
      </head>

      <body className="antialiased font-sans bg-background">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PCHSN4M2"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <ReactQueryProvider>
                {children}
                <Toaster />
                <Suspense fallback={null}>
                  <PlanSelectionModal />
                </Suspense>
              </ReactQueryProvider>
            </AuthProvider>
            <Analytics />
            <GoogleAnalytics gaId="G-6ETJFB3PT3" />
            <SpeedInsights />
            <PostHogIdentify />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

