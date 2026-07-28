import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import YouTubePanel from '../components/YouTubePanel'

const COUNTRIES = [
  {
    id: 'usa', name: 'United States', flag: '🇺🇸', tagline: 'World\'s top universities & OPT work visa',
    color: 'from-blue-600/20 to-indigo-600/10 border-blue-500/25',
    overview: 'Home to Ivy League and top STEM universities. Strong research ecosystem and post-study work options.',
    eligibility: 'Bachelor\'s: 12th pass with SAT/ACT scores. Master\'s: Bachelor\'s degree with GRE/GMAT.',
    exams: ['TOEFL / IELTS', 'SAT (UG)', 'GRE (PG)', 'GMAT (MBA)'],
    topUniversities: ['MIT', 'Stanford University', 'Harvard University', 'Caltech', 'UC Berkeley', 'Carnegie Mellon'],
    tuitionRange: '$20,000 – $60,000/year',
    scholarships: ['Fulbright Program', 'Hubert Humphrey Fellowship', 'AAUW International Fellowships', 'University-specific Merit Scholarships'],
    visa: 'F-1 Student Visa. Apply via SEVIS & DS-160 form. Interview at US Embassy.',
    costOfLiving: '$1,000 – $2,500/month depending on city',
    internships: 'CPT during studies, OPT (12 months, 36 months for STEM) after graduation',
    workVisa: 'OPT → H-1B work visa (lottery system). STEM OPT extends to 3 years.',
    prPathway: 'H-1B → Green Card (EB-2/EB-3). Process can take 5-15 years for Indian nationals.',
    careers: ['Software Engineering', 'Data Science', 'Finance', 'Healthcare', 'Research & Academia'],
  },
  {
    id: 'uk', name: 'United Kingdom', flag: '🇬🇧', tagline: '1-year Master\'s & Graduate Route visa',
    color: 'from-red-600/20 to-rose-600/10 border-red-500/25',
    overview: 'Historic university system with globally recognized degrees. 1-year Master\'s programs save time and money.',
    eligibility: 'UG: 12th pass with UCAS application. PG: Bachelor\'s degree.',
    exams: ['IELTS / PTE', 'No GRE typically required'],
    topUniversities: ['University of Oxford', 'University of Cambridge', 'Imperial College London', 'UCL', 'LSE', 'University of Edinburgh'],
    tuitionRange: '£12,000 – £38,000/year',
    scholarships: ['Chevening Scholarship', 'Commonwealth Scholarships', 'GREAT Scholarships', 'Rhodes Scholarship'],
    visa: 'Student Visa (Tier 4). Need CAS from university, proof of funds.',
    costOfLiving: '£1,000 – £1,800/month (higher in London)',
    internships: 'Can work 20 hrs/week during term. Full-time during breaks.',
    workVisa: 'Graduate Route Visa: 2 years post-study work (3 years for PhD). Then apply for Skilled Worker visa.',
    prPathway: 'Skilled Worker visa → ILR (Indefinite Leave to Remain) after 5 years.',
    careers: ['Finance & Banking', 'Tech & AI', 'Law', 'Medicine', 'Creative Industries'],
  },
  {
    id: 'canada', name: 'Canada', flag: '🇨🇦', tagline: 'PR-friendly with PGWP & Express Entry',
    color: 'from-red-500/20 to-orange-500/10 border-red-500/25',
    overview: 'Known for welcoming immigration policies, affordable education, and clear PR pathways.',
    eligibility: 'UG: 12th pass. PG: Bachelor\'s degree. SDS (Student Direct Stream) for faster visa.',
    exams: ['IELTS / PTE', 'GRE (some programs)', 'GMAT (MBA)'],
    topUniversities: ['University of Toronto', 'UBC', 'McGill University', 'University of Waterloo', 'University of Alberta', 'McMaster University'],
    tuitionRange: 'CAD 15,000 – 40,000/year',
    scholarships: ['Vanier Canada Graduate Scholarships', 'Lester B. Pearson Scholarships', 'University-specific Scholarships'],
    visa: 'Study Permit. Apply via SDS for faster processing. Need GIC of CAD 20,635.',
    costOfLiving: 'CAD 1,000 – 2,000/month',
    internships: 'Co-op programs widely available. Can work 20 hrs/week off-campus.',
    workVisa: 'PGWP: 1-3 years post-study work permit (based on program length).',
    prPathway: 'Express Entry (CRS points), Provincial Nominee Programs (PNP). 2-3 year PR timeline.',
    careers: ['IT & Software', 'Healthcare', 'Engineering', 'Finance', 'Natural Resources'],
  },
  {
    id: 'australia', name: 'Australia', flag: '🇦🇺', tagline: 'Post-study work visa up to 6 years',
    color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/25',
    overview: 'High quality of life, multicultural environment, and generous post-study work rights.',
    eligibility: 'UG: 12th pass. PG: Bachelor\'s degree. English proficiency required.',
    exams: ['IELTS / PTE / TOEFL', 'GRE (some programs)'],
    topUniversities: ['University of Melbourne', 'University of Sydney', 'ANU', 'UNSW', 'Monash University', 'University of Queensland'],
    tuitionRange: 'AUD 20,000 – 50,000/year',
    scholarships: ['Australia Awards', 'Destination Australia', 'Research Training Program', 'University Merit Scholarships'],
    visa: 'Student Visa (Subclass 500). Need CoE, OSHC health insurance, proof of funds.',
    costOfLiving: 'AUD 1,400 – 2,500/month',
    internships: 'Can work 48 hrs/fortnight during studies. Unlimited during breaks.',
    workVisa: 'Temporary Graduate Visa (485): 2-6 years depending on qualification and location.',
    prPathway: 'Skilled Migration (189/190/491). Points-based system. Typically 2-4 years.',
    careers: ['IT & Cybersecurity', 'Engineering', 'Healthcare & Nursing', 'Accounting', 'Education'],
  },
  {
    id: 'germany', name: 'Germany', flag: '🇩🇪', tagline: 'Free/low-cost tuition at public universities',
    color: 'from-gray-500/20 to-slate-500/10 border-gray-500/25',
    overview: 'Almost free tuition at public universities. Strong engineering and STEM programs.',
    eligibility: 'UG: 12th + 1 year Indian college or Studienkolleg. PG: Bachelor\'s with good GPA.',
    exams: ['IELTS / TestDaF / DSH', 'GRE (some programs)', 'APS Certificate required'],
    topUniversities: ['TU Munich', 'LMU Munich', 'Heidelberg University', 'RWTH Aachen', 'TU Berlin', 'Humboldt University'],
    tuitionRange: '€0 – €1,500/semester (public). €10,000 – €30,000/year (private)',
    scholarships: ['DAAD Scholarships', 'Deutschlandstipendium', 'Heinrich Böll Foundation', 'Erasmus+'],
    visa: 'Student Visa → Residence Permit. Need blocked account (€11,904/year).',
    costOfLiving: '€800 – €1,200/month',
    internships: 'Can work 120 full days or 240 half days per year.',
    workVisa: '18-month job seeker visa after graduation. Then Blue Card for skilled workers.',
    prPathway: 'Permanent residence after 2-4 years of Blue Card employment.',
    careers: ['Automotive Engineering', 'AI & Machine Learning', 'Research', 'Renewable Energy', 'Manufacturing'],
  },
  {
    id: 'ireland', name: 'Ireland', flag: '🇮🇪', tagline: 'Tech hub of Europe with Stay Back visa',
    color: 'from-emerald-600/20 to-green-500/10 border-emerald-500/25',
    overview: 'European tech hub with Google, Meta, Apple HQs. 2-year stay back option.',
    eligibility: 'UG: 12th pass. PG: Bachelor\'s degree with relevant background.',
    exams: ['IELTS / PTE / TOEFL'],
    topUniversities: ['Trinity College Dublin', 'UCD', 'NUI Galway', 'University of Limerick', 'Dublin City University', 'Cork IT'],
    tuitionRange: '€10,000 – €25,000/year',
    scholarships: ['Government of Ireland Scholarships', 'Irish Aid Fellowship', 'University Scholarships'],
    visa: 'Student Visa (Stamp 2). Need €10,000 in bank, offer letter, health insurance.',
    costOfLiving: '€800 – €1,500/month',
    internships: 'Can work 20 hrs/week during term, 40 hrs/week during holidays.',
    workVisa: 'Stay Back Visa: 1 year (Level 8) or 2 years (Level 9/10 Masters/PhD).',
    prPathway: 'Critical Skills Employment Permit → Stamp 4 after 2 years.',
    careers: ['Software Development', 'Data Analytics', 'Pharmaceuticals', 'FinTech', 'Cloud Computing'],
  },
  {
    id: 'singapore', name: 'Singapore', flag: '🇸🇬', tagline: 'Asia\'s education & business powerhouse',
    color: 'from-red-500/20 to-pink-500/10 border-red-500/25',
    overview: 'World-class education system, strong industry connections, and strategic Asian location.',
    eligibility: 'UG: 12th with strong academics. PG: Bachelor\'s degree.',
    exams: ['IELTS / TOEFL', 'SAT (some UG programs)', 'GRE/GMAT (PG)'],
    topUniversities: ['NUS', 'NTU', 'SMU', 'SUTD', 'SIT', 'SUSS'],
    tuitionRange: 'SGD 15,000 – 45,000/year (subsidized for bond holders)',
    scholarships: ['Singapore Government Scholarships', 'Tuition Grant (with service bond)', 'ASEAN Scholarships'],
    visa: 'Student\'s Pass via SOLAR system. Need IPA letter from university.',
    costOfLiving: 'SGD 1,200 – 2,000/month',
    internships: 'Industrial attachment mandatory in many programs. Can work during vacation.',
    workVisa: 'Long-Term Visit Pass for job search. Then Employment Pass / S Pass.',
    prPathway: 'PR application after working for 6+ months. Points-based assessment.',
    careers: ['FinTech', 'Biomedical Sciences', 'Engineering', 'Business Analytics', 'Urban Planning'],
  },
  {
    id: 'nz', name: 'New Zealand', flag: '🇳🇿', tagline: 'Quality of life & post-study work rights',
    color: 'from-sky-500/20 to-blue-500/10 border-sky-500/25',
    overview: 'Safe, scenic country with excellent quality of life and practical education focus.',
    eligibility: 'UG: 12th pass. PG: Bachelor\'s degree.',
    exams: ['IELTS / PTE / TOEFL'],
    topUniversities: ['University of Auckland', 'University of Otago', 'Victoria University Wellington', 'University of Canterbury', 'Massey University'],
    tuitionRange: 'NZD 22,000 – 40,000/year',
    scholarships: ['New Zealand Scholarships', 'University Merit Awards', 'MFAT Scholarships'],
    visa: 'Student Visa. Need offer of place, proof of funds, medical clearance.',
    costOfLiving: 'NZD 1,200 – 1,800/month',
    internships: 'Can work 20 hrs/week during studies. Full-time during scheduled breaks.',
    workVisa: 'Post-Study Work Visa: 1-3 years based on qualification level and location.',
    prPathway: 'Skilled Migrant Category resident visa. Points-based.',
    careers: ['IT & Software', 'Agriculture & Viticulture', 'Healthcare', 'Engineering', 'Tourism Management'],
  },
]

