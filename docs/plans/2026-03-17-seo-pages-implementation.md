# SEO Marketing Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `/how-it-works` and `/pricing` SEO pages with Framer Motion animations inside a shared marketing route group layout.

**Architecture:** Extract the landing page navbar and footer into shared components. Create an `app/(marketing)/` route group with a layout that wraps all public marketing pages. Each page is a server component (metadata) + client component (animations). Framer Motion handles scroll reveals, staggered animations, and micro-interactions.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, Inter font (already loaded)

**Design doc:** `docs/plans/2026-03-17-seo-pages-design.md`

---

### Task 1: Install Framer Motion

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `npm install framer-motion`

**Step 2: Verify installation**

Run: `npm ls framer-motion`
Expected: `framer-motion@X.X.X` listed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion dependency"
```

---

### Task 2: Extract Navbar component

**Files:**
- Create: `components/marketing/Navbar.tsx`
- Reference: `app/LandingPage.tsx:284-330` (existing navbar code)

**Step 1: Create the Navbar component**

Extract the navbar from `LandingPage.tsx` lines 284-330 into a standalone `'use client'` component. It needs:
- `scrolled` state (scroll listener)
- `mobileMenuOpen` state
- `isLoggedIn` state (fetched from `/api/me`)
- `scrollTo` helper for in-page anchor links (only used on landing page — make optional via prop)
- Navigation links: Features, How It Works, Pricing, FAQ, Log in / Dashboard, Get Started Free / Go to Dashboard
- Add `Link` hrefs to `/how-it-works` and `/pricing` for the new pages
- Accept optional `showAnchorLinks?: boolean` prop — when true, show the `scrollTo` buttons (Features, FAQ); when false, show only page links

The component should use the same Tailwind classes, floating rounded-2xl style, glass blur on scroll, and mobile hamburger menu from the existing landing page.

```tsx
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
```

**Step 2: Commit**

```bash
git add components/marketing/Navbar.tsx
git commit -m "feat: extract shared marketing Navbar component"
```

---

### Task 3: Create Footer component

**Files:**
- Create: `components/marketing/Footer.tsx`

**Step 1: Create the Footer**

A clean marketing footer with:
- AutoMyReply logo + tagline
- **Product** column: How It Works, Pricing, Features (links to `/#features`)
- **Legal** column: Privacy Policy, Terms of Service
- **Support** column: Contact (mailto:automyreply@gmail.com)
- Copyright line at bottom
- Same design language: gray-50 background, teal accents, Inter font, rounded borders

```tsx
import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Image src="/images/amber_teal-logo.png" alt="AutoMyReply" width={28} height={28} className="h-7 w-auto" />
              <span className="text-base font-bold text-gray-900">AutoMyReply</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">AI-powered replies for your Google Business reviews.</p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/how-it-works" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">How It Works</Link></li>
              <li><Link href="/pricing" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Pricing</Link></li>
              <li><Link href="/#features" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Features</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Support</h4>
            <ul className="space-y-3">
              <li><a href="mailto:automyreply@gmail.com" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} AutoMyReply. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
```

**Step 2: Commit**

```bash
git add components/marketing/Footer.tsx
git commit -m "feat: create shared marketing Footer component"
```

---

### Task 4: Create marketing route group and layout

**Files:**
- Create: `app/(marketing)/layout.tsx`
- Move: `app/page.tsx` → `app/(marketing)/page.tsx`
- Move: `app/LandingPage.tsx` → `app/(marketing)/LandingPage.tsx`

**Step 1: Create the marketing layout**

```tsx
import { Navbar } from '@/components/marketing/Navbar'
import { Footer } from '@/components/marketing/Footer'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  )
}
```

Note: The Navbar is NOT in the layout because the landing page currently renders its own navbar inline (with `showAnchorLinks`). The landing page will continue using `<Navbar showAnchorLinks />` inside `LandingPage.tsx`, while the new pages will use `<Navbar />` inside their own client components. This avoids breaking the landing page's anchor-link scroll behavior.

**Step 2: Move landing page files**

```bash
mv app/page.tsx app/(marketing)/page.tsx
mv app/LandingPage.tsx app/(marketing)/LandingPage.tsx
```

**Step 3: Update the import path in page.tsx**

