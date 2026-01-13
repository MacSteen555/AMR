import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="mb-16">
          <nav className="flex justify-between items-center">
            <div className="text-2xl font-bold text-indigo-600">AutoMyReply</div>
            <Link
              href="/login"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Sign In
            </Link>
          </nav>
        </header>

        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            AI-Powered Review Management
            <span className="text-indigo-600"> Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Automatically generate professional replies to Google Business Profile reviews,
            gain insights from your feedback, and stay ahead of the competition.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-indigo-600 text-white rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 bg-white text-indigo-600 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg border-2 border-indigo-600"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="max-w-6xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything you need to manage reviews
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI-Generated Replies
              </h3>
              <p className="text-gray-600">
                Generate professional, personalized replies to reviews in seconds. 
                Customize your brand voice and sentiment approach.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Powerful Insights
              </h3>
              <p className="text-gray-600">
                Get AI-powered insights from your reviews. Understand trends, 
                sentiment, and actionable recommendations.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Competitive Analysis
              </h3>
              <p className="text-gray-600">
                Track competitor reviews and compare your performance. 
                Stay ahead with competitive intelligence.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Preview */}
        <section className="max-w-4xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Simple, transparent pricing
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">FREE</h3>
              <p className="text-3xl font-bold text-gray-900 mb-4">$0</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Draft generation</li>
                <li>✓ Basic features</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">PRO</h3>
              <p className="text-3xl font-bold text-gray-900 mb-4">$29</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Everything in Free</li>
                <li>✓ Location insights</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-500">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">BUSINESS</h3>
              <p className="text-3xl font-bold text-gray-900 mb-4">$99</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Everything in Pro</li>
                <li>✓ Team insights</li>
                <li>✓ Competitive analysis</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">ENTERPRISE</h3>
              <p className="text-3xl font-bold text-gray-900 mb-4">Custom</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Everything in Business</li>
                <li>✓ Priority support</li>
                <li>✓ Custom features</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center max-w-2xl mx-auto">
          <div className="bg-indigo-600 text-white p-12 rounded-2xl shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of businesses managing their reviews with AI
            </p>
            <Link
              href="/login"
              className="inline-block px-8 py-4 bg-white text-indigo-600 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Sign Up Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 text-center text-gray-600">
          <p>&copy; 2024 AutoMyReply. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}

