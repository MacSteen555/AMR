import type { Metadata } from 'next'
import HowItWorksPage from './HowItWorksPage'

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'See how AutoMyReply turns your Google reviews into on-brand AI replies in 3 simple steps. Connect, customize, and respond — all in under 5 minutes.',
  keywords: [
    'how to manage google reviews',
    'google review automation',
    'AI review reply generator',
    'automate google review responses',
    'review management tool',
  ],
  openGraph: {
    title: 'How It Works | AutoMyReply',
    description:
      'See how AutoMyReply turns your Google reviews into on-brand AI replies in 3 simple steps.',
    url: 'https://automyreply.com/how-it-works',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works | AutoMyReply',
    description: 'AI-powered Google review replies in 3 simple steps.',
  },
  alternates: {
    canonical: 'https://automyreply.com/how-it-works',
  },
}

export default function HowItWorks() {
  return <HowItWorksPage />
}
