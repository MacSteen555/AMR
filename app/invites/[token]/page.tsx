'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'

interface InviteDetails {
    id: string
    invited_email: string
    role: string
    expires_at: string
    team_name: string
    team_id: string
    inviter_name: string
    inviter_email: string
}

type PageState =
    | { type: 'loading' }
    | { type: 'valid'; invite: InviteDetails; authenticated: boolean; currentEmail: string | null }
    | { type: 'error'; message: string; code?: string }
    | { type: 'accepting' }
    | { type: 'success'; teamName: string; alreadyMember: boolean }

export default function AcceptInvitePage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string
    const [state, setState] = useState<PageState>({ type: 'loading' })

    useEffect(() => {
        validateInvite()
    }, [token])

    const validateInvite = async () => {
        try {
            const res = await fetch(`/api/invites/validate?token=${token}`)
            const data = await res.json()

            if (!res.ok) {
                setState({ type: 'error', message: data.error, code: data.code })
                return
            }

            setState({
                type: 'valid',
                invite: data.invite,
                authenticated: data.authenticated,
                currentEmail: data.current_email,
            })
        } catch {
            setState({ type: 'error', message: 'Failed to load invitation details' })
        }
    }

    const handleAccept = async () => {
        setState({ type: 'accepting' })
        try {
            const res = await fetch('/api/invites/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })
            const data = await res.json()

            if (!res.ok) {
                setState({ type: 'error', message: data.error })
                return
            }

            setState({
                type: 'success',
                teamName: data.team_name,
                alreadyMember: data.already_member,
            })
        } catch {
            setState({ type: 'error', message: 'Failed to accept invitation' })
        }
    }

    useEffect(() => {
        if (state.type === 'valid' && !state.authenticated) {
            if (typeof window !== 'undefined') {
                document.cookie = `invite_redirect=/invites/${token}; path=/; max-age=600; SameSite=Lax`
            }
        }
    }, [state.type, (state as any).authenticated, token])

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Loading */}
                {state.type === 'loading' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-4" />
                        <p className="text-gray-500">Loading invitation...</p>
                    </div>
                )}

                {/* Valid Invite */}
                {state.type === 'valid' && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-8 py-6 text-center">
                            <h1 className="text-xl font-bold text-white">AutoMyReply</h1>
                        </div>

                        <div className="p-8">
                            {/* Envelope Icon */}
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-50 rounded-full text-3xl">
                                    ✉️
                                </div>
                            </div>

                            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                                You're invited!
                            </h2>

                            <p className="text-gray-500 text-center text-sm mb-6">
                                <strong className="text-gray-700">{state.invite.inviter_name}</strong> invited you to join
                            </p>

                            {/* Team Card */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center mb-6">
                                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Team</p>
                                <p className="text-lg font-bold text-gray-900">{state.invite.team_name}</p>
                                <p className="text-xs text-gray-400 mt-1">Role: <span className="capitalize text-gray-600">{state.invite.role}</span></p>
                            </div>

                            {/* Action */}
                            {state.authenticated ? (
                                <>
                                    {state.currentEmail?.toLowerCase() === state.invite.invited_email.toLowerCase() ? (
                                        <button
                                            onClick={handleAccept}
                                            className="w-full py-3 px-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all shadow-md hover:shadow-lg"
                                        >
                                            Join Team
                                        </button>
                                    ) : (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                                            <p className="text-sm text-amber-800">
                                                This invite was sent to <strong>{state.invite.invited_email}</strong>.
                                                You're signed in as <strong>{state.currentEmail}</strong>.
                                            </p>
                                            <p className="text-xs text-amber-600 mt-2">
                                                Please sign in with the invited email address.
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-4 mt-2">
                                    <GoogleLoginButton />
                                    <p className="text-xs text-gray-400 text-center">
                                        Sign in with <strong>{state.invite.invited_email}</strong> to accept
                                    </p>
                                </div>
                            )}

                            {/* Expiry */}
                            <p className="text-xs text-gray-400 text-center mt-6">
                                This invitation expires on {new Date(state.invite.expires_at).toLocaleDateString('en-US', {
                                    month: 'long', day: 'numeric', year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                )}

                {/* Accepting */}
                {state.type === 'accepting' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Joining team...</p>
                    </div>
                )}

                {/* Success */}
                {state.type === 'success' && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6 text-center">
                            <div className="text-4xl mb-2">🎉</div>
                            <h2 className="text-xl font-bold text-white">
                                {state.alreadyMember ? 'Already a member!' : 'Welcome aboard!'}
                            </h2>
                        </div>
                        <div className="p-8 text-center">
                            <p className="text-gray-600 mb-6">
                                {state.alreadyMember
                                    ? `You're already a member of ${state.teamName}.`
                                    : `You've successfully joined ${state.teamName}.`
                                }
                            </p>
                            <button
                                onClick={() => router.push('/teams')}
                                className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors"
                            >
                                Go to Teams
                            </button>
                        </div>
                    </div>
                )}

                {/* Error */}
                {state.type === 'error' && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-8 py-6 text-center">
                            <div className="text-4xl mb-2">
                                {state.code === 'EXPIRED' ? '⏰' : state.code === 'ALREADY_ACCEPTED' ? '✅' : '❌'}
                            </div>
                            <h2 className="text-xl font-bold text-white">
                                {state.code === 'EXPIRED' ? 'Invitation Expired' :
                                    state.code === 'ALREADY_ACCEPTED' ? 'Already Accepted' :
                                        'Invalid Invitation'}
                            </h2>
                        </div>
                        <div className="p-8 text-center">
                            <p className="text-gray-600 mb-6">{state.message}</p>
                            <button
                                onClick={() => router.push('/')}
                                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Go Home
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    AutoMyReply — Automated Review Management
                </p>
            </div>
        </div>
    )
}
