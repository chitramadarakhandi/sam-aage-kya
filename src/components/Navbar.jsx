import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'
import SearchBar from './SearchBar'

// Icon glyphs per nav destination — kept as simple emoji (matches the
// existing icon style used across the rest of the app) rather than pulling
// in a new icon library, so this is a pure visual change with zero new
// dependencies.
const ICONS = {
  '/': '🏠',
  '/explore': '🧭',
  '/onboarding': '🚀',
  '/career-pipeline': '🗺️',
  '/career-intel': '🧠',
  '/competitive-exams': '🎯',
  '/online-education': '📚',
  '/scholarships': '💰',
  '/study-abroad': '✈️',
  '/mentors': '🌟',
  '/admin-dashboard': '🛠️',
  '/mentor-dashboard': '🎓',
}

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()

  const onboardingLink = '/onboarding'
  const resultLink = profile?.class_level === 'class10' ? '/class10/result' : '/result'

  const isAdminUser = profile?.role === 'admin'
  const isMentorUser = profile?.role === 'mentor'

  // Admins and mentors get a stripped-down nav — only their own dashboard.
  // All the student-facing sections (Home, Explore, Careers, etc.) are hidden.
  // (Identical logic to before — only the container this renders into changed.)
  const navLinks = isAdminUser
    ? [{ to: '/admin-dashboard', label: 'Admin Dashboard' }]
    : isMentorUser
    ? [{ to: '/mentor-dashboard', label: 'Mentor Dashboard' }]
    : [
        { to: '/',           label: 'Home' },
        { to: '/explore',    label: 'Explore Paths' },
        { to: onboardingLink, label: 'Get Started' },
        { to: '/career-pipeline', label: 'Careers' },
        { to: '/career-intel', label: 'Career Intel Hub' },
        { to: '/competitive-exams', label: 'Exams' },
        { to: '/online-education', label: 'Learn Online' },
        { to: '/scholarships', label: 'Scholarships' },
        { to: '/study-abroad', label: 'Abroad' },
        { to: '/mentors',    label: 'Mentors' },
      ]

  // On mobile, the bottom bar only has room for a handful of primary tabs;
  // everything else (plus search/account) lives in the "More" sheet.
  const mobilePrimaryLinks = navLinks.slice(0, 4)
  const mobileMoreLinks = navLinks.slice(4)

  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close the mobile "More" sheet on route change.
  useEffect(() => { setIsMoreOpen(false) }, [location.pathname])

  const handleSignOut = async () => {
    setDropdownOpen(false)
    setIsMoreOpen(false)
    await signOut()
    navigate('/')
  }

  const initials = user?.email?.[0]?.toUpperCase() ?? '?'
  const isMentor = profile?.role === 'mentor'
  const isAdmin = profile?.role === 'admin'
  const homeTo = isAdminUser ? '/admin-dashboard' : isMentorUser ? '/mentor-dashboard' : '/'

  const isActivePath = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))

  return (
    <>
      {/* ── Top mini-bar: logo (always visible, scroll anchor) ──────────────
          Kept minimal — full navigation now lives in the floating bottom
          bar below, matching the reference design. */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex justify-between items-center">
          <Link to={homeTo} className="pointer-events-auto flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm font-display group-hover:scale-110 transition-transform duration-200 shadow-glow-brand" style={{ backgroundImage: 'linear-gradient(135deg, #4F7CFF, #A855F7, #EC4899)' }}>
              AK
            </div>
            <span className="font-display font-bold text-lg text-white group-hover:text-transparent group-hover:bg-clip-text transition-colors duration-200" style={{ backgroundImage: 'linear-gradient(90deg,#60A5FA,#EC4899)' }}>
              Aage Kya?
            </span>
          </Link>
          <div className="pointer-events-auto hidden sm:block">
            <SearchBar isCompact />
          </div>
        </div>
      </div>

      {/* ── Floating bottom navigation (desktop) ─────────────────────────── */}
      {/* Centering (left-1/2 + -translate-x-1/2) lives on this static outer
          div. Framer Motion's animate sets its own inline `transform` for
          the y/opacity entrance, which would otherwise OVERWRITE the
          Tailwind translate-x centering transform on the same element —
          that was the bug pushing the bar to the left edge. Keeping the
          animated element nested inside, instead, avoids the conflict. */}
      <div className="hidden md:flex fixed bottom-5 left-1/2 -translate-x-1/2 z-50 font-sans justify-center max-w-[calc(100vw-2rem)]">
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 }}
        >
        <div className="flex items-center gap-1 bg-[#0A0F1E]/90 backdrop-blur-2xl border border-white/10 rounded-full px-2 py-2 shadow-elevated max-w-full">
          {/* Nav links live in their own scrollable strip. Search/Auth are
              siblings OUTSIDE this scroll container — an overflow-x-auto
              (which implicitly also clips on the y-axis) was cutting off
              the Sign Out / account dropdown that pops upward above the
              bar, making it look broken/unclickable. Keeping the dropdown
              outside any overflow:auto ancestor fixes that. */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {navLinks.map((link) => {
              const active = isActivePath(link.to)
              return (
                <div key={link.to} className="relative group flex-shrink-0">
                  <NavLink
                    to={link.to}
                    end={link.to === '/'}
                    className="relative flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-semibold transition-colors duration-200 z-10 whitespace-nowrap"
                    style={{ color: active ? '#fff' : undefined }}
                  >
                    {active && (
                      <motion.span
                        layoutId="bottom-nav-active"
                        className="absolute inset-0 rounded-full -z-10"
                        style={{ backgroundImage: 'linear-gradient(90deg, #4F7CFF, #A855F7, #EC4899)' }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className={active ? '' : 'text-gray-400 group-hover:text-white'}>
                      <span className="mr-1">{ICONS[link.to] || '•'}</span>
                      <span className="hidden xl:inline">{link.label}</span>
                    </span>
                  </NavLink>
                  {/* Tooltip (shows full label on screens where labels are icon-only) */}
                  <span className="xl:hidden pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#0D1117] border border-white/10 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {link.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Divider */}
          <span className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          {/* Search */}
          <div className="relative group flex-shrink-0">
            <SearchIconTrigger />
            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#0D1117] border border-white/10 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              Search
            </span>
          </div>

          {/* Auth */}
          {user ? (
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full transition-all duration-200 hover:bg-white/10"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundImage: 'linear-gradient(135deg,#4F7CFF,#EC4899)' }}>
                  {initials}
                </div>
                <svg className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 bottom-full mb-3 w-56 bg-[#0D1117] rounded-2xl border border-white/10 overflow-hidden shadow-elevated z-50"
                  >
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-white text-xs font-semibold truncate">{user.email}</p>
                      <p className="text-gray-500 text-[10px] mt-0.5 capitalize">
                        {isAdmin ? '🔑 Admin' : isMentor ? '🌟 Mentor' : '🎓 Student'}
                      </p>
                    </div>
                    <div className="py-1">
                      {!isAdmin && !isMentor && (
                        <Link to="/dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                          <span>🏠</span> Dashboard
                        </Link>
                      )}
                      {isAdmin && (
                        <Link to="/admin-dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                          <span>🛠️</span> Admin Dashboard
                        </Link>
                      )}
                      {isMentor && (
                        <Link to="/mentor-dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                          <span>🎓</span> Mentor Dashboard
                        </Link>
                      )}
                      {!isAdmin && !isMentor && (
                        <Link to={resultLink} onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                          <span>📄</span> My Results
                        </Link>
                      )}
                      {!isAdmin && !isMentor && (
                        <Link to="/my-mentor-requests" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                          <span>💬</span> My Mentor Requests
                        </Link>
                      )}
                    </div>
                    <div className="border-t border-white/5 py-1">
                      <button onClick={handleSignOut} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-colors">
                        <span>🚪</span> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex-shrink-0 text-white text-xs font-bold px-4 py-2.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 whitespace-nowrap"
              style={{ backgroundImage: 'linear-gradient(90deg,#4F7CFF,#A855F7,#EC4899)' }}
            >
              Sign In
            </button>
          )}
        </div>
        </motion.nav>
      </div>

      {/* ── Floating bottom navigation (mobile) ──────────────────────────── */}
      {/* Same fix as desktop: centering/edge-inset lives on the static
          outer div; Framer Motion's transform-based animation is isolated
          to the nested element so it can't clobber layout positioning. */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-50 font-sans">
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 }}
        >
        <div className="flex items-center justify-between gap-1 bg-[#0A0F1E]/92 backdrop-blur-2xl border border-white/10 rounded-2xl px-2 py-2 shadow-elevated">
          {mobilePrimaryLinks.map((link) => {
            const active = isActivePath(link.to)
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className="relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold z-10"
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-mobile-active"
                    className="absolute inset-0 rounded-xl -z-10"
                    style={{ backgroundImage: 'linear-gradient(135deg, #4F7CFF, #A855F7, #EC4899)' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="text-base">{ICONS[link.to] || '•'}</span>
                <span className={active ? 'text-white' : 'text-gray-500'}>{link.label.split(' ')[0]}</span>
              </NavLink>
            )
          })}

          <button
            onClick={() => setIsMoreOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold text-gray-500"
          >
            <span className="text-base">☰</span>
            <span>More</span>
          </button>
        </div>
        </motion.nav>
      </div>

      {/* ── Mobile "More" sheet — rest of nav + search + account ─────────── */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] md:hidden"
              onClick={() => setIsMoreOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[91] md:hidden bg-[#0A0F1E] border-t border-white/10 rounded-t-3xl px-5 pt-5 pb-28 max-h-[75vh] overflow-y-auto"
            >
              <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

              <div className="mb-4">
                <SearchBar isCompact={false} />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {[...mobilePrimaryLinks, ...mobileMoreLinks].map((link) => {
                  const active = isActivePath(link.to)
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsMoreOpen(false)}
                      className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                        active ? 'text-white' : 'text-gray-300 bg-white/5 border border-white/10'
                      }`}
                      style={active ? { backgroundImage: 'linear-gradient(135deg, #4F7CFF, #A855F7, #EC4899)' } : undefined}
                    >
                      <span>{ICONS[link.to] || '•'}</span> {link.label}
                    </Link>
                  )
                })}
              </div>

              <div className="pt-3 border-t border-white/5 space-y-2">
                {user ? (
                  <>
                    <p className="text-gray-500 text-xs px-1 mb-1">{user.email}</p>
                    {!isAdmin && !isMentor && (
                      <Link to="/dashboard" onClick={() => setIsMoreOpen(false)} className="block px-3.5 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5">🏠 Dashboard</Link>
                    )}
                    {!isAdmin && !isMentor && (
                      <Link to={resultLink} onClick={() => setIsMoreOpen(false)} className="block px-3.5 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5">📄 My Results</Link>
                    )}
                    {!isAdmin && !isMentor && (
                      <Link to="/my-mentor-requests" onClick={() => setIsMoreOpen(false)} className="block px-3.5 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5">💬 My Mentor Requests</Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin-dashboard" onClick={() => setIsMoreOpen(false)} className="block px-3.5 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5">🛠️ Admin Dashboard</Link>
                    )}
                    {isMentor && (
                      <Link to="/mentor-dashboard" onClick={() => setIsMoreOpen(false)} className="block px-3.5 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5">🎓 Mentor Dashboard</Link>
                    )}
                    <button onClick={handleSignOut} className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm text-rose-400 bg-rose-500/5">
                      🚪 Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setIsMoreOpen(false); setIsAuthOpen(true) }}
                    className="w-full btn-primary text-sm py-3"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  )
}

// Small wrapper so the SearchBar's compact trigger can sit inline inside
// the pill nav without altering SearchBar's own implementation.
function SearchIconTrigger() {
  return (
    <div className="[&>button]:!bg-transparent [&>button]:!border-0 [&>button]:!px-3 [&>button]:!py-2.5 [&>button_span]:hidden [&>button_kbd]:hidden">
      <SearchBar isCompact />
    </div>
  )
}
