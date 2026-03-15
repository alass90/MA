import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Agent Conversation | Talos',
  description: 'Interactive agent conversation powered by Talos',
  openGraph: {
    title: 'Agent Conversation | Talos',
    description: 'Interactive agent conversation powered by Talos',
    type: 'website',
  },
};

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
