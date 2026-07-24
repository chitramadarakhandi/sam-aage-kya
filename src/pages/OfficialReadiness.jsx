import { useState } from 'react'

const TABS = [
  { id: 'apaar',    icon: '🪪', label: 'APAAR ID' },
  { id: 'digilocker', icon: '☁️', label: 'DigiLocker' },
  { id: 'abc',      icon: '🏦', label: 'ABC / NCrF' },
  { id: 'docs',     icon: '📂', label: 'Admissions Docs' },
]

const STORAGE_KEY = 'aageKyaOfficialChecks'

function useChecklist(prefix, items) {
  const [checked, setChecked] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return saved[prefix] || {}
    } catch { return {} }
  })

  const toggle = (key) => {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [prefix]: next }))
      } catch {}
      return next
    })
  }

  const done = Object.values(checked).filter(Boolean).length
  return { checked, toggle, done, total: items.length }
}

function CheckItem({ id: _id, text, note, checked, onChange }) {
  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all group
        ${checked
          ? 'bg-emerald-500/10 border-emerald-500/25'
          : 'bg-white/4 border-white/8 hover:border-white/15'
        }`}
    >
      <div
        onClick={onChange}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
          ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-white/25 group-hover:border-white/40'}`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1" onClick={onChange}>
        <span className={`text-sm font-medium block leading-snug ${checked ? 'text-emerald-300 line-through decoration-emerald-500/50' : 'text-gray-200'}`}>
          {text}
        </span>
        {note && <span className="text-xs text-gray-500 mt-0.5 block leading-snug">{note}</span>}
      </div>
    </label>
  )
}