function CountryCard({ country, isSelected, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-5 rounded-2xl border text-left transition-all duration-300 bg-gradient-to-br ${country.color} ${
        isSelected ? 'ring-2 ring-saffron/50 shadow-lg shadow-saffron/10' : ''
      }`}
    >
      <div className="text-3xl mb-2">{country.flag}</div>
      <h3 className="font-display font-bold text-white text-base">{country.name}</h3>
      <p className="text-gray-400 text-[11px] mt-1 line-clamp-2">{country.tagline}</p>
    </motion.button>
  )
}

function InfoSection({ icon, title, children }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
      <h3 className="font-display font-bold text-white text-sm mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      <div className="text-gray-300 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

export default function StudyAbroad() {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const country = COUNTRIES.find(c => c.id === selectedCountry)

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 font-sans relative">
      <div className="fixed inset-0 bg-mesh-premium pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none opacity-30" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/25 rounded-full px-5 py-2 mb-6">
            <span className="text-lg">✈️</span>
            <span className="text-purple-300 text-sm font-semibold">Global Opportunities</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black text-white mb-4">
            Study <span className="gradient-text-purple">Abroad</span> Guide
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Comprehensive guides for studying in top countries — eligibility, universities, costs,
            visas, scholarships, and career opportunities.
          </p>
        </motion.div>

        {/* Country Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {COUNTRIES.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <CountryCard
                country={c}
                isSelected={selectedCountry === c.id}
                onClick={() => setSelectedCountry(c.id)}
              />
            </motion.div>
          ))}
        </div>

        {/* Country Detail */}
        <AnimatePresence mode="wait">
          {country && (
            <motion.div
              key={country.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Country Header */}
              <div className={`glass-card-premium p-8 bg-gradient-to-br ${country.color}`}>
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-5xl">{country.flag}</span>
                  <div>
                    <h2 className="font-display text-3xl font-black text-white">{country.name}</h2>
                    <p className="text-gray-300 text-sm">{country.tagline}</p>
                  </div>
                </div>
                <p className="text-gray-300 text-base leading-relaxed">{country.overview}</p>
              </div>

              {/* Info Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                <InfoSection icon="📋" title="Eligibility">
                  <p>{country.eligibility}</p>
                </InfoSection>

                <InfoSection icon="📝" title="Required Exams">
                  <div className="flex flex-wrap gap-2">
                    {country.exams.map((exam, i) => (
                      <span key={i} className="tag tag-blue">{exam}</span>
                    ))}
                  </div>
                </InfoSection>

                <InfoSection icon="🏛️" title="Top Universities">
                  <div className="space-y-1.5">
                    {country.topUniversities.map((uni, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-saffron/10 border border-saffron/20 flex items-center justify-center text-[10px] text-saffron font-bold">{i+1}</span>
                        <span>{uni}</span>
                      </div>
                    ))}
                  </div>
                </InfoSection>

                <InfoSection icon="💰" title="Tuition Fees">
                  <p className="text-xl font-display font-bold text-saffron">{country.tuitionRange}</p>
                  <p className="text-xs text-gray-500 mt-1">Per academic year (approximate)</p>
                </InfoSection>

                <InfoSection icon="🏠" title="Cost of Living">
                  <p className="text-lg font-semibold text-white">{country.costOfLiving}</p>
                </InfoSection>

                <InfoSection icon="🎓" title="Scholarships">
                  <div className="space-y-2">
                    {country.scholarships.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-emerald-400">✦</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </InfoSection>

                <InfoSection icon="📄" title="Visa Process">
                  <p>{country.visa}</p>
                </InfoSection>

                <InfoSection icon="💼" title="Internship Opportunities">
                  <p>{country.internships}</p>
                </InfoSection>

                <InfoSection icon="🛂" title="Post-Study Work Visa">
                  <p>{country.workVisa}</p>
                </InfoSection>

                <InfoSection icon="🏡" title="PR / Immigration Pathway">
                  <p>{country.prPathway}</p>
                </InfoSection>

                <InfoSection icon="🚀" title="Top Career Opportunities">
                  <div className="flex flex-wrap gap-2">
                    {country.careers.map((c, i) => (
                      <span key={i} className="tag tag-emerald">{c}</span>
                    ))}
                  </div>
                </InfoSection>
              </div>

              {/* Curated YouTube Video Guides */}
              <YouTubePanel topic={`study_abroad_${country.id}`} title={`Curated Video Guides for ${country.name}`} className="mt-6" />

              {/* Disclaimer */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3 mt-6">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <div>
                  <h4 className="text-amber-300 font-semibold text-sm mb-1">Please Verify</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Information is indicative and based on general guidelines. Tuition fees, visa requirements,
                    and immigration policies change frequently. Always verify with official university websites
                    and government immigration portals before making decisions.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!selectedCountry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card-premium p-16 text-center"
          >
            <div className="text-6xl mb-4">🌍</div>
            <h3 className="font-display text-2xl font-bold text-white mb-2">Select a Country</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Click on any country above to explore detailed information about studying there —
              including universities, costs, visas, and career opportunities.
            </p>
          </motion.div>
        )}

        {/* Quick Links */}
        <div className="mt-16 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/competitive-exams" className="btn-outline text-sm py-2.5 px-5">
              Competitive Exams
            </Link>
            <Link to="/onboarding" className="btn-outline text-sm py-2.5 px-5">
              Get Career Guidance
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
