import Link from 'next/link'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-20 px-6">
            <div className="max-w-3xl mx-auto bg-white p-10 md:p-14 rounded-3xl shadow-sm border border-gray-100">
                <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 mb-8 inline-flex items-center gap-1">
                    ← Back to home
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">AutoMyReply Terms of Service</h1>
                <div className="prose prose-indigo max-w-none text-gray-600 space-y-6">
                    <p className="text-sm text-gray-400">Effective date: March 3, 2026</p>

                    <p>These Terms of Service ("Terms") govern your access to and use of AutoMyReply (the "Service"). The Service is operated by AutoMyReply ("we," "us," "our"). By creating an account, accessing, or using the Service, you agree to these Terms.</p>
                    <p>If you do not agree, do not use the Service.</p>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">1. Who may use the Service</h2>
                        <p>You must be able to form a binding contract and comply with applicable laws. If you use the Service on behalf of a business or other organization, you represent you have authority to bind that organization to these Terms.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">2. The Service</h2>
                        <p>AutoMyReply provides tools to help businesses:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>connect Google accounts via OAuth,</li>
                            <li>sync and view reviews and business location information,</li>
                            <li>generate AI-assisted draft replies,</li>
                            <li>optionally publish replies (where enabled),</li>
                            <li>generate analytics/insights and competitor comparisons.</li>
                        </ul>
                        <p className="mt-4">The Service may change over time. We may add, modify, or remove features at any time.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">3. Accounts, teams, and access</h2>
                        <p>You are responsible for maintaining the confidentiality of your account and for all activity under it. You are responsible for ensuring that invited team members have the right to access and manage the relevant locations and data.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">4. Your content and permissions</h2>
                        <p>"Customer Content" includes information you provide or connect to the Service, including business location details, reviews, review replies/drafts, competitor data, and any configuration text (e.g., brand voice, signatures).</p>
                        <p className="mt-4">You grant us a worldwide, non-exclusive license to host, store, process, and display Customer Content solely to provide, maintain, secure, and improve the Service.</p>
                        <p className="mt-4">You represent and warrant that you have all rights and permissions necessary to provide Customer Content and to authorize us to process it.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">5. AI-generated content disclaimer (important)</h2>
                        <p>The Service may generate suggestions using automated systems, including AI/LLMs. Generated content may be inaccurate, incomplete, inappropriate, or not suited to your situation.</p>
                        <p className="mt-4">You are responsible for reviewing and approving any reply before posting it publicly. If the Service offers automated posting now or in the future, you remain responsible for content posted using your account.</p>
                        <p className="mt-4">We do not guarantee any particular business outcome (e.g., improved ratings, revenue, customer sentiment).</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">6. Third-party services (Google, Stripe, SerpAPI, etc.)</h2>
                        <p>The Service integrates with third-party services. Examples include:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Google OAuth and Google Business Profile APIs,</li>
                            <li>payment processors (e.g., Stripe),</li>
                            <li>data providers (e.g., SerpAPI) for competitor information.</li>
                        </ul>
                        <p className="mt-4">Your use of those third-party services is subject to their terms and policies. We are not responsible for third-party services and they may change, suspend, or terminate access at any time.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">7. Payments, subscriptions, credits, and trials</h2>
                        <p>Some features require payment. If you purchase a subscription:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>You authorize us (via our payment processor) to charge your payment method on a recurring basis until canceled.</li>
                            <li>Fees are generally non-refundable except where required by law, or where we explicitly provide a refund.</li>
                        </ul>
                        <p className="mt-4">If the Service uses "credits" (e.g., for draft generation, insights, or competitive runs), credits:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>are not currency,</li>
                            <li>have no cash value,</li>
                            <li>may expire or reset based on your plan,</li>
                            <li>may be changed as part of plan updates.</li>
                        </ul>
                        <p className="mt-4">We may change pricing and plan features with reasonable notice.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">8. Cancellation</h2>
                        <p>You can cancel at any time through your account settings (if available) or by contacting support. Cancellation stops future renewals; you may retain access until the end of the paid period, unless terminated earlier for cause.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">9. Acceptable use</h2>
                        <p>You agree not to:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>use the Service to generate or post deceptive, fraudulent, illegal, or abusive content,</li>
                            <li>impersonate others, or misrepresent affiliation,</li>
                            <li>harass, threaten, or defame individuals,</li>
                            <li>attempt to bypass security, rate limits, or access controls,</li>
                            <li>reverse engineer or attempt to extract source code (except to the extent allowed by law),</li>
                            <li>use the Service to build a competing product using automated scraping of our Service.</li>
                        </ul>
                        <p className="mt-4">We may suspend or terminate access if we reasonably believe you violated these Terms or pose a risk to the Service or others.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">10. Data retention and deletion</h2>
                        <p>We may retain Customer Content and logs for as long as needed to provide the Service, comply with law, resolve disputes, enforce agreements, and maintain security.</p>
                        <p className="mt-4">You may request deletion of your account and associated data by emailing <a href="mailto:automyreply@gmail.com" className="text-indigo-600 hover:text-indigo-700">automyreply@gmail.com</a>. Some information may be retained where required for legal, tax, security, or fraud-prevention reasons (for example, billing records and audit logs).</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">11. Security</h2>
                        <p>We use reasonable safeguards designed to protect information. However, no system is 100% secure. You agree you use the Service at your own risk.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">12. Intellectual property</h2>
                        <p>We (and our licensors) retain all rights in the Service, including software, designs, and trademarks. These Terms do not grant you ownership of the Service.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">13. Disclaimers</h2>
                        <p className="uppercase tracking-wide text-sm font-semibold mt-4">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">14. Limitation of liability</h2>
                        <p className="uppercase tracking-wide text-sm font-semibold mt-4 mb-2">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
                        <ul className="list-disc pl-6 space-y-4 uppercase tracking-wide text-sm font-semibold">
                            <li>WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL.</li>
                            <li>OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID US FOR THE SERVICE IN THE 3 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR CAD $100 IF YOU HAVE NOT PAID ANY AMOUNTS.</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">15. Indemnity</h2>
                        <p>You agree to indemnify and hold us harmless from claims, damages, liabilities, and expenses (including reasonable legal fees) arising from:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>your use of the Service,</li>
                            <li>your Customer Content,</li>
                            <li>your violation of these Terms or applicable law.</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">16. Termination</h2>
                        <p>You may stop using the Service at any time. We may suspend or terminate your access:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>for violation of these Terms,</li>
                            <li>to comply with law,</li>
                            <li>to protect the Service, users, or the public.</li>
                        </ul>
                        <p className="mt-4">Upon termination, your right to use the Service stops immediately.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">17. Changes to these Terms</h2>
                        <p>We may update these Terms from time to time. If changes are material, we will provide reasonable notice (e.g., in-product notice or email). Continued use after the effective date means you accept the updated Terms.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">18. Governing law and venue</h2>
                        <p>These Terms are governed by the laws of Ontario, Canada and the applicable federal laws of Canada. You agree that courts located in Ontario will have exclusive jurisdiction, except where prohibited by law.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">19. Contact</h2>
                        <p>Questions about these Terms: <a href="mailto:automyreply@gmail.com" className="text-indigo-600 hover:text-indigo-700">automyreply@gmail.com</a></p>
                    </div>

                </div>
            </div>
        </div>
    )
}
