'use client'

import { useState, useMemo  } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Truck, FileText, Fuel, ShieldCheck, MapPin, BarChart3, Clock, Check, Users, Send, PlusCircle, List } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SOLO_DEMO_EMAIL, SOLO_DEMO_PASSWORD, FLEET_DEMO_EMAIL, FLEET_DEMO_PASSWORD } from '@/lib/demo'

export default function LandingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [requestOpen, setRequestOpen] = useState(false)
  const [demoLoading, setDemoLoading] = useState<'solo' | 'fleet' | null>(null)
  const [demoError, setDemoError] = useState('')

  async function tryDemo(type: 'solo' | 'fleet') {
    setDemoLoading(type)
    setDemoError('')
    const email = type === 'solo' ? SOLO_DEMO_EMAIL : FLEET_DEMO_EMAIL
    const password = type === 'solo' ? SOLO_DEMO_PASSWORD : FLEET_DEMO_PASSWORD
    const dest = type === 'solo' ? '/driver' : '/dashboard'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setDemoError('Demo unavailable right now. Try again in a moment.')
      setDemoLoading(null)
      return
    }
    router.push(dest)
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5] text-gray-900">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck size={24} className="text-gray-900" />
            <span className="text-lg md:text-xl font-bold tracking-tight">Fleetwise</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <a href="#pricing" className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-gray-900 px-2 md:px-3 py-2">
              Pricing
            </a>
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-2 md:px-3 py-2">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-[#1a1a1a] text-white px-3 md:px-4 py-2 rounded hover:bg-gray-800"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-12 md:pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-gray-900">
          From paper ticket<br />to paid invoice.
        </h1>
        <p className="mt-5 md:mt-6 text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
          Scan the tag. Confirm the load. Send the invoice in minutes — not hours. No spreadsheets. No chasing drivers. No billing nights.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-6 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800 text-center"
          >
            Start Free Trial
          </Link>
          <button
            onClick={() => tryDemo('solo')}
            disabled={demoLoading !== null}
            className="w-full sm:w-auto px-6 py-3 border border-gray-300 bg-white rounded font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {demoLoading === 'solo' ? 'Loading…' : 'Try Solo Demo'}
          </button>
          <button
            onClick={() => tryDemo('fleet')}
            disabled={demoLoading !== null}
            className="w-full sm:w-auto px-6 py-3 border border-gray-300 bg-white rounded font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {demoLoading === 'fleet' ? 'Loading…' : 'Try Fleet Demo'}
          </button>
        </div>
        {demoError && <p className="mt-4 text-sm text-red-600">{demoError}</p>}
        <p className="mt-4 text-xs text-gray-500">30-day free trial · No credit card · Demo pre-loaded with sample data</p>
      </section>

      {/* Trusted by */}
      <section className="border-y border-gray-200 bg-white py-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-medium text-gray-500 uppercase tracking-[0.15em] mb-6 px-4 md:px-6">
            Built for local trucking companies
          </p>
          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-24 bg-gradient-to-r from-white to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-24 bg-gradient-to-l from-white to-transparent z-10" />
            <div className="marquee-track flex items-center gap-12 md:gap-16">
              {(() => {
                const names = [
                  'Mesa Rock Hauling',
                  'Desert Freight Co.',
                  'Valley Aggregate',
                  'Saguaro Transport',
                  'Copper State Haulers',
                  'Sonoran Dirt Works',
                ]
                const doubled = [...names, ...names]
                return doubled.map((name, i) => (
                  <div
                    key={i}
                    className="text-sm md:text-base font-semibold text-gray-500 tracking-tight whitespace-nowrap"
                  >
                    {name}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">See it in action</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">One app. Two views.</h2>
          <p className="mt-3 text-sm text-gray-600 max-w-xl mx-auto">Drivers work from their phone. Owners and dispatchers run the back office from any screen.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
          {/* Phone mockup — driver */}
          <div className="mx-auto lg:mx-0 lg:sticky lg:top-24">
            <div className="relative w-full max-w-[300px] mx-auto lg:mx-0" style={{ aspectRatio: '300/620' }}>
            <div className="relative w-full h-full bg-[#1a1a1a] rounded-[40px] p-3 shadow-2xl">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#1a1a1a] rounded-full z-10" />
              <div className="w-full h-full bg-[#F8F7F5] rounded-[30px] overflow-hidden relative">
                {/* Mirrors real solo driver home */}
                <div className="p-3 space-y-2 overflow-y-auto h-full pt-4">
                  {/* Welcome header */}
                  <div className="px-1 mb-1">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">Good morning</p>
                    <p className="text-[13px] font-bold text-gray-900 leading-tight">Welcome back, Carlos</p>
                    <p className="text-[10px] text-gray-500">Desert Run Hauling</p>
                  </div>
                  {/* Earnings card */}
                  <div className="bg-[#1a1a1a] rounded-lg p-3">
                    <p className="text-[9px] text-gray-400">Today's Earnings</p>
                    <p className="text-xl font-bold text-white mt-0.5">$287.50</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">$57.50/load × 5 loads</p>
                  </div>
                  {/* Summary card */}
                  <div className="bg-white border border-gray-200 rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-400 mb-1.5">Today</p>
                    <div className="flex items-center gap-3">
                      <div><p className="text-base font-semibold text-gray-900">5</p><p className="text-[9px] text-gray-500">Loads</p></div>
                      <div><p className="text-base font-semibold text-gray-900">$461</p><p className="text-[9px] text-gray-500">Fuel</p></div>
                    </div>
                  </div>
                  {/* Quick actions */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="col-span-2 flex flex-col items-center justify-center gap-1 bg-[#1a1a1a] text-white rounded-lg p-2.5">
                      <PlusCircle size={14} />
                      <span className="text-[9px] font-medium">Submit Ticket</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 bg-white border border-gray-200 rounded-lg p-2">
                      <Fuel size={13} className="text-gray-700" />
                      <span className="text-[9px] font-medium text-gray-700">Log Fuel</span>
                    </div>
                  </div>
                  {/* Today's Logs */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide px-2.5 py-1.5 border-b border-gray-100">Today's Logs</p>
                    {/* Pre-trip row */}
                    <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-50">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-900">Pre-Trip Inspection</p>
                        <p className="text-[9px] text-gray-500">6:24 AM</p>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Passed</span>
                    </div>
                    {/* Load row */}
                    <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-50">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-900">Tag #TK-4835</p>
                        <p className="text-[9px] text-gray-500">11:02 AM</p>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">submitted</span>
                    </div>
                    {/* Fuel row */}
                    <div className="flex items-center justify-between px-2.5 py-2">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-900">118.2 gal · $3.90/gal</p>
                        <p className="text-[9px] text-gray-500">7:48 AM</p>
                      </div>
                      <p className="text-[10px] font-bold text-gray-900">$461.27</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-3 font-medium">Solo owner-op — mobile</p>
          </div>

          {/* Laptop mockup — dispatcher */}
          <div>
            <div className="relative bg-[#1a1a1a] rounded-t-xl pt-3 pb-2 px-3 shadow-2xl">
              <div className="flex gap-1.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="bg-[#F8F7F5] rounded flex min-h-[480px] overflow-hidden">
                {/* Mock sidebar */}
                <div className="hidden sm:flex w-36 bg-[#1a1a1a] flex-col flex-shrink-0">
                  <div className="p-3 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <Truck size={12} className="text-white/70" />
                      <span className="font-semibold text-[10px] text-white">Fleetwise</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {[
                      { icon: BarChart3, label: 'Dashboard', active: true },
                      { icon: Users, label: 'Drivers' },
                      { icon: Send, label: 'Dispatch' },
                      { icon: FileText, label: 'Tickets' },
                      { icon: Clock, label: 'Timesheets' },
                      { icon: Fuel, label: 'Fuel' },
                      { icon: ShieldCheck, label: 'Invoices' },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-[10px] font-medium ${item.active ? 'bg-white/15 text-white' : 'text-white/60'}`}>
                        <item.icon size={10} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Dashboard content */}
                <div className="flex-1 p-4 overflow-hidden">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Tuesday, April 22</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                    {[
                      { label: 'Active Drivers', value: '3', icon: Users },
                      { label: 'Loads Today', value: '14', icon: FileText },
                      { label: 'Pending', value: '2', icon: Clock },
                      { label: 'Dispatches', value: '4', icon: Send },
                      { label: 'Fuel Spend', value: '$842', icon: Fuel },
                    ].map((m, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded p-2">
                        <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-gray-600 mb-1">
                          <m.icon size={10} />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 leading-tight">{m.value}</p>
                        <p className="text-[9px] text-gray-500 leading-tight">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-200 rounded p-2.5">
                      <p className="text-[10px] font-medium text-gray-900 mb-2">Driver Activity</p>
                      <div className="space-y-1.5">
                        {[
                          { name: 'Carlos Vega', sub: 'T-101 · Quarry · 9:14 AM', loads: '5', active: true, pass: true },
                          { name: 'Derek Johnson', sub: 'T-102 · Job site · 9:47 AM', loads: '4', active: true, pass: true },
                          { name: 'Maria Flores', sub: 'T-103 · Yard · 6:02 AM', loads: '5', active: true, pass: true },
                        ].map((d, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${d.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium text-gray-900 truncate">{d.name}</p>
                              <p className="text-[9px] text-gray-500 truncate">{d.sub}</p>
                            </div>
                            <span className="text-[10px] font-medium text-gray-700">{d.loads}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded p-2.5">
                      <p className="text-[10px] font-medium text-gray-900 mb-2">Recent Tickets</p>
                      <div className="space-y-1.5">
                        {[
                          { name: 'Carlos Vega', time: '10:42 AM', status: 'confirmed' },
                          { name: 'Derek Johnson', time: '10:31 AM', status: 'submitted' },
                          { name: 'Maria Flores', time: '10:15 AM', status: 'confirmed' },
                        ].map((t, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium text-gray-900 truncate">{t.name}</p>
                              <p className="text-[9px] text-gray-500">{t.time}</p>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              t.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-3 bg-gray-300 mx-[-20px] rounded-b-xl shadow-inner" />
            <p className="text-center text-xs text-gray-500 mt-3 font-medium">Fleet owner / dispatcher — desktop</p>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">What it does</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Everything your fleet runs on — in one place.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: <ShieldCheck size={20} />, title: 'Pre-trip inspections', body: 'Drivers run through a daily checklist. Failed items flag the dispatcher instantly with photos and notes.' },
            { icon: <MapPin size={20} />, title: 'GPS check-ins', body: 'Yard, quarry, job site — one tap. See every driver\'s location and status in real time.' },
            { icon: <FileText size={20} />, title: 'Load tickets with AI scan', body: 'Snap a photo of the paper tag. GPT-4o reads it and fills in the ticket automatically.' },
            { icon: <Fuel size={20} />, title: 'Fuel logs with receipt scan', body: 'Receipts auto-parse gallons and price per gallon. See fuel spend per driver per day.' },
            { icon: <Clock size={20} />, title: 'Hours + earnings', body: 'Drivers see their live earnings based on per-load or hourly pay rates set by the owner.' },
            { icon: <BarChart3 size={20} />, title: 'Dispatcher dashboard', body: 'Live metrics: active drivers, loads today, pending confirmations, fuel spend, inspection failures.' },
          ].map((f, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 mb-3">{f.icon}</div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-gray-200 py-20">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">How it works</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Set up in an afternoon.</h2>
          </div>

          <div className="space-y-4">
            {[
              { n: '01', title: 'Sign up in two minutes', body: 'Create your company account, pick your plan, and you\'re in. No sales call, no setup fee, no IT required.' },
              { n: '02', title: 'Invite your drivers', body: 'Share one link. Drivers register on their phone and are ready to run loads the same day.' },
              { n: '03', title: 'Run your day', body: 'Drivers complete inspections, scan tags, log fuel. Owners and dispatchers see everything live on the dashboard.' },
              { n: '04', title: 'Generate invoices automatically', body: 'When the week ends, every confirmed ticket is already waiting. Select the period, review the lines, and send the invoice.' },
            ].map(s => (
              <div key={s.n} className="flex gap-6 items-start bg-[#F8F7F5] border border-gray-200 rounded-lg p-6">
                <div className="text-3xl font-semibold text-gray-300 w-16 flex-shrink-0">{s.n}</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Why Fleetwise</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Stop losing money to paper.</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            'No more lost tickets. Every load is captured, timestamped, and photographed.',
            'No more building invoices by hand. Scanned data auto-fills tag, origin, destination, loads, rate, and amount.',
            'No more missed fuel receipts. Snap the receipt — gallons and price parse automatically.',
            'No more surprise breakdowns. Failed pre-trip items alert the dispatcher the moment they\'re flagged.',
            'No more payroll disputes. Live earnings by load or by hour, visible to driver and owner.',
            'No more chasing payments. Track every invoice from draft to paid with overdue alerts.',
            'No more guessing where drivers are. Every check-in and location is live on the dashboard.',
          ].map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={12} strokeWidth={3} />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white border-y border-gray-200 py-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Simple pricing. Per company.</h2>
            <p className="mt-3 text-sm text-gray-600 max-w-xl mx-auto">30-day free trial on every plan. Cancel anytime. No credit card to start.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              {
                id: 'solo',
                name: 'Solo',
                price: 19,
                blurb: 'For owner-operators running their own truck.',
                features: [
                  '1 driver / 1 truck',
                  'AI tag scan + receipt scan',
                  'Client invoicing with auto-filled lines',
                  'Earnings tracking per load',
                  'Pre-trip inspections',
                ],
                highlight: false,
              },
              {
                id: 'starter',
                name: 'Starter',
                price: 39,
                blurb: 'For small fleets with a dispatcher.',
                features: [
                  'Up to 5 drivers / 5 trucks',
                  'Full dispatcher dashboard',
                  'AI tag scan + receipt scan',
                  'Client invoicing + driver payroll',
                  'Timesheets + fuel tracking',
                  'Pre-trip inspections',
                ],
                highlight: true,
              },
              {
                id: 'fleet',
                name: 'Fleet',
                price: 79,
                blurb: 'For growing fleets that need more.',
                features: [
                  'Up to 20 drivers / 20 trucks',
                  'Everything in Starter',
                  'Bulk invoicing',
                  'Advanced reporting',
                  'Priority support',
                ],
                highlight: false,
              },
            ].map(tier => (
              <div
                key={tier.id}
                className={`relative rounded-xl border p-6 md:p-8 flex flex-col ${
                  tier.highlight ? 'border-[#1a1a1a] shadow-lg bg-white' : 'border-gray-200 bg-white'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{tier.blurb}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-gray-900">${tier.price}</span>
                  <span className="text-sm text-gray-500">/ month</span>
                </div>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex gap-2 items-start text-sm text-gray-700">
                      <Check size={16} className="text-gray-900 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?plan=${tier.id}`}
                  className={`mt-6 w-full py-2.5 rounded text-sm font-medium text-center ${
                    tier.highlight
                      ? 'bg-[#1a1a1a] text-white hover:bg-gray-800'
                      : 'border border-gray-300 text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Start Free Trial
                </Link>
                <button
                  onClick={() => tryDemo(tier.id === 'solo' ? 'solo' : 'fleet')}
                  disabled={demoLoading !== null}
                  className="mt-2 w-full py-2 rounded text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
                >
                  {demoLoading === (tier.id === 'solo' ? 'solo' : 'fleet') ? 'Loading…' : `Try ${tier.id === 'solo' ? 'Solo' : 'Fleet'} Demo`}
                </button>
              </div>
            ))}
          </div>

          {/* Enterprise row */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-[#F8F7F5] p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
              <p className="text-sm text-gray-600 mt-1">
                Unlimited drivers and trucks, dedicated onboarding, SLA, custom integrations, and QuickBooks priority.
              </p>
            </div>
            <button
              onClick={() => setRequestOpen(true)}
              className="px-5 py-2.5 border border-gray-900 rounded text-sm font-medium text-gray-900 hover:bg-white"
            >
              Contact sales
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1a1a1a] text-white py-20">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">Start running loads today.</h2>
          <p className="text-gray-300 mb-8">30-day free trial. No credit card. Set up in minutes.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 bg-white text-gray-900 rounded font-medium hover:bg-gray-100 text-center"
            >
              Start Free Trial
            </Link>
            <button
              onClick={() => tryDemo('solo')}
              disabled={demoLoading !== null}
              className="w-full sm:w-auto px-6 py-3 border border-gray-600 rounded font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {demoLoading === 'solo' ? 'Loading…' : 'Try Solo Demo'}
            </button>
            <button
              onClick={() => tryDemo('fleet')}
              disabled={demoLoading !== null}
              className="w-full sm:w-auto px-6 py-3 border border-gray-600 rounded font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {demoLoading === 'fleet' ? 'Loading…' : 'Try Fleet Demo'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white py-16 px-6 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <h3 className="text-xl font-semibold">Have questions?</h3>
          <p className="text-white/60 text-sm">We're here to help — reach out and we'll reply fast.</p>
          <a
            href="mailto:luisangelmureno@gmail.com?subject=Fleetwise"
            className="inline-block mt-2 bg-white text-[#1a1a1a] font-semibold text-sm px-6 py-3 rounded-lg hover:bg-white/90 transition-colors"
          >
            Contact us
          </a>
        </div>
        <p className="mt-12 text-xs text-white/30">© {new Date().getFullYear()} Fleetwise. All rights reserved.</p>
      </footer>

      {requestOpen && <RequestAccessModal onClose={() => setRequestOpen(false)} />}
    </div>
  )
}

function RequestAccessModal({ onClose }: { onClose: () => void }) {
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fleetSize, setFleetSize] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const res = await fetch('/api/request-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName,
        contact_name: contactName,
        email,
        phone,
        fleet_size: fleetSize,
        notes,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <Check className="text-green-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Request received</h3>
            <p className="text-sm text-gray-600 mb-6">We'll be in touch within one business day.</p>
            <button onClick={onClose} className="px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800">Close</button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Request Access</h3>
            <p className="text-sm text-gray-600 mb-4">Tell us about your fleet. We'll reach out to get you set up.</p>

            {error && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <input required placeholder="Company name" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input required placeholder="Your name" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input type="tel" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <select value={fleetSize} onChange={e => setFleetSize(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Fleet size (optional)</option>
                <option value="1-5">1–5 trucks</option>
                <option value="6-15">6–15 trucks</option>
                <option value="16-50">16–50 trucks</option>
                <option value="50+">50+ trucks</option>
              </select>
              <textarea rows={3} placeholder="Anything we should know? (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {submitting ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
