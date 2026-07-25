import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { findEnrichment } from '../data/collegeEnrichment'
import { formatLocation } from '../utils/location'
import { getCollegeDetails } from '../api'

// Enrichment data + its exact-match lookup live in src/data/collegeEnrichment.js
// (keyed by full institution name) so they can be unit-tested without React.

// ─── CollegeDetailCard ────────────────────────────────────────────────────────

export default function CollegeDetailCard({ collegeName, sourceUrl }) {
  const [isOpen, setIsOpen] = useState(false)
  const [aiData, setAiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const staticData = findEnrichment(collegeName)
  const displayData = staticData || aiData

  const fetchCollegeDetails = async () => {
    if (staticData || fetched || loading) return
    setLoading(true)
    try {
      const res = await getCollegeDetails(collegeName)
      if (res.ok) {
        const data = await res.json()
        setAiData(data)
      }
    } catch (err) {
      console.warn('College details fetch failed:', err)
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  const handleToggle = () => {
    if (!isOpen && !staticData && !fetched) {
      fetchCollegeDetails()
    }
    setIsOpen(prev => !prev)
  }

  return (
    <div className="relative">
      {/* College name button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-left w-full group hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all"
      >
        <span className="text-saffron mt-0.5 text-xs flex-shrink-0">▸</span>
        <span className="text-gray-300 text-sm group-hover:text-saffron transition-colors flex-1">
          {collegeName}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-600 text-[10px] flex-shrink-0"
        >
          ▼
        </motion.span>
      </button>

      {/* Dropdown Detail Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden mt-1 ml-4"
          >
            <div className="bg-[#0d1526] border border-white/10 rounded-xl p-4 space-y-3">

              {/* Loading state */}
              {loading && (
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <div className="w-3 h-3 rounded-full border-2 border-saffron/40 border-t-saffron animate-spin" />
                  Fetching college details…
                </div>
              )}

              {/* No data yet */}
              {!loading && !displayData && (
                <div className="text-gray-500 text-xs text-center py-2">
                  No detailed info available for this college yet.
                  <br />
                  <a
                    href={sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(collegeName + ' India college details fees')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-saffron hover:underline mt-1 inline-block"
                  >
                    Search on Google →
                  </a>
                </div>
              )}

              {/* College Details */}
              {displayData && (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-display font-bold text-white text-sm leading-tight">
                        {displayData.fullName || collegeName}
                      </h5>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {formatLocation([displayData.city, displayData.state, displayData.type])}
                      </p>
                    </div>
                    {displayData.naac && (
                      <span className="flex-shrink-0 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg">
                        NAAC {displayData.naac}
                      </span>
                    )}
                  </div>

                  {displayData.nirf && (
                    <p className="text-gray-400 text-xs">🏆 {displayData.nirf}</p>
                  )}

                  {/* Fee Structure */}
                  {displayData.fees && (
                    <div className="bg-white/4 rounded-lg p-3 space-y-1.5">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">💰 Fee Structure</p>
                      {displayData.fees.govtQuota && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-emerald-400 flex-shrink-0">Govt/State Quota:</span>
                          <span className="text-gray-200">{displayData.fees.govtQuota}</span>
                        </div>
                      )}
                      {displayData.fees.managementQuota && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-amber-400 flex-shrink-0">Mgmt/Private Seat:</span>
                          <span className="text-gray-200">{displayData.fees.managementQuota}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cutoffs */}
                  {displayData.cutoffs && (
                    <div className="bg-white/4 rounded-lg p-3 space-y-1.5">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">📊 Exam Cutoffs</p>
                      {Object.entries(displayData.cutoffs).map(([exam, cutoff]) => cutoff && cutoff !== 'Not applicable' && (
                        <div key={exam} className="flex items-start gap-2 text-xs">
                          <span className="text-saffron flex-shrink-0 uppercase font-semibold">{exam}:</span>
                          <span className="text-gray-300">{cutoff}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Placements */}
                  {displayData.placements && (
                    <div className="bg-white/4 rounded-lg p-3 space-y-1.5">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">🚀 Placements</p>
                      <p className="text-xs text-white">Avg Package: <span className="text-emerald-400 font-semibold">{displayData.placements.avgPackage || 'Not published'}</span></p>
                      {Array.isArray(displayData.placements.topRecruiters) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {displayData.placements.topRecruiters.map((r, i) => (
                            <span key={i} className="text-[10px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Review */}
                  {displayData.reviews && (
                    <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">💬 Student Review</p>
                      <p className="text-blue-200 text-xs italic leading-relaxed">{displayData.reviews}</p>
                    </div>
                  )}

                  {/* Links */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(displayData.website || sourceUrl) && (
                      <a
                        href={displayData.website || sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-semibold bg-white/5 border border-white/10 hover:border-saffron/40 text-gray-400 hover:text-saffron px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        🌐 Official Website
                      </a>
                    )}
                    {displayData.linkedin && (
                      <a
                        href={displayData.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-semibold bg-blue-500/5 border border-blue-500/15 hover:border-blue-400/40 text-blue-400 px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        in LinkedIn
                      </a>
                    )}
                    {displayData.youtube && (
                      <a
                        href={displayData.youtube}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-semibold bg-red-500/5 border border-red-500/15 hover:border-red-400/40 text-red-400 px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        ▶ Videos
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(collegeName + ' reviews placements')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-semibold bg-white/5 border border-white/10 hover:border-white/25 text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      🔍 More Info
                    </a>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
