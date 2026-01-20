'use client'

import { useEffect, useState } from 'react'
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
}

interface AuthData {
  user: User
  teams: Team[]
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const data: AuthData = await apiGet('/api/me')
      setUser(data.user)
      setTeams(data.teams || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
      if (err.message === 'Unauthorized' || err.message.includes('401')) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    // Clear local state
    setUser(null)
    setTeams([])
    // Redirect to login
    router.push('/login')
  }

  return {
    user,
    teams,
    loading,
    error,
    checkAuth,
    logout,
  }
}



