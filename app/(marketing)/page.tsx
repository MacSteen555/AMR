import type { Metadata } from 'next'
import LandingPageClient from './LandingPage'

export const metadata: Metadata = {
  title: 'AutoMyReply — AI-Powered Google Review Management',
  description:
    'Respond to every Google review in seconds with AI replies that match your brand voice. Save hours, boost your ratings, and never miss a review again.',
  keywords: [
    'google review management',
    'AI review replies',
    'google business profile',
    'review automation',
    'review response tool',
    'AI reply generator',
    'manage google reviews',
    'business review software',
  ],
  openGraph: {
    title: 'AutoMyReply — AI-Powered Google Review Management',
    description:
      'Respond to every Google review in seconds with AI replies that match your brand voice. Save hours, boost your ratings, and never miss a review.',
    url: 'https://automyreply.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutoMyReply — AI-Powered Google Review Management',
    description:
      'AI-powered replies for your Google Business Profile reviews. Save hours, stay on-brand, never miss a review.',
  },
  alternates: {
    canonical: 'https://automyreply.com',
  },
}

export default function LandingPage() {
  return <LandingPageClient />
}
