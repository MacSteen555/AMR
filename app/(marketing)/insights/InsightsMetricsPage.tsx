'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

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
   TYPES
   ════════════════════════════════════════════════════════════════════ */
type ScaleType =
  | { kind: 'range'; min: number; max: number; label: string }
  | { kind: 'tiers'; tiers: { label: string; color: string }[] }
  | { kind: 'tags'; tags: { label: string; color: string }[] }

interface MetricDefinition {
  name: string
  dot: string            // tailwind bg color for the dot
  what: string
  how: string
  scale?: ScaleType
  why: string
}

interface MetricCategory {
  title: string
  anchor: string
  metrics: MetricDefinition[]
}

/* ════════════════════════════════════════════════════════════════════
   METRIC DATA
   ════════════════════════════════════════════════════════════════════ */
const categories: MetricCategory[] = [
  {
    title: 'Report Overview',
    anchor: 'overview',
    metrics: [
      {
        name: 'Adaptive Window',
        dot: 'bg-gray-400',
        what: 'The time period your report covers.',
        how: 'Starts at 30 days, then expands to 60 or 90 until both the current and comparison periods have enough reviews to produce a meaningful analysis.',
        why: 'Ensures you always get a meaningful comparison, even with low review volume.',
      },
      {
        name: 'Confidence Level',
        dot: 'bg-gray-400',
        what: 'How reliable the analysis is based on data volume.',
        how: 'Determined by the number of reviews in your analysis window. Fewer than 10 reviews yields LOW confidence with minimal analysis. 10–50 reviews yields STANDARD confidence with full analysis and appropriate hedging. More than 50 reviews yields HIGH confidence with rich, detailed analysis.',
        scale: {
          kind: 'tiers',
          tiers: [
            { label: 'LOW', color: 'bg-amber-100 text-amber-700' },
            { label: 'STANDARD', color: 'bg-sky-100 text-sky-700' },
            { label: 'HIGH', color: 'bg-teal-100 text-teal-700' },
          ],
        },
        why: 'Prevents over-interpreting thin data.',
      },
    ],
  },
  {
    title: 'Snapshot & Trends',
    anchor: 'trends',
    metrics: [
      {
        name: '30-Day Snapshot',
        dot: 'bg-teal-500',
        what: 'Quick-hit insights about what happened this month.',
        how: 'We compare the last 30 days of reviews against your all-time patterns and identify what\'s different or notable: spikes, dips, emerging praise or complaints.',
        why: 'Gives you the "pulse" of your business without requiring you to read every review.',
      },
      {
        name: 'Trend Stats',
        dot: 'bg-gray-400',
        what: 'Numeric comparison between your current and previous period.',
        how: 'Pre-computed averages, review counts, response rates, and 5-star percentages for both the current and comparison periods.',
        why: 'Hard numbers you can track over time and share with your team.',
      },
      {
        name: 'Rating Trend',
        dot: 'bg-teal-500',
        what: 'Whether your average rating is going up, down, or flat.',
        how: 'Compares the current period\'s average star rating against the previous period\'s average.',
        scale: {
          kind: 'tags',
          tags: [
            { label: 'improving', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'stable', color: 'bg-gray-100 text-gray-600' },
            { label: 'declining', color: 'bg-red-100 text-red-700' },
          ],
        },
        why: 'Your most fundamental health indicator.',
      },
      {
        name: 'Sentiment Score',
        dot: 'bg-teal-500',
        what: 'Overall customer mood beyond just star ratings.',
        how: 'We analyze review text and assign a 0–100 score based on language, tone, and context. A 4-star review that says "it was fine I guess" scores differently from one that says "absolutely loved it."',
        scale: { kind: 'range', min: 0, max: 100, label: 'Sentiment' },
        why: 'Captures nuance that star ratings miss.',
      },
    ],
  },
  {
    title: 'Themes & Patterns',
    anchor: 'themes',
    metrics: [
      {
        name: 'Themes',
        dot: 'bg-amber-500',
        what: 'Recurring topics customers mention in their reviews.',
        how: 'We read every review and cluster mentions into themes such as "Staff friendliness," "Wait times," or "Food quality." Each theme tracks mention count, sentiment, sub-themes, and trend direction.',
        why: 'Tells you what customers actually care about.',
      },
      {
        name: 'Theme Trend Direction',
        dot: 'bg-amber-500',
        what: 'Whether a theme is getting more or less attention over time.',
        how: 'Compares mention frequency in the current period versus the previous period.',
        scale: {
          kind: 'tags',
          tags: [
            { label: 'up', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'down', color: 'bg-red-100 text-red-700' },
            { label: 'stable', color: 'bg-gray-100 text-gray-600' },
            { label: 'new', color: 'bg-violet-100 text-violet-700' },
          ],
        },
        why: 'A "new" negative theme is an early warning. A "stable" positive theme is a core strength.',
      },
      {
        name: 'Sub-themes',
        dot: 'bg-amber-500',
        what: 'Granular breakdown within a parent theme.',
        how: 'For example, "Staff" might split into "Friendliness," "Knowledge," and "Response time." Each sub-theme carries its own sentiment and mention count.',
        why: 'Tells you specifically what to fix or maintain within a broader area.',
      },
    ],
  },
  {
    title: 'Strengths & Weaknesses',
    anchor: 'strengths',
    metrics: [
      {
        name: 'Key Strengths',
        dot: 'bg-teal-500',
        what: 'Areas where your reviews consistently shine.',
        how: 'We identify themes with high mention counts and positive sentiment, supported by specific customer quotes.',
        why: 'Know what to protect and promote.',
      },
      {
        name: 'Key Weaknesses',
        dot: 'bg-teal-500',
        what: 'Areas where your reviews reveal recurring problems.',
        how: 'Themes with negative sentiment, each rated by severity so you can prioritize.',
        why: 'Know what to fix first.',
      },
      {
        name: 'Severity Rating',
        dot: 'bg-teal-500',
        what: 'How damaging a weakness is to your business.',
        how: 'We assess severity based on complaint frequency, intensity of language, and whether the issue affects core business operations.',
        scale: {
          kind: 'tiers',
          tiers: [
            { label: 'LOW', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'MEDIUM', color: 'bg-amber-100 text-amber-700' },
            { label: 'HIGH', color: 'bg-red-100 text-red-700' },
          ],
        },
        why: 'Prioritize fixes by real-world impact.',
      },
    ],
  },
  {
    title: 'Timeline & History',
    anchor: 'timeline',
    metrics: [
      {
        name: 'Monthly Timeline',
        dot: 'bg-gray-400',
        what: 'Month-by-month view of your review performance.',
        how: 'Groups reviews by calendar month, computes average rating and review count, and identifies the dominant themes for each month.',
        why: 'Spot seasonal patterns and turning points.',
      },
      {
        name: 'Timeline Insights',
        dot: 'bg-gray-400',
        what: 'Narrative observations about month-over-month patterns.',
        how: 'We look for theme emergence and disappearance, sentiment shifts, and correlations between themes and rating changes.',
        why: 'Connects the dots between isolated data points.',
      },
    ],
  },
  {
    title: 'Recommendations',
    anchor: 'recommendations',
    metrics: [
      {
        name: 'Recommendations',
        dot: 'bg-teal-500',
        what: 'Specific actions to improve your business based on your review data.',
        how: 'We generate recommendations based on identified weaknesses, competitive gaps, and untapped opportunities. Each is rated by expected impact and implementation effort.',
        why: 'Turns data into action.',
      },
      {
        name: 'Response Rate',
        dot: 'bg-gray-400',
        what: 'How often you reply to your reviews.',
        how: 'Percentage of reviews that have a posted or synced reply across the analysis period.',
        scale: { kind: 'range', min: 0, max: 100, label: 'Response %' },
        why: 'Responding to reviews improves customer trust and local SEO.',
      },
    ],
  },
]

