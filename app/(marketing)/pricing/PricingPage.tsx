'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/marketing/Navbar'

/* ════════════════════════════════════════════════════════════════════
   DATA
   ════════════════════════════════════════════════════════════════════ */

const PLANS = [
  {
    name: 'Free',
    price: 0,
    description: 'Get started with AI replies',
    features: ['5 reviews / month', 'AI reply generation', '1 location', 'Community support'],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: 15,
    description: 'For growing businesses',
    features: [
      '50 reviews / month',
      'Everything in Free',
      '3 AI reports / month',
      '1 competitor tracked',
      'Priority support',
    ],
    cta: 'Start with Pro',
    popular: true,
  },
  {
    name: 'Business',
    price: 35,
    description: 'For multi-location teams',
    features: [
      '200 reviews / month',
      'Everything in Pro',
      '10 AI reports / month',
      '5 competitors tracked',
      'Priority support',
    ],
    cta: 'Go Business',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 85,
    description: 'For agencies & franchises',
    features: [
      '1,000 reviews / month',
      'Everything in Business',
      '20 AI reports / month',
      '20 competitors tracked',
      'Priority support',
    ],
    cta: 'Go Enterprise',
    popular: false,
  },
]

const FAQS = [
  {
    question: 'Can I switch plans anytime?',
    answer:
      'Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing period.',
  },
  {
    question: 'What happens when I hit my review limit?',
    answer:
      "You'll be notified when you're approaching your limit. You can upgrade your plan or wait until your next billing period when your allowance resets.",
  },
  {
    question: 'Is there a free trial?',
    answer:
      "Our Free plan is free forever with 5 reviews per month. No credit card required. You can upgrade to a paid plan whenever you're ready.",
  },
  {
    question: 'Do unused reviews roll over?',
    answer:
      'Unused reviews do not roll over to the next billing period. Your allowance resets at the start of each billing cycle.',
  },
]

const COMPARISON = [
  { feature: 'Monthly Reviews', free: '5', pro: '50', business: '200', enterprise: '1,000' },
  { feature: 'AI Reply Generation', free: true, pro: true, business: true, enterprise: true },
  { feature: 'AI Reports / month', free: false, pro: '3', business: '10', enterprise: '20' },
  { feature: 'Competitors Tracked', free: false, pro: '1', business: '5', enterprise: '20' },
  { feature: 'Priority Support', free: false, pro: true, business: true, enterprise: true },
]

/* ════════════════════════════════════════════════════════════════════
   ICONS
   ════════════════════════════════════════════════════════════════════ */

function CheckIcon({ className = 'w-5 h-5 text-teal-600' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ════════════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const tableRowVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

/* ════════════════════════════════════════════════════════════════════
   COMPARISON TABLE CELL RENDERER
   ════════════════════════════════════════════════════════════════════ */

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <CheckIcon className="w-5 h-5 text-teal-600 mx-auto" />
  if (value === false) return <span className="text-gray-300">&mdash;</span>
  return <span className="font-semibold text-gray-900">{value}</span>
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── A) Hero Section ─────────────────────────────────────────── */}
      <section className="pt-36 pb-16 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          <motion.div variants={fadeUp}>
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-6">
              Pricing
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6"
          >
            Simple pricing, powerful results
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg md:text-xl text-gray-500 max-w-xl mx-auto">
            Start free. Upgrade when you&apos;re ready. No hidden fees.
          </motion.p>
        </motion.div>
      </section>

      {/* ── B) Pricing Cards ────────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <motion.div
          className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          {PLANS.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`relative flex flex-col rounded-2xl p-8 ${
                plan.popular
                  ? 'border-2 border-teal-500 shadow-xl shadow-teal-100/50'
                  : 'border border-gray-200'
              } bg-white`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
                  Most Popular
                </span>
              )}

              {/* Plan header */}
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{plan.description}</p>

              {/* Price */}
              <div className="mt-6 mb-8">
                <span className="text-5xl font-extrabold text-gray-900">
                  ${plan.price}
                </span>
                <span className="text-base text-gray-400 ml-1">/mo</span>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <CheckIcon className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/login"
                className={`block w-full text-center py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  plan.popular
                    ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white hover:shadow-lg hover:shadow-teal-200/60'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-teal-300 hover:text-teal-700'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── C) Feature Comparison Table ─────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50/60">
        <motion.div
          className="max-w-4xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4"
          >
            Compare plans in detail
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
            Every plan includes AI-powered reply generation. Pick the one that fits your scale.
          </motion.p>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <motion.tr variants={fadeUp} className="border-b border-gray-200">
                  <th className="text-left py-4 pr-4 text-sm font-semibold text-gray-500 w-1/3">
                    Feature
                  </th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-500">Free</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-teal-600">
                    Pro
                    <span className="ml-1.5 inline-block bg-teal-50 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full align-middle">
                      Popular
                    </span>
                  </th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-500">
                    Business
                  </th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-500">
                    Enterprise
                  </th>
                </motion.tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <motion.tr
                    key={row.feature}
                    variants={tableRowVariant}
                    custom={i}
                    className="border-b border-gray-100 last:border-none"
                  >
                    <td className="py-4 pr-4 text-sm text-gray-700 font-medium">{row.feature}</td>
                    <td className="py-4 px-4 text-center text-sm">
                      <CellValue value={row.free} />
                    </td>
                    <td className="py-4 px-4 text-center text-sm bg-teal-50/40">
                      <CellValue value={row.pro} />
                    </td>
                    <td className="py-4 px-4 text-center text-sm">
                      <CellValue value={row.business} />
                    </td>
                    <td className="py-4 px-4 text-center text-sm">
                      <CellValue value={row.enterprise} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile comparison cards */}
          <div className="md:hidden space-y-6">
            {PLANS.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                className={`rounded-2xl border p-6 bg-white ${
                  plan.popular ? 'border-teal-500 border-2' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  {plan.popular && (
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
                      Popular
                    </span>
                  )}
                </div>
                <ul className="space-y-3">
                  {COMPARISON.map((row) => {
                    const value =
                      row[plan.name.toLowerCase() as keyof typeof row] as boolean | string
                    return (
                      <li key={row.feature} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{row.feature}</span>
                        <span>
                          <CellValue value={value} />
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── D) FAQ Accordion ────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <motion.div
          className="max-w-3xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12"
          >
            Frequently asked questions
          </motion.h2>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
                  >
                    <span className="text-sm md:text-base font-semibold text-gray-900 pr-4">
                      {faq.question}
                    </span>
                    <ChevronIcon open={isOpen} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-sm md:text-base text-gray-500 leading-relaxed">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </section>

      {/* ── E) CTA Section ──────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-teal-600 to-teal-800 py-24 px-6">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-white mb-4">
            Still not sure? Start free.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-teal-200 text-lg mb-10">
            No credit card required. Upgrade anytime.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              href="/login"
              className="inline-block px-8 py-4 bg-white text-teal-700 font-semibold rounded-xl text-base hover:shadow-xl hover:shadow-teal-900/20 transition-all duration-200 cursor-pointer"
            >
              Get Started Free &rarr;
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
