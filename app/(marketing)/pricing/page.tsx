import type { Metadata } from 'next'
import PricingPage from './PricingPage'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, transparent pricing for AI-powered Google review management. Start free, upgrade as you grow. Plans from $0 to $85/month.',
  keywords: [
    'google review management pricing',
    'review reply tool cost',
    'AI review management plans',
    'google review software pricing',
    'review automation pricing',
  ],
  openGraph: {
    title: 'Pricing | AutoMyReply',
    description:
      'Simple, transparent pricing for AI-powered Google review management. Start free, upgrade as you grow.',
    url: 'https://automyreply.com/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | AutoMyReply',
    description: 'AI review management from $0 to $85/month. Start free, no credit card required.',
  },
  alternates: {
    canonical: 'https://automyreply.com/pricing',
  },
}

export default function Pricing() {
  return <PricingPage />
}
