'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'

export interface User {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
}

export interface Team {
  id: string
  name: string
  role: string
  subscription: {
    tier: string
    status: string
    monthly_credits: number
    insights_enabled: boolean
    competitive_enabled: boolean
  } | null
  creditBalance: number
  reviewsManaged: number
}

interface AuthData {
  user: User
  teams: Team[]
}

interface AuthContextValue {
  user: User | null
  teams: Team[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  const [user, setUser] = useState<User | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkAuth = useCallback(async () => {
    try {
      const data: AuthData = await apiGet('/api/me')
      setUser(data.user)
      setTeams(data.teams || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
      if (err.message === 'Unauthorized' || err.message.includes('401')) {
        routerRef.current.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* best-effort */ }
    setUser(null)
    setTeams([])
    routerRef.current.push('/login')
  }, [])

  const refresh = useCallback(async () => {
    await checkAuth()
  }, [checkAuth])

  return (
    <AuthContext.Provider value={{ user, teams, loading, error, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