The server wrapper `app/(marketing)/page.tsx` imports `./LandingPage` — this relative path still works after the move since both files are in the same directory.

**Step 4: Update LandingPage.tsx to use the shared Navbar**

Replace the inline navbar code (lines ~284-330 of LandingPage.tsx) with:
```tsx
import { Navbar } from '@/components/marketing/Navbar'
// ... inside the component's return:
<Navbar showAnchorLinks />
```

Remove the inline navbar JSX and the `scrollTo`, `scrolled`, `mobileMenuOpen`, `isLoggedIn` state that was only used by the navbar. Keep any state still needed by the rest of the page.

Wait — `scrollTo` is also used by the hero CTA ("See it in action" button) and potentially other parts. Keep `scrollTo` as a local function in LandingPage. Only move navbar-specific state into the Navbar component.

Actually, simplify: the Navbar component is fully self-contained (has its own scroll/menu/auth state). Just replace the inline navbar JSX in LandingPage with `<Navbar showAnchorLinks />` and remove the now-unused `scrolled`, `mobileMenuOpen`, and the navbar-only `isLoggedIn` state. Keep `isLoggedIn` if it's used elsewhere in the landing page (e.g., CTA buttons). Check the landing page — yes, `isLoggedIn` is used in the hero CTAs too, so keep it.

Remove from LandingPage: `scrolled`, `mobileMenuOpen` state and the scroll event listener for `scrolled`. Keep: `isLoggedIn`, `scrollTo`, `contactOpen`.

Also remove the landing page's inline footer/CTA section at the bottom since the shared Footer in the layout handles that now. Actually — the landing page has a custom CTA section + a minimal contact/footer, not a proper footer. Keep the CTA section in the landing page; the shared Footer below it adds proper navigation links.

**Step 5: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds, landing page at `/` works as before

**Step 6: Commit**

```bash
git add app/(marketing)/ components/marketing/
git commit -m "feat: create marketing route group with shared layout, navbar, and footer"
```

---

### Task 5: Build the `/how-it-works` page

**Files:**
- Create: `app/(marketing)/how-it-works/page.tsx` (server component with metadata)
- Create: `app/(marketing)/how-it-works/HowItWorksPage.tsx` (client component)

**Step 1: Create the server component with metadata**

```tsx
import type { Metadata } from 'next'
import HowItWorksPage from './HowItWorksPage'

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'See how AutoMyReply turns your Google reviews into on-brand AI replies in 3 simple steps. Connect, customize, and respond — all in under 5 minutes.',
  keywords: [
    'how to manage google reviews',
    'google review automation',
    'AI review reply generator',
    'automate google review responses',
    'review management tool',
  ],
  openGraph: {
    title: 'How It Works | AutoMyReply',
    description:
      'See how AutoMyReply turns your Google reviews into on-brand AI replies in 3 simple steps.',
    url: 'https://automyreply.com/how-it-works',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works | AutoMyReply',
    description: 'AI-powered Google review replies in 3 simple steps.',
  },
  alternates: {
    canonical: 'https://automyreply.com/how-it-works',
  },
}

export default function HowItWorks() {
  return <HowItWorksPage />
}
```

**Step 2: Create the client component**

Build `HowItWorksPage.tsx` as a `'use client'` component with these sections. Use Framer Motion throughout:

- `motion.div` with `whileInView={{ opacity: 1, y: 0 }}` `initial={{ opacity: 0, y: 40 }}` `transition={{ duration: 0.6 }}` `viewport={{ once: true, amount: 0.2 }}` for scroll reveals
- Staggered children using `staggerChildren: 0.15` in parent variants
- Spring hover: `whileHover={{ y: -4, boxShadow: '...' }}` on cards
- Import `{ Navbar }` from `@/components/marketing/Navbar`

**Sections:**

**A) Hero**
- Badge pill: "How It Works" with teal styling
- H1: "From setup to first reply in under 5 minutes" with `.text-gradient` on a key phrase
- Subtitle text
- Decorative floating orbs (teal/amber blurred circles, `animate-float`)
- `mesh-gradient` background

