import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
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
import Explore from './pages/Explore'
import OnlineEducation from './pages/OnlineEducation'

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
    const userRole = profile?.role || 'student'
    if (!allowedRoles.includes(userRole)) {
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

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter flex-1">
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
        
        {/* Protected Mentor Routes */}
        <Route path="/mentor-dashboard"  element={<ProtectedRoute allowedRoles={['mentor']}><MentorDashboard /></ProtectedRoute>} />
        
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
      </Routes>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-navy flex flex-col">
          <ScrollToTop />
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
