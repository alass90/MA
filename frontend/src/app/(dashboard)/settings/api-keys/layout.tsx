import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys | Talos',
  description: 'Manage your API keys for programmatic access to Talos',
  openGraph: {
    title: 'API Keys | Talos',
    description: 'Manage your API keys for programmatic access to Talos',
    type: 'website',
  },
};

export default async function APIKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
