import { useState, useEffect, useCallback } from 'react'
import { apiUrl } from '../api'
import { STATE_NAMES } from '../data/indiaLocations'

export default function RankPredictor({ formData }) {
  // State for user rank input and config
  const [exam, setExam] = useState(() => {
    if (formData?.stream?.includes('PCB')) return 'NEET'
    return 'JEE' // default PCM/PCMB to JEE
  })
  
  const [rank, setRank] = useState('')
  const [category, setCategory] = useState('General')
  const [domicileState, setDomicileState] = useState(formData?.state || '')
  
  // Tabs: 'finder' (Feature 1/3) or 'simulator' (Feature 2)
  const [activeTab, setActiveTab] = useState('finder')

  // Finder results
  const [predictedOptions, setPredictedOptions] = useState([])
  const [finderLoading, setFinderLoading] = useState(false)
  const [finderError, setFinderError] = useState('')

  // Simulator state
  const [simCollege, setSimCollege] = useState('')
  const [simCourse, setSimCourse] = useState('')
  const [availableColleges, setAvailableColleges] = useState([])
  const [availableCourses, setAvailableCourses] = useState([])
  const [collegeCourses, setCollegeCourses] = useState({})
  const [simulationResult, setSimulationResult] = useState(null)
  const [simLoading, setSimLoading] = useState(false)

  // Adjust categories when exam changes
  useEffect(() => {
    if (exam === 'KCET') {
      setCategory('GM')
    } else {
      setCategory('General')
    }
    // Reset finder and simulation results
    setPredictedOptions([])
    setSimulationResult(null)
    setSimCollege('')
    setSimCourse('')
  }, [exam])

  // Fetch unique colleges/courses for the simulator dropdowns when exam changes
  useEffect(() => {
    let active = true
    const fetchOptions = async () => {
      try {
        const res = await fetch(apiUrl(`/api/predictor/options?exam=${exam}`))
        if (!res.ok) throw new Error('Failed to fetch simulator options')
        const data = await res.json()
        if (active) {
          setAvailableColleges(data.colleges || [])
          setCollegeCourses(data.collegeCourses || {})
        }
      } catch (err) {
        console.error('Error fetching options:', err)
      }
    }
    fetchOptions()
    return () => { active = false }
  }, [exam])

  // Update courses dropdown when selected college changes in simulator.
  // Uses the collegeCourses map fetched in the options request (no extra call).
  useEffect(() => {
    if (!simCollege) {
      setAvailableCourses([])
      setSimCourse('')
      return
    }
    const courses = collegeCourses[simCollege] || []
    setAvailableCourses(courses)
    setSimCourse('')
  }, [simCollege, collegeCourses])

  // Handle Predictor query (Reverse Finder)
  const handlePredict = async (e) => {
    if (e) e.preventDefault()
    if (!rank || isNaN(parseInt(rank, 10))) {
      setFinderError('Please enter a valid rank number')
      return
    }
    setFinderError('')
    setFinderLoading(true)
    setPredictedOptions([])

    try {
      const url = apiUrl(`/api/predictor/predict?exam=${exam}&rank=${rank}&category=${category}&state=${encodeURIComponent(domicileState)}`)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Server returned an error')
      const data = await res.json()
      setPredictedOptions(data.results || [])
      if (data.results?.length === 0) {
        setFinderError('No matching college options found for this rank.')
      }
    } catch (err) {
      setFinderError('Could not retrieve predictions. Ensure the backend server is running.')
      console.error(err)
    } finally {
      setFinderLoading(false)
    }
  }

  // Handle manual simulation
  const handleSimulate = useCallback(async () => {
    if (!rank || isNaN(parseInt(rank, 10))) {
      alert('Please enter your rank first.')
      return
    }
    if (!simCollege || !simCourse) return

    setSimLoading(true)
    setSimulationResult(null)

    try {
      const url = apiUrl(`/api/predictor/simulate?college=${encodeURIComponent(simCollege)}&course=${encodeURIComponent(simCourse)}&exam=${exam}&rank=${rank}&category=${category}`)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to run simulation')
      const data = await res.json()
      setSimulationResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      setSimLoading(false)
    }
  }, [rank, simCollege, simCourse, exam, category])

  // Auto trigger simulation when college/course selection changes and rank is present
  useEffect(() => {
    if (simCollege && simCourse && rank && !isNaN(parseInt(rank, 10))) {
      handleSimulate()
    }
  }, [simCollege, simCourse, rank, handleSimulate])

  // Colour a historical-cutoff position. These labels are not probabilities.
  const getBadgeClass = (status) => {
    switch (status) {
      case 'Well within latest cutoff':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      case 'Within latest cutoff':
        return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
      case 'Near latest cutoff':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      case 'Outside latest cutoff':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400'
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400'
    }
  }

  return (
    <div className="glass-card p-6 sm:p-7 border-indigo-500/20 bg-indigo-950/20 rounded-2xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <span>📊</span> Historical Cutoff Comparison
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">
            Compare a rank with available historical closing ranks. This is not an admission probability.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('finder')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'finder'
                ? 'bg-saffron text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔎 Match My Rank
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'simulator'
                ? 'bg-saffron text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🧪 Compare One Option
          </button>
        </div>
      </div>

      {/* Rank Configuration Form */}
      <form onSubmit={handlePredict} className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/4 p-4 rounded-xl border border-white/8">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">Exam</label>
          <select
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            className="w-full bg-indigo-950/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-saffron"
          >
            <option value="JEE">JEE prototype data (Main/Advanced combined)</option>
            <option value="NEET">NEET (AIIMS / Medical)</option>
            <option value="KCET">KCET (Karnataka)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">Your Rank</label>
          <input
            type="number"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            placeholder="e.g. 1500"
            className="w-full bg-indigo-950/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-saffron"
            required
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-indigo-950/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-saffron"
          >
            {exam === 'KCET' ? (
              <>
                <option value="GM">General Merit (GM)</option>
                <option value="OBC">OBC (2A/2B/3A/3B)</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
              </>
            ) : (
              <>
                <option value="General">General / Open</option>
                <option value="OBC">OBC-NCL</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">Domicile State</label>
          <select
            value={domicileState}
            onChange={(e) => setDomicileState(e.target.value)}
            className="w-full bg-indigo-950/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-saffron"
          >
            <option value="">Select State</option>
            {STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {activeTab === 'finder' && (
          <div className="col-span-2 sm:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={finderLoading}
              className="bg-saffron hover:bg-saffron-light text-white font-bold text-xs py-2 px-5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {finderLoading ? 'Searching...' : '🔎 Predict My Colleges'}
            </button>
          </div>
        )}
      </form>

      {/* Tab Contents: Finder */}
      {activeTab === 'finder' && (
        <div className="space-y-4">
          {finderError && (
            <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
              ⚠️ {finderError}
            </p>
          )}

          {predictedOptions.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                <span>College & Course Option</span>
                <span>Chances / History (Closing Ranks)</span>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {predictedOptions.map((opt, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white/4 border border-white/8 rounded-xl hover:border-indigo-500/30 transition-all gap-3"
                  >
                    <div>
                      <h4 className="text-white text-xs font-bold">{opt.college_name}</h4>
                      <p className="text-indigo-300 text-[10px] mt-0.5">{opt.course}</p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {/* Trend representation */}
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        {opt.trends.map((t, idx) => (
                          <span key={idx} className={t.year === 2025 ? 'text-gray-200 font-semibold' : ''}>
                            {t.year}: <strong className="text-indigo-200">{t.closing_rank.toLocaleString()}</strong>
                            {idx < opt.trends.length - 1 && <span className="mx-1 text-white/10">|</span>}
                          </span>
                        ))}
                      </div>

                      {/* Likelihood badge */}
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${getBadgeClass(opt.likelihood)}`}>
                        {opt.likelihood}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Simulator */}
      {activeTab === 'simulator' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">Select College</label>
              <select
                value={simCollege}
                onChange={(e) => setSimCollege(e.target.value)}
                className="w-full bg-indigo-950/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-saffron"
              >
                <option value="">-- Choose College --</option>
                {availableColleges.map((col, idx) => (
                  <option key={idx} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">Select Course</label>
              <select
                value={simCourse}
                disabled={!simCollege}
                onChange={(e) => setSimCourse(e.target.value)}
                className="w-full bg-indigo-950/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-saffron"
              >
                <option value="">-- Choose Course --</option>
                {availableCourses.map((crs, idx) => (
                  <option key={idx} value={crs}>{crs}</option>
                ))}
              </select>
            </div>
          </div>

          {simLoading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-saffron border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {simulationResult && (
            <div className="bg-white/4 border border-white/8 rounded-xl p-5 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white text-sm font-bold">{simulationResult.college}</h4>
                  <p className="text-indigo-300 text-xs mt-0.5">{simulationResult.course}</p>
                </div>

                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getBadgeClass(simulationResult.likelihood)}`}>
                  {simulationResult.likelihood}
                </span>
              </div>

              {/* Trend visual chart representation */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Closing Rank Trend vs Your Rank ({parseInt(rank).toLocaleString()})</p>
                
                <div className="grid grid-cols-3 gap-3">
                  {simulationResult.trends.map((t, idx) => {
                    const margin = t.closing_rank - parseInt(rank)
                    return (
                      <div key={idx} className="bg-indigo-950/40 border border-white/5 rounded-lg p-3 text-center space-y-1.5">
                        <span className="text-[10px] text-gray-400 font-bold block">{t.year} Cutoff</span>
                        <span className="text-white text-sm font-bold block">{t.closing_rank.toLocaleString()}</span>
                        
                        {/* Margin indicator */}
                        <span className={`text-[9px] font-semibold ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {margin >= 0 ? `${margin.toLocaleString()} ranks within` : `${Math.abs(margin).toLocaleString()} ranks outside`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimers & Info */}
      <div className="text-[10px] text-gray-500 bg-white/2 rounded-xl p-3 border border-white/5">
        <strong className="text-gray-400 font-bold">Prototype limitation:</strong> The current dataset does not fully separate counselling round, quota, domicile, seat pool, or JEE Main versus Advanced. Labels only compare your rank with the latest stored closing rank; they are not calibrated chances or guarantees. Use the current official counselling authority data before acting.
      </div>

    </div>
  )
}
