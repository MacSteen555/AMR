import type { Metadata } from 'next'
import CompeteMetricsPage from './CompeteMetricsPage'

export const metadata: Metadata = {
  title: 'Understanding Competitive Analytics',
  description: 'Learn how AutoMyReply compares your business against competitors using real review data. Every competitive metric explained: scoring, time horizons, and methodology.',
  keywords: ['competitive analysis', 'competitor reviews', 'market position', 'business intelligence', 'competitive benchmarking'],
  openGraph: {
    title: 'Understanding Competitive Analytics | AutoMyReply',
    description: 'Every metric in your Competitive report explained: scoring methodology, time horizons, and how to act on the data.',
    url: 'https://automyreply.com/compete',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Understanding Competitive Analytics | AutoMyReply',
    description: 'Every competitive metric explained.',
  },
  alternates: {
    canonical: 'https://automyreply.com/compete',
  },
}

export default function Page() {
  return <CompeteMetricsPage />
}
