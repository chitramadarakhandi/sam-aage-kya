import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'
import SearchBar from './SearchBar'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()

  const onboardingLink = '/onboarding'
  const resultLink = profile?.class_level === 'class10' ? '/class10/result' : '/result'

  const isAdminUser = profile?.role === 'admin'
  const isMentorUser = profile?.role === 'mentor'

  // Admins and mentors get a stripped-down nav — only their own dashboard.
  // All the student-facing sections (Home, Explore, Careers, etc.) are hidden.
  const navLinks = isAdminUser
    ? [{ to: '/admin-dashboard', label: 'Admin Dashboard' }]
    : isMentorUser
    ? [{ to: '/mentor-dashboard', label: 'Mentor Dashboard' }]
    : [
        { to: '/',           label: 'Home' },
        { to: '/explore',    label: 'Explore Paths' },
        { to: onboardingLink, label: 'Get Started' },
        { to: '/career-pipeline', label: 'Careers' },
        { to: '/competitive-exams', label: 'Exams' },
        { to: '/online-education', label: 'Learn Online' },
        { to: '/scholarships', label: 'Scholarships' },
        { to: '/study-abroad', label: 'Abroad' },
        { to: '/mentors',    label: 'Mentors' },
      ]
  const [isOpen, setIsOpen]     = useState(false)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Scroll-aware glass effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  const handleSignOut = async () => {
    setDropdownOpen(false)
    await signOut()
    navigate('/')
  }

  const initials = user?.email?.[0]?.toUpperCase() ?? '?'
  const isMentor = profile?.role === 'mentor'
  const isAdmin = profile?.role === 'admin'

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 font-sans transition-all duration-300 ${
          scrolled
            ? 'bg-[#06080F]/92 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.4)]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to={isAdminUser ? '/admin-dashboard' : isMentorUser ? '/mentor-dashboard' : '/'} className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-saffron to-saffron-dark flex items-center justify-center text-white font-bold text-sm font-display group-hover:scale-110 transition-transform duration-200 shadow-md">
                AK
              </div>
              <span className="font-display font-bold text-xl text-white group-hover:text-saffron transition-colors duration-200">
                Aage Kya?
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `relative px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-white bg-white/8'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.label}
                      {isActive && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-saffron" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Desktop right side */}
            <div className="hidden md:flex items-center gap-2">
              {/* Universal Search */}
              <SearchBar isCompact />

              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2 transition-all duration-200"
                  >
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-saffron to-saffron-dark flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                    <span className="text-gray-300 text-xs max-w-[80px] truncate hidden lg:inline">{user.email}</span>
                    <svg className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden shadow-xl animate-fade-in z-50">
                      <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-white text-xs font-semibold truncate">{user.email}</p>
                        <p className="text-gray-500 text-[10px] mt-0.5 capitalize">
                          {isAdmin ? '🔑 Admin' : isMentor ? '🌟 Mentor' : '🎓 Student'}
                        </p>
                      </div>
                      <div className="py-1">
                        {!isAdmin && !isMentor && (
                          <Link
                            to="/dashboard"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Dashboard
                          </Link>
                        )}
                        {isAdmin && (
                          <Link
                            to="/admin-dashboard"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            Admin Dashboard
                          </Link>
                        )}
                        {isMentor && (
                          <Link
                            to="/mentor-dashboard"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Mentor Dashboard
                          </Link>
                        )}
                        {!isAdmin && !isMentor && (
                          <Link
                            to={resultLink}
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            My Results
                          </Link>
                        )}
                        {!isAdmin && !isMentor && (
                          <Link
                            to="/my-mentor-requests"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            My Mentor Requests
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-white/5 py-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="btn-primary text-xs py-2 px-5"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile menu */}
          {isOpen && (
            <div className="md:hidden pb-4 border-t border-white/5 mt-2 pt-4 space-y-1 animate-fade-in">
              {/* Mobile Search */}
              <div className="mb-3 px-1">
                <SearchBar isCompact={false} />
              </div>

              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'text-white bg-saffron/15 border border-saffron/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="pt-3 border-t border-white/5 space-y-2">
                {user ? (
                  <>
                    {!isAdmin && (
                      <Link to="/dashboard" onClick={() => setIsOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/5">
                        Dashboard
                      </Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin-dashboard" onClick={() => setIsOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/5">
                        Admin Dashboard
                      </Link>
                    )}
                    {isMentor && (
                      <Link to="/mentor-dashboard" onClick={() => setIsOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/5">
                        Mentor Dashboard
                      </Link>
                    )}
                    <button
                      onClick={() => { setIsOpen(false); handleSignOut() }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-rose-400 hover:bg-rose-500/5 transition-colors"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setIsOpen(false); setIsAuthOpen(true) }}
                    className="w-full btn-primary text-sm py-2.5"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  )
}
