'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { User, Role, AccountType } from '@/types'

interface AuthContextValue {
  supabaseUser: SupabaseUser | null
  profile: User | null
  role: Role | null
  accountType: AccountType | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  supabaseUser: null,
  profile: null,
  role: null,
  accountType: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSupabaseUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setAccountType(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*, companies(account_type)')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile(data)
      setAccountType(((data as unknown) as { companies?: { account_type?: AccountType } }).companies?.account_type ?? null)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ supabaseUser, profile, role: profile?.role ?? null, accountType, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
