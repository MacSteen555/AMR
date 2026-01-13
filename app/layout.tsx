import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoMyReply - AI-Powered Review Management',
  description: 'Automatically generate professional replies to Google Business Profile reviews',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

