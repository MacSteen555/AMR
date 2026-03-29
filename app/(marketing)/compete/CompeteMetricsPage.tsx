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
  | { kind: 'centered-range'; min: number; max: number; label: string }
  | { kind: 'tiers'; tiers: { label: string; color: string }[] }
  | { kind: 'tags'; tags: { label: string; color: string }[] }

interface MetricDefinition {
  name: string
  accent: string           // tailwind border-l color class
  dot: string              // tailwind bg color for the dot
  what: string
  how: string
  scale?: ScaleType
  why: string
}

interface MetricCategory {
  title: string
  anchor: string
  tint: string             // subtle bg tint for section header
  accentColor: string      // section number color
  lineColor: string        // decorative line color
  metrics: MetricDefinition[]
}

/* ════════════════════════════════════════════════════════════════════
   METRIC DATA
   ════════════════════════════════════════════════════════════════════ */
const categories: MetricCategory[] = [
  {
    title: 'Scoring',
    anchor: 'scoring',
    tint: 'bg-teal-50/50',
    accentColor: 'text-teal-500',
    lineColor: 'bg-teal-300',
    metrics: [
      {
        name: 'Competitive Position Score',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'Where you stand vs competitors in your local market.',
        how: 'We evaluate both rating quality AND review volume. A 5.0 from 5 reviews scores lower than a 4.6 from 200 reviews because volume signals reliability. The score synthesizes your overall rating, review count, sentiment, and response patterns relative to every competitor in your report.',
        scale: {
          kind: 'range',
          min: 0,
          max: 100,
          label: '50 = on par · 75+ = market leader · <30 = significantly behind',
        },
        why: 'Your single number for competitive standing. Track it over time to see if you\'re gaining or losing ground.',
      },
      {
        name: 'Market Momentum',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'Whether you\'re gaining or losing ground relative to competitors.',
        how: 'Compares your recent performance trajectory against competitors\' recent trajectories, weighted against historical baselines. A business that went from 3.8 to 4.2 while competitors held steady shows strong positive momentum.',
        scale: {
          kind: 'centered-range',
          min: -10,
          max: 10,
          label: 'Negative = losing ground · 0 = holding · Positive = gaining',
        },
        why: 'Position tells you where you are. Momentum tells you where you\'re headed.',
      },
      {
        name: 'Rating Gap',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'The numeric difference between your average rating and the competitor average.',
        how: 'Your average star rating minus the mean of all competitors\' averages. Positive means you\'re ahead; negative means you\'re behind.',
        scale: {
          kind: 'centered-range',
          min: -2,
          max: 2,
          label: 'Your avg minus competitor avg',
        },
        why: 'A simple, trackable number for competitive standing that anyone on your team can understand.',
      },
    ],
  },
  {
    title: 'Competitive Pulse',
    anchor: 'pulse',
    tint: 'bg-amber-50/50',
    accentColor: 'text-amber-500',
    lineColor: 'bg-amber-300',
    metrics: [
      {
        name: 'Pulse Headline',
        accent: 'border-l-amber-400',
        dot: 'bg-amber-500',
        what: 'A one-sentence summary of the last 2 weeks of competitive activity.',
        how: 'We read all reviews from the 14-day pulse window for every business in your report and identify the single most notable development — a surge in complaints about a competitor, a spike in your praise, or a shift in customer sentiment.',
        why: 'The "TL;DR" of recent competitive activity. Read this first to know if anything needs your attention right now.',
      },
      {
        name: 'Your Highlights / Competitor Highlights',
        accent: 'border-l-amber-400',
        dot: 'bg-amber-500',
        what: 'Notable observations from recent reviews on each side.',
        how: 'We extract 2\u20134 standout observations per business from the last 14 days. These aren\'t summaries of every review — they\'re the most meaningful signals, like a new recurring complaint or an unusually effusive round of praise.',
        why: 'Know what customers are saying about you and your competitors right now, without reading dozens of reviews.',
      },
      {
        name: 'Immediate Action',
        accent: 'border-l-amber-400',
        dot: 'bg-amber-500',
        what: 'One specific thing you can do this week based on the pulse data.',
        how: 'We identify the highest-leverage tactical move by cross-referencing your recent weaknesses with competitor strengths (or vice versa) within the 14-day window.',
        why: 'Turns pulse data into a concrete next step.',
      },
    ],
  },
  {
    title: 'Trend Analysis',
    anchor: 'trends',
    tint: 'bg-teal-50/50',
    accentColor: 'text-teal-500',
    lineColor: 'bg-teal-300',
    metrics: [
      {
        name: 'Momentum Summary',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'Who is gaining or losing ground over the last 3 months.',
        how: 'We compare the first half of the 90-day window against the second half for each business in your report. Businesses showing consistent improvement in ratings, volume, or sentiment are flagged as gaining momentum.',
        why: '14 days is noise. 90 days reveals signal. This is where real patterns become visible.',
      },
      {
        name: 'Emerging Themes',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'Topics that are new, growing, or fading in customer conversation.',
        how: 'We track theme frequency and sentiment across the full 90-day window. Themes are classified by trajectory: emerging (recently appeared), accelerating (growing in frequency), fading (declining in mentions), or persistent (steady presence).',
        scale: {
          kind: 'tags',
          tags: [
            { label: 'emerging', color: 'bg-violet-100 text-violet-700' },
            { label: 'accelerating', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'fading', color: 'bg-gray-100 text-gray-600' },
            { label: 'persistent', color: 'bg-sky-100 text-sky-700' },
          ],
        },
        why: 'Catch trends before they become entrenched problems — or capitalize on opportunities before competitors notice them.',
      },
      {
        name: 'Gap Movement',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'Whether competitive gaps in specific themes are getting bigger or smaller.',
        how: 'We compare theme-level sentiment for you vs competitors across the 90-day window, tracking how those gaps evolve. A "widening" gap means the leader is pulling further ahead; a "closing" gap means the trailer is catching up.',
        scale: {
          kind: 'tags',
          tags: [
            { label: 'widening', color: 'bg-red-100 text-red-700' },
            { label: 'closing', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'stable', color: 'bg-gray-100 text-gray-600' },
          ],
        },
        why: 'Know which competitive battles you\'re winning and which ones are slipping away.',
      },
    ],
  },
  {
    title: 'Market Position',
    anchor: 'market-position',
    tint: 'bg-slate-50/50',
    accentColor: 'text-slate-500',
    lineColor: 'bg-slate-300',
    metrics: [
      {
        name: 'Position Narrative',
        accent: 'border-l-slate-400',
        dot: 'bg-slate-500',
        what: 'The full competitive story based on 6 months of review data.',
        how: 'We synthesize the entire 6-month review corpus into a structural analysis: who dominates, who\'s rising, who\'s falling, and what dynamics are shaping the local market.',
        why: 'The boardroom view of your competitive landscape. Context for every other metric in the report.',
      },
      {
        name: 'Enduring Strengths / Weaknesses',
        accent: 'border-l-slate-400',
        dot: 'bg-slate-500',
        what: 'Themes where you consistently outperform (or underperform) competitors over 6 months.',
        how: 'We identify themes with persistent positive or negative sentiment gaps between you and competitors. A strength must show consistent advantage across months, not just a one-time spike.',
        why: 'These are your structural advantages and liabilities — the things that define your competitive identity in the market.',
      },
      {
        name: 'Structural Advantages / Disadvantages',
        accent: 'border-l-slate-400',
        dot: 'bg-slate-500',
        what: 'Competitive edges that are hard to replicate, or weaknesses that are hard to overcome.',
        how: 'We identify moat-like strengths (e.g., location, long-tenured staff, unique offerings) and deep-rooted weaknesses (e.g., infrastructure, fundamental service model issues) from 6 months of review patterns.',
        why: 'Guides long-term strategy. A structural advantage is worth protecting; a structural disadvantage may require fundamental changes, not just tactical fixes.',
      },
    ],
  },
  {
    title: 'Head-to-Head',
    anchor: 'head-to-head',
    tint: 'bg-teal-50/50',
    accentColor: 'text-teal-500',
    lineColor: 'bg-teal-300',
    metrics: [
      {
        name: 'Head-to-Head Comparison',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'A per-competitor breakdown of how you stack up individually.',
        how: 'Compares your rating, review volume, and thematic strengths/weaknesses against each competitor individually rather than against the group average.',
        why: 'Aggregate data hides per-competitor dynamics. You might lead the pack overall but trail one specific rival in a critical area.',
      },
      {
        name: 'Thematic Gaps',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'Where customer sentiment differs most between you and each competitor.',
        how: 'We compare customer sentiment per theme across your reviews and each competitor\'s reviews. Each theme is classified by its competitive implications.',
        scale: {
          kind: 'tags',
          tags: [
            { label: 'advantage', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'disadvantage', color: 'bg-red-100 text-red-700' },
            { label: 'opportunity', color: 'bg-amber-100 text-amber-700' },
            { label: 'threat', color: 'bg-rose-100 text-rose-700' },
          ],
        },
        why: 'Know exactly where you win and where you lose against each specific competitor.',
      },
    ],
  },
  {
    title: 'Intelligence',
    anchor: 'intelligence',
    tint: 'bg-amber-50/50',
    accentColor: 'text-amber-500',
    lineColor: 'bg-amber-300',
    metrics: [
      {
        name: 'Threat Alerts',
        accent: 'border-l-rose-400',
        dot: 'bg-rose-500',
        what: 'Genuine competitive threats requiring your attention.',
        how: 'We flag competitors who are improving in your weak areas, gaining review velocity, or showing momentum in themes where you\'re stagnant. Maximum 3 alerts per report — we never fabricate threats to fill space.',
        scale: {
          kind: 'tiers',
          tiers: [
            { label: 'LOW', color: 'bg-amber-100 text-amber-700' },
            { label: 'MEDIUM', color: 'bg-orange-100 text-orange-700' },
            { label: 'HIGH', color: 'bg-rose-100 text-rose-700' },
          ],
        },
        why: 'Your early warning system. Know about competitive threats before they become competitive losses.',
      },
      {
        name: 'Steal-Worthy',
        accent: 'border-l-amber-400',
        dot: 'bg-amber-500',
        what: 'Things competitors\' customers love that you can learn from.',
        how: 'We surface actual quotes from competitor reviews that highlight things they do exceptionally well. These aren\'t generic observations — they\'re specific, actionable practices backed by real customer praise.',
        why: 'Learn from the best in your market. Every great idea doesn\'t have to be your own.',
      },
      {
        name: 'Opportunities',
        accent: 'border-l-amber-400',
        dot: 'bg-amber-500',
        what: 'Gaps no one is filling, or competitor weaknesses you can exploit.',
        how: 'We identify themes where all competitors get criticized, or where no business in the market excels. Each opportunity is rated by potential impact and estimated implementation effort.',
        scale: {
          kind: 'tags',
          tags: [
            { label: 'high impact', color: 'bg-emerald-100 text-emerald-700' },
            { label: 'low effort', color: 'bg-sky-100 text-sky-700' },
            { label: 'high effort', color: 'bg-amber-100 text-amber-700' },
          ],
        },
        why: 'Low-hanging competitive fruit. These are the moves with the best return on effort.',
      },
    ],
  },
  {
    title: 'Comparison Stats',
    anchor: 'comparison-stats',
    tint: 'bg-teal-50/50',
    accentColor: 'text-teal-500',
    lineColor: 'bg-teal-300',
    metrics: [
      {
        name: 'Response Rate Comparison',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'How actively each business responds to its reviews.',
        how: 'Calculates the percentage of reviews that have an owner response for each business in the report. Compared side-by-side so you can see where you stand.',
        scale: { kind: 'range', min: 0, max: 100, label: 'Response %' },
        why: 'Response rate signals customer engagement and directly affects local SEO ranking.',
      },
      {
        name: 'Sentiment Comparison',
        accent: 'border-l-teal-500',
        dot: 'bg-teal-500',
        what: 'Overall customer mood for each business, beyond star ratings.',
        how: 'We assign a 0\u2013100 sentiment score based on review language, tone, and context. A 4-star review saying "it was fine I guess" scores differently from one saying "absolutely loved it." Compared across all businesses in the report.',
        scale: { kind: 'range', min: 0, max: 100, label: 'Sentiment' },
        why: 'Ratings tell you the score. Sentiment tells you the mood. Two businesses with identical ratings can have very different customer sentiment.',
      },
    ],
  },
  {
    title: 'Report Continuity',
    anchor: 'continuity',
    tint: 'bg-slate-50/50',
    accentColor: 'text-slate-500',
    lineColor: 'bg-slate-300',
    metrics: [
      {
        name: 'Delta Comparison',
        accent: 'border-l-slate-400',
        dot: 'bg-slate-500',
        what: 'What changed since the last time you ran a competitive report.',
        how: 'Compares current scores, themes, and alerts against the previous report\'s data. Tracks new threats vs resolved threats, improved themes vs declined themes, and score movements. If this is your first report, this section is skipped.',
        why: 'Often the most useful data in the entire report: "what\'s different this time?" Progress becomes visible when you can compare reports over time.',
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

function CenteredRangeScale({ min, max, label }: { min: number; max: number; label: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1 font-medium">
        <span>{min}</span>
        <span className="text-gray-500">{label}</span>
        <span>+{max}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-10" />
        {/* Positive fill from center */}
        <div
          className="absolute top-0 bottom-0 rounded-r-full"
          style={{
            left: '50%',
            width: '30%',
            background: 'linear-gradient(90deg, #5eead4 0%, #0d9488 100%)',
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
    case 'centered-range':
      return <CenteredRangeScale min={scale.min} max={scale.max} label={scale.label} />
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
    <div className={`group bg-white rounded-2xl border border-gray-100 p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-teal-500/5 relative overflow-hidden`}>
      {/* Left accent border */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${metric.accent} opacity-40 group-hover:opacity-100 transition-opacity duration-300`} />

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
   NAVBAR (inline)
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
          <Link href="/insights" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Insights</Link>
          <span className="text-sm text-teal-600 font-semibold">Competitive</span>
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
          <Link href="/insights" className="block text-sm text-gray-600 hover:text-gray-900 py-2">Insights</Link>
          <span className="block text-sm text-teal-600 font-semibold py-2">Competitive</span>
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
   TIME HORIZON CARD
   ════════════════════════════════════════════════════════════════════ */
function HorizonCard({ color, label, window, description }: { color: string; label: string; window: string; description: string }) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-gray-400 font-medium">
          {window}
        </span>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">
        {description}
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function CompeteMetricsPage() {
  const heroRef = useReveal()
  const horizonsRef = useReveal()
  const pipelineRef = useReveal()
  const volumeRef = useReveal()
  const ctaRef = useReveal()
  const categoryRefs = categories.map(() => useReveal()) // eslint-disable-line react-hooks/rules-of-hooks

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 antialiased">

      <Nav />

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative pt-36 overflow-hidden">
        {/* Dot-pattern background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(20,184,166,0.06) 0%, transparent 70%)',
          }}
        />

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
            Understanding Competitive Analytics
          </h1>

          <p
            className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
                     >
            Your competitive report analyzes real customer reviews across three time horizons.
            Here&apos;s exactly how we measure your market position, track momentum, and identify opportunities.
          </p>

          {/* Decorative divider */}
          <div className="mt-10 flex items-center justify-center gap-2">
            <span className="block w-8 h-px bg-teal-300" />
            <span className="block w-2 h-2 rounded-full bg-teal-400" />
            <span className="block w-8 h-px bg-teal-300" />
          </div>
        </div>
      </section>

      {/* ════════════════ TIME HORIZONS ════════════════ */}
      <section className="relative py-16 bg-white border-y border-gray-100">
        <div ref={horizonsRef} className="reveal max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2
              className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3"
                         >
              Three Time Horizons
            </h2>
            <p
              className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed"
                         >
              Each section of your report focuses on a specific time window. Pulse reviews are a subset
              of trend reviews, which are a subset of all reviews analyzed for market position.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <HorizonCard
              color="bg-amber-50/70 border-amber-200/60 text-amber-700"
              label="Pulse"
              window="14 days"
              description="What's happening right now. Recent competitive activity, notable shifts, and immediate tactical opportunities."
            />
            <HorizonCard
              color="bg-teal-50/70 border-teal-200/60 text-teal-700"
              label="Trends"
              window="90 days"
              description="What patterns are forming. Momentum shifts, emerging themes, and gap movements that separate signal from noise."
            />
            <HorizonCard
              color="bg-slate-50/70 border-slate-200/60 text-slate-700"
              label="Market Position"
              window="6 months"
              description="Where you stand structurally. Enduring strengths, deep-rooted weaknesses, and the full competitive narrative."
            />
          </div>

          {/* Nesting visual */}
          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-200 border border-amber-300" />
              <span className="text-gray-300">&sub;</span>
              <span className="inline-block w-4 h-4 rounded-full bg-teal-200 border border-teal-300" />
              <span className="text-gray-300">&sub;</span>
              <span className="inline-block w-5 h-5 rounded-full bg-slate-200 border border-slate-300" />
              <span className="ml-2 text-gray-500">Each horizon nests inside the next</span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ DATA PIPELINE ════════════════ */}
      <section className="relative py-16 bg-gray-50/50">
        <div ref={pipelineRef} className="reveal max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Fully Automated, Every Two Weeks</h2>
          <p className="text-center text-gray-500 text-sm mb-12 max-w-2xl mx-auto leading-relaxed">
            You add a competitor once. From that point on, we handle everything: syncing their latest reviews from Google,
            analyzing them alongside yours across all three time horizons, and generating a fresh competitive report.
            No buttons to click, no reports to request. It just happens.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'We sync reviews', desc: 'Every two weeks, we automatically pull the latest reviews from Google for your business and every competitor you track.' },
              { step: '2', title: 'We compute stats', desc: 'Ratings, volumes, response rates, and sentiment are calculated per business across each time horizon (14 days, 90 days, 6 months).' },
              { step: '3', title: 'We analyze and compare', desc: 'Our analysis engine reads the reviews side-by-side, identifies competitive patterns, and scores your market position.' },
              { step: '4', title: 'Your report is ready', desc: 'A fresh competitive report appears in your dashboard with pulse, trends, and market position sections. Previous reports are saved for comparison.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 text-teal-700 text-sm font-bold mb-3 border border-teal-100">
                  {item.step}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-teal-900 mb-1">Delta tracking built in</h3>
                <p className="text-sm text-teal-800/70 leading-relaxed">
                  Each new report is automatically compared against the previous one. You will see what changed: score shifts, new threats,
                  resolved issues, and themes that improved or declined. This means you can track competitive progress over time without
                  manually comparing reports.
                </p>
              </div>
            </div>
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
                  className={`text-xs font-bold tabular-nums ${cat.accentColor}`}
                                 >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={`block w-8 h-px ${cat.lineColor}`} />
                <h2
                  className="text-2xl sm:text-3xl font-bold text-gray-900"
                                 >
                  {cat.title}
                </h2>
              </div>

              {/* Subtle section tint indicator for time-horizon categories */}
              {(cat.anchor === 'pulse' || cat.anchor === 'trends' || cat.anchor === 'market-position') && (
                <div className={`-mx-2 px-2 py-1 rounded-lg ${cat.tint} mb-6`}>
                  <p className="text-xs text-gray-400 font-medium">
                    {cat.anchor === 'pulse' && 'Time horizon: 14 days'}
                    {cat.anchor === 'trends' && 'Time horizon: 90 days'}
                    {cat.anchor === 'market-position' && 'Time horizon: 6 months'}
                  </p>
                </div>
              )}

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

      {/* ════════════════ VOLUME & CONFIDENCE ════════════════ */}
      <section className="py-16 px-6 bg-white border-y border-gray-100">
        <div ref={volumeRef} className="reveal max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3"
                         >
              Volume &amp; Confidence
            </h2>
            <p
              className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed"
                         >
              We treat review volume as a trust multiplier. More data means higher confidence in every score and comparison.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-amber-50/60 rounded-xl border border-amber-200/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Low Volume
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Fewer than 10 reviews triggers low-confidence flagging. Scores are still calculated but clearly marked as preliminary.
              </p>
            </div>
            <div className="bg-sky-50/60 rounded-xl border border-sky-200/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                  Standard Volume
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Sufficient reviews for reliable comparisons. Full analysis is generated with appropriate confidence levels.
              </p>
            </div>
            <div className="bg-teal-50/60 rounded-xl border border-teal-200/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-teal-400" />
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  High Volume
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Rich data enables granular competitive intelligence with high-confidence scoring and detailed thematic analysis.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p
              className="text-sm text-gray-500 leading-relaxed italic max-w-lg mx-auto"
                         >
              We&apos;d rather tell you we don&apos;t have enough data than make a confident claim from 3 reviews.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════ CTA ════════════════ */}
      <section className="py-20 px-6 bg-gradient-to-br from-teal-50 via-teal-50/50 to-white">
        <div ref={ctaRef} className="reveal max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
                     >
            See how you stack up
          </h2>
          <p
            className="text-gray-600 mb-8 leading-relaxed"
                     >
            Run a competitive analysis against your local rivals. Real reviews, real data,
            no black boxes.
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
                <li><Link href="/insights" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Insights Metrics</Link></li>
                <li><span className="text-sm text-teal-600 font-medium">Competitive Metrics</span></li>
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
