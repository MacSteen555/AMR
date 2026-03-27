'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/marketing/Navbar'

/* ════════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ════════════════════════════════════════════════════════════════════ */

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: 'easeOut' as const },
}

const staggerItem = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

/* ════════════════════════════════════════════════════════════════════
   SVG ICONS
   ════════════════════════════════════════════════════════════════════ */

function CheckIcon({ className = 'text-teal-600' }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 flex-shrink-0 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

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

function GoogleLogo() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  )
}

function ShieldCheck() {
  return (
    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION A: HERO
   ════════════════════════════════════════════════════════════════════ */

function HeroSection() {
  return (
    <section className="relative overflow-hidden min-h-[85vh] flex flex-col">
      {/* Background */}
      <div className="mesh-gradient absolute inset-0" />
      <div className="dot-pattern absolute inset-0" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-[10%] w-72 h-72 bg-teal-400/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-[10%] w-64 h-64 bg-amber-400/20 rounded-full blur-3xl animate-float-delayed" />

      <Navbar />

      <div className="relative flex-1 flex items-center justify-center px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ whileInView: { transition: { staggerChildren: 0.15 } } }}
        >
          <motion.div
            variants={staggerItem}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-sm font-medium text-teal-700">How It Works</span>
          </motion.div>

          <motion.h1
            variants={staggerItem}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight"
          >
            From setup to first reply in
            <br />
            <span className="text-gradient">under 5 minutes</span>
          </motion.h1>

          <motion.p
            variants={staggerItem}
            className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
          >
            Connect your Google Business Profile, set your brand voice, and let AI
            handle the rest. Three steps to faster, smarter review management.
          </motion.p>

          <motion.div variants={staggerItem} className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-2xl text-base font-semibold hover:shadow-lg hover:shadow-teal-200 transition-all duration-300 cursor-pointer"
            >
              Get Started Free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION B: 3-STEP FLOW
   ════════════════════════════════════════════════════════════════════ */

const steps = [
  {
    number: 1,
    title: 'Connect Google',
    description:
      'Link your Google Business Profile in one click with secure OAuth. Your data stays encrypted and safe.',
  },
  {
    number: 2,
    title: 'Set Your Brand Voice',
    description:
      'Tell the AI how your business sounds — professional, friendly, casual, or fully custom. Set different voices for each location.',
  },
  {
    number: 3,
    title: 'Review & Post',
    description:
      'AI generates personalized replies instantly. Review the draft, edit if needed, then post directly to Google — all from one dashboard.',
  },
]

function StepVisual1() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 w-full max-w-sm">
      <div className="flex items-center gap-3 mb-5">
        <GoogleLogo />
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-teal-600 rounded-full" />
          </div>
          <ArrowRight />
          <div className="flex-1 h-px bg-gray-200 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-teal-600 rounded-full" />
          </div>
        </div>
        <ShieldCheck />
      </div>
      <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Connected</p>
          <p className="text-xs text-emerald-600">Google Business Profile linked</p>
        </div>
      </div>
    </div>
  )
}

function StepVisual2() {
  const tones = ['Professional', 'Friendly', 'Casual']
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 w-full max-w-sm">
      <p className="text-sm font-semibold text-gray-700 mb-4">Choose your tone</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {tones.map(tone => (
          <span
            key={tone}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tone === 'Professional'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {tone}
          </span>
        ))}
      </div>
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-xs text-gray-500 mb-1">Preview</p>
        <p className="text-sm text-gray-700 leading-relaxed">
          &ldquo;Thank you for your thoughtful review. We appreciate your feedback and are
          committed to maintaining the highest standards.&rdquo;
        </p>
      </div>
    </div>
  )
}

function StepVisual3() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 w-full max-w-sm">
      {/* Review */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">S</div>
          <span className="text-sm font-semibold text-gray-800">Sarah M.</span>
          <span className="text-xs text-gray-400 ml-auto">2 days ago</span>
        </div>
        <Stars count={5} />
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Amazing service! The team went above and beyond. Highly recommend!
        </p>
      </div>

      {/* AI Reply */}
      <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-semibold text-teal-700">AI Reply</span>
          <span className="ml-auto text-xs text-teal-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            0.8s
          </span>
        </div>
        <p className="text-sm text-teal-800 leading-relaxed">
          Thank you so much for your wonderful review, Sarah! We&apos;re thrilled our team exceeded your expectations.
        </p>
      </div>
    </div>
  )
}

