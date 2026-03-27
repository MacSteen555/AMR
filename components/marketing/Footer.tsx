import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Image src="/images/amber_teal-logo.png" alt="AutoMyReply" width={32} height={32} className="h-8 w-auto" />
              <span className="text-lg font-bold text-gray-900">AutoMyReply</span>
            </Link>
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
              <li><Link href="/#features" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Features</Link></li>
              <li><Link href="/how-it-works" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">How It Works</Link></li>
              <li><Link href="/ai" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">AI Technology</Link></li>
              <li><Link href="/pricing" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Pricing</Link></li>
              <li><Link href="/#demo" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Live Demo</Link></li>
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
              <li><Link href="/#faq" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">FAQ</Link></li>
              <li><a href="mailto:automyreply@gmail.com" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">Contact Us</a></li>
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
  )
}
