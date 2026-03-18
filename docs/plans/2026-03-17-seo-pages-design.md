# SEO Marketing Pages Design

**Date:** 2026-03-17
**Pages:** `/how-it-works`, `/pricing`
**Approach:** Shared marketing layout (Route Group B)

## Architecture

### Route Structure

```
app/(marketing)/
  layout.tsx              # Shared navbar + footer + Framer Motion page transitions
  page.tsx                # Landing page server wrapper (moved from app/)
  LandingPage.tsx         # Landing page client component (moved from app/)
  how-it-works/
    page.tsx              # Server component (metadata)
    HowItWorksPage.tsx    # Client component (animations)
  pricing/
    page.tsx              # Server component (metadata)
    PricingPage.tsx        # Client component (animations)

components/marketing/
  Navbar.tsx              # Extracted from landing page
  Footer.tsx              # New — links to all marketing pages
```

### Dependencies

- `framer-motion` — scroll-triggered reveals, staggered animations, page transitions, spring physics hover effects

### Design Language (matches existing landing page)

- **Palette:** Teal (primary), amber (accent), gray (neutral), emerald (success)
- **Font:** Inter (already loaded)
- **Shapes:** rounded-2xl/3xl cards, gradient pills/badges above headings
- **Patterns:** mesh gradients, dot patterns, glass cards, floating orbs
- **Animations:** Framer Motion `whileInView`, stagger children, spring hover lifts

---

## `/how-it-works` Page

### SEO Metadata

- Title: "How It Works"
- Description: "See how AutoMyReply turns your Google reviews into on-brand AI replies in 3 simple steps. Connect, customize, and respond — all in under 5 minutes."

### Sections

1. **Hero** — "How AutoMyReply Works" headline with animated gradient text, subtitle, decorative floating orbs

2. **Interactive 3-Step Flow** — Expanded visual walkthrough:
   - Step 1: Connect Google — OAuth mockup with animated connection
   - Step 2: Set Brand Voice — tone config panel mockup
   - Step 3: Review & Post — typewriter AI reply demo
   - Vertical animated timeline connecting steps, progress dots fill on scroll
   - Steps reveal from alternating sides (left/right/left)

3. **Competitor Monitoring** — "Know exactly where you stand"
   - Animated competitive overview dashboard mockup
   - Ranked table: your business vs. competitors (star ratings, review counts, response rates)
   - Tier limit callouts (1/5/20 competitors per tier)
   - Cards stack in one by one on scroll

4. **AI Insights & Reports** — "Turn hundreds of reviews into actionable strategy"
   - Timeframe showcase: weekly, monthly, quarterly report periods
   - Animated metrics: sentiment breakdown bars, recurring themes, trend lines, location comparison
   - Report cadence callout: 3/10/20 reports per tier
   - Staggered card reveals

5. **Before/After Comparison** — Split panel:
   - Without: unanswered reviews, red indicators, "3 days avg response"
   - With: all replied, green indicators, "< 5s avg response"
   - Animated counters transitioning between states

6. **CTA** — "Ready to get started?" with gradient button to `/login`

---

## `/pricing` Page

### SEO Metadata

- Title: "Pricing"
- Description: "Simple, transparent pricing for AI-powered Google review management. Start free, upgrade as you grow. Plans from $0 to $85/month."

### Pricing Data

| | FREE | PRO | BUSINESS | ENTERPRISE |
|---|---|---|---|---|
| Price | $0/mo | $15/mo | $35/mo | $85/mo |
| Reviews/mo | 5 | 50 | 200 | 1,000 |
| AI Reports/mo | -- | 3 | 10 | 20 |
| Competitors | -- | 1 | 5 | 20 |
| Priority Support | -- | Yes | Yes | Yes |

PRO is marked "Most Popular."

### Sections

1. **Hero** — "Simple pricing, powerful results" headline, "Start free. Upgrade when you're ready." subtitle

2. **Pricing Cards** — 4-column grid (stacks mobile):
   - PRO highlighted with teal border, slight scale-up, "Most Popular" pill
   - Cards stagger in with Framer Motion
   - Price spring counter animation
   - Hover: lift + shadow + border glow

3. **Feature Comparison Table** — Full breakdown with sticky header, row-by-row reveal

4. **FAQ Accordion** — Smooth Framer Motion height animations:
   - "Can I switch plans anytime?"
   - "What happens when I hit my review limit?"
   - "Is there a free trial?"
   - "Do unused reviews roll over?"

5. **CTA** — "Still not sure? Start free — no credit card required."