**B) Interactive 3-Step Flow**
- Vertical timeline on the left (thin teal line with numbered dots)
- 3 alternating panels (step on left, visual on right, then swap)
- Each step: numbered badge, title, description, and a visual mockup card
- Step 1 visual: "Connect Google" — a card showing a Google logo → checkmark animation
- Step 2 visual: "Set Brand Voice" — a card showing tone options (Professional, Friendly, Casual) with radio-button-style selectors
- Step 3 visual: "Review & Post" — a card showing a star rating, review text, and AI reply typing out
- Use Framer Motion `whileInView` to slide each step in from alternate sides

**C) Competitor Monitoring**
- Section badge: "Competitive Intel"
- H2: "Know exactly where you stand"
- Left side: description text + bullet list of capabilities (side-by-side comparison, sentiment tracking, AI reports, identify weaknesses)
- Right side: animated competitive overview card (matches the landing page's existing competitive card design)
  - Ranked table with Your Business (#1), Competitor A, B, C
  - Star ratings, review counts
  - Cards stack in one by one with staggered animation
- Tier callout badges: "Track 1 competitor on Pro · 5 on Business · 20 on Enterprise"

**D) AI Insights & Reports**
- Section badge: "AI Insights"
- H2: "Turn hundreds of reviews into actionable strategy"
- Left side: animated insights card with:
  - Sentiment breakdown bars (Customer Service 92%, Wait Times 64%, etc.) — bars animate width on scroll
  - Timeframe label: "Last 30 days" / "Last 90 days"
- Right side: description + bullet list:
  - Sentiment trend analysis over time
  - Recurring praise & complaint themes
  - Actionable improvement recommendations
  - Location-by-location comparison
- Report cadence callout: "3 reports/month on Pro · 10 on Business · 20 on Enterprise"

**E) Before/After Comparison**
- Split panel with animated transition
- Left ("Without AutoMyReply"): red/amber tones, stats: "3 day avg response", "23% response rate", unanswered review indicators
- Right ("With AutoMyReply"): green/teal tones, stats: "< 5 second avg response", "100% response rate", all-replied indicators
- Animated counters that tick from before → after values when in view

**F) CTA**
- H2: "Ready to transform your review management?"
- Gradient CTA button → `/login`
- "No credit card required" subtitle
- Teal gradient background with decorative elements

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds, `/how-it-works` renders

**Step 4: Commit**

```bash
git add app/(marketing)/how-it-works/
git commit -m "feat: add /how-it-works SEO page with Framer Motion animations"
```

---

### Task 6: Build the `/pricing` page

**Files:**
- Create: `app/(marketing)/pricing/page.tsx` (server component with metadata)
- Create: `app/(marketing)/pricing/PricingPage.tsx` (client component)

**Step 1: Create the server component with metadata**

```tsx
import type { Metadata } from 'next'
import PricingPage from './PricingPage'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, transparent pricing for AI-powered Google review management. Start free, upgrade as you grow. Plans from $0 to $85/month.',
  keywords: [
    'google review management pricing',
    'review reply tool cost',
    'AI review management plans',
    'google review software pricing',
    'review automation pricing',
  ],
  openGraph: {
    title: 'Pricing | AutoMyReply',
    description:
      'Simple, transparent pricing for AI-powered Google review management. Start free, upgrade as you grow.',
    url: 'https://automyreply.com/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | AutoMyReply',
    description: 'AI review management from $0 to $85/month. Start free, no credit card required.',
  },
  alternates: {
    canonical: 'https://automyreply.com/pricing',
  },
}

export default function Pricing() {
  return <PricingPage />
}
```

**Step 2: Create the client component**

Build `PricingPage.tsx` as a `'use client'` component. Same Framer Motion patterns as how-it-works.

**Sections:**

**A) Hero**
- Badge pill: "Pricing" with emerald styling
- H1: "Simple pricing, powerful results"
- Subtitle: "Start free. Upgrade when you're ready. No hidden fees."
- Minimal hero — clean white background, no orbs

