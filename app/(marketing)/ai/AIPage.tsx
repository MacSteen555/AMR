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

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

const staggerItemInline = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

/* ════════════════════════════════════════════════════════════════════
   SVG ICONS
   ════════════════════════════════════════════════════════════════════ */

function SparkleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" />
    </svg>
  )
}

function BoltIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function LightbulbIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function CursorIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  )
}

function PencilIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function TrendingUpIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

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

function StarSingle({ className = 'w-4 h-4 text-amber-400' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION 1: HERO
   ════════════════════════════════════════════════════════════════════ */

function HeroSection() {
  return (
    <section className="relative overflow-hidden min-h-[85vh] flex flex-col">
      {/* Background */}
      <div className="mesh-gradient absolute inset-0" />
      <div className="dot-pattern absolute inset-0 opacity-30 pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-[10%] w-72 h-72 bg-teal-200/30 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-[10%] w-64 h-64 bg-amber-200/25 rounded-full blur-3xl animate-float-delayed" />

      <Navbar />

      <div className="relative flex-1 flex items-center justify-center px-6 pt-36 pb-24">
        <motion.div
          className="max-w-5xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          <motion.div
            variants={staggerItem}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-6"
          >
            <SparkleIcon className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">AI Technology</span>
          </motion.div>

          <motion.h1
            variants={staggerItem}
            className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-tight"
          >
            AI that speaks
            <br />
            <span className="text-gradient">your brand</span>
          </motion.h1>

          <motion.p
            variants={staggerItem}
            className="mt-6 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed"
          >
            AutoMyReply&apos;s AI generates personalized, context-aware replies to your
            Google reviews — and gets smarter every time you use it.
          </motion.p>

          <motion.div variants={staggerItem} className="mt-8">
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="inline-block"
            >
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-2xl text-base font-semibold hover:shadow-lg hover:shadow-teal-200 transition-all duration-300 cursor-pointer"
              >
                Try It Free
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION 2: AI REPLY GENERATION
   ════════════════════════════════════════════════════════════════════ */

function ReplyGenerationSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div className="text-center mb-16" {...fadeInUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-4">
            <BoltIcon className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">Instant Replies</span>
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">
            Context-aware replies in seconds
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: text */}
          <motion.div {...fadeInUp}>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              Our AI reads the full review context — star rating, sentiment, reviewer
              history, and your brand voice settings — to craft the perfect reply
              every single time. No templates, no copy-paste. Just genuine,
              personalized responses that sound like you wrote them.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-50 text-teal-700">
                Context-Aware
              </span>
              <span className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-700">
                On-Brand
              </span>
              <span className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700">
                &lt; 5 Seconds
              </span>
            </div>
          </motion.div>

          {/* Right: visual mockup */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: 'easeOut' as const }}
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-teal-100/30 p-8">
              {/* Reviewer */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                  SM
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">Sarah M.</span>
                    <span className="text-xs text-gray-400">2 days ago</span>
                  </div>
                  <Stars count={5} />
                </div>
              </div>

              {/* Review text */}
              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                Amazing service! The team went above and beyond to make sure everything
                was perfect. Highly recommend!
              </p>

              {/* Divider */}
              <div className="h-px bg-gray-100 mb-5" />

              {/* AI Reply */}
              <div className="border-l-2 border-teal-400 bg-teal-50 rounded-r-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SparkleIcon className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-semibold text-teal-700">AI-Generated Reply</span>
                </div>
                <p className="text-sm text-teal-800 leading-relaxed">
                  Thank you so much for your wonderful review, Sarah! We&apos;re thrilled
                  to hear that our team exceeded your expectations. Your kind words
                  motivate us, and we look forward to serving you again!
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION 3: BRAND VOICE CONTROL
   ════════════════════════════════════════════════════════════════════ */

const brandVoiceFeatures = [
  'Per-location voice profiles',
  'Professional, friendly, or casual presets',
  'Custom instructions and guidelines',
  'Automatic signature insertion',
]

function BrandVoiceSection() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50/80">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div className="text-center mb-16" {...fadeInUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-700">Brand Voice</span>
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">
            Your voice, amplified by AI
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: visual mockup */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: 'easeOut' as const }}
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-teal-100/30 p-8">
              <h4 className="font-semibold text-gray-900 mb-5">Brand Voice Settings</h4>

              {/* Tone options */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-600 text-white shadow-md shadow-teal-200 cursor-pointer">
                  Professional
                </span>
                <span className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer">
                  Friendly
                </span>
                <span className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer">
                  Casual
                </span>
              </div>

              {/* Preview */}
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Preview</p>

              <div className="space-y-3 mb-6">
                <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 relative">
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-teal-600 text-white text-[10px] font-semibold rounded-full">
                    Currently selected
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    &ldquo;Thank you for your feedback. We appreciate your kind words and
                    look forward to serving you again.&rdquo;
                  </p>
                </div>
              </div>

              {/* Custom instructions textarea mockup */}
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Custom Instructions</p>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 min-h-[72px]">
                <p className="text-sm text-gray-400 italic">
                  Always mention our weekend specials...
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right: text */}
          <motion.div {...fadeInUp}>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              Set a unique voice for every location. Whether your downtown cafe
              should sound warm and casual, or your flagship store needs a
              polished, professional tone — the AI adapts to match.
            </p>
            <ul className="space-y-4">
              {brandVoiceFeatures.map(feature => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <CheckIcon className="text-amber-600" />
                  </div>
                  <span className="text-gray-700 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION 4: AI THAT LEARNS
   ════════════════════════════════════════════════════════════════════ */

const learningCards = [
  {
    icon: CursorIcon,
    title: 'Brand Voice Memory',
    description: 'Remembers your tone, style rules, and per-location preferences across sessions.',
  },
  {
    icon: PencilIcon,
    title: 'Learns From Edits',
    description: 'Adapts to how you refine generated drafts before posting to better match your expectations.',
  },
  {
    icon: TrendingUpIcon,
    title: 'Continuous Improvement',
    description: 'Each reply gets better as the AI deepens its understanding of your unique brand identity.',
  },
]

function AILearnsSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* Icon */}
        <motion.div {...fadeInUp} className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center">
            <LightbulbIcon className="w-8 h-8 text-teal-600" />
          </div>
        </motion.div>

        <motion.h2
          {...fadeInUp}
          className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4"
        >
          AI that gets smarter with you
        </motion.h2>

        <motion.p
          {...fadeInUp}
          className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto mb-14"
        >
          The more you use AutoMyReply, the better it understands your brand. Our AI
          continuously learns from your preferences and edits to deliver replies that
          feel authentically yours.
        </motion.p>

        {/* Cards */}
        <motion.div
          className="grid sm:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          {learningCards.map(card => (
            <motion.div
              key={card.title}
              variants={staggerItem}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-50 transition-all duration-200 cursor-pointer"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <card.icon className="w-6 h-6 text-teal-600" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION 5: COMPETITOR MONITORING
   ════════════════════════════════════════════════════════════════════ */

const competitors = [
  { name: 'Your Business', reviews: 142, rating: 4.6, highlight: true },
  { name: 'Competitor A', reviews: 98, rating: 4.3, highlight: false },
  { name: 'Competitor B', reviews: 215, rating: 4.1, highlight: false },
  { name: 'Competitor C', reviews: 67, rating: 3.8, highlight: false },
]

const competitorFeatures = [
  'Side-by-side competitor comparison',
  'Competitor review sentiment tracking',
  'AI-generated competitive reports',
  'Identify competitor weaknesses',
]

function CompetitorSection() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-gray-50/80 to-white">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div className="text-center mb-16" {...fadeInUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-4">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-sm font-medium text-teal-700">Competitive Intel</span>
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">
            Know exactly where you stand
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: text */}
          <motion.div {...fadeInUp}>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              Monitor your competitors&apos; review performance in real time. Track
              their ratings, analyze their customer sentiment, and understand their
              strengths and weaknesses so you can stay ahead in your market.
            </p>
            <ul className="space-y-4">
              {competitorFeatures.map(feature => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <CheckIcon className="text-teal-600" />
                  </div>
                  <span className="text-gray-700 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right: competitive overview card */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: 'easeOut' as const }}
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-teal-100/30 p-8">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-gray-900">Competitive Overview</h4>
                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                  You&apos;re #1
                </span>
              </div>
              <motion.div
                className="space-y-3"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
              >
                {competitors.map(c => (
                  <motion.div
                    key={c.name}
                    variants={staggerItem}
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                      c.highlight ? 'bg-teal-50 border border-teal-200' : 'bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        c.highlight ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {c.name.charAt(0)}
                      </div>
                      <span className={`text-sm font-semibold ${c.highlight ? 'text-teal-800' : 'text-gray-700'}`}>
                        {c.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{c.reviews} reviews</span>
                      <div className="flex items-center gap-1">
                        <StarSingle className={`w-4 h-4 ${c.highlight ? 'text-amber-400' : 'text-gray-300'}`} />
                        <span className={`font-semibold ${c.highlight ? 'text-teal-800' : 'text-gray-600'}`}>{c.rating}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              <p className="mt-5 text-xs text-gray-400 text-center">
                AI-generated competitive report available
              </p>
            </div>
          </motion.div>
        </div>

        {/* Tier callout */}
        <motion.p {...fadeInUp} className="text-center mt-12 text-sm text-gray-500">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gray-100 border border-gray-200 shadow-sm">
            Track 1 competitor on Pro &middot; 5 on Business &middot; 20 on Enterprise
          </span>
        </motion.p>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION 6: AI INSIGHTS & REPORTS
   ════════════════════════════════════════════════════════════════════ */

const sentimentBars = [
  { label: 'Customer Service', value: 92, color: 'bg-emerald-500' },
  { label: 'Wait Times', value: 64, color: 'bg-amber-500' },
  { label: 'Food Quality', value: 88, color: 'bg-emerald-500' },
  { label: 'Atmosphere', value: 95, color: 'bg-emerald-500' },
  { label: 'Value for Money', value: 78, color: 'bg-teal-500' },
]

const keyFindings = [
  { text: 'Parking complaints increased 34% this month', color: 'border-amber-400', indicator: 'bg-amber-400' },
  { text: 'Customer service praised in 89% of 5-star reviews', color: 'border-emerald-400', indicator: 'bg-emerald-400' },
  { text: 'Weekend wait times are the top negative theme', color: 'border-amber-400', indicator: 'bg-amber-400' },
]

const insightFeatures = [
  'Sentiment trend analysis over time',
  'Recurring praise & complaint themes',
  'Actionable improvement recommendations',
  'Location-by-location comparison',
]

function InsightsSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div className="text-center mb-16" {...fadeInUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-700">AI Insights</span>
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">
            Turn hundreds of reviews into actionable strategy
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: visual cards */}
          <motion.div {...fadeInUp}>
            {/* Sentiment card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-teal-100/30 p-8 mb-4">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-gray-900">Sentiment Breakdown</h4>
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Last 30 days</span>
              </div>
              <div className="space-y-4">
                {sentimentBars.map(bar => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{bar.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{bar.value}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${bar.color}`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${bar.value}%` }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 1, ease: 'easeOut' as const, delay: 0.2 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-gray-400 text-center">
                Generated from 1,247 reviews
              </p>
            </div>

            {/* Key findings card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <SparkleIcon className="w-4 h-4 text-teal-600" />
                <h4 className="font-bold text-gray-900">Key Findings</h4>
              </div>
              <div className="space-y-3">
                {keyFindings.map(finding => (
                  <div
                    key={finding.text}
                    className={`flex items-center gap-3 p-3 rounded-lg border-l-2 ${finding.color} bg-gray-50`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${finding.indicator}`} />
                    <p className="text-sm text-gray-700">{finding.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: text */}
          <motion.div {...fadeInUp}>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              Our AI reads every review, extracts key themes, and generates reports that
              tell you exactly what customers love and what needs improvement. Stop
              guessing — let data drive your decisions.
            </p>
            <ul className="space-y-4 mb-8">
              {insightFeatures.map(feature => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <CheckIcon className="text-amber-600" />
                  </div>
                  <span className="text-gray-700 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-500">
              Generate reports weekly, monthly, or quarterly.
            </p>
          </motion.div>
        </div>

        {/* Tier callout */}
        <motion.p {...fadeInUp} className="text-center mt-12 text-sm text-gray-500">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gray-100 border border-gray-200 shadow-sm">
            3 reports/month on Pro &middot; 10 on Business &middot; 20 on Enterprise
          </span>
        </motion.p>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SECTION 7: CTA
   ════════════════════════════════════════════════════════════════════ */

function CtaSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          {...fadeInUp}
          className="relative bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 rounded-3xl overflow-hidden px-8 py-16 sm:px-16 sm:py-20"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

          <div className="relative text-center">
            <motion.h2
              {...staggerItemInline}
              className="text-3xl md:text-5xl font-bold text-white tracking-tight"
            >
              Let AI handle your reviews
            </motion.h2>

            <motion.p
              {...staggerItemInline}
              className="mt-6 text-lg text-teal-200 max-w-xl mx-auto"
            >
              Join hundreds of businesses saving hours every week with AI-powered
              review management.
            </motion.p>

            <motion.div
              {...staggerItemInline}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="inline-block"
              >
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-600 rounded-2xl text-base font-bold hover:shadow-2xl hover:shadow-teal-900/30 transition-all duration-300 cursor-pointer"
                >
                  Get Started Free
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="inline-block"
              >
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl text-base font-semibold hover:bg-white/20 transition-all duration-300 cursor-pointer"
                >
                  See Pricing
                </Link>
              </motion.div>
            </motion.div>

            <motion.p
              {...staggerItemInline}
              className="mt-4 text-sm text-teal-300"
            >
              No credit card required
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ════════════════════════════════════════════════════════════════════ */

export default function AIPage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <ReplyGenerationSection />
      <BrandVoiceSection />
      <AILearnsSection />
      <CompetitorSection />
      <InsightsSection />
      <CtaSection />
    </main>
  )
}
