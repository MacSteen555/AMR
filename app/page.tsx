'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

/* ───────────────────────── Demo Data ───────────────────────── */
const DEMO_REVIEWS = [
  {
    author: 'Sarah M.',
    stars: 5,
    time: '2 days ago',
    text: 'Amazing service! The team went above and beyond to make sure everything was perfect. Highly recommend to everyone!',
    reply: 'Thank you so much for your wonderful review, Sarah! We\'re thrilled to hear that our team exceeded your expectations. Your kind words truly motivate us, and we look forward to serving you again soon! 🙏',
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
    reply: 'Thank you for the lovely feedback, Emily! We\'re so glad you enjoyed the atmosphere and our desserts. Great suggestion on the vegetarian options — we\'re actually expanding that section of our menu next month! Stay tuned 🌿',
  },
]

/* ───────────────────────── Typewriter Hook ───────────────────────── */
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
        if (i >= text.length) {
          clearInterval(interval)
          setDone(true)
        }
      }, speed)
      return () => clearInterval(interval)
    }, startDelay)
    return () => clearTimeout(timeout)
  }, [text, speed, startDelay])

  return { displayed, done }
}

/* ───────────────────────── Star Rating ───────────────────────── */
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

/* ───────────────────────── Review Demo Component ───────────────────────── */
function ReviewDemo() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [showReply, setShowReply] = useState(false)
  const review = DEMO_REVIEWS[activeIndex]
  const { displayed, done } = useTypewriter(showReply ? review.reply : '', 18, 800)

  useEffect(() => {
    // Start showing reply animation after a pause
    const timer = setTimeout(() => setShowReply(true), 1200)
    return () => clearTimeout(timer)
  }, [activeIndex])

  const switchReview = (index: number) => {
    setShowReply(false)
    setActiveIndex(index)
  }

  // Auto-advance after reply is fully typed
  useEffect(() => {
    if (!done || !showReply) return
    const timer = setTimeout(() => {
      switchReview((activeIndex + 1) % DEMO_REVIEWS.length)
    }, 4000)
    return () => clearTimeout(timer)
  }, [done, showReply, activeIndex])

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Review Selector Tabs */}
      <div className="flex gap-2 mb-4 justify-center">
        {DEMO_REVIEWS.map((r, i) => (
          <button
            key={i}
            onClick={() => switchReview(i)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${i === activeIndex
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
          >
            {r.stars}★ Review
          </button>
        ))}
      </div>

      {/* Review Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500" style={{ animation: 'fadeSlideUp 0.5s ease-out' }} key={activeIndex}>
        {/* Review Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white font-bold text-sm">
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

        {/* AI Reply Section */}
        <div className="p-6 bg-gradient-to-br from-indigo-50/50 to-violet-50/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">AI-Generated Reply</span>
            {!done && showReply && (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-xs text-indigo-400 font-medium">Generating...</span>
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
            {!done && showReply && <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-text-bottom" />}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Feature Card ───────────────────────── */
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-indigo-200 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-50 hover:-translate-y-1">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

/* ───────────────────────── Step Card ───────────────────────── */
function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-indigo-200/50">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  )
}

/* ───────────────────────── Pricing Card ───────────────────────── */
function PricingCard({ name, price, period, features, popular, cta }: {
  name: string; price: string; period?: string; features: string[]; popular?: boolean; cta: string
}) {
  return (
    <div className={`relative bg-white rounded-2xl p-6 border-2 transition-all duration-300 hover:-translate-y-1 ${popular ? 'border-indigo-500 shadow-xl shadow-indigo-100' : 'border-gray-100 hover:border-indigo-200 hover:shadow-lg'
      }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-full shadow-lg">Most Popular</span>
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        <div className="mt-2">
          <span className="text-4xl font-bold text-gray-900">{price}</span>
          {period && <span className="text-gray-400 text-sm ml-1">/{period}</span>}
        </div>
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className={`block w-full py-3 px-4 rounded-xl font-semibold text-center transition-all duration-300 ${popular
          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5'
          : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200'
          }`}
      >
        {cta}
      </Link>
    </div>
  )
}

/* ───────────────────────── Main Page ───────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 scroll-smooth" style={{ scrollBehavior: 'smooth' }}>
      {/* ── Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-transparent'
        }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/logo.png" alt="AutoMyReply" className="h-8 w-auto" />
            <span className="text-xl font-bold text-gray-900">AutoMyReply</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }} className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">Features</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }) }} className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">Pricing</a>
            <Link href="/login" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Login</Link>
            <Link
              href="/login"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all duration-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Soft gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/60 via-white to-white pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full mb-8">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-indigo-700">AI-Powered Review Management</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-6 leading-[1.1]">
            Engage with your customers
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">seamlessly, in seconds</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            AutoMyReply uses AI to generate personalized, on-brand replies to your Google Business reviews. Save time, stay consistent, and never miss a review.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/login"
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-lg font-semibold hover:shadow-xl hover:shadow-indigo-200 hover:-translate-y-1 transition-all duration-300 inline-flex items-center justify-center gap-2"
            >
              Start Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#demo"
              onClick={(e) => { e.preventDefault(); document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="px-8 py-4 bg-white text-gray-700 rounded-2xl text-lg font-semibold border-2 border-gray-200 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-lg transition-all duration-300 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              See it in action
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            {[
              { value: '10,000+', label: 'Replies generated' },
              { value: '500+', label: 'Businesses' },
              { value: '< 5s', label: 'Avg. reply time' },
              { value: '4.9★', label: 'User rating' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-400 font-medium mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Demo Section ── */}
      <section id="demo" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Watch AI craft the perfect reply</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Click a review type to see how AutoMyReply generates personalized, on-brand responses in real time.</p>
          </div>
          <ReviewDemo />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-gray-50/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Get started in 3 steps</h2>
            <p className="text-gray-500 text-lg">From setup to your first reply in under 5 minutes.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <StepCard number="1" title="Connect Google" description="Link your Google Business Profile in one click with secure OAuth." />
            <StepCard number="2" title="Set Your Brand Voice" description="Tell the AI how your business sounds — professional, friendly, casual, or custom." />
            <StepCard number="3" title="Review & Post" description="AI generates replies instantly. Edit if you want, then post directly to Google." />
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything you need to manage reviews</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Powerful tools for businesses of any size.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              title="AI-Powered Replies"
              description="Generate personalized, context-aware replies in seconds. The AI learns from your edits and feedback to better match your voice over time."
            />
            <FeatureCard
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              title="Team Collaboration"
              description="Invite team members, assign roles, and manage multiple locations together. Built for agencies and franchises."
            />
            <FeatureCard
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>}
              title="Brand Voice Control"
              description="Define how your AI replies sound — per location. Customize tone, style, and specific rules for negative reviews."
            />
            <FeatureCard
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>}
              title="Google Integration"
              description="Directly sync reviews from Google Business Profile. Post replies back to Google without leaving the app."
            />
            <FeatureCard
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              title="AI Insights"
              description="Surface recurring themes, sentiment trends, and actionable recommendations from hundreds of reviews — automatically."
            />
            <FeatureCard
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              title="Multi-Location"
              description="Manage reviews across all your locations from one dashboard. Each location gets its own brand voice settings."
            />
          </div>
        </div>
      </section>

      {/* ── Insights & Competitive Intelligence Showcase ── */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-gray-50/50">
        <div className="max-w-6xl mx-auto">
          {/* Insights */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-50 border border-violet-100 rounded-full mb-4">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">AI Insights</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Turn reviews into strategy</h3>
              <p className="text-gray-500 leading-relaxed mb-6">
                AutoMyReply's AI doesn't just reply — it reads between the lines. Get location-level and team-wide insights that surface recurring themes, sentiment shifts, and areas for improvement across hundreds of reviews.
              </p>
              <ul className="space-y-3">
                {['Sentiment trend analysis over time', 'Recurring praise & complaint themes', 'Actionable improvement recommendations', 'Location-by-location comparison'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-8 border border-violet-100/50">
              <div className="space-y-4">
                {[
                  { label: 'Customer Service', score: 92, color: 'bg-emerald-500' },
                  { label: 'Wait Times', score: 64, color: 'bg-amber-500' },
                  { label: 'Food Quality', score: 88, color: 'bg-emerald-500' },
                  { label: 'Atmosphere', score: 95, color: 'bg-emerald-500' },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{item.label}</span>
                      <span className="font-semibold text-gray-900">{item.score}%</span>
                    </div>
                    <div className="w-full bg-white rounded-full h-2.5">
                      <div className={`${item.color} h-2.5 rounded-full transition-all duration-1000`} style={{ width: `${item.score}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-violet-100">Sentiment breakdown from 1,247 reviews — generated by AI</p>
              </div>
            </div>
          </div>

          {/* Competitive Intelligence */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-8 border border-indigo-100/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">Y</div>
                    <div><div className="font-semibold text-gray-900 text-sm">Your Business</div><div className="text-xs text-gray-400">142 reviews</div></div>
                  </div>
                  <div className="flex items-center gap-1"><span className="font-bold text-gray-900">4.6</span><span className="text-amber-400 text-xs">★</span></div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">A</div>
                    <div><div className="font-medium text-gray-700 text-sm">Competitor A</div><div className="text-xs text-gray-400">98 reviews</div></div>
                  </div>
                  <div className="flex items-center gap-1"><span className="font-bold text-gray-700">4.3</span><span className="text-amber-400 text-xs">★</span></div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">B</div>
                    <div><div className="font-medium text-gray-700 text-sm">Competitor B</div><div className="text-xs text-gray-400">215 reviews</div></div>
                  </div>
                  <div className="flex items-center gap-1"><span className="font-bold text-gray-700">4.1</span><span className="text-amber-400 text-xs">★</span></div>
                </div>
                <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-indigo-100">AI-generated competitive report available</p>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full mb-4">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Competitive Intel</span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Know where you stand</h3>
              <p className="text-gray-500 leading-relaxed mb-6">
                Track your competitors' reviews side-by-side with your own. AutoMyReply pulls competitor data, analyzes their sentiment and themes, and generates reports showing your strengths and where you can improve.
              </p>
              <ul className="space-y-3">
                {['Side-by-side competitor comparison', 'Competitor review sentiment tracking', 'AI-generated competitive reports', 'Identify competitor weaknesses to exploit'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI That Learns ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 mb-6">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">AI that gets smarter with you</h2>
          <p className="text-gray-500 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            The more you use AutoMyReply, the better it gets. Our AI learns from your brand voice settings, your editing patterns, and the replies you choose to post — so every draft feels more natural and on-brand than the last.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="text-2xl mb-2">🎯</div>
              <h4 className="font-semibold text-gray-900 text-sm mb-1">Brand Voice Memory</h4>
              <p className="text-gray-400 text-xs leading-relaxed">Remembers your tone, style rules, and per-location preferences</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="text-2xl mb-2">✏️</div>
              <h4 className="font-semibold text-gray-900 text-sm mb-1">Learns From Edits</h4>
              <p className="text-gray-400 text-xs leading-relaxed">Adapts to how you refine generated drafts before posting</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="text-2xl mb-2">📈</div>
              <h4 className="font-semibold text-gray-900 text-sm mb-1">Continuous Improvement</h4>
              <p className="text-gray-400 text-xs leading-relaxed">Each reply gets better as the AI understands your brand</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section id="pricing" className="py-20 px-6 bg-gradient-to-b from-gray-50/50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-lg">Start free, upgrade as you grow. No hidden fees.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <PricingCard
              name="Free"
              price="$0"
              period="mo"
              features={['5 credits/month', 'AI reply generation', '1 location', 'Basic support']}
              cta="Start Free"
            />
            <PricingCard
              name="Pro"
              price="$15"
              period="mo"
              features={['25 credits/month', 'Everything in Free', 'AI Insights', 'Priority support']}
              popular
              cta="Get Pro"
            />
            <PricingCard
              name="Business"
              price="$35"
              period="mo"
              features={['50 credits/month', 'Everything in Pro', 'Competitive Intel', 'Team collaboration']}
              cta="Get Business"
            />
            <PricingCard
              name="Enterprise"
              price="$80"
              period="mo"
              features={['1,000 credits/month', 'All features', 'Custom integrations', 'Dedicated support']}
              cta="Contact Us"
            />
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-12 md:p-16 text-center overflow-hidden">
            {/* Decorative */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to automate your review replies?</h2>
              <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
                Join hundreds of businesses saving hours every week with AI-powered review management.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 rounded-2xl text-lg font-bold hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                Get Started Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/images/logo.png" alt="AutoMyReply" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-gray-900">AutoMyReply</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy Policy</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} AutoMyReply. All rights reserved.</p>
        </div>
      </footer>

      {/* ── Animations ── */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