**B) Pricing Cards**
- 4-column grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6`)
- Cards stagger in with `staggerChildren: 0.1`

Pricing data:
```tsx
const PLANS = [
  {
    name: 'Free',
    price: 0,
    period: '/mo',
    description: 'Get started with AI replies',
    features: ['5 reviews / month', 'AI reply generation', '1 location', 'Community support'],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: 15,
    period: '/mo',
    description: 'For growing businesses',
    features: ['50 reviews / month', 'Everything in Free', '3 AI reports / month', '1 competitor tracked', 'Priority support'],
    cta: 'Start with Pro',
    popular: true,
  },
  {
    name: 'Business',
    price: 35,
    period: '/mo',
    description: 'For multi-location teams',
    features: ['200 reviews / month', 'Everything in Pro', '10 AI reports / month', '5 competitors tracked', 'Priority support'],
    cta: 'Go Business',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 85,
    period: '/mo',
    description: 'For agencies & franchises',
    features: ['1,000 reviews / month', 'Everything in Business', '20 AI reports / month', '20 competitors tracked', 'Priority support'],
    cta: 'Go Enterprise',
    popular: false,
  },
]
```

Card design:
- White bg, rounded-2xl, border, padding
- Pro card: teal gradient border (`border-teal-400`), `scale-[1.02]` default, "Most Popular" floating pill badge at top
- Price: large `text-4xl font-bold` with `$` prefix — animate with Framer Motion spring counter on first view
- Feature list with teal checkmark icons
- CTA button at bottom: Pro gets gradient teal bg, others get white/outline
- Hover: `whileHover={{ y: -6 }}` with `transition={{ type: 'spring', stiffness: 300 }}`

**C) Feature Comparison Table**
- Full-width table below cards
- Sticky header row
- Rows animate in with `staggerChildren`

| Feature | Free | Pro | Business | Enterprise |
|---------|------|-----|----------|------------|
| Monthly Reviews | 5 | 50 | 200 | 1,000 |
| AI Reply Generation | ✓ | ✓ | ✓ | ✓ |
| AI Reports / month | — | 3 | 10 | 20 |
| Competitors Tracked | — | 1 | 5 | 20 |
| Priority Support | — | ✓ | ✓ | ✓ |

Use checkmark SVGs (teal) and dash spans (gray) for boolean values. Numeric values displayed as-is.

**D) FAQ Accordion**
- Section heading: "Frequently asked questions"
- 4 items, each with question + answer
- Framer Motion `AnimatePresence` + `motion.div` for smooth height animation on open/close
- Only one open at a time (accordion pattern)

Questions:
1. "Can I switch plans anytime?" → "Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing period."
2. "What happens when I hit my review limit?" → "You'll be notified when you're approaching your limit. You can upgrade your plan or wait until your next billing period when your allowance resets."
3. "Is there a free trial?" → "Our Free plan is free forever with 5 reviews per month. No credit card required. You can upgrade to a paid plan whenever you're ready."
4. "Do unused reviews roll over?" → "Unused reviews do not roll over to the next billing period. Your allowance resets at the start of each billing cycle."

**E) CTA**
- H2: "Still not sure? Start free."
- Subtitle: "No credit card required. Upgrade anytime."
- Gradient CTA button → `/login`
- Teal gradient background matching landing page CTA style

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds, `/pricing` renders

**Step 4: Commit**

```bash
git add app/(marketing)/pricing/
git commit -m "feat: add /pricing SEO page with animated cards and FAQ"
```

---

### Task 7: Update sitemap and internal links

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `app/(marketing)/LandingPage.tsx` (update any "Pricing" anchor links to also link to `/pricing`)

**Step 1: Add new pages to sitemap**

Add `/how-it-works` and `/pricing` to the sitemap entries:

```tsx
{
  url: 'https://automyreply.com/how-it-works',
  lastModified: new Date(),
  changeFrequency: 'monthly',
  priority: 0.8,
},
{
  url: 'https://automyreply.com/pricing',
  lastModified: new Date(),
  changeFrequency: 'monthly',
  priority: 0.8,
},
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add app/sitemap.ts app/(marketing)/LandingPage.tsx
git commit -m "feat: add new pages to sitemap and update internal links"
```

---

### Task 8: Final verification and cleanup

**Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings

**Step 2: Dev server smoke test**

Run: `npm run dev`

Manually verify:
- `/` — landing page loads, navbar has new links (How It Works, Pricing), footer appears
- `/how-it-works` — page loads, all sections visible, animations trigger on scroll
- `/pricing` — page loads, cards render with correct pricing data, FAQ accordion works
- `/sitemap.xml` — contains all 6 pages (/, /how-it-works, /pricing, /login, /privacy, /terms)

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup for SEO marketing pages"
```
