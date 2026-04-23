'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Truck, DollarSign, Camera, LogOut, ChevronRight, Lock, Globe } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { AppLoader } from '@/components/AppLoader'
import type { Lang } from '@/lib/translations'

const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'es', label: 'Spanish', native: 'Español' },
]

export default function DriverSettingsPage() {
  const { profile, signOut, loading } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  if (loading || !profile) return <AppLoader />

  const avatarUrl = (profile as any)?.avatar_url ?? null
  const initials = profile.full_name?.charAt(0).toUpperCase() ?? '?'
  const payLabel = profile.pay_type === 'per_load'
    ? `$${Number(profile.pay_rate).toFixed(2)} / load`
    : profile.pay_type === 'hourly'
    ? `$${Number(profile.pay_rate).toFixed(2)} / hr`
    : 'Not set'

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `avatars/${profile!.id}`
    const { data } = await supabase.storage.from('fuel-receipts').upload(path, file, { upsert: true, contentType: file.type })
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('fuel-receipts').getPublicUrl(data.path)
      await supabase.from('users').update({ avatar_url: publicUrl } as any).eq('id', profile!.id)
    }
    setUploading(false)
  }

  async function handleChangePassword() {
    setPwError(null)
    setPwSuccess(false)
    if (pwForm.next !== pwForm.confirm) { setPwError(t('settings.passwordMismatch')); return }
    if (pwForm.next.length < 6) { setPwError(t('settings.passwordMinLength')); return }
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setPwForm({ next: '', confirm: '' })
    setTimeout(() => { setChangingPassword(false); setPwSuccess(false) }, 2000)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.push('/login')
  }

  return (
    <div className="p-4 pb-28 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900">{t('settings.title')}</h1>

      {/* Profile */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 flex items-center gap-4 border-b border-gray-100">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden text-xl font-bold text-gray-600">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : uploading ? (
                <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : initials}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-6 h-6 bg-[#1a1a1a] rounded-full flex items-center justify-center"
            >
              <Camera size={12} className="text-white" />
            </button>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{profile.full_name}</p>
            <p className="text-sm text-gray-500 capitalize">{profile.role}</p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <User size={16} className="text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{t('settings.fullName')}</p>
              <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
            </div>
          </div>
          {profile.phone && (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <User size={16} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{t('settings.phone')}</p>
                <p className="text-sm font-medium text-gray-900">{profile.phone}</p>
              </div>
            </div>
          )}
          {profile.truck_number && (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Truck size={16} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{t('settings.truckNumber')}</p>
                <p className="text-sm font-medium text-gray-900">{profile.truck_number}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pay Info */}
      {profile.pay_type && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('settings.payRate')}</p>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <DollarSign size={16} className="text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{t('settings.payType')}</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{profile.pay_type.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5 border-t border-gray-100">
            <DollarSign size={16} className="text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{t('settings.rate')}</p>
              <p className="text-sm font-medium text-gray-900">{payLabel}</p>
            </div>
          </div>
          <p className="px-4 pb-3 text-xs text-gray-400">{t('settings.rateNote')}</p>
        </div>
      )}

      {/* Preferences */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('settings.preferences')}</p>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <Globe size={16} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-2">{t('settings.languageLabel')}</p>
            <div className="flex gap-2">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    lang === l.code
                      ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('settings.security')}</p>
        {!changingPassword ? (
          <button
            onClick={() => setChangingPassword(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 text-left"
          >
            <Lock size={16} className="text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-900">{t('settings.changePassword')}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ) : (
          <div className="px-4 py-4 space-y-3">
            <input
              type="password"
              placeholder={t('settings.newPassword')}
              value={pwForm.next}
              onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400"
            />
            <input
              type="password"
              placeholder={t('settings.confirmPassword')}
              value={pwForm.confirm}
              onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400"
            />
            {pwError && <p className="text-xs text-red-600">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-600">{t('settings.passwordUpdated')}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setChangingPassword(false); setPwForm({ next: '', confirm: '' }); setPwError(null) }}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600"
              >
                {t('settings.cancel')}
              </button>
              <button
                onClick={handleChangePassword}
                className="flex-1 py-2.5 bg-[#1a1a1a] text-white rounded-lg text-sm font-semibold"
              >
                {t('settings.update')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign Out */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-red-50 disabled:opacity-60"
        >
          <LogOut size={16} className="text-red-500 shrink-0" />
          <span className="text-sm font-semibold text-red-600">{signingOut ? t('settings.signingOut') : t('settings.signOut')}</span>
        </button>
      </div>
    </div>
  )
}
