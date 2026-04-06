'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'

/* ════════════════════════════════════════════════════════════════════
   SCROLL REVEAL HOOK
   ════════════════════════════════════════════════════════════════════ */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.unobserve(el) } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

/* ════════════════════════════════════════════════════════════════════
   ANIMATED COUNTER
   ════════════════════════════════════════════════════════════════════ */
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1800
          const startTime = performance.now()
          const step = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

/* ════════════════════════════════════════════════════════════════════
   DEMO DATA
   ════════════════════════════════════════════════════════════════════ */
const DEMO_REVIEWS = [
  {
    author: 'Sarah M.',
    stars: 5,
    time: '2 days ago',
    text: 'Amazing service! The team went above and beyond to make sure everything was perfect. Highly recommend to everyone!',
    reply: 'Thank you so much for your wonderful review, Sarah! We\'re thrilled to hear that our team exceeded your expectations. Your kind words truly motivate us, and we look forward to serving you again soon!',
  },
  {
    author: 'James K.',
    stars: 2,
    time: '1 week ago',
    text: 'Had to wait over 30 minutes for my order. The food was okay but the wait was unacceptable during a weekday lunch.',
    reply: 'Hi James, we sincerely apologize for the extended wait during your visit. This is not up to our usual standard. We\'ve already spoken with our team about optimizing weekday lunch service. We\'d love the chance to make it right — please reach out to us directly.',
  },
  {
    author: 'Emily R.',
    stars: 4,
    time: '3 days ago',
    text: 'Great atmosphere and friendly staff. The dessert menu is outstanding! Would love to see more vegetarian main course options.',
    reply: 'Thank you for the lovely feedback, Emily! We\'re so glad you enjoyed the atmosphere and our desserts. Great suggestion on the vegetarian options — we\'re actually expanding that section of our menu next month. Stay tuned!',
  },
]

/* ════════════════════════════════════════════════════════════════════
   TYPEWRITER HOOK
   ════════════════════════════════════════════════════════════════════ */
function useTypewriter(text: string, speed = 22, startDelay = 600) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) { clearInterval(interval); setDone(true) }
      }, speed)
      return () => clearInterval(interval)
    }, startDelay)
    return () => clearTimeout(timeout)
  }, [text, speed, startDelay])

  return { displayed, done }
}

/* ════════════════════════════════════════════════════════════════════
   STAR RATING (SVG)
   ════════════════════════════════════════════════════════════════════ */