function ProgressRing({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="#10b981" strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-emerald-400">{pct}%</span>
      </div>
    </div>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

const APAAR_ITEMS = [
  { id: 'a1', text: 'Visit abc.gov.in and click "Register as Student"', note: 'Academic Bank of Credits portal — free to register' },
  { id: 'a2', text: 'Login with DigiLocker (create account first if needed)', note: 'DigiLocker is your digital document wallet — also free' },
  { id: 'a3', text: 'Enter your Aadhaar number to link identity', note: 'Only for APAAR linking — we never store this' },
  { id: 'a4', text: 'Verify OTP sent to Aadhaar-linked mobile number' },
  { id: 'a5', text: 'Download your APAAR card from the portal', note: 'Keep this — it will be needed for college admissions from 2025 onwards' },
  { id: 'a6', text: 'Ask your school to register you on the APAAR system too', note: 'Schools need to bulk-register students under their UDISE code' },
  { id: 'a7', text: 'Store APAAR ID in a safe place (Notes app or family WhatsApp group)', note: 'Do NOT share on social media or with strangers' },
]

const DIGI_ITEMS = [
  { id: 'd1', text: 'Create a DigiLocker account at digilocker.gov.in', note: 'Free for all Indian citizens with Aadhaar' },
  { id: 'd2', text: 'Link your Aadhaar to activate all document pulling features' },
  { id: 'd3', text: 'Pull your 10th Marksheet (via CBSE / State Board integration)', note: 'Available for CBSE, most state boards — check if your board is listed' },
  { id: 'd4', text: 'Pull your 12th Marksheet (after appearing in exams)', note: 'Usually available within 2-4 weeks of results' },
  { id: 'd5', text: 'Upload Income Certificate (issued by Tehsildar/SDM)', note: 'Required for scholarship applications — keep PDF ready' },
  { id: 'd6', text: 'Upload Caste/Category Certificate if applicable', note: 'OBC/SC/ST/EWS certificates needed for reserved category seats and scholarships' },
  { id: 'd7', text: 'Upload School Transfer Certificate (TC)', note: 'Required at most colleges during admission' },
]

const ABC_ITEMS = [
  { id: 'b1', text: 'Understand what ABC (Academic Bank of Credits) is', note: 'A national digital bank where your academic credits from any NAAC-accredited institution are stored' },
  { id: 'b2', text: 'Know that NCrF (National Credit Framework) assigns credit values to learning', note: 'Even class 9-12 has credit equivalence — this affects how colleges value your profile' },
  { id: 'b3', text: 'Register on abc.gov.in using your APAAR ID (same portal)', note: 'One login, two linked systems' },
  { id: 'b4', text: 'Understand credit transfer rules if you switch colleges or take a break', note: 'Under NEP 2020, you can pause studies and resume — credits don\'t expire (5-year window)' },
  { id: 'b5', text: 'Ask your college counsellor about their ABC integration status', note: 'Not all colleges are fully integrated yet as of 2025' },
]

const DOC_ITEMS = [
  { id: 'doc1', text: '10th Board Marksheet (original + 2 photocopies)' },
  { id: 'doc2', text: '12th Board Marksheet (original + 2 photocopies)', note: 'Get certified copies made once results are out' },
  { id: 'doc3', text: 'Transfer Certificate (TC) from your school' },
  { id: 'doc4', text: 'Migration Certificate (for students changing board / state)', note: 'Usually issued by your current board — apply early, takes 2-6 weeks' },
  { id: 'doc5', text: 'Aadhaar Card (self-attested photocopy)', note: 'Standard identity proof required at most institutions' },
  { id: 'doc6', text: 'Passport-size photographs (minimum 8-10 copies)', note: 'Carry more than you think you need — admission forms always ask for extras' },
  { id: 'doc7', text: 'Income Certificate (for scholarship and reserved-category applications)', note: 'Issued by Tehsildar/SDM — valid for 1 year from issue date' },
  { id: 'doc8', text: 'Caste/Category Certificate if applicable (OBC/SC/ST/EWS)', note: 'Must be in the correct format as prescribed by Central/State government' },
  { id: 'doc9', text: 'Domicile Certificate (if required by state university)', note: 'Some state universities require proof of state domicile for local quota seats' },
  { id: 'doc10', text: 'Gap Certificate (if any gap year taken)', note: 'Notarised affidavit explaining the gap — required by many DU, BHU, and other central university colleges' },
]

function ApaarTab() {
  const { checked, toggle, done, total } = useChecklist('apaar', APAAR_ITEMS)
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 mb-6">
        <ProgressRing done={done} total={total} />
        <div>
          <h3 className="font-display font-bold text-white text-lg">APAAR ID Setup</h3>
          <p className="text-gray-400 text-sm leading-relaxed mt-1">
            APAAR (Automated Permanent Academic Account Registry) is your lifelong academic identity, required for college admissions from 2025 onwards. This is NOT the same as Aadhaar — it's just linked to it.
          </p>
          <a href="https://abc.gov.in" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs text-saffron hover:underline">
            Open abc.gov.in ↗
          </a>
        </div>
      </div>
      <div className="space-y-2">
        {APAAR_ITEMS.map(item => (
          <CheckItem key={item.id} {...item} checked={!!checked[item.id]} onChange={() => toggle(item.id)} />
        ))}
      </div>
    </div>
  )
}

function DigiLockerTab() {
  const { checked, toggle, done, total } = useChecklist('digilocker', DIGI_ITEMS)
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 mb-6">
        <ProgressRing done={done} total={total} />
        <div>
          <h3 className="font-display font-bold text-white text-lg">DigiLocker Readiness</h3>
          <p className="text-gray-400 text-sm leading-relaxed mt-1">
            DigiLocker stores all your official documents digitally. Most colleges now accept DigiLocker-linked documents as originals. Set it up <em>before</em> results season to avoid last-minute rush.
          </p>
          <a href="https://digilocker.gov.in" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs text-saffron hover:underline">
            Open digilocker.gov.in ↗
          </a>
        </div>
      </div>
      <div className="space-y-2">
        {DIGI_ITEMS.map(item => (
          <CheckItem key={item.id} {...item} checked={!!checked[item.id]} onChange={() => toggle(item.id)} />
        ))}
      </div>
    </div>
  )
}

