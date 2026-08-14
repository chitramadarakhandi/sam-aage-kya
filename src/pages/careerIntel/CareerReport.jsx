import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getCareerById, getRelatedCareers, USD_INR_RATE } from '../../data/careerIntel'
import { computeStudentInsights, computeParentInsights } from '../../data/careerIntel/xaiEngine'
import {
  ScoreGauge, ProgressBar, LineChart, RadarChart, XaiTooltip,
} from '../../components/careerIntel'

function SectionTitle({ emoji, children }) {
  return <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2 mb-4">{emoji} {children}</h2>
}

function InfoList({ items, icon = '•' }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
          <span className="text-saffron flex-shrink-0 mt-0.5">{icon}</span> {item}
        </li>
      ))}
    </ul>
  )
}

function Pill({ children, tone = 'default' }) {
  const toneMap = {
    default: 'bg-white/5 border-white/10 text-gray-300',
    good: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    warn: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    bad: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
  }
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${toneMap[tone]}`}>{children}</span>
}

export default function CareerReport() {
  const { id } = useParams()
  const { profile } = useAuth()
  const career = getCareerById(id)
  const related = getRelatedCareers(career)

  const [view, setView] = useState('student') // 'student' | 'parent'
  const [market, setMarket] = useState('india') // 'india' | 'global'

  const studentInsights = useMemo(() => career ? computeStudentInsights(career, profile) : null, [career, profile])
  const parentInsights = useMemo(() => career ? computeParentInsights(career, profile) : null, [career, profile])

  if (!career) {
    return (
      <main className="pt-32 pb-20 min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="font-display text-xl font-bold text-white mb-2">Career not found</h1>
        <p className="text-gray-400 text-sm mb-6">We couldn't find "{id}" in the Career Intelligence Hub.</p>
        <Link to="/career-intel" className="btn-primary px-6 py-3 text-sm">← Back to Hub</Link>
      </main>
    )
  }

  const salarySeries = [{
    name: market === 'india' ? 'Salary (₹L/yr)' : 'Salary ($/yr)',
    color: '#FF6B00',
    points: career.salaryTimeline.map((p) => ({ x: p.year, y: market === 'india' ? p.indiaLPA : p.globalUSD })),
  }]

  // NOTE: x must be numeric — LineChart computes its scale with Math.min/max
  // over point.x, and Math.min('Now', '5yr', '10yr') is NaN, which silently
  // rendered every point/line off-screen (the chart looked blank even
  // though the y-axis gridline numbers, e.g. 71/53/36, were correct).
  // Use year-offsets (0/5/10) for the scale, with a label map for display.
  const DEMAND_X_LABELS = { 0: 'Now', 5: '5yr', 10: '10yr' }
  const demandSeries = [
    { name: 'Demand Forecast', color: '#10B981', points: [
      { x: 0, y: career.demand.current }, { x: 5, y: career.demand.year5 }, { x: 10, y: career.demand.year10 },
    ] },
  ]

  const radarAxes = [
    { key: 'salary', label: 'Salary' }, { key: 'demand', label: 'Demand' },
    { key: 'stability', label: 'Stability' }, { key: 'lowAiRisk', label: 'Low AI Risk' },
    { key: 'roi', label: 'ROI' }, { key: 'workLife', label: 'Work-Life' }, { key: 'global', label: 'Global' },
  ]
  const radarSeries = [{
    name: career.name, color: '#FF6B00',
    values: {
      salary: Math.min(100, career.salary.senior * 1.2),
      demand: career.demand.current,
      stability: career.jobStability.score,
      lowAiRisk: 100 - career.aiRisk.score,
      roi: career.roi.score,
      workLife: career.workLifeBalance.score,
      global: career.globalOpportunities.score,
    },
  }]

  return (
    <main className="career-report-print pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
          <Link to="/career-intel" className="text-gray-400 hover:text-white text-xs flex items-center gap-1.5">← Back to Hub</Link>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Student / Parent toggle */}
            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
              {['student', 'parent'].map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${view === v ? 'bg-saffron text-white' : 'text-gray-400 hover:text-white'}`}>
                  {v === 'student' ? '🎓 Student View' : '👨‍👩‍👧 Parent View'}
                </button>
              ))}
            </div>
            {/* India / Global toggle */}
            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
              {['india', 'global'].map((v) => (
                <button key={v} onClick={() => setMarket(v)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${market === v ? 'bg-saffron text-white' : 'text-gray-400 hover:text-white'}`}>
                  {v === 'india' ? '🇮🇳 India' : '🌍 Global'}
                </button>
              ))}
            </div>
            <button onClick={() => window.print()} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5">
              📄 Download PDF Report
            </button>
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="glass-card-premium p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-saffron/15 border border-saffron/25 flex items-center justify-center text-3xl flex-shrink-0">
            {career.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Pill>{career.category}</Pill>
              {career.govtCareer && <Pill tone="good">Government Path</Pill>}
              {career.studyAbroadFriendly && <Pill tone="good">Study Abroad Friendly</Pill>}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">{career.name}</h1>
            <p className="text-gray-400 text-sm mt-1">{career.overview}</p>
          </div>
        </div>

        {/* ── College-tier disparity warning ──
             Shown BEFORE any score/chart, deliberately — every number on
             this page is a single national-average-style estimate for the
             career as a whole, and does not adjust for which college a
             student would actually attend. For core branches like
             Mechanical/Civil Engineering, real placement outcomes differ
             sharply by institution tier, and a flattering-looking single
             number can otherwise mislead a student into thinking the
             stats apply equally regardless of where they study. */}
        {career.tierDependencyWarning && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 mb-8 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-amber-300 text-sm font-bold mb-1">Outcomes vary a lot by college — read this before trusting the numbers below</p>
              <p className="text-gray-300 text-xs leading-relaxed">{career.tierDependencyWarning}</p>
            </div>
          </div>
        )}

        {/* ── Overview quick stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <div className="glass-card border-white/5 p-4 text-center">
            <p className="text-white font-display font-bold text-lg">
              {market === 'india' ? `₹${career.salary.entry}L → ₹${career.salary.senior}L` : `$${Math.round(career.salary.entryGlobal / 1000)}K → $${Math.round(career.salary.seniorGlobal / 1000)}K`}
            </p>
            <p className="text-gray-500 text-[10px] mt-1">Salary Progression</p>
          </div>
          <div className="glass-card border-white/5 p-4 text-center">
            <p className="text-emerald-400 font-display font-bold text-lg">{career.demand.current}/100</p>
            <p className="text-gray-500 text-[10px] mt-1">Current Demand</p>
          </div>
          <div className="glass-card border-white/5 p-4 text-center">
            <p className={`font-display font-bold text-lg ${career.aiRisk.score >= 60 ? 'text-rose-400' : 'text-emerald-400'}`}>{career.aiRisk.score}/100</p>
            <p className="text-gray-500 text-[10px] mt-1">AI Automation Risk</p>
          </div>
          <div className="glass-card border-white/5 p-4 text-center">
            <p className="text-saffron font-display font-bold text-lg">{career.roi.score}/100</p>
            <p className="text-gray-500 text-[10px] mt-1">ROI Score</p>
          </div>
        </div>

        {/* ═══════════════ STUDENT VIEW ═══════════════ */}
        {view === 'student' && (
          <div className="space-y-10">
            <div>
              <SectionTitle emoji="🎯">Your Career Fit ({profile ? 'Personalized' : 'Sign in for personalization'})</SectionTitle>
              <div className="glass-card border-white/5 p-6 flex flex-col sm:flex-row items-center gap-8">
                <ScoreGauge label="Career Fit Score" score={studentInsights.fit.score} explain={studentInsights.fit.explain} size={120} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 flex-1 w-full">
                  <ProgressBar label="Interest Match" score={studentInsights.fit.breakdown.interest.score} explain={studentInsights.fit.breakdown.interest.explain} color="#FF6B00" />
                  <ProgressBar label="Skill Match" score={studentInsights.fit.breakdown.skill.score} explain={studentInsights.fit.breakdown.skill.explain} color="#6366F1" />
                  <ProgressBar label="Academic Fit" score={studentInsights.fit.breakdown.academic.score} explain={studentInsights.fit.breakdown.academic.explain} color="#10B981" />
                </div>
              </div>
              {!profile && (
                <p className="text-gray-500 text-xs mt-3">💡 <Link to="/onboarding" className="text-saffron hover:underline">Complete your Profile Builder</Link> to see a fit score personalized to your marks, stream, and interests.</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card border-white/5 p-5">
                <SectionTitle emoji="💪">Your Strengths</SectionTitle>
                <InfoList items={studentInsights.strengths} icon="✓" />
              </div>
              <div className="glass-card border-white/5 p-5">
                <SectionTitle emoji="📈">Skill Gaps to Close</SectionTitle>
                <InfoList items={studentInsights.skillGaps} icon="→" />
              </div>
            </div>

            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🗺️">Your Personalized Learning Path</SectionTitle>
              <InfoList items={studentInsights.learningPath} icon="①" />
            </div>
          </div>
        )}

        {/* ═══════════════ PARENT VIEW ═══════════════ */}
        {view === 'parent' && (
          <div className="space-y-10">
            <SectionTitle emoji="👨‍👩‍👧">Parent Insights — Security, Cost &amp; Long-Term Value</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="glass-card border-white/5 p-5 flex flex-col items-center">
                <ScoreGauge label="Job Security" score={parentInsights.jobSecurity.score} explain={parentInsights.jobSecurity.explain} color="#10B981" />
              </div>
              <div className="glass-card border-white/5 p-5 flex flex-col items-center">
                <ScoreGauge label="ROI" score={parentInsights.roi.score} explain={parentInsights.roi.explain} color="#FF6B00" />
              </div>
              <div className="glass-card border-white/5 p-5 flex flex-col items-center">
                <ScoreGauge label="Future Stability" score={parentInsights.futureStability.score} explain={parentInsights.futureStability.explain} color="#6366F1" />
              </div>
              <div className="glass-card border-white/5 p-5 flex flex-col items-center">
                <ScoreGauge label="Financial Risk" score={parentInsights.financialRisk.score} explain={parentInsights.financialRisk.explain} color="#F43F5E" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="glass-card border-white/5 p-5 space-y-4">
                <ProgressBar label="Placement Potential" score={parentInsights.placementPotential.score} explain={parentInsights.placementPotential.explain} color="#10B981" />
                <ProgressBar label="Long-Term Growth" score={Math.min(100, Math.max(0, parentInsights.longTermGrowth.score * 5 + 50))} explain={parentInsights.longTermGrowth.explain} color="#6366F1" />
              </div>
              <div className="glass-card border-white/5 p-5">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Cost of Education</p>
                <XaiTooltip explain={parentInsights.costOfEducation.explain}>
                  <p className="text-white text-sm">{parentInsights.costOfEducation.explain}</p>
                </XaiTooltip>
              </div>
            </div>
            <div className="glass-card border-white/5 p-5">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Salary Potential</p>
              <p className="text-white text-lg font-bold">₹{career.salary.entry}L → ₹{career.salary.mid}L → ₹{career.salary.senior}L per annum</p>
              <p className="text-gray-500 text-xs mt-1">{parentInsights.salaryPotential.explain}</p>
            </div>
          </div>
        )}

        {/* ═══════════════ SHARED SECTIONS (both views) ═══════════════ */}
        <div className="space-y-10 mt-10">

          {/* Salary timeline + demand forecast charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LineChart
              title={`Salary Progression Timeline (${market === 'india' ? '₹ Lakh/yr' : 'USD/yr'})`}
              explain={`Interpolated from entry (${career.salary.entry}L), mid-career (${career.salary.mid}L), and senior (${career.salary.senior}L) anchor points. Global figures use an illustrative ₹${USD_INR_RATE}/$1 conversion rate for comparability, not a live forex feed.`}
              series={salarySeries}
              xLabel="Year"
              valueFormatter={(v) => market === 'india' ? `₹${v}L` : `$${Math.round(v / 1000)}K`}
            />
            <LineChart
              title="Demand Forecast (5 / 10-Year)"
              explain={career.demand.reason}
              series={demandSeries}
              valueFormatter={(v) => `${v}`}
              xLabelFormatter={(x) => DEMAND_X_LABELS[x] ?? x}
            />
          </div>

          {/* Radar profile */}
          <RadarChart
            title="Career Profile Radar"
            explain="Each axis is normalized to 0-100 (Low AI Risk is inverted from the raw AI Risk score so higher is always better on every axis) — this gives a single-glance shape of the career's strengths and trade-offs."
            axes={radarAxes}
            series={radarSeries}
          />

          {/* Score breakdown grid */}
          <div>
            <SectionTitle emoji="📊">Full Score Breakdown</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="glass-card border-white/5 p-5 space-y-4">
                <ProgressBar label="Job Stability" score={career.jobStability.score} explain={career.jobStability.reason} color="#10B981" />
                <ProgressBar label="Global Opportunities" score={career.globalOpportunities.score} explain={career.globalOpportunities.reason} color="#0EA5E9" />
              </div>
              <div className="glass-card border-white/5 p-5 space-y-4">
                <ProgressBar label="Work-Life Balance" score={career.workLifeBalance.score} explain={career.workLifeBalance.reason} color="#8B5CF6" />
                <ProgressBar label="AI/Automation Risk" score={career.aiRisk.score} explain={career.aiRisk.reason} color="#F43F5E" />
              </div>
              <div className="glass-card border-white/5 p-5 space-y-4">
                <ProgressBar label="Competition Level" score={career.competitionLevel.score} explain={career.competitionLevel.reason} color="#F59E0B" />
                <ProgressBar label="Learning Difficulty" score={career.learningDifficulty.score} explain={career.learningDifficulty.reason} color="#EC4899" />
              </div>
              <div className="glass-card border-white/5 p-5 space-y-4">
                <ProgressBar label="ROI" score={career.roi.score} explain={career.roi.reason} color="#FF6B00" />
                <ProgressBar label="Entrepreneurship Scope" score={career.entrepreneurshipScope.score} explain={career.entrepreneurshipScope.reason} color="#22C55E" />
              </div>
              <div className="glass-card border-white/5 p-5">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Industry Growth</p>
                <XaiTooltip explain={career.industryGrowth.reason}>
                  <p className={`text-2xl font-display font-bold ${career.industryGrowth.percent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {career.industryGrowth.percent >= 0 ? '+' : ''}{career.industryGrowth.percent}%/yr
                  </p>
                </XaiTooltip>
              </div>
            </div>
          </div>

          {/* Education path & eligibility */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🎓">Education Path</SectionTitle>
              <div className="space-y-3">
                {career.educationPath.map((stage, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-saffron/15 text-saffron text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div><p className="text-white text-sm font-semibold">{stage.stage}</p><p className="text-gray-400 text-xs">{stage.detail}</p></div>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-4"><span className="text-gray-300 font-semibold">Eligibility:</span> {career.eligibility}</p>
            </div>
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="📝">Entrance Exams &amp; Certifications</SectionTitle>
              <div className="flex flex-wrap gap-2 mb-4">{career.entranceExams.map((e) => <Pill key={e}>{e}</Pill>)}</div>
              <p className="text-gray-300 text-xs font-semibold mb-2">Certifications</p>
              <InfoList items={career.certifications} />
            </div>
          </div>

          {/* Skills */}
          <div className="glass-card border-white/5 p-5">
            <SectionTitle emoji="🛠️">Required Skills</SectionTitle>
            <div className="flex flex-wrap gap-2">{career.requiredSkills.map((s) => <Pill key={s} tone="good">{s}</Pill>)}</div>
          </div>

          {/* Roadmap */}
          <div className="glass-card border-white/5 p-5">
            <SectionTitle emoji="🚀">Career Roadmap</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {career.roadmap.map((r, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-3.5 border border-white/5">
                  <p className="text-saffron text-[10px] font-bold uppercase tracking-wider mb-1">{r.phase}</p>
                  <p className="text-gray-300 text-xs">{r.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Higher education, govt, entrepreneurship */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🎓">Higher Education Options</SectionTitle>
              <InfoList items={career.higherEducationOptions} />
            </div>
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🏛️">Government Opportunities</SectionTitle>
              <InfoList items={career.governmentOpportunities.length ? career.governmentOpportunities : ['No major dedicated government pathway for this specific role.']} />
            </div>
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🚀">Entrepreneurship Scope</SectionTitle>
              <ProgressBar label="Independent Practice Potential" score={career.entrepreneurshipScope.score} explain={career.entrepreneurshipScope.reason} color="#22C55E" />
            </div>
          </div>

          {/* Recruiters, colleges, scholarships */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🏢">Top Recruiters</SectionTitle>
              <div className="flex flex-wrap gap-2">{career.topRecruiters.map((r) => <Pill key={r}>{r}</Pill>)}</div>
            </div>
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🏛️">Top Colleges / Institutes</SectionTitle>
              <InfoList items={career.topColleges} />
            </div>
            <div className="glass-card border-white/5 p-5">
              <SectionTitle emoji="🎗️">Scholarships</SectionTitle>
              <InfoList items={career.scholarships} />
            </div>
          </div>

          {/* YouTube resources */}
          <div className="glass-card border-white/5 p-5">
            <SectionTitle emoji="📺">YouTube Resources</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {career.youtubeResources.map((y, i) => (
                <a key={i} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(y.title + ' ' + y.channel)}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 border border-white/5 transition-colors">
                  <span className="text-xl flex-shrink-0">▶️</span>
                  <div><p className="text-white text-xs font-semibold">{y.title}</p><p className="text-gray-500 text-[10px]">{y.channel}</p></div>
                </a>
              ))}
            </div>
          </div>

          {/* Advantages / Challenges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card border-emerald-500/20 bg-emerald-500/5 p-5">
              <SectionTitle emoji="✅">Advantages</SectionTitle>
              <InfoList items={career.advantages} icon="+" />
            </div>
            <div className="glass-card border-rose-500/20 bg-rose-500/5 p-5">
              <SectionTitle emoji="⚠️">Challenges</SectionTitle>
              <InfoList items={career.challenges} icon="−" />
            </div>
          </div>

          {/* Related careers */}
          {related.length > 0 && (
            <div>
              <SectionTitle emoji="🔗">Related Careers</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {related.map((r) => (
                  <Link key={r.id} to={`/career-intel/${r.id}`} className="glass-card border-white/5 hover:border-saffron/30 p-4 flex items-center gap-3 transition-all">
                    <span className="text-2xl">{r.emoji}</span>
                    <div><p className="text-white text-sm font-semibold">{r.name}</p><p className="text-gray-500 text-[10px]">{r.category}</p></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print-only CSS — keeps the on-screen dark dashboard, but a clean
          light printable report, matching the pattern in PrintReport.jsx */}
      <style>{`
        @media print {
          body { background: white !important; }
          .career-report-print { padding-top: 0 !important; color: #111 !important; background: white !important; }
          .career-report-print .glass-card, .career-report-print .glass-card-premium {
            background: white !important; border: 1px solid #ddd !important; box-shadow: none !important;
          }
          nav, footer, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </main>
  )
}