function ThreeStepSection() {
  const visuals = [<StepVisual1 key={1} />, <StepVisual2 key={2} />, <StepVisual3 key={3} />]

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div className="text-center mb-16" {...fadeInUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-700">Quick Setup</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Get started in 3 simple steps
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="space-y-20">
          {steps.map((step, i) => {
            const fromLeft = i % 2 === 0
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: fromLeft ? -60 : 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, ease: 'easeOut' as const }}
                className={`flex flex-col ${fromLeft ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-10 lg:gap-16`}
              >
                {/* Text */}
                <div className="flex-1 max-w-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-teal-200">
                      {step.number}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed text-lg">{step.description}</p>
                </div>

                {/* Visual */}
                <motion.div
                  className="flex-1 flex justify-center"
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  {visuals[i]}
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION C: AI FEATURES BRIDGE (links to /ai)
   ════════════════════════════════════════════════════════════════════ */

function AIBridgeSection() {
  return (
    <section className="py-24 px-6 bg-gray-50">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div {...fadeInUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-6">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-sm font-medium text-teal-700">Powered by AI</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            More than just replies
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            AutoMyReply&apos;s AI doesn&apos;t just write replies — it learns your brand voice, monitors
            competitors, and turns hundreds of reviews into actionable business insights.
          </p>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-3 gap-6 mb-10"
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ whileInView: { transition: { staggerChildren: 0.15 } } }}
        >
          {[
            {
              title: 'Brand Voice Learning',
              desc: 'AI adapts to your tone and gets better with every edit you make.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              ),
            },
            {
              title: 'Competitor Monitoring',
              desc: 'Track competitors\' reviews and see how you compare side-by-side.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              ),
            },
            {
              title: 'AI Insights & Reports',
              desc: 'Surface sentiment trends, recurring themes, and actionable recommendations.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              ),
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-50 transition-all duration-300 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100/50 flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{item.title}</h4>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div {...fadeInUp}>
          <Link
            href="/ai"
            className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-teal-700 rounded-xl text-sm font-semibold border-2 border-teal-200 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-50 transition-all duration-300 cursor-pointer"
          >
            Explore our AI technology
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION E: BEFORE / AFTER COMPARISON
   ════════════════════════════════════════════════════════════════════ */

function StatBadge({ label, color }: { label: string; color: 'red' | 'green' }) {
  const colors = color === 'red'
    ? 'bg-red-50 text-red-600 border-red-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${colors}`}>
      {label}
    </span>
  )
}

function BeforeAfterSection() {
  return (
    <section className="py-24 px-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          {...fadeInUp}
          className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight text-center mb-14"
        >
          See the difference
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* WITHOUT */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' as const }}
          >
            <div className="bg-gray-100 rounded-2xl border border-gray-200 overflow-hidden h-full">
              <div className="bg-gray-300 px-6 py-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <h4 className="font-bold text-gray-600">Without AutoMyReply</h4>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-500">3 days</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Response Rate</p>
                  <p className="text-2xl font-bold text-gray-500">23%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</p>
                  <StatBadge label="Unanswered" color="red" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* WITH */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: 'easeOut' as const }}
          >
            <div className="bg-teal-50 rounded-2xl border border-teal-200 overflow-hidden h-full shadow-lg shadow-teal-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <h4 className="font-bold text-white">With AutoMyReply</h4>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs text-teal-600 uppercase tracking-wide mb-1">Avg Response Time</p>
                  <motion.p
                    className="text-2xl font-bold text-teal-800"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    &lt; 5 sec
                  </motion.p>
                </div>
                <div>
                  <p className="text-xs text-teal-600 uppercase tracking-wide mb-1">Response Rate</p>
                  <motion.p
                    className="text-2xl font-bold text-teal-800"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    100%
                  </motion.p>
                </div>
                <div>
                  <p className="text-xs text-teal-600 uppercase tracking-wide mb-1">Status</p>
                  <StatBadge label="All Replied" color="green" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION F: CTA
   ════════════════════════════════════════════════════════════════════ */

function CtaSection() {
  return (
    <section className="relative py-24 px-6 bg-gradient-to-br from-teal-600 to-teal-800 overflow-hidden">
      {/* Dot pattern overlay */}
      <div className="dot-pattern absolute inset-0 opacity-10" />

      <motion.div
        className="relative max-w-3xl mx-auto text-center"
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, amount: 0.3 }}
        variants={{ whileInView: { transition: { staggerChildren: 0.15 } } }}
      >
        <motion.h2
          variants={staggerItem}
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight"
        >
          Ready to transform your review management?
        </motion.h2>

        <motion.p
          variants={staggerItem}
          className="mt-6 text-lg text-teal-200 max-w-xl mx-auto"
        >
          Join hundreds of businesses that never miss a review.
        </motion.p>

        <motion.div variants={staggerItem} className="mt-10">
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="inline-block"
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-teal-700 rounded-2xl text-base font-bold hover:shadow-2xl hover:shadow-teal-900/30 transition-all duration-300 cursor-pointer"
            >
              Get Started Free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>

        <motion.p
          variants={staggerItem}
          className="mt-4 text-sm text-teal-300"
        >
          No credit card required
        </motion.p>
      </motion.div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ════════════════════════════════════════════════════════════════════ */

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <ThreeStepSection />
      <BeforeAfterSection />
      <AIBridgeSection />
      <CtaSection />
    </main>
  )
}
