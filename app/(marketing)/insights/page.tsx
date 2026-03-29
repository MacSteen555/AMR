import type { Metadata } from 'next'
import InsightsMetricsPage from './InsightsMetricsPage'

export const metadata: Metadata = {
  title: 'Understanding Your Insights',
  description: 'Learn how AutoMyReply analyzes your Google reviews to surface actionable insights. Every metric explained: what it measures, how it works, and why it matters.',
  keywords: ['review analytics', 'business insights', 'sentiment analysis', 'review trends', 'Google review analytics'],
  openGraph: {
    title: 'Understanding Your Insights | AutoMyReply',
    description: 'Every metric in your Insights report explained: what it measures, how it works, and why it matters for your business.',
    url: 'https://automyreply.com/insights',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Understanding Your Insights | AutoMyReply',
    description: 'Every metric in your Insights report explained.',
  },
  alternates: {
    canonical: 'https://automyreply.com/insights',
  },
}

export default function Page() {
  return <InsightsMetricsPage />
}
