import Link from 'next/link'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-20 px-6">
            <div className="max-w-3xl mx-auto bg-white p-10 md:p-14 rounded-3xl shadow-sm border border-gray-100">
                <Link href="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 mb-8 inline-flex items-center gap-1">
                    ← Back to home
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">AutoMyReply Privacy Policy</h1>
                <div className="prose prose-indigo max-w-none text-gray-600 space-y-6">
                    <p className="text-sm text-gray-400">Effective date: March 3, 2026</p>

                    <p>This Privacy Policy explains how AutoMyReply ("we," "us," "our") collects, uses, shares, and protects information when you use AutoMyReply (the "Service").</p>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">1. Information we collect</h2>

                        <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">A) Account and identity data</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Email address</li>
                            <li>Display name (if provided)</li>
                            <li>Avatar/profile image URL (if provided)</li>
                            <li>Google OAuth identity information (e.g., provider, provider user id, provider email)</li>
                            <li>Team membership and role information</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">B) Business/location data (Google Business Profile)</h3>
                        <p>If you connect Google Business Profile, we may collect and store:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Google location identifiers</li>
                            <li>Business/location name, address, phone, website</li>
                            <li>Geographic and timezone fields (city, region, country, coordinates, timezone)</li>
                            <li>Location configuration you provide (brand voice, sentiment guidance, language, signature)</li>
                            <li>Sync metadata (timestamps, status, errors)</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">C) Reviews and reply data</h3>
                        <p>We may collect and store:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Review identifiers, ratings, reviewer name/profile URL (if provided by Google)</li>
                            <li>Review text, date, and review URL</li>
                            <li>Images/links associated with reviews (as URLs/JSON)</li>
                            <li>Reply status and timestamps</li>
                            <li>Draft replies and final reply text (including draft history where enabled)</li>
                            <li>Reply posting attempt logs (success/failure, error messages, request/response payloads)</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">D) Competitor and insights data</h3>
                        <p>We may collect and store:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Competitor business details (name, address, category, rating, review count, IDs like place_id/business_id/data_id)</li>
                            <li>Competitor reviews and associated metadata (from providers such as SerpAPI)</li>
                            <li>Generated insights and analytics outputs (stored as JSON), including model and prompt version metadata</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">E) Billing and usage data</h3>
                        <p>If you subscribe, we may store:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2 mb-4">
                            <li>Stripe customer and subscription IDs</li>
                            <li>Subscription tier/status and period dates</li>
                        </ul>
                        <p>We do not store full payment card numbers. Payments are processed by our payment processor (e.g., Stripe).</p>
                        <p className="mt-4">We also store usage records such as:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Credit balances and credit ledger transactions</li>
                            <li>Audit logs (actions taken in the Service, with timestamps and metadata)</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">F) Technical data</h3>
                        <p>We may collect:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Log data (IP address, device/browser information, timestamps)</li>
                            <li>Security and fraud-prevention signals</li>
                            <li>Cookies or similar technologies (for authentication and analytics, if enabled)</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">2. How we use information</h2>
                        <p>We use information to:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>Provide and operate the Service (sync reviews, generate drafts, show analytics)</li>
                            <li>Authenticate users and manage team access</li>
                            <li>Maintain security, prevent abuse, and enforce our Terms</li>
                            <li>Process billing and manage subscriptions/credits</li>
                            <li>Improve and debug the Service (including performance monitoring)</li>
                            <li>Communicate with you (support, important notices)</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">3. Legal bases (Canada/Ontario)</h2>
                        <p>We process information primarily because:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>it is necessary to provide the Service you request,</li>
                            <li>you consent (e.g., connecting Google OAuth),</li>
                            <li>it is needed for legitimate interests (security, fraud prevention, product improvement),</li>
                            <li>it is required to comply with legal obligations (tax, accounting).</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">4. How we share information</h2>
                        <p>We share information only as needed to operate the Service, including with:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2 mb-4">
                            <li>Google (to access Google Business Profile APIs under your authorization)</li>
                            <li>Payment processors (e.g., Stripe) for billing</li>
                            <li>Service providers (hosting, databases, error monitoring, analytics)</li>
                            <li>Data providers (e.g., SerpAPI) for competitor information you request</li>
                        </ul>
                        <p>We may also share information:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2 mb-4">
                            <li>to comply with law, court orders, or lawful requests,</li>
                            <li>to protect rights, safety, and security of the Service, our users, or the public,</li>
                            <li>in connection with a business transfer (merger, acquisition, or sale of assets).</li>
                        </ul>
                        <p>We do not sell your personal information.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">5. Google API data (important)</h2>
                        <p>If you connect a Google account, we access Google Business Profile data and reviews under the permissions you grant.</p>
                        <p className="mt-4">We use Google API data only to provide features you request (review sync, draft reply generation, posting replies where enabled, analytics/insights). We do not use Google API data to build advertising profiles, to sell to third parties, or for unrelated purposes.</p>
                        <p className="mt-4">You can revoke the Service's access at any time from your Google Account settings. After revocation, some previously stored data may remain in our system until deleted per Section 8.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">6. Data retention</h2>
                        <p>We retain information as long as needed to:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2 mb-4">
                            <li>provide the Service,</li>
                            <li>maintain records (billing, security, audit),</li>
                            <li>comply with legal obligations,</li>
                            <li>resolve disputes and enforce agreements.</li>
                        </ul>
                        <p>Retention periods vary by data type. For example, billing records may be retained for legal/tax requirements even after account deletion.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">7. Security</h2>
                        <p>We use reasonable administrative, technical, and organizational safeguards. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">8. Your choices and rights</h2>
                        <p>Depending on your location, you may have rights to access, correct, delete, or export your information.</p>
                        <p className="mt-4">At minimum, you can:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2 mb-4">
                            <li>access and update your account information within the Service (where available),</li>
                            <li>request account/data deletion by emailing <a href="mailto:automyreply@gmail.com" className="text-indigo-600 hover:text-indigo-700">automyreply@gmail.com</a>,</li>
                            <li>revoke Google access in your Google Account settings.</li>
                        </ul>
                        <p>When you request deletion, we will delete or de-identify personal data where reasonably possible, except where we must retain it for legal, security, or fraud-prevention purposes.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">9. Children's privacy</h2>
                        <p>The Service is not intended for children under 13, and we do not knowingly collect personal information from children.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">10. International data transfers</h2>
                        <p>Your information may be processed in countries other than where you live, depending on our hosting and service providers. We take steps designed to protect data in transit and at rest.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">11. Changes to this Privacy Policy</h2>
                        <p>We may update this Privacy Policy. If changes are material, we will provide reasonable notice (e.g., in-product notice or email). The effective date above will be updated.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 mt-8">12. Contact</h2>
                        <p>Privacy questions or requests: <a href="mailto:automyreply@gmail.com" className="text-indigo-600 hover:text-indigo-700">automyreply@gmail.com</a></p>
                    </div>

                </div>
            </div>
        </div>
    )
}
