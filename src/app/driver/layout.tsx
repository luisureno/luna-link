'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BottomNav } from '@/components/driver/BottomNav'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = profile?.full_name?.charAt(0).toUpperCase() ?? '?'
  const avatarUrl = (profile as any)?.avatar_url ?? null

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    setMenuOpen(false)

    const path = `avatars/${profile.id}`
    const { data } = await supabase.storage.from('fuel-receipts').upload(path, file, { upsert: true, contentType: file.type })
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('fuel-receipts').getPublicUrl(data.path)
      await supabase.from('users').update({ avatar_url: publicUrl } as any).eq('id', profile.id)
    }
    setUploading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7F5]">
      <header className="bg-[#1a1a1a] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold text-sm hover:opacity-80 transition-opacity">HaulProof</Link>
          {profile?.role !== 'driver' && (
            <Link href="/dashboard" className="text-xs text-white/50 hover:text-white transition-colors border border-white/20 rounded px-2 py-1">
              ← Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{profile?.full_name}</p>
            <p className="text-xs text-white/50">
              {profile?.truck_number ?? ''} &middot; {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>

          {/* Avatar button */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold overflow-hidden hover:bg-white/30 transition-colors"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : uploading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                initials
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-20 bg-white rounded-lg shadow-lg border border-gray-200 w-44 overflow-hidden">
                  <button
                    onClick={() => { setMenuOpen(false); fileRef.current?.click() }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    📷 Upload Photo
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      <main className="flex-1 pb-20">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