/* ════════════════════════════════════════════════════════════════════
   SCALE RENDERERS
   ════════════════════════════════════════════════════════════════════ */
function RangeScale({ min, max, label }: { min: number; max: number; label: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1 font-medium">
        <span>{min}</span>
        <span className="text-gray-500">{label}</span>
        <span>{max}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: '72%',
            background: 'linear-gradient(90deg, #99f6e4 0%, #0d9488 100%)',
          }}
        />
      </div>
    </div>
  )
}

function TierScale({ tiers }: { tiers: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      {tiers.map((t) => (
        <span
          key={t.label}
          className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${t.color}`}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

function TagScale({ tags }: { tags: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      {tags.map((t) => (
        <span
          key={t.label}
          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${t.color}`}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

function ScaleVisual({ scale }: { scale: ScaleType }) {
  switch (scale.kind) {
    case 'range':
      return <RangeScale min={scale.min} max={scale.max} label={scale.label} />
    case 'tiers':
      return <TierScale tiers={scale.tiers} />
    case 'tags':
      return <TagScale tags={scale.tags} />
  }
}

/* ════════════════════════════════════════════════════════════════════
   METRIC CARD
   ════════════════════════════════════════════════════════════════════ */
function MetricCard({ metric }: { metric: MetricDefinition }) {
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-teal-500/5 relative overflow-hidden">
      {/* Left accent border */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-teal-500/40 group-hover:bg-teal-500 transition-colors duration-300" />

      {/* Metric name */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`inline-block w-2 h-2 rounded-full ${metric.dot} shrink-0`} />
        <h3 className="text-lg font-bold text-gray-900" >
          {metric.name}
        </h3>
      </div>

      {/* What it measures */}
      <div className="mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">
          What it measures
        </span>
        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">
          {metric.what}
        </p>
      </div>

      {/* How it's calculated */}
      <div className="mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          How it&apos;s calculated
        </span>
        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">
          {metric.how}
        </p>
      </div>

      {/* Scale (optional) */}
      {metric.scale && (
        <div className="mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Scale
          </span>
          <ScaleVisual scale={metric.scale} />
        </div>
      )}

      {/* Why it matters */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Why it matters
        </span>
        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed font-medium">
          {metric.why}
        </p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   NAVBAR
   ════════════════════════════════════════════════════════════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

        <div className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Features</Link>
          <span className="text-sm text-teal-600 font-semibold">Insights</span>
          <Link href="/compete" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Competitive</Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Log in</Link>
          <Link href="/login" className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-teal-200 transition-all duration-300">
            Get Started Free
          </Link>
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 cursor-pointer" aria-label="Toggle menu">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 px-6 py-4 bg-white rounded-b-2xl space-y-3">
          <Link href="/#features" className="block text-sm text-gray-600 hover:text-gray-900 py-2">Features</Link>
          <span className="block text-sm text-teal-600 font-semibold py-2">Insights</span>
          <Link href="/compete" className="block text-sm text-gray-600 hover:text-gray-900 py-2">Competitive</Link>
          <Link href="/login" className="block text-sm text-gray-600 hover:text-gray-900 py-2">Log in</Link>
          <Link href="/login" className="block w-full text-center px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-semibold">
            Get Started Free
          </Link>
        </div>
      )}
    </nav>
  )
}

/* ════════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function InsightsMetricsPage() {
  const heroRef = useReveal()
  const pipelineRef = useReveal()
  const ctaRef = useReveal()
  const categoryRefs = categories.map(() => useReveal()) // eslint-disable-line react-hooks/rules-of-hooks

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 antialiased">

      <Nav />

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative pt-36 overflow-hidden">
        {/* Dot-pattern background */}
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
        <div className="absolute inset-0 mesh-gradient pointer-events-none" />

        <div
          ref={heroRef}
          className="reveal relative max-w-3xl mx-auto text-center px-6 pt-20 pb-16"
          style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          {/* Badge */}
          <div className="mb-5">
            <span
              className="inline-block px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded-full bg-teal-50 text-teal-700 border border-teal-100"
            >
              Methodology
            </span>
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6"
                     >
            Understanding Your Insights
          </h1>

          <p
            className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
          >
            Every metric in your report is grounded in real review data. Here&apos;s exactly how we
            analyze your reviews, what each metric measures, and how to act on what you find.
          </p>

          {/* Decorative divider */}
          <div className="mt-10 flex items-center justify-center gap-2">
            <span className="block w-8 h-px bg-teal-300" />
            <span className="block w-2 h-2 rounded-full bg-teal-400" />
            <span className="block w-8 h-px bg-teal-300" />
          </div>
        </div>
      </section>

      {/* ════════════════ DATA PIPELINE ════════════════ */}
      <section className="relative py-16 bg-white border-y border-gray-100">
        <div ref={pipelineRef} className="reveal max-w-3xl mx-auto px-6">
          <p
            className="text-center text-gray-500 text-sm mb-10 max-w-xl mx-auto leading-relaxed"
          >
            Your reviews are analyzed using a combination of statistical computation
            and pattern interpretation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'We collect your reviews', desc: 'Reviews are synced from your Google Business Profile in real time.' },
              { step: '2', title: 'We compute statistics', desc: 'Averages, counts, trends, and response rates are calculated across time periods.' },
              { step: '3', title: 'We interpret patterns', desc: 'Our analysis engine reads the text, identifies themes, and generates narrative insights.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 text-teal-700 text-sm font-bold mb-3 border border-teal-100"
                >
                  {item.step}
                </div>
                <h3
                  className="text-sm font-bold text-gray-900 mb-1"
                                 >
                  {item.title}
                </h3>
                <p
                  className="text-xs text-gray-500 leading-relaxed"
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ METRIC SECTIONS ════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto space-y-20">
          {categories.map((cat, i) => (
            <div key={cat.anchor} id={cat.anchor} ref={categoryRefs[i]} className="reveal">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-8">
                <span
                  className="text-xs font-bold text-teal-500 tabular-nums"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="block w-8 h-px bg-teal-300" />
                <h2
                  className="text-2xl sm:text-3xl font-bold text-gray-900"
                                 >
                  {cat.title}
                </h2>
              </div>

              {/* Metric cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {cat.metrics.map((m) => (
                  <MetricCard key={m.name} metric={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════ CTA ════════════════ */}
      <section className="py-20 px-6 bg-gradient-to-br from-teal-50 via-teal-50/50 to-white">
        <div ref={ctaRef} className="reveal max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
                     >
            See your own insights
          </h2>
          <p
            className="text-gray-600 mb-8 leading-relaxed"
          >
            Connect your Google Business Profile and get a full analysis of your
            reviews—themes, sentiment, trends, and actionable recommendations.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
          >
            Get Started
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Image src="/images/amber_teal-logo.png" alt="AutoMyReply" width={32} height={32} className="h-8 w-auto" />
                <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mt-2 max-w-sm">
                Intelligent review management for Google Business Profile. Every metric explained.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Methodology</h4>
              <ul className="space-y-3">
                <li><span className="text-sm text-teal-600 font-medium">Insights Metrics</span></li>
                <li><Link href="/compete" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Competitive Metrics</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Company</h4>
              <ul className="space-y-3">
                <li><Link href="/terms" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} AutoMyReply. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
