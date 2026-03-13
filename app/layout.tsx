import type { Metadata } from 'next'
import { PostHogProvider } from '@/components/PostHogProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoMyReply — AI-Powered Google Review Management',
  description: 'Automatically generate professional, on-brand replies to your Google Business Profile reviews with AI. Save hours, stay consistent, and never miss a review.',
  keywords: 'google reviews, review management, AI replies, business profile, review automation',
  icons: {
    icon: '/images/amber-a.png',
    apple: '/images/amber-a.png',
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