function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={`w-4 h-4 ${i <= count ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   REVIEW DEMO
   ════════════════════════════════════════════════════════════════════ */
function ReviewDemo() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [showReply, setShowReply] = useState(false)
  const review = DEMO_REVIEWS[activeIndex]
  const { displayed, done } = useTypewriter(showReply ? review.reply : '', 18, 800)

  useEffect(() => {
    const timer = setTimeout(() => setShowReply(true), 1200)
    return () => clearTimeout(timer)
  }, [activeIndex])

  const switchReview = useCallback((index: number) => {
    setShowReply(false)
    setActiveIndex(index)
  }, [])

  useEffect(() => {
    if (!done || !showReply) return
    const timer = setTimeout(() => {
      switchReview((activeIndex + 1) % DEMO_REVIEWS.length)
    }, 4000)
    return () => clearTimeout(timer)
  }, [done, showReply, activeIndex, switchReview])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2 mb-5 justify-center">
        {DEMO_REVIEWS.map((r, i) => (
          <button
            key={i}
            onClick={() => switchReview(i)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
              i === activeIndex
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {r.stars}★ Review
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden" key={activeIndex} style={{ animation: 'fadeSlideUp 0.5s ease-out' }}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
              {review.author.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{review.author}</div>
              <div className="text-xs text-gray-400">{review.time}</div>
            </div>
            <div className="ml-auto"><Stars count={review.stars} /></div>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">{review.text}</p>
        </div>

        <div className="p-6 bg-teal-50/40">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">AI-Generated Reply</span>
            {!done && showReply && (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                <span className="text-xs text-teal-400 font-medium">Generating...</span>
              </span>
            )}
            {done && (
              <span className="ml-auto flex items-center gap-1.5 text-emerald-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium">Ready to post</span>
              </span>
            )}
          </div>
          <p className="text-gray-700 text-sm leading-relaxed min-h-[80px]">
            {displayed}
            {!done && showReply && <span className="inline-block w-0.5 h-4 bg-teal-500 ml-0.5 animate-pulse align-text-bottom" />}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   FAQ ACCORDION
   ════════════════════════════════════════════════════════════════════ */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden transition-all duration-300 hover:border-teal-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left cursor-pointer"
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-6' : 'max-h-0'}`}>
        <p className="px-6 text-gray-500 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

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

  /* ── Section reveal refs ── */
  const demoRef = useReveal()
  const stepsRef = useReveal()
  const featuresRef = useReveal()
  const insightsRef = useReveal()
  const competitiveRef = useReveal()
  const aiLearnRef = useReveal()
  const testimonialsRef = useReveal()
  const pricingRef = useReveal()
  const faqRef = useReveal()
  const ctaRef = useReveal()

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ════════════════ NAVBAR ════════════════ */}
      <nav className={`fixed top-4 left-4 right-4 z-50 transition-all duration-500 rounded-2xl ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-lg shadow-gray-200/40 border border-gray-200/60'
          : 'bg-white/0'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/images/amber_teal-logo.png" alt="AutoMyReply" width={32} height={32} className="h-8 w-auto" />
            <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo('features')} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">Features</button>
            <button onClick={() => scrollTo('pricing')} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">Pricing</button>
            <Link href="/insights" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Insights</Link>
            <Link href="/compete" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Competitive</Link>
            <button onClick={() => scrollTo('faq')} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">FAQ</button>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">{isLoggedIn ? "Dashboard" : "Log in"}</Link>
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
            <button onClick={() => scrollTo('features')} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 cursor-pointer">Features</button>
            <button onClick={() => scrollTo('pricing')} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 cursor-pointer">Pricing</button>
            <Link href="/insights" className="block text-sm text-gray-600 hover:text-gray-900 py-2">Insights</Link>
            <Link href="/compete" className="block text-sm text-gray-600 hover:text-gray-900 py-2">Competitive</Link>
            <button onClick={() => scrollTo('faq')} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 cursor-pointer">FAQ</button>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="block text-sm text-gray-600 hover:text-gray-900 py-2">{isLoggedIn ? "Dashboard" : "Log in"}</Link>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="block w-full text-center px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-semibold">
              {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
            </Link>
          </div>
        )}
      </nav>

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative pt-36 pb-24 overflow-hidden mesh-gradient">
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />

        {/* Decorative orbs */}
        <div className="absolute top-24 left-[10%] w-72 h-72 bg-teal-200/30 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute top-48 right-[10%] w-80 h-80 bg-amber-200/25 rounded-full blur-3xl animate-float-delayed pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/80 backdrop-blur-sm border border-teal-100 rounded-full mb-8 shadow-sm" style={{ animation: 'fadeSlideUp 0.6s ease-out' }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-teal-700">AI-Powered Review Management</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.08]" style={{ animation: 'fadeSlideUp 0.6s ease-out 0.1s both' }}>
            Every review answered.
            <br />
            <span className="text-gradient">Zero effort required.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ animation: 'fadeSlideUp 0.6s ease-out 0.2s both' }}>
            AutoMyReply uses AI to craft personalized, on-brand replies to your Google Business reviews. Save time, stay consistent, and never miss a review.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20" style={{ animation: 'fadeSlideUp 0.6s ease-out 0.3s both' }}>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="group px-8 py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-2xl text-lg font-semibold hover:shadow-xl hover:shadow-teal-200/60 transition-all duration-300 inline-flex items-center justify-center gap-2"
            >
              {isLoggedIn ? "Go to Dashboard" : "Start Free"}
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <button
              onClick={() => scrollTo('demo')}
              className="px-8 py-4 bg-white text-gray-700 rounded-2xl text-lg font-semibold border-2 border-gray-200 hover:border-teal-300 hover:text-teal-700 hover:shadow-lg transition-all duration-300 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              See it in action
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16" style={{ animation: 'fadeSlideUp 0.6s ease-out 0.4s both' }}>
            {[
              { value: 10000, suffix: '+', label: 'Replies generated' },
              { value: 5, prefix: '< ', suffix: 's', label: 'Avg. reply time' },
              { value: 30, suffix: 's', label: 'Setup time' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </div>
                <div className="text-sm text-gray-400 font-medium mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ LIVE DEMO ════════════════ */}
      <section id="demo" className="py-24 px-6">
        <div ref={demoRef} className="reveal max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-100 rounded-full mb-4">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Live Demo</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Watch AI craft the perfect reply</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Click a review type to see how AutoMyReply generates personalized, on-brand responses in real time.</p>
          </div>
          <ReviewDemo />
        </div>
      </section>

      {/* ════════════════ HOW IT WORKS ════════════════ */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50/80">
        <div ref={stepsRef} className="reveal max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full mb-4">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Quick Setup</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Get started in 3 simple steps</h2>
            <p className="text-gray-500 text-lg">From setup to your first reply in under 5 minutes.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: '1',
                title: 'Connect Google',
                desc: 'Link your Google Business Profile in one click with secure OAuth authentication.',
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              },
              {
                num: '2',
                title: 'Set Brand Voice',
                desc: 'Tell the AI how your business sounds — professional, friendly, casual, or fully custom.',
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
              },
              {
                num: '3',
                title: 'Review & Post',
                desc: 'AI generates replies instantly. Edit if needed, then post directly to Google.',
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              },
            ].map((step, i) => (
              <div key={i} className={`reveal-delay-${i + 1} group relative text-center`}>
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-teal-200/60 pointer-events-none" />
                )}
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-50 border border-teal-100/50 mb-6 group-hover:shadow-lg group-hover:shadow-teal-100 transition-all duration-300">
                  {step.icon}
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {step.num}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FEATURES BENTO GRID ════════════════ */}
      <section id="features" className="py-24 px-6">
        <div ref={featuresRef} className="reveal max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-100 rounded-full mb-4">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Features</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Everything you need to manage reviews</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Powerful tools for businesses of every size.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
            {/* Large card: AI-Powered Replies */}
            <div className="reveal-delay-1 group relative bg-white rounded-2xl p-8 border border-gray-100 hover:border-teal-200 transition-all duration-300 hover:shadow-xl hover:shadow-teal-50 cursor-pointer md:col-span-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-teal-50 to-transparent rounded-bl-full pointer-events-none" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-teal-200/50">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">AI-Powered Replies</h3>
                <p className="text-gray-500 leading-relaxed max-w-md">Generate personalized, context-aware replies in seconds. The AI learns from your edits to better match your voice over time.</p>
                <div className="mt-6 flex items-center gap-4 text-sm">
                  <span className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg font-medium">Smart Context</span>
                  <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-medium">Adaptive Learning</span>
                  <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-medium">Instant Drafts</span>
                </div>
              </div>
            </div>

            {/* Small card: Team Collaboration */}
            <div className="reveal-delay-2 group relative bg-white rounded-2xl p-7 border border-gray-100 hover:border-teal-200 transition-all duration-300 hover:shadow-xl hover:shadow-teal-50 cursor-pointer md:col-span-2">
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100/50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Collaboration</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Invite members, assign roles, manage locations together. Built for agencies.</p>
            </div>

            {/* Small card: Brand Voice */}
            <div className="reveal-delay-1 group relative bg-white rounded-2xl p-7 border border-gray-100 hover:border-amber-200 transition-all duration-300 hover:shadow-xl hover:shadow-amber-50 cursor-pointer md:col-span-2">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100/50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Brand Voice Control</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Define how your AI replies sound — per location. Customize tone and style.</p>
            </div>

            {/* Large card: Google Integration */}
            <div className="reveal-delay-2 group relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700 hover:border-teal-500 transition-all duration-300 hover:shadow-xl hover:shadow-teal-900/20 cursor-pointer md:col-span-4 overflow-hidden">
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-tl from-teal-500/10 to-transparent rounded-tl-full pointer-events-none" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Google Integration</h3>
                <p className="text-gray-400 leading-relaxed max-w-md">Directly sync reviews from Google Business Profile. Post replies back to Google without leaving the app.</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['G', 'B', 'P'].map((l, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold border-2 border-gray-900">{l}</div>
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">Syncs in real-time</span>
                </div>
              </div>
            </div>

            {/* Small card: AI Insights */}
            <div className="reveal-delay-3 group relative bg-white rounded-2xl p-7 border border-gray-100 hover:border-teal-200 transition-all duration-300 hover:shadow-xl hover:shadow-teal-50 cursor-pointer md:col-span-3">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100/50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Insights</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">Surface recurring themes, sentiment trends, and actionable recommendations from hundreds of reviews.</p>
                </div>
              </div>
            </div>

            {/* Small card: Multi-Location */}
            <div className="reveal-delay-3 group relative bg-white rounded-2xl p-7 border border-gray-100 hover:border-teal-200 transition-all duration-300 hover:shadow-xl hover:shadow-teal-50 cursor-pointer md:col-span-3">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100/50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Location</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">Manage reviews across all your locations from one dashboard. Each location gets its own voice settings.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ INSIGHTS SHOWCASE ════════════════ */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50/80">
        <div className="max-w-6xl mx-auto">
          {/* Insights */}
          <div ref={insightsRef} className="reveal grid md:grid-cols-2 gap-12 lg:gap-16 items-center mb-32">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full mb-4">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">AI Insights</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Turn reviews into strategy</h3>
              <p className="text-gray-500 leading-relaxed mb-8">
                AutoMyReply's AI doesn't just reply — it reads between the lines. Get location-level and team-wide insights that surface recurring themes, sentiment shifts, and areas for improvement.
              </p>
              <ul className="space-y-4">
                {['Sentiment trend analysis over time', 'Recurring praise & complaint themes', 'Actionable improvement recommendations', 'Location-by-location comparison'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-xl shadow-amber-100/30">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-semibold text-gray-900 text-sm">Sentiment Breakdown</h4>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">Last 30 days</span>
              </div>
              <div className="space-y-5">
                {[
                  { label: 'Customer Service', score: 92, color: 'bg-emerald-500' },
                  { label: 'Wait Times', score: 64, color: 'bg-amber-500' },
                  { label: 'Food Quality', score: 88, color: 'bg-emerald-500' },
                  { label: 'Atmosphere', score: 95, color: 'bg-emerald-500' },
                  { label: 'Value for Money', score: 78, color: 'bg-teal-500' },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700">{item.label}</span>
                      <span className="font-bold text-gray-900">{item.score}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${item.color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${item.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">Sentiment breakdown from 1,247 reviews — generated by AI</p>
            </div>
          </div>

          {/* Competitive Intelligence */}
          <div ref={competitiveRef} className="reveal grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 md:order-1 bg-white rounded-2xl p-8 border border-gray-100 shadow-xl shadow-teal-100/30">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-semibold text-gray-900 text-sm">Competitive Overview</h4>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-medium">You're #1</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Your Business', reviews: 142, rating: 4.6, isYou: true },
                  { name: 'Competitor A', reviews: 98, rating: 4.3, isYou: false },
                  { name: 'Competitor B', reviews: 215, rating: 4.1, isYou: false },
                  { name: 'Competitor C', reviews: 67, rating: 3.8, isYou: false },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-3.5 rounded-xl transition-colors duration-200 ${item.isYou ? 'bg-teal-50 border border-teal-100' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${item.isYou ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {item.name.charAt(0) === 'Y' ? 'Y' : item.name.split(' ')[1]}
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${item.isYou ? 'text-teal-900' : 'text-gray-700'}`}>{item.name}</div>
                        <div className="text-xs text-gray-400">{item.reviews} reviews</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-sm ${item.isYou ? 'text-teal-900' : 'text-gray-700'}`}>{item.rating}</span>
                      <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">AI-generated competitive report available</p>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-100 rounded-full mb-4">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Competitive Intel</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Know where you stand</h3>
              <p className="text-gray-500 leading-relaxed mb-8">
                Track competitors' reviews side-by-side with your own. AutoMyReply pulls competitor data, analyzes sentiment and themes, and generates reports showing your strengths and growth opportunities.
              </p>
              <ul className="space-y-4">
                {['Side-by-side competitor comparison', 'Competitor review sentiment tracking', 'AI-generated competitive reports', 'Identify competitor weaknesses'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ AI THAT LEARNS ════════════════ */}
      <section className="py-24 px-6">
        <div ref={aiLearnRef} className="reveal max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-100 mb-6">
            <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">AI that gets smarter with you</h2>
          <p className="text-gray-500 text-lg leading-relaxed max-w-2xl mx-auto mb-12">
            The more you use AutoMyReply, the better it gets. Our AI learns from your brand voice, editing patterns, and the replies you post — so every draft feels more natural than the last.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              {
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>,
                title: 'Brand Voice Memory',
                desc: 'Remembers your tone, style rules, and per-location preferences across sessions.'
              },
              {
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                title: 'Learns From Edits',
                desc: 'Adapts to how you refine generated drafts before posting to better match your expectations.'
              },
              {
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
                title: 'Continuous Improvement',
                desc: 'Each reply gets better as the AI deepens its understanding of your unique brand identity.'
              },
            ].map((item, i) => (
              <div key={i} className={`reveal-delay-${i + 1} group bg-white rounded-2xl p-6 border border-gray-100 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-50 transition-all duration-300 cursor-pointer`}>
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100/50 flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">{item.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ WHY AUTOMYREPLY ════════════════ */}
      <section className="py-24 bg-gradient-to-b from-gray-50/80 to-white overflow-hidden">
        <div ref={testimonialsRef} className="reveal max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full mb-4">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Why AutoMyReply</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Built for businesses that care about reviews</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Every feature designed to save you time and make your business look great online.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                title: 'Hours saved weekly',
                desc: 'Stop spending hours crafting individual replies. AI generates on-brand responses in seconds, not minutes.',
                borderHover: 'hover:border-teal-200',
                shadowHover: 'hover:shadow-teal-50',
                bg: 'bg-teal-50',
                border: 'border-teal-100/50',
              },
              {
                icon: <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
                title: '100% response rate',
                desc: 'Never miss a review again. Every customer gets a thoughtful, personalized reply — positive or negative.',
                borderHover: 'hover:border-amber-200',
                shadowHover: 'hover:shadow-amber-50',
                bg: 'bg-amber-50',
                border: 'border-amber-100/50',
              },
              {
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
                title: 'Your voice, not ours',
                desc: 'Custom brand voice settings per location ensure every reply sounds authentically like your business.',
                borderHover: 'hover:border-teal-200',
                shadowHover: 'hover:shadow-teal-50',
                bg: 'bg-teal-50',
                border: 'border-teal-100/50',
              },
              {
                icon: <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
                title: 'Actionable insights',
                desc: 'AI analyzes review patterns to surface what customers love and where you can improve.',
                borderHover: 'hover:border-amber-200',
                shadowHover: 'hover:shadow-amber-50',
                bg: 'bg-amber-50',
                border: 'border-amber-100/50',
              },
              {
                icon: <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
                title: 'Secure by default',
                desc: 'OAuth 2.0 authentication, encrypted tokens, and we never store your Google password. Your data stays yours.',
                borderHover: 'hover:border-teal-200',
                shadowHover: 'hover:shadow-teal-50',
                bg: 'bg-teal-50',
                border: 'border-teal-100/50',
              },
              {
                icon: <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                title: 'Built for teams',
                desc: 'Invite team members, assign roles, and manage multiple locations together from one dashboard.',
                borderHover: 'hover:border-amber-200',
                shadowHover: 'hover:shadow-amber-50',
                bg: 'bg-amber-50',
                border: 'border-amber-100/50',
              },
            ].map((item, i) => (
              <div key={i} className={`reveal-delay-${(i % 3) + 1} group bg-white rounded-2xl p-7 border border-gray-100 ${item.borderHover} hover:shadow-xl ${item.shadowHover} transition-all duration-300`}>
                <div className={`w-12 h-12 rounded-xl ${item.bg} ${item.border} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ PRICING ════════════════ */}
      <section id="pricing" className="py-24 px-6">
        <div ref={pricingRef} className="reveal max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full mb-4">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Pricing</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-lg">Start free, upgrade as you grow. No hidden fees.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'Free',
                price: '$0',
                period: 'mo',
                features: ['5 reviews / month', 'AI reply generation', '1 location', 'Basic support'],
                popular: false,
                cta: 'Start Free',
              },
              {
                name: 'Pro',
                price: '$15',
                period: 'mo',
                features: ['50 reviews / month', 'Everything in Free', 'AI Insights', 'Priority support'],
                popular: true,
                cta: 'Get Pro',
              },
              {
                name: 'Business',
                price: '$35',
                period: 'mo',
                features: ['200 reviews / month', 'Everything in Pro', 'Competitive Intel', 'Team collaboration'],
                popular: false,
                cta: 'Get Business',
              },
              {
                name: 'Enterprise',
                price: '$80',
                period: 'mo',
                features: ['1,000 reviews / month', 'All features', 'Custom integrations', 'Dedicated support'],
                popular: false,
                cta: 'Contact Us',
              },
            ].map((plan, i) => (
              <div key={i} className={`reveal-delay-${i + 1} relative bg-white rounded-2xl p-7 border-2 transition-all duration-300 ${
                plan.popular
                  ? 'border-teal-500 shadow-xl shadow-teal-100/50 scale-[1.02]'
                  : 'border-gray-100 hover:border-teal-200 hover:shadow-lg'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-xs font-bold rounded-full shadow-lg shadow-teal-200/50">Most Popular</span>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-400 text-sm ml-1">/{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-7">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <svg className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={isLoggedIn ? "/dashboard" : "/login"}
                  className={`block w-full py-3 px-4 rounded-xl font-semibold text-center transition-all duration-300 cursor-pointer ${
                    plan.popular
                      ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white hover:shadow-lg hover:shadow-teal-200'
                      : 'bg-gray-50 text-gray-700 hover:bg-teal-50 hover:text-teal-700 border border-gray-200'
                  }`}
                >
                  {isLoggedIn ? "Go to Dashboard" : plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FAQ ════════════════ */}
      <section id="faq" className="py-24 px-6 bg-gradient-to-b from-gray-50/50 to-white">
        <div ref={faqRef} className="reveal max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-100 rounded-full mb-4">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">FAQ</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
            <p className="text-gray-500 text-lg">Everything you need to know about AutoMyReply.</p>
          </div>

          <div className="space-y-3">
            <FAQItem
              question="How does AutoMyReply generate replies?"
              answer="AutoMyReply uses advanced AI models to analyze each review's content, sentiment, and context. It then generates a personalized reply that matches your configured brand voice, tone, and style guidelines. Each reply is unique and contextually relevant."
            />
            <FAQItem
              question="Can I edit the AI-generated replies before posting?"
              answer="Absolutely! Every generated reply is a draft that you can review, edit, and refine before posting. The AI learns from your edits over time, so future drafts will better match your preferences."
            />
            <FAQItem
              question="How does the review system work?"
              answer="Each plan includes a monthly review limit. Generating an AI reply to a review counts as one review managed. For example, the Pro plan includes 50 reviews per month. You can always purchase additional capacity if you need more."
            />
            <FAQItem
              question="Is my Google Business Profile data secure?"
              answer="Yes, security is our top priority. We use OAuth 2.0 for Google authentication, encrypt all tokens at rest, and never store your Google password. All data is processed securely and we're compliant with Google's API policies."
            />
            <FAQItem
              question="Can I manage multiple locations?"
              answer="Yes! AutoMyReply supports multi-location management. Each location can have its own brand voice settings, and you can manage all reviews from a single dashboard. This is especially useful for franchises and agencies."
            />
            <FAQItem
              question="Do you offer a free trial?"
              answer="Our Free plan lets you manage up to 5 reviews per month at no cost — no credit card required. This lets you experience the AI reply generation firsthand. When you're ready for more features and capacity, you can upgrade to Pro, Business, or Enterprise."
            />
          </div>
        </div>
      </section>

      {/* ════════════════ CTA BANNER ════════════════ */}
      <section className="py-24 px-6">
        <div ref={ctaRef} className="reveal max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 rounded-3xl p-12 md:p-16 text-center overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-sm" />
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-sm" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Ready to automate your reviews?</h2>
              <p className="text-teal-200 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                Stop spending hours on review replies. Let AI handle them in seconds — on-brand, every time. Start free — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={isLoggedIn ? "/dashboard" : "/login"}
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-teal-600 rounded-2xl text-lg font-bold hover:shadow-xl transition-all duration-300"
                >
                  {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <button
                  onClick={() => scrollTo('demo')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white rounded-2xl text-lg font-semibold border border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer"
                >
                  Watch Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ CONTACT ════════════════ */}
      <section id="contact" className="py-24 px-6 bg-white">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-3">Get in Touch</h2>
          <p className="text-gray-500 mb-8">Questions, feedback, or just want to say hi? We&apos;d love to hear from you.</p>
          <button
            onClick={() => setContactOpen(true)}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition shadow-sm cursor-pointer"
          >
            Contact Us
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8">
            {/* Brand column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Image src="/images/amber_teal-logo.png" alt="AutoMyReply" width={32} height={32} className="h-8 w-auto" />
                <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm mb-6">
                AI-powered review management for Google Business Profile. Save time, stay consistent, and never miss a review.
              </p>
              <div className="flex items-center gap-4">
                {/* Twitter/X */}
                <a href="#" className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-teal-50 flex items-center justify-center text-gray-400 hover:text-teal-600 transition-all duration-200" aria-label="Twitter">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
                {/* LinkedIn */}
                <a href="#" className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-teal-50 flex items-center justify-center text-gray-400 hover:text-teal-600 transition-all duration-200" aria-label="LinkedIn">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </a>
              </div>
            </div>

            {/* Product links */}
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Product</h4>
              <ul className="space-y-3">
                <li><button onClick={() => scrollTo('features')} className="text-sm text-gray-500 hover:text-teal-600 transition-colors cursor-pointer">Features</button></li>
                <li><button onClick={() => scrollTo('pricing')} className="text-sm text-gray-500 hover:text-teal-600 transition-colors cursor-pointer">Pricing</button></li>
                <li><button onClick={() => scrollTo('demo')} className="text-sm text-gray-500 hover:text-teal-600 transition-colors cursor-pointer">Live Demo</button></li>
              </ul>
            </div>

            {/* Methodology links */}
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Methodology</h4>
              <ul className="space-y-3">
                <li><Link href="/insights" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Insights Metrics</Link></li>
                <li><Link href="/compete" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Competitive Metrics</Link></li>
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Company</h4>
              <ul className="space-y-3">
                <li><Link href="/terms" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            {/* Support links */}
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Support</h4>
              <ul className="space-y-3">
                <li><button onClick={() => scrollTo('faq')} className="text-sm text-gray-500 hover:text-teal-600 transition-colors cursor-pointer">FAQ</button></li>
                <li><button onClick={() => setContactOpen(true)} className="text-sm text-gray-500 hover:text-teal-600 transition-colors cursor-pointer">Contact Us</button></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} AutoMyReply. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>

      {contactOpen && <LandingContactModal onClose={() => setContactOpen(false)} />}
    </div>
  )
}

function LandingContactModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/contact/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), message: form.message.trim() }),
      })
      if (!res.ok) throw new Error()
      setStatus('sent')
    } catch {
      setStatus('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()} style={{ animation: 'fadeSlideUp 0.2s ease-out' }}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Contact Us</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {status === 'sent' ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Message sent!</p>
              <p className="text-xs text-gray-500">We&apos;ll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y"
                  placeholder="How can we help?"
                />
              </div>
              {status === 'error' && (
                <p className="text-xs text-red-600">Failed to send. Please try again.</p>
              )}
              <button
                type="submit"
                disabled={sending}
                className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