function AbcTab() {
  const { checked, toggle, done, total } = useChecklist('abc', ABC_ITEMS)
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 mb-6">
        <ProgressRing done={done} total={total} />
        <div>
          <h3 className="font-display font-bold text-white text-lg">Academic Bank of Credits (ABC) &amp; NCrF</h3>
          <p className="text-gray-400 text-sm leading-relaxed mt-1">
            Under NEP 2020, India now has a credit system similar to international universities. ABC stores your credits. NCrF sets how credits are valued across school, vocational, and higher education levels. Understanding this matters more after Class 12.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {ABC_ITEMS.map(item => (
          <CheckItem key={item.id} {...item} checked={!!checked[item.id]} onChange={() => toggle(item.id)} />
        ))}
      </div>

      <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
        <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">Plain-English Explainer</p>
        <ul className="space-y-2 text-gray-300 text-sm leading-relaxed">
          <li><strong className="text-white">ABC</strong> = A national piggy bank for your educational credits. Like a bank account, but for academic achievement.</li>
          <li><strong className="text-white">NCrF</strong> = The national rulebook that says "1 year of Class 11 = X credits". Applies to schools, colleges, and even skill/vocational training.</li>
          <li><strong className="text-white">Why it matters</strong> = You can now switch streams, take a gap year, do skill programs and count them. Rigid 3-year degrees are being replaced by flexible 4-year programs where you can exit at 1, 2, or 3 years with different certificates.</li>
        </ul>
      </div>
    </div>
  )
}

function DocsTab() {
  const { checked, toggle, done, total } = useChecklist('docs', DOC_ITEMS)
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 mb-6">
        <ProgressRing done={done} total={total} />
        <div>
          <h3 className="font-display font-bold text-white text-lg">Admissions Document Checklist</h3>
          <p className="text-gray-400 text-sm leading-relaxed mt-1">
            Keep originals + 2-3 self-attested photocopies of everything. Most colleges in India still require physical documents at the time of in-person admission. Start collecting these <strong>before</strong> results — some take weeks to obtain.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {DOC_ITEMS.map(item => (
          <CheckItem key={item.id} {...item} checked={!!checked[item.id]} onChange={() => toggle(item.id)} />
        ))}
      </div>

      <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300">
        <strong className="text-white block mb-1">⚠️ Pro tip</strong>
        Keep a WhatsApp folder or Google Drive folder with scans of all documents. Many online forms require uploads, and having them pre-scanned in one place saves hours during admission season.
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficialReadiness() {
  const [activeTab, setActiveTab] = useState('apaar')

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-saffron text-sm font-semibold">Official System Readiness</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Don't Get Caught{' '}
            <span className="gradient-text">Off Guard</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            India's academic system is changing fast — APAAR, DigiLocker, ABC, NEP 2020. Here's what you actually need to do, explained plainly.
          </p>
        </div>

        {/* Important notice */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <span className="text-xl shrink-0">📌</span>
          <p className="text-amber-200 text-sm leading-relaxed">
            <strong>This is informational only.</strong> We don't connect to APAAR, DigiLocker, or any government portal. These are checklists to guide you — all links open official government websites directly.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-white/4 border border-white/8 rounded-2xl p-1.5 mb-8">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all
                ${activeTab === tab.id
                  ? 'bg-saffron text-navy font-bold shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <span className="text-base sm:text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="glass-card p-6 sm:p-8">
          {activeTab === 'apaar'      && <ApaarTab />}
          {activeTab === 'digilocker' && <DigiLockerTab />}
          {activeTab === 'abc'        && <AbcTab />}
          {activeTab === 'docs'       && <DocsTab />}
        </div>

        {/* Bottom note */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Checklist progress is saved in your browser. No data is sent to our servers for these static checklist items.
        </p>
      </div>
    </main>
  )
}
