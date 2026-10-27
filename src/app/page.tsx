import type { Metadata } from 'next';
import Feature from '@/features/landing-page/LandingPage';

export const metadata: Metadata = {
  title: 'PropBank — Property Portfolio Management & Real Estate',
  description: 'Manage multiple properties, tenants, rent terms, agreements and records in one organized workspace. Discover available properties to buy or rent with PropBank.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'PropBank — Property Portfolio Management & Real Estate',
    description: 'Your entire property portfolio. One place. Organize your properties with PropBank and explore real estate for your next move.',
    type: 'website',
  },
};

export default function Page() { return <Feature />; }
