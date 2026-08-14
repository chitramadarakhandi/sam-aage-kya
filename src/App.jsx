import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import { ChatFloatingButton } from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Result from './pages/Result'
import Mentors from './pages/Mentors'
import Roadmap from './pages/Roadmap'
import Dashboard from './pages/Dashboard'
import PrintReport from './pages/PrintReport'
import MentorDashboard from './pages/MentorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import OfficialReadiness from './pages/OfficialReadiness'
import Scenarios from './pages/Scenarios'
import QABoard from './pages/QABoard'
import Chatbot from './pages/Chatbot'

// New pages
import CompetitiveExams from './pages/CompetitiveExams'
import StudyAbroad from './pages/StudyAbroad'
import CareerPipeline from './pages/CareerPipeline'
import Scholarships from './pages/Scholarships'
import CollegeOverview from './pages/CollegeOverview'
import MentorApplication from './pages/MentorApplication'
import MyMentorRequests from './pages/MyMentorRequests'
import RoleSelect from './pages/RoleSelect'
import Explore from './pages/Explore'
import OnlineEducation from './pages/OnlineEducation'

// AI Career Intelligence Hub — new, fully isolated flagship module.
// Does not touch the existing recommendation workflow, auth, DB schema,
// multi-agent system, or RAG pipeline; it's a standalone data+UI layer
// under src/data/careerIntel and src/pages/careerIntel.
import CareerIntelligenceHub from './pages/careerIntel/CareerIntelligenceHub'
import CareerReport from './pages/careerIntel/CareerReport'
import CareerCompare from './pages/careerIntel/CareerCompare'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-saffron to-saffron-dark flex items-center justify-center text-white font-bold text-sm font-display animate-pulse">
            AK
          </div>
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-saffron" />
          <p className="text-gray-500 text-xs">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles) {
    // A single account can hold multiple roles (e.g. student + mentor), so
    // check the full derived `roles` set rather than the single `role`
    // string, which is never overwritten to 'mentor' anymore.
    const userRoles = profile?.roles || (profile?.role ? [profile.role] : ['student'])
    const hasAllowedRole = allowedRoles.some((r) => userRoles.includes(r))
    if (!hasAllowedRole) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

// ─── Post-login redirect (magic link path) ─────────────────────────────────
// Email+password sign-in already redirects explicitly inside AuthModal. A
// magic link click, however, lands the user back on whatever page they were
// on (usually "/") with no redirect logic at all — this component catches
// that one-time "just signed in" flag (set in AuthContext) and sends the
// account to the right dashboard once its roles are known, without ever
// hijacking normal in-app navigation on subsequent page loads.
function PostLoginRedirect() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading || !user || !profile) return
    if (!sessionStorage.getItem('aageKyaJustSignedIn')) return
    sessionStorage.removeItem('aageKyaJustSignedIn')

    // "Login as" chosen in the auth modal before the magic link was sent —
    // a routing hint only, never a grant of access. See AuthModal.jsx's
    // resolvePostLoginDestination for the equivalent password-flow logic.
    const loginAs = sessionStorage.getItem('aageKyaLoginAs') || 'student'
    sessionStorage.removeItem('aageKyaLoginAs')

    const roles = profile.roles || (profile.role ? [profile.role] : ['student'])
    let destination = '/dashboard'
    if (loginAs === 'admin') {
      destination = roles.includes('admin') ? '/admin-dashboard' : '/dashboard'
    } else if (loginAs === 'mentor') {
      destination = '/mentor-dashboard'
    } else if (roles.length > 1) {
      destination = '/choose-role'
    } else if (roles.includes('admin')) {
      destination = '/admin-dashboard'
    } else if (roles.includes('mentor')) {
      destination = '/mentor-dashboard'
    }

    // Don't clobber a deep link the magic link itself pointed at (e.g.
    // emailRedirectTo set to a specific page elsewhere in the app).
    if (location.pathname === '/' ) navigate(destination, { replace: true })
  }, [loading, user, profile, location.pathname, navigate])

  return null
}

// Purely visual page-transition wrapper — fades/slides each route in on
// navigation using Framer Motion. Wraps the exact same <Routes> tree with
// no changes to paths, guards, or protected-route logic.
function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 pb-bottom-nav"
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location.pathname}>
        <Routes location={location}>
          <Route path="/"                  element={<Landing />} />
          
          {/* Protected Student Routes */}
          <Route path="/onboarding"        element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/:classLevel/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/result"            element={<ProtectedRoute><Result /></ProtectedRoute>} />
          <Route path="/:classLevel/result" element={<ProtectedRoute><Result /></ProtectedRoute>} />
          <Route path="/roadmap"           element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
          <Route path="/:classLevel/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
          <Route path="/profile"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/result/print"      element={<ProtectedRoute><PrintReport /></ProtectedRoute>} />
          <Route path="/:classLevel/result/print" element={<ProtectedRoute><PrintReport /></ProtectedRoute>} />
          <Route path="/scenarios"         element={<ProtectedRoute><Scenarios /></ProtectedRoute>} />
          <Route path="/my-mentor-requests" element={<ProtectedRoute><MyMentorRequests /></ProtectedRoute>} />
          <Route path="/choose-role"       element={<ProtectedRoute><RoleSelect /></ProtectedRoute>} />
          
          {/* Protected Mentor Routes */}
          {/* No allowedRoles gate here: a real mentor's local `students.role`
              often still reads 'student' the first time they log in (it only
              flips to 'mentor' once /api/mentor/workspace links their account
              to an approved mentor profile by email). Gating on the stale
              local role bounced real mentors back to /dashboard before that
              linking could happen. MentorDashboard itself shows an
              "apply to mentor" screen for anyone with no mentor application. */}
          <Route path="/mentor-dashboard"  element={<ProtectedRoute><MentorDashboard /></ProtectedRoute>} />
          
          {/* Protected Admin Routes */}
          <Route path="/admin-dashboard"   element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          
          {/* Public Routes */}
          <Route path="/explore"           element={<Explore />} />
          <Route path="/mentors"           element={<Mentors />} />
          <Route path="/official-readiness" element={<OfficialReadiness />} />
          <Route path="/qa"                element={<QABoard />} />
          <Route path="/chat"              element={<Chatbot />} />

          {/* New Public Routes */}
          <Route path="/competitive-exams" element={<CompetitiveExams />} />
          <Route path="/online-education"  element={<OnlineEducation />} />
          <Route path="/study-abroad"      element={<StudyAbroad />} />
          <Route path="/career-pipeline"   element={<CareerPipeline />} />
          <Route path="/scholarships"      element={<Scholarships />} />
          <Route path="/college/:id"        element={<CollegeOverview />} />
          <Route path="/mentor-apply"       element={<MentorApplication />} />

          {/* AI Career Intelligence Hub — new flagship module, fully isolated */}
          <Route path="/career-intel"          element={<CareerIntelligenceHub />} />
          <Route path="/career-intel/compare"  element={<CareerCompare />} />
          <Route path="/career-intel/:id"      element={<CareerReport />} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-navy flex flex-col">
          <ScrollToTop />
          <PostLoginRedirect />
          <Navbar />
          <AnimatedRoutes />
          <Footer />
          <ChatFloatingButton />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
