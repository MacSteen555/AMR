'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface NavbarProps {
  showAnchorLinks?: boolean
}

export function Navbar({ showAnchorLinks = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(res => { if (res.ok) setIsLoggedIn(true) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className={`fixed top-4 left-4 right-4 z-50 transition-all duration-500 rounded-2xl ${
      scrolled
        ? 'bg-white/80 backdrop-blur-xl shadow-lg shadow-gray-200/40 border border-gray-200/60'
        : 'bg-white/0'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/images/amber_teal-logo.png" alt="AutoMyReply" width={32} height={32} className="h-8 w-auto" />
          <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {showAnchorLinks && (
            <button onClick={() => scrollTo('features')} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">Features</button>
          )}
          <Link href="/how-it-works" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">How It Works</Link>
          <Link href="/ai" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">AI</Link>
          <Link href="/pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Pricing</Link>
          {showAnchorLinks && (
            <button onClick={() => scrollTo('faq')} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">FAQ</button>
          )}
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
            {isLoggedIn ? "Dashboard" : "Log in"}
          </Link>
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-teal-200 transition-all duration-300">
            {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 cursor-pointer" aria-label="Toggle menu">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 px-6 py-4 bg-white rounded-b-2xl space-y-3" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
          {showAnchorLinks && (
            <button onClick={() => scrollTo('features')} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 cursor-pointer">Features</button>
          )}
          <Link href="/how-it-works" className="block text-sm text-gray-600 hover:text-gray-900 py-2">How It Works</Link>
          <Link href="/ai" className="block text-sm text-gray-600 hover:text-gray-900 py-2">AI</Link>
          <Link href="/pricing" className="block text-sm text-gray-600 hover:text-gray-900 py-2">Pricing</Link>
          {showAnchorLinks && (
            <button onClick={() => scrollTo('faq')} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 cursor-pointer">FAQ</button>
          )}
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="block text-sm text-gray-600 hover:text-gray-900 py-2">
            {isLoggedIn ? "Dashboard" : "Log in"}
          </Link>
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="block w-full text-center px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-semibold">
            {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
          </Link>
        </div>
      )}
    </nav>
  )
}
