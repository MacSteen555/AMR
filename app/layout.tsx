import type { Metadata } from 'next'
import { PostHogProvider } from '@/components/PostHogProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AutoMyReply — AI-Powered Google Review Management',
    template: '%s | AutoMyReply',
  },
  description: 'Automatically generate professional, on-brand replies to your Google Business Profile reviews with AI. Save hours, stay consistent, and never miss a review.',
  keywords: 'google reviews, review management, AI replies, business profile, review automation',
  metadataBase: new URL('https://automyreply.com'),
  icons: {
    icon: '/images/amber-a.png',
    apple: '/images/amber-a.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'AutoMyReply',
    title: 'AutoMyReply — AI-Powered Google Review Management',
    description: 'Automatically generate professional, on-brand replies to your Google Business Profile reviews with AI. Save hours, stay consistent, and never miss a review.',
    url: 'https://automyreply.com',
    images: [{ url: '/images/amber_teal-logo.png', width: 512, height: 512, alt: 'AutoMyReply' }],
  },
  twitter: {
    card: 'summary',
    title: 'AutoMyReply — AI-Powered Google Review Management',
    description: 'AI-powered replies for your Google Business Profile reviews. Save hours, stay consistent, never miss a review.',
    images: ['/images/amber_teal-logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}




