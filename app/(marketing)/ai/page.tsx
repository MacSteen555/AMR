import type { Metadata } from 'next'
import AIPage from './AIPage'

export const metadata: Metadata = {
  title: 'AI-Powered Review Management',
  description:
    'See how AutoMyReply\'s AI generates on-brand replies, learns from your edits, monitors competitors, and turns reviews into actionable business insights.',
  keywords: [
    'AI review reply generator',
    'AI google review management',
    'AI review insights',
    'automated review responses',
    'AI review monitoring',
    'google review AI tool',
  ],
  openGraph: {
    title: 'AI-Powered Review Management | AutoMyReply',
    description:
      'AI that generates on-brand replies, learns from your edits, monitors competitors, and delivers actionable insights.',
    url: 'https://automyreply.com/ai',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI-Powered Review Management | AutoMyReply',
    description:
      'AI-generated replies, competitor monitoring, and review insights — all on autopilot.',
  },
  alternates: {
    canonical: 'https://automyreply.com/ai',
  },
}

export default function AI() {
  return <AIPage />
}
