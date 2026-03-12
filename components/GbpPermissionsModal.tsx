'use client'

interface GbpPermissionsModalProps {
    isOpen: boolean
    onClose: () => void
}

export function GbpPermissionsModal({ isOpen, onClose }: GbpPermissionsModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Can&apos;t see your business?</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">

                    {/* Section 1 - Google Permissions */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center">
                                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-1">Google Permissions</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    When signing in to AutoMyReply, you must click <span className="font-semibold text-gray-900">Allow</span> on the Google consent screen to grant access to your Business Profile. If you clicked deny or skipped this step, sign out and sign back in, making sure to allow all permissions.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2 - Owner/Manager Access */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center">
                                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-1">Owner/Manager Access Required</h3>
                                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                                    You must be an <span className="font-semibold text-gray-900">Owner</span> or <span className="font-semibold text-gray-900">Manager</span> of the Google Business Profile. If you&apos;re not, ask the profile owner to add you:
                                </p>
                                <ol className="text-sm text-gray-600 leading-relaxed space-y-2 list-decimal list-outside ml-4">
                                    <li>
                                        Sign in at{' '}
                                        <a
                                            href="https://business.google.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-teal-600 hover:text-teal-700 underline underline-offset-2"
                                        >
                                            business.google.com
                                        </a>{' '}
                                        with the Google account that owns the business profile.
                                    </li>
                                    <li>Search for the business name in the Google search bar.</li>
                                    <li>Click the 3 vertical dots next to the business name and go to <span className="font-semibold text-gray-900">Business Profile Settings</span>.</li>
                                    <li>Click <span className="font-semibold text-gray-900">People and access</span>, then hit the blue <span className="font-semibold text-gray-900">Add</span> button.</li>
                                    <li>Enter the email address and choose either <span className="font-semibold text-gray-900">Owner</span> or <span className="font-semibold text-gray-900">Manager</span> under access, then click <span className="font-semibold text-gray-900">Invite</span>.</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
