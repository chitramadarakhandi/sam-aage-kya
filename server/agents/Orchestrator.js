import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { normalizeStream, streamsMatch } from '../config/streams.js'
import { enforceGuidanceEvidence } from '../domain/verification/verifyEvidence.js'

// Helper to check environment configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null

// Unified LLM Client matching index.js's implementation
class UnifiedAIClient {
  // NOTE: Read API keys lazily on each call (NOT in the constructor).
  // This module is imported by index.js BEFORE dotenv.config() runs, so reading
  // env vars at construction time captures stale/empty values and can wrongly
  // fall back to a stray OPENAI_API_KEY. Reading them per-call guarantees the
  // .env values (GROQ_API_KEY) are available.
  async getCompletion({ model, messages, temperature, max_tokens, response_format }) {
    const groqApiKey = process.env.GROQ_API_KEY
    const openaiApiKey = process.env.OPENAI_API_KEY

    let url, headers, bodyModel
    if (groqApiKey) {
      url = 'https://api.groq.com/openai/v1/chat/completions'
      headers = {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      }
      bodyModel = model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    } else if (openaiApiKey) {
      url = 'https://api.openai.com/v1/chat/completions'
      headers = {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
      bodyModel = 'gpt-4o-mini'
    } else {
      throw new Error('NO_API_KEY')
    }

    const body = {
      model: bodyModel,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 2048,
    }

    if (response_format) {
      body.response_format = response_format
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`AI API error (${response.status}): ${errText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }
}

const aiClient = new UnifiedAIClient()

// Call LLM safely
async function runLLMAgent(prompt, responseJson = true) {
  try {
    const responseText = await aiClient.getCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2, // Low temperature for deterministic/reliable agent behavior
      max_tokens: 1500,
      response_format: responseJson ? { type: 'json_object' } : undefined
    })

    if (responseJson) {
      const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      return JSON.parse(cleaned)
    }
    return responseText
  } catch (err) {
    console.error('LLM Agent execution failed:', err.message)
    throw err
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 10 SPECIALIZED AGENTS WITH DEGRADED MOCK FALLBACKS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 1. Profile Analysis Agent
 */
export async function runProfileAnalysisAgent(state) {
  const form = state.formData
  try {
    const prompt = `
    You are the Profile Analysis Agent. Analyze the student's profile:
    - Board: ${form.board || 'Not specified'}
    - Marks: ${form.marks || 'Not specified'}%
    - Home State: ${form.state || 'Not specified'}
    - Stream: ${form.stream || 'Not specified'}
    - Class Level: ${form.classLevel || 'class12'}
    - Family Income: ${form.incomeRange || 'Not specified'}
    - First Generation College: ${form.firstGenCollege === true ? 'Yes' : 'No'}
    - Preferred State/City: ${form.preferredState || 'Not specified'} / ${form.preferredCity || 'Not specified'}
    - Annual Budget: ${form.budget || 'Not specified'}
    - Hobbies/Interests: ${form.interests || 'Not specified'}
    - Biggest Fear: ${form.biggestFear || 'Not specified'}

    Provide a structured assessment of this student's profile.
    Respond ONLY with a JSON object:
    {
      "academicStanding": "High/Medium/Low with brief reason",
      "financialCategory": "Affordable/Subsidized/Premium based on budget & income",
      "riskAppetite": "Safe, Balanced, or Exploratory",
      "keyConstraints": ["list of budget, geography, or board constraints"],
      "keyStrengths": ["list of academic/hobby strengths"],
      "coachingNeeds": "Detailed evaluation of coaching/guidance requirements"
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[ProfileAnalysisAgent] Falling back to local mock analyzer...')
    const marksNum = parseFloat(form.marks) || 0
    const marksLabel = marksNum >= 90 ? `${marksNum}% (Excellent)` : marksNum >= 75 ? `${marksNum}% (Good)` : marksNum >= 50 ? `${marksNum}% (Average)` : `${marksNum}% (Needs improvement)`
    return {
      academicStanding: marksNum >= 80 ? `High — ${marksLabel}` : marksNum >= 55 ? `Medium — ${marksLabel}` : `Low — ${marksLabel}`,
      financialCategory: form.incomeRange === 'below_2.5L' ? 'Subsidized' : form.incomeRange === '2.5L-5L' ? 'Affordable' : 'Standard',
      riskAppetite: "Balanced",
      keyConstraints: ["Budget limits", `Home state preference (${form.state || 'India'})`],
      keyStrengths: [form.interests ? `Interest in ${form.interests}` : "Academics", `${marksNum}% academic performance`],
      coachingNeeds: marksNum >= 85 ? "Advanced prep — target competitive national exams." : "Self-study supplemented by targeted coaching resources."
    }
  }
}

/**
 * 2. Search & Retrieval Agent (RAG)
 */
export async function runSearchRetrievalAgent(state) {
  const form = state.formData
  if (!supabase) {
    return { colleges: [], scholarships: [] }
  }

  const stream = form.stream || ''
  const marks = parseFloat(form.marks) || 0
  const budget = form.budget || ''
  const statePref = form.preferredState || ''
  const classLevel = form.classLevel || 'class12'

  let colleges = []
  let scholarships = []

  try {
    // 1. Fetch colleges
    const { data: colData, error: colError } = await supabase
      .from('colleges')
      .select('*')
    
    if (colError) throw colError
    
    let allColleges = colData || []
    
    // Parse budget limits
    let maxBudget = Infinity
    if (classLevel === 'class10') {
      // Map high school/coaching budget to corresponding future college budget
      if (budget === 'below_20k') maxBudget = 100000
      else if (budget === '20k-60k') maxBudget = 300000
      else if (budget === '60k-1.5L') maxBudget = 600000
    } else {
      if (budget === 'below_1L') maxBudget = 100000
      else if (budget === '1L-3L') maxBudget = 300000
      else if (budget === '3L-6L') maxBudget = 600000
    }

    // Filter and score colleges
    const normStudentStream = normalizeStream(stream)
    const preStreamFilter = allColleges.filter(c => {
      // Stream match for class12: compare normalized to avoid casing/whitespace drift.
      if (classLevel === 'class12' && stream) {
        if (!c.streams || !c.streams.some(s => normalizeStream(s) === normStudentStream)) return false
      }
      return true
    })

    // Warn loudly if stream filtering produced zero colleges (indicates drift).
    if (classLevel === 'class12' && stream && preStreamFilter.length === 0) {
      console.warn(
        `[RAG] Stream filter "${stream}" (normalized: "${normStudentStream}") matched 0 colleges — ` +
        `check that Onboarding form values match the streams array in seed.js. Falling back to all colleges.`
      )
    }

    const collegesForScoring = (classLevel === 'class12' && stream && preStreamFilter.length > 0)
      ? preStreamFilter
      : allColleges

    const scoredColleges = collegesForScoring.map(c => {
      let score = 0
      
      // Marks check: within range?
      if (marks >= c.min_marks) {
        score += 30
      } else if (marks + 10 >= c.min_marks) {
        score += 10
      } else {
        score -= 50
      }

      // Budget check:
      if (c.yearly_cost_max <= maxBudget) {
        score += 40
      } else if (c.yearly_cost_min <= maxBudget) {
        score += 20
      } else {
        score -= 40
      }

      // State check:
      if (statePref && statePref !== 'Any State') {
        if (c.state && c.state.toLowerCase() === statePref.toLowerCase()) {
          score += 30
        }
      } else {
        score += 10
      }

      // College type: central/state colleges are usually cheaper and look good for low income
      if (form.incomeRange === 'below_2.5L' && (c.college_type === 'central' || c.college_type === 'state')) {
        score += 15
      }

      return { ...c, matchScore: score }
    })
    
    // Sort by match score descending
    scoredColleges.sort((a, b) => b.matchScore - a.matchScore)
    // Remove severely mismatched colleges (score < 0) unless we have too few
    let filteredColleges = scoredColleges.filter(c => c.matchScore >= 0)
    if (filteredColleges.length < 5) {
      filteredColleges = scoredColleges.slice(0, 10)
    }
    colleges = filteredColleges.slice(0, 20)

    // 2. Fetch scholarships and filter them
    const { data: scholData, error: scholError } = await supabase
      .from('scholarships')
      .select('*')
    if (scholError) throw scholError

    let allScholarships = scholData || []
    
    // Parse student income range in lakh
    let studentIncomeLakh = 99
    if (form.incomeRange === 'below_2.5L') studentIncomeLakh = 2.5
    else if (form.incomeRange === '2.5L-5L') studentIncomeLakh = 5.0
    else if (form.incomeRange === '5L-10L') studentIncomeLakh = 10.0
    else if (form.incomeRange === 'above_10L') studentIncomeLakh = 99.0

    const scoredScholarships = allScholarships.map(s => {
      let score = 0
      
      // Income eligibility
      if (s.eligibility_income_max_lakh >= studentIncomeLakh) {
        score += 30
      } else {
        score -= 50
      }

      // Marks eligibility
      if (marks >= s.eligibility_marks_min) {
        score += 20
      } else {
        score -= 50
      }

      // Stream eligibility
      if (s.eligible_streams && (s.eligible_streams.includes('All') || s.eligible_streams.includes(stream))) {
        score += 20
      }

      // State eligibility
      if (s.eligible_states && (s.eligible_states.includes('All') || s.eligible_states.includes(form.state))) {
        score += 20
      }

      return { ...s, matchScore: score }
    })

    scoredScholarships.sort((a, b) => b.matchScore - a.matchScore)
    scholarships = scoredScholarships.filter(s => s.matchScore >= 0).slice(0, 10)

  } catch (err) {
    console.warn('RAG Database retrieval failed, falling back:', err.message)
  }

  return { colleges, scholarships }
}

/**
 * 3. Career Recommendation Agent
 */
export async function runCareerRecommendationAgent(state) {
  const form = state.formData
  const profileAnalysis = state.profileAnalysis
  try {
    const isClass10 = form.classLevel === 'class10'
    const classLevelInstruction = isClass10
      ? `
    ⚠️ THIS STUDENT IS IN CLASS 10 (choosing what to study in Class 11 & 12).
    You MUST recommend STREAM CHOICES for 11th/12th — NOT college degrees.
    Valid "path" values are streams such as: "Science (PCM)", "Science (PCB)",
    "Science (PCMB)", "Commerce with Maths", "Commerce without Maths",
    "Arts / Humanities". Do NOT recommend B.Tech, BCA, MBBS, diplomas, or any
    college course — those come after Class 12. For each recommended stream,
    explain which future careers it opens up, based on the student's interests.
    - "requires_entrance_exam" should be "None (stream selection, not entrance-based)".
    - "backup_plan" should describe switching to another stream if this one is too hard.`
      : `
    THIS STUDENT IS IN CLASS 12 (choosing a college course/career after 12th).
    Recommend specific college courses / career tracks (e.g. B.Tech Computer
    Science, B.Sc Biotechnology, CA, B.Des), matching their stream "${form.stream}".`

    const prompt = `
    You are the Career Recommendation Agent. Recommends the best career paths and courses matching this profile.
    Profile Analysis: ${JSON.stringify(profileAnalysis)}
    Student Interests: ${form.interests}
    Student Stream: ${form.stream || (isClass10 ? 'Not yet chosen (Class 10)' : 'Not specified')}
    Class Level: ${form.classLevel}
    ${classLevelInstruction}

    INTEREST INTERPRETATION GUIDELINE:
    If a student enters design or visual/creative interests like 'poster', 'posters', 'designing', or 'sketching':
    - Map them to modern, highly-employable professional design careers: Bachelor of Design (B.Des in Graphic Design, Communication Design, or UI/UX), B.Sc in Animation & VFX, or fields in Digital Marketing / Advertising.
    - Do NOT recommend traditional fine arts (BFA in Painting, Sculpture, etc.) or music/songs/performing arts unless the student explicitly mentions performing arts, singing, or music.
    - If they have a Science stream, B.Des, B.Arch, or tech-design fields (like UI/UX) are excellent options.

    Recommend 2-3 ${isClass10 ? 'stream options for Class 11/12' : 'specific career tracks'}.
    Respond ONLY with a JSON object in this format:
    {
      "recommendations": [
        {
          "path_id": "short_kebab_slug (${isClass10 ? 'e.g. science_pcm, commerce_maths, arts_humanities' : 'e.g. btech_cs, mbbs_medicine, ca_finance, bsc_biotech'}). MUST be unique per path and <= 20 chars, lowercase letters and underscores only.",
          "path": "${isClass10 ? 'Stream name (e.g. Science (PCM), Commerce with Maths, Arts / Humanities)' : 'Career/Course name (e.g. B.Tech Computer Science, B.Sc Biotechnology)'}",
          "honest_take": "Brutally honest 2-sentence advice about difficulty, competition, and suitability.",
          "requires_entrance_exam": "${isClass10 ? 'None (stream selection, not entrance-based)' : 'Specific exam name or None'}",
          "opens_doors_to": ["${isClass10 ? 'Future career this stream enables' : 'Job role 1'}", "${isClass10 ? 'Another future career' : 'Job role 2'}"],
          "watch_out_for": "Main pitfall or drawback of this ${isClass10 ? 'stream' : 'path'}",
          "backup_plan": "${isClass10 ? 'Which stream to switch to if this is too hard' : 'Specific backup plan if entrance fails'}"
        }
      ]
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[CareerRecommendationAgent] Falling back to local mock carrier recommendations...')
    const isClass10 = form.classLevel === 'class10'
    const stream = form.stream || 'Commerce'

    if (isClass10) {
      return {
        recommendations: [
          {
            path_id: 'science_pcm',
            path: "Science (PCM)",
            honest_take: "PCM is a solid gateway to engineering and design. It is demanding, but offers maximum career versatility.",
            requires_entrance_exam: "JEE Main / BITSAT",
            opens_doors_to: ["Software Engineering", "Architecture", "Data Analytics"],
            watch_out_for: "Significantly higher academic rigour compared to Class 10.",
            backup_plan: "Transition to Commerce or BCA if mathematics/physics feels too difficult."
          },
          {
            path_id: 'commerce_maths',
            path: "Commerce with Applied Mathematics",
            honest_take: "Focuses heavily on business, accounting, and finance. Practical and structured with good industry opportunities.",
            requires_entrance_exam: "None",
            opens_doors_to: ["Chartered Accountancy", "Business Analytics", "Investment Banking"],
            watch_out_for: "Requires strong logical and quantitative abilities.",
            backup_plan: "General Commerce without Maths if Accounting gets too complex."
          }
        ]
      }
    }

    if (stream.includes('PCM')) {
      return {
        recommendations: [
          {
            path_id: 'btech_cs_ai',
            path: "B.Tech Computer Science & AI",
            honest_take: "The most popular engineering field in India. Great packages if you code regularly, but entry competition is intense.",
            requires_entrance_exam: "JEE Main / COMEDK / KCET",
            opens_doors_to: ["Software Engineer", "AI Developer", "Cloud Solutions Architect"],
            watch_out_for: "High market saturation; you need a strong portfolio of projects to stand out.",
            backup_plan: "BCA followed by an MCA to enter the IT sector."
          },
          {
            path_id: 'bsc_data_science',
            path: "B.Sc in Data Science / Analytics",
            honest_take: "A modern analytics pathway focusing on statistics, programming, and databases. An excellent alternative to engineering.",
            requires_entrance_exam: "CUET / None",
            opens_doors_to: ["Data Analyst", "Database Manager", "Business Analyst"],
            watch_out_for: "Requires a strong aptitude for mathematics and logical reasoning.",
            backup_plan: "General B.Sc in Information Technology."
          }
        ]
      }
    } else if (stream.includes('PCB')) {
      return {
        recommendations: [
          {
            path_id: 'bsc_biotech',
            path: "B.Sc Biotechnology / Genetics",
            honest_take: "Great research and lab-oriented career. Avoids NEET pressure but requires higher education to secure top roles.",
            requires_entrance_exam: "CUET / None",
            opens_doors_to: ["Biotech Researcher", "Lab Scientist", "Pharmaceutical Analyst"],
            watch_out_for: "An M.Sc or Ph.D is practically mandatory for high-paying research roles.",
            backup_plan: "Transition to MBA in Biotech or Clinical Research Management."
          },
          {
            path_id: 'bpt_physiotherapy',
            path: "Bachelor of Physiotherapy (BPT)",
            honest_take: "An excellent clinical option with a focus on patient rehabilitation. High demand in private clinics and sports academies.",
            requires_entrance_exam: "State CET / NEET",
            opens_doors_to: ["Physiotherapist", "Sports Rehab Specialist", "Health Consultant"],
            watch_out_for: "Low initial salaries before you build a reputation and private practice.",
            backup_plan: "Diploma in Hospital Administration."
          }
        ]
      }
    } else {
      return {
        recommendations: [
          {
            path_id: 'ca_finance',
            path: "Chartered Accountancy (CA)",
            honest_take: "One of the most prestigious finance careers. Affordable to pursue but demands immense discipline and multiple attempt persistence.",
            requires_entrance_exam: "CA Foundation",
            opens_doors_to: ["Corporate Auditor", "Tax consultant", "Financial Controller"],
            watch_out_for: "Very low pass percentages in intermediate and final exams.",
            backup_plan: "B.Com + MBA in Finance."
          },
          {
            path_id: 'bba_finance',
            path: "BBA in Financial Analyst",
            honest_take: "A highly dynamic management degree focusing on corporate finance, stocks, and investments. Offers faster corporate entry.",
            requires_entrance_exam: "CUET / IPMAT",
            opens_doors_to: ["Financial Analyst", "Portfolio Coordinator", "Operations Lead"],
            watch_out_for: "Placements depend heavily on college tiers; aim for top 50 B-schools.",
            backup_plan: "Postgraduate preparation for CAT or GMAT."
          }
        ]
      }
    }
  }
}

/**
 * 4. College Recommendation Agent
 */
export async function runCollegeRecommendationAgent(state) {
  const form = state.formData
  const careerPaths = state.careerPaths
  const retrievedColleges = state.retrievedColleges
  try {
    const prompt = `
    You are the College Recommendation Agent. Map the recommended career paths to the most suitable colleges.
    Career Recommendations: ${JSON.stringify(careerPaths)}
    Retrieved Colleges: ${JSON.stringify(retrievedColleges.slice(0, 10))}
    Student Budget: ${form.budget}
    Preferred State/City: ${form.preferredState} / ${form.preferredCity}
    Marks: ${form.marks}%
    Admission Mode: ${form.preferredModeOfAdmission}

    CRITICAL GROUNDING RULES:
    1. You MUST ONLY recommend colleges that are present in the "Retrieved Colleges" list provided above. Do NOT hallucinate other institutions.
    2. Ensure that the yearly fee range of each recommended college is compatible with the Student Budget (${form.budget}) and that their minimum marks requirements are met by the student's marks of ${form.marks}%.
    3. State clearly in the "whyFit" field how the college's fee range fits the student's budget and how their marks meet the admission criteria.
    4. The "path_id" in each mapping MUST exactly match the "path_id" from the Career Recommendations above. Do NOT alter or omit it.

    Map colleges to the career paths.
    Respond ONLY with a JSON object:
    {
      "mappings": [
        {
          "path_id": "Copy exactly from Career Recommendations — do not change",
          "path": "Career/Course name (matching one of the recommendations)",
          "colleges": [
            {
              "name": "College Name (must be from Retrieved Colleges list)",
              "city": "City",
              "state": "State",
              "feeRange": "₹X–₹Y/yr",
              "admissionMode": "How to get in (e.g., JEE, KCET, Management)",
              "whyFit": "1-sentence why this fits marks and budget"
            }
          ]
        }
      ]
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[CollegeRecommendationAgent] Falling back to local mock mapping...')
    return {
      mappings: (careerPaths.recommendations || []).map(opt => {
        const pathId = opt.path_id || ''
        const pathLower = (opt.path || '').toLowerCase()
        let fallbackColleges = []

        if (pathId === 'ca_finance' || pathId === 'bba_finance' ||
            pathLower.includes('commerce') || pathLower.includes('accountancy') || pathLower.includes('bba') || pathLower.includes('finance') || pathLower.includes('ca')) {
          fallbackColleges = [
            {
              name: "Shri Ram College of Commerce",
              city: "Delhi",
              state: "Delhi",
              feeRange: "₹58,000–₹1,08,000/yr",
              admissionMode: "CUET",
              whyFit: "Top-ranked commerce college in India with highly subsidized fees."
            },
            {
              name: "Symbiosis College of Arts and Commerce",
              city: "Pune",
              state: "Maharashtra",
              feeRange: "₹1,28,000–₹2,15,000/yr",
              admissionMode: "Merit / Direct",
              whyFit: "Highly respected institution for business and commerce studies."
            }
          ]
        } else if (pathId.includes('humanities') || pathId.includes('arts') ||
                   pathLower.includes('arts') || pathLower.includes('humanities') || pathLower.includes('ias') || pathLower.includes('civil')) {
          fallbackColleges = [
            {
              name: "Lady Shri Ram College",
              city: "Delhi",
              state: "Delhi",
              feeRange: "₹52,000–₹1,02,000/yr",
              admissionMode: "CUET",
              whyFit: "Elite humanities institution with extremely affordable fees."
            },
            {
              name: "St. Xavier's College Mumbai",
              city: "Mumbai",
              state: "Maharashtra",
              feeRange: "₹92,000–₹1,72,000/yr",
              admissionMode: "CUET / Entrance",
              whyFit: "Historical institution renowned for arts and liberal education."
            }
          ]
        } else if (pathId === 'bsc_biotech' || pathId === 'bpt_physiotherapy' ||
                   pathLower.includes('doctor') || pathLower.includes('neet') || pathLower.includes('mbbs') || pathLower.includes('biotech') || pathLower.includes('physiotherapy')) {
          fallbackColleges = [
            {
              name: "AIIMS New Delhi",
              city: "Delhi",
              state: "Delhi",
              feeRange: "₹50,000–₹1,15,000/yr",
              admissionMode: "NEET-UG",
              whyFit: "India's premier medical institute with highly subsidized education fees."
            },
            {
              name: "Madras Medical College",
              city: "Chennai",
              state: "Tamil Nadu",
              feeRange: "₹48,000–₹1,02,000/yr",
              admissionMode: "NEET-UG",
              whyFit: "Respected state-run medical institution offering affordable learning."
            }
          ]
        } else {
          // Default Science/Engineering (PCM paths including btech_cs_ai, bsc_data_science)
          fallbackColleges = [
            {
              name: "RV College of Engineering",
              city: "Bangalore",
              state: "Karnataka",
              feeRange: "₹1,40,000–₹2,25,000/yr",
              admissionMode: "KCET / COMEDK",
              whyFit: "Top-tier college offering excellent tech exposure and placements."
            },
            {
              name: "PES University",
              city: "Bangalore",
              state: "Karnataka",
              feeRange: "₹1,95,000–₹3,15,000/yr",
              admissionMode: "PESSAT / KCET",
              whyFit: "Premium infrastructure and direct corporate recruiter partnerships."
            }
          ]
        }

        // Adjust fallback colleges if the budget is very low (e.g., below_20k or below_1L)
        if (form.budget === 'below_20k' || form.budget === 'below_1L') {
          fallbackColleges = fallbackColleges.map(c => {
            if (c.name === 'RV College of Engineering' || c.name === 'PES University') {
              return {
                ...c,
                name: "NIT Patna",
                city: "Patna",
                state: "Bihar",
                feeRange: "₹1,18,000–₹1,80,000/yr",
                admissionMode: "JEE Main (State Quota)",
                whyFit: "National Institute offering quality engineering education at subsidized fees."
              }
            }
            return c
          })
        }

        return {
          path_id: opt.path_id,
          path: opt.path,
          colleges: retrievedColleges.length > 0
            ? retrievedColleges.slice(0, 3).map(c => ({
                name: c.name,
                city: c.city,
                state: c.state,
                feeRange: `₹${c.yearly_cost_min.toLocaleString('en-IN')}–₹${c.yearly_cost_max.toLocaleString('en-IN')}/yr`,
                admissionMode: form.preferredModeOfAdmission || "Entrance Exam / Merit",
                whyFit: "Directly matches academic stream and falls within preferred budget thresholds."
              }))
            : fallbackColleges
        }
      })
    }
  }
}

/**
 * 5. Scholarship Agent
 */
export async function runScholarshipAgent(state) {
  const form = state.formData
  const profileAnalysis = state.profileAnalysis
  const retrievedScholarships = state.retrievedScholarships
  try {
    const prompt = `
    You are the Scholarship Agent. Find matching scholarships and financial aid.
    Profile Analysis: ${JSON.stringify(profileAnalysis)}
    Retrieved Scholarships: ${JSON.stringify(retrievedScholarships.slice(0, 5))}
    Student Income Range: ${form.incomeRange}
    Student State: ${form.state}
    Marks: ${form.marks}%

    Recommend 2-3 scholarships. Include application instructions.
    Respond ONLY with a JSON object:
    {
      "scholarships": [
        {
          "name": "Scholarship Name",
          "description": "Brief description",
          "eligibility": "Marks/income criteria",
          "amount": "Approx amount or benefit",
          "applicationUrl": "URL or 'Search NSP Portal'"
        }
      ]
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[ScholarshipAgent] Falling back to local mock scholarship suggestions...')
    return {
      scholarships: retrievedScholarships.length > 0
        ? retrievedScholarships.slice(0, 2).map(s => ({
            name: s.name,
            description: s.description,
            eligibility: `Marks > ${s.eligibility_marks_min}%, Income < ${s.eligibility_income_max_lakh}L`,
            amount: "Tuition waiver or ₹50,000 annual grant",
            applicationUrl: s.application_url
          }))
        : [
            {
              name: "Post-Matric Scholarship Scheme",
              description: "Provides financial assistance to students belonging to minority and backward classes.",
              eligibility: "Income < ₹2.5 Lakh/yr, Marks > 50%",
              amount: "Covers complete admission fees & monthly stipend",
              applicationUrl: "https://scholarships.gov.in"
            },
            {
              name: "HDFC Badhte Kadam Scholarship",
              description: "Corporate social responsibility initiative assisting students from low-income families.",
              eligibility: "Marks > 60%, Income < ₹6L/yr",
              amount: "₹30,000–₹1,00,000/yr",
              applicationUrl: "https://www.buddy4study.com"
            }
          ]
    }
  }
}

/**
 * 6. Study Abroad Agent
 */
export async function runStudyAbroadAgent(state) {
  const form = state.formData
  const profileAnalysis = state.profileAnalysis
  try {
    const prompt = `
    You are the Study Abroad Agent. Evaluate international study feasibility for this student.
    Profile Analysis: ${JSON.stringify(profileAnalysis)}
    Marks: ${form.marks}%
    Annual Budget: ${form.budget}

    Suggest the best country, required exams (IELTS, TOEFL, SAT, etc.), visa info, and estimated tuition.
    Respond ONLY with a JSON object:
    {
      "isFeasible": true/false,
      "recommendedCountry": "Country name (e.g. Germany for low budget, USA for high budget)",
      "targetUniversities": ["University 1", "University 2"],
      "requiredExams": ["Exams needed"],
      "estimatedYearlyCost": "Estimated tuition + living costs",
      "visaDifficulty": "Low/Medium/High with short reason",
      "scholarshipsAvailable": ["International scholarship name or None"]
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[StudyAbroadAgent] Falling back to local study abroad guide...')
    const costLow = form.budget === 'below_2L' || form.budget === '2L-5L'
    return {
      isFeasible: !costLow,
      recommendedCountry: costLow ? "Germany (Public Universities have zero tuition)" : "United States",
      targetUniversities: costLow ? ["TUM Munich", "RWTH Aachen"] : ["ASU Phoenix", "UT Dallas"],
      requiredExams: costLow ? ["IELTS Academic", "TestDaF (German)"] : ["SAT", "IELTS / TOEFL"],
      estimatedYearlyCost: costLow ? "₹8,00,000/yr (Living expenses only)" : "₹25,00,000–₹35,00,000/yr",
      visaDifficulty: "Medium (Requires blocked account for living proof)",
      scholarshipsAvailable: ["DAAD Scholarship", "Fulbright-Nehru Grant"]
    }
  }
}

/**
 * 7. Career Roadmap Agent
 */
export async function runCareerRoadmapAgent(state) {
  const form = state.formData
  const careerPaths = state.careerPaths
  try {
    const prompt = `
    You are the Career Roadmap Agent. Generate a detailed 4-year learning roadmap for each recommended path.
    Career Options: ${JSON.stringify(careerPaths)}
    Class Level: ${form.classLevel || 'class12'}
    Student Income Range: ${form.incomeRange}

    Generate a 4-year milestone grid. If Class 10, Year 1/2 are school, Year 3/4 are college. If Class 12, Years are college 1-4.
    IMPORTANT: The "path_id" in each roadmap MUST exactly match the "path_id" from the Career Options above. Do NOT alter or omit it.
    Respond ONLY with a JSON object:
    {
      "roadmaps": [
        {
          "path_id": "Copy exactly from Career Options — do not change",
          "path": "Career/Course name",
          "years": [
            {
              "year": 1,
              "focus": "Focus of this year",
              "skills": ["Skill 1", "Skill 2"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            },
            {
              "year": 2,
              "focus": "Focus of this year",
              "skills": ["Skill 1"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            },
            {
              "year": 3,
              "focus": "Focus of this year",
              "skills": ["Skill 1"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            },
            {
              "year": 4,
              "focus": "Focus of this year",
              "skills": ["Skill 1"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            }
          ]
        }
      ]
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[CareerRoadmapAgent] Falling back to local mock roadmap maker...')
    return {
      roadmaps: (careerPaths.recommendations || []).map(opt => ({
        path_id: opt.path_id,
        path: opt.path,
        years: [
          {
            year: 1,
            focus: "Build core fundamentals and theoretical foundations",
            skills: ["Fundamental Concepts", "Essential Tools", "Basic Coding/Logic"],
            certifications: ["Introduction Certificate (Coursera/edX)"],
            projects: ["Basic static portfolio project"],
            milestones: ["Understand fundamentals", "Develop study schedule"]
          },
          {
            year: 2,
            focus: "Master practical intermediate frameworks",
            skills: ["Intermediate tools", "Collaborative work systems", "Version control"],
            certifications: ["Advanced Technical Certifications"],
            projects: ["Medium sized full stack application"],
            milestones: ["Establish professional LinkedIn profile", "Participate in local hackathon"]
          },
          {
            year: 3,
            focus: "Secure industry internship and specialise",
            skills: ["System design", "Cloud engineering basics", "Advanced subjects"],
            certifications: ["Cloud Practitioner Certification"],
            projects: ["2-month summer project at startup"],
            milestones: ["Complete industry internship", "Deliver a live project"]
          },
          {
            year: 4,
            focus: "Interview preparation and industry transition",
            skills: ["Technical interview cases", "Aptitude training", "Communication skills"],
            certifications: ["Final capstone project credential"],
            projects: ["Production deployment of final application"],
            milestones: ["Graduate with a high-fidelity portfolio", "Secure job offer / PG seat"]
          }
        ]
      }))
    }
  }
}

/**
 * 8. Mentor Agent
 */
export async function runMentorAgent(state) {
  const form = state.formData
  const stream = form.stream || ''
  
  let mentors = []
  if (supabase) {
    try {
      const { data } = await supabase
        .from('mentors')
        .select('name, role, company, stream_expertise, rating, bio, cal_link')
        .limit(5)
      mentors = data || []
    } catch (_) {}
  }

  // Fallback default mentors if DB has none
  if (!mentors.length) {
    mentors = [
      { name: 'Dr. Vivek Sharma', role: 'Software Architect', company: 'Google', stream_expertise: 'Science (PCM)', rating: 4.8, bio: 'Experienced developer, mentor for IIT aspirants and computer science graduates.' },
      { name: 'Ananya Roy, CA', role: 'Audit Manager', company: 'EY', stream_expertise: 'Commerce', rating: 4.9, bio: 'CA professional helping commerce students navigate intermediate papers and internships.' },
      { name: 'Dr. Priya Nair', role: 'Senior Surgeon', company: 'Apollo Hospitals', stream_expertise: 'Science (PCB)', rating: 4.7, bio: 'Passionate medical educator guiding NEET students on careers in medicine and biotechnology.' }
    ]
  }

  // Filter or score based on stream matching
  const matched = mentors.map(m => {
    let score = 5
    if (m.stream_expertise && m.stream_expertise.includes(stream)) {
      score += 15
    }
    return { ...m, matchScore: score }
  }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 3)

  return matched
}

/**
 * 9. YouTube Resource Agent
 */
export async function runYouTubeResourceAgent(state) {
  const careerPaths = state.careerPaths || { recommendations: [] }
  const paths = (careerPaths.recommendations || []).map(r => r.path)

  const videosMap = {
    'B.Tech': [
      { title: 'Computer Science & Engineering Roadmap', channel: 'Apna College', embedId: 'V9a8Z29eM5g' },
      { title: 'IIT/NIT Life & Campus Tour', channel: 'IIT Kharagpur', embedId: 'xP8s_d57c2k' }
    ],
    'Medical': [
      { title: 'NEET Prep Strategies & Time Table', channel: 'Physics Wallah', embedId: 'HjU3s3B4g8k' },
      { title: 'MBBS Student Life in India', channel: 'Doctor V', embedId: 'KjD3s24kLs9' }
    ],
    'Commerce': [
      { title: 'CA Foundation Guidance & Prep', channel: 'CA Rachana Ranade', embedId: 'L8s2jD9fS8g' },
      { title: 'Careers in Finance & Investment Banking', channel: 'Ankur Warikoo', embedId: 'T9sL29d8k1w' }
    ]
  }

  const results = []
  for (const path of paths) {
    let matched = false
    for (const key of Object.keys(videosMap)) {
      if (path.toLowerCase().includes(key.toLowerCase())) {
        results.push(...videosMap[key].map(v => ({ ...v, path })))
        matched = true
        break
      }
    }
    if (!matched) {
      results.push({
        title: `${path} Career Guidance Video`,
        channel: 'Aage Kya? Curated',
        embedId: '3sD9fsH4kLs',
        path
      })
    }
  }

  return results.slice(0, 4)
}

/**
 * 10. Summary Agent
 */
export async function runSummaryAgent(state) {
  const form = state.formData
  const careerPaths = state.careerPaths
  const collegeRecommendations = state.collegeRecommendations
  const scholarshipRecommendations = state.scholarshipRecommendations
  try {
    const prompt = `
    You are the Summary Agent. Synthesize the findings of all career agents into a warm, encouraging summary.
    Student Profile: Name: ${form.fullName}, Marks: ${form.marks}%, Stream: ${form.stream}
    Career Paths recommended: ${JSON.stringify(careerPaths)}
    Colleges mapped: ${JSON.stringify(collegeRecommendations)}
    Scholarships found: ${JSON.stringify(scholarshipRecommendations)}

    Write a unified final guidance wrap-up.
    Respond ONLY with a JSON object:
    {
      "summary": "Warm 3-sentence summary of recommendations and opportunities.",
      "oneThingToDoThisWeek": "One specific actionable task for the student this week (e.g. check a website, talk to a mentor)."
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[SummaryAgent] Falling back to local mock synthesis...')
    return {
      summary: `Based on your ${form.stream || 'studies'} stream and interest in ${form.interests || 'building items'}, you have outstanding pathways ahead. By targeting top institutions in ${form.preferredState || 'India'} and securing active scholarship assistance, you can achieve your career objectives.`,
      oneThingToDoThisWeek: "Look up the official website of the target entrance exams and verify the application deadlines."
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CENTRAL STATE-GRAPH ORCHESTRATOR
// ──────────────────────────────────────────────────────────────────────────────

export async function runMultiAgentOrchestrator(formData) {
  const startTotal = Date.now()

  // 1. Initialize State Graph
  const state = {
    formData,
    profileAnalysis: null,
    retrievedColleges: [],
    retrievedScholarships: [],
    careerPaths: [],
    collegeRecommendations: [],
    scholarshipRecommendations: [],
    studyAbroadGuidance: null,
    roadmaps: [],
    mentorMatches: [],
    youtubeResources: [],
    finalSummary: null,
    executionLogs: []
  }

  const logStep = async (agentName, action) => {
    const start = Date.now()
    try {
      const output = await action()
      const duration = Date.now() - start
      state.executionLogs.push({
        agent: agentName,
        status: 'success',
        durationMs: duration,
        timestamp: new Date().toISOString()
      })
      return output
    } catch (err) {
      const duration = Date.now() - start
      state.executionLogs.push({
        agent: agentName,
        status: 'failed',
        durationMs: duration,
        error: err.message,
        timestamp: new Date().toISOString()
      })
      console.error(`Orchestration failure in node [${agentName}]:`, err.message)
      return null
    }
  }

  // ─── STAGE 1: Profile & Data Retrieval (Parallel) ───
  console.log('[Orchestrator] Starting Stage 1: Profile Analysis & Database Retrieval')
  const [profileResult, ragResult] = await Promise.all([
    logStep('Profile Analysis Agent', () => runProfileAnalysisAgent(state)),
    logStep('Search & Retrieval Agent', () => runSearchRetrievalAgent(state))
  ])

  state.profileAnalysis = profileResult || { academicStanding: 'Medium', financialCategory: 'Subsidized', riskAppetite: 'Balanced', keyConstraints: [], keyStrengths: [], coachingNeeds: '' }
  state.retrievedColleges = ragResult?.colleges || []
  state.retrievedScholarships = ragResult?.scholarships || []

  // ─── STAGE 2: Career Recommendation ───
  console.log('[Orchestrator] Starting Stage 2: Career Recommendation')
  const careerResult = await logStep('Career Recommendation Agent', () => runCareerRecommendationAgent(state))
  state.careerPaths = careerResult || { recommendations: [] }

  // ─── STAGE 3: Mappings, Roadmaps, Scholarships & Mentors (Parallel) ───
  console.log('[Orchestrator] Starting Stage 3: College, Scholarship, Roadmap, Mentor & Study Abroad planning')
  const [collegeResult, scholarshipResult, studyAbroadResult, roadmapResult, mentorResult, youtubeResult] = await Promise.all([
    logStep('College Recommendation Agent', () => runCollegeRecommendationAgent(state)),
    logStep('Scholarship Agent', () => runScholarshipAgent(state)),
    logStep('Study Abroad Agent', () => runStudyAbroadAgent(state)),
    logStep('Career Roadmap Agent', () => runCareerRoadmapAgent(state)),
    logStep('Mentor Agent', () => runMentorAgent(state)),
    logStep('YouTube Resource Agent', () => runYouTubeResourceAgent(state))
  ])

  state.collegeRecommendations = collegeResult?.mappings || []
  state.scholarshipRecommendations = scholarshipResult?.scholarships || []
  state.studyAbroadGuidance = studyAbroadResult || { isFeasible: false, recommendedCountry: 'Germany', requiredExams: [], targetUniversities: [], estimatedYearlyCost: 'N/A' }
  state.roadmaps = roadmapResult?.roadmaps || []
  state.mentorMatches = mentorResult || []
  state.youtubeResources = youtubeResult || []

  // ─── COLLEGE GUARDRAIL: strip hallucinated names (Bug #2 fix) ───────────────
  // Build an allow-list from the DB-retrieved colleges (the only verified source of truth).
  if (state.retrievedColleges.length > 0) {
    const allowedCollegeNames = new Set(state.retrievedColleges.map(c => c.name))
    let totalRemoved = 0
    state.collegeRecommendations = state.collegeRecommendations.map(mapping => {
      const before = mapping.colleges ? mapping.colleges.length : 0
      const filtered = (mapping.colleges || []).filter(c => allowedCollegeNames.has(c.name))
      const removed = before - filtered.length
      totalRemoved += removed
      return { ...mapping, colleges: filtered }
    })
    if (totalRemoved > 0) {
      console.warn(`[CollegeGuardrail] Removed ${totalRemoved} hallucinated college name(s) from LLM output.`)
    } else {
      console.log('[CollegeGuardrail] All college names verified against DB — no hallucinations detected.')
    }
  }

  // ─── STAGE 4: Synthesis & Final Summary ───
  console.log('[Orchestrator] Starting Stage 4: Synthesis & Final Summary')
  const summaryResult = await logStep('Summary Agent', () => runSummaryAgent(state))
  state.finalSummary = summaryResult || { summary: 'Guidance compiled successfully.', oneThingToDoThisWeek: 'Review options.' }

  const totalDuration = Date.now() - startTotal
  console.log(`[Orchestrator] Multi-Agent Execution completed successfully in ${totalDuration}ms`)

  // Return the combined, structured result matches the shape expected by the frontend
  // and includes full explainability metadata.
  return {
    summary: state.finalSummary.summary,
    options: (state.careerPaths.recommendations || []).map(opt => {
      // ── Bug #1 fix: match by path_id (strict equality) with path-text fallback ──
      // Priority 1: both sides have path_id → exact match (no ambiguity)
      // Priority 2: only one side has path_id → match on normalized path text
      const matchMapping = (m) => {
        if (opt.path_id && m.path_id) return opt.path_id === m.path_id
        // Fallback for LLMs that omit path_id: normalized exact-text comparison
        return (m.path || '').trim().toLowerCase() === (opt.path || '').trim().toLowerCase()
      }

      const mappedCol = state.collegeRecommendations.find(matchMapping)
      const mappedRoad = state.roadmaps.find(matchMapping)

      if (!mappedCol) {
        console.warn(`[Orchestrator] No college mapping found for path_id="${opt.path_id}" path="${opt.path}"`)
      }
      if (!mappedRoad) {
        console.warn(`[Orchestrator] No roadmap found for path_id="${opt.path_id}" path="${opt.path}"`)
      }

      // For Class 10, the user is looking at high school + local coaching cost.
      // We estimate this cost based on their selected high school/coaching budget range.
      let costStr = '₹20,000–₹60,000/yr'
      if (formData.classLevel === 'class10') {
        const b = formData.budget
        if (b === 'below_20k') costStr = '₹5,000–₹20,000/yr'
        else if (b === '20k-60k') costStr = '₹20,000–₹60,000/yr'
        else if (b === '60k-1.5L') costStr = '₹60,000–₹1,50,000/yr'
        else if (b === 'above_1.5L') costStr = '₹1,50,000–₹2,50,000/yr'
      } else {
        costStr = mappedCol && mappedCol.colleges.length ? mappedCol.colleges[0].feeRange : '₹80,000–₹1,50,000/yr'
      }

      return {
        path: opt.path,
        honest_take: opt.honest_take,
        requires_entrance_exam: opt.requires_entrance_exam || 'None',
        realistic_colleges: mappedCol ? mappedCol.colleges.map(c => c.name) : [],
        avg_yearly_cost: costStr,
        opens_doors_to: opt.opens_doors_to || [],
        watch_out_for: opt.watch_out_for || 'Competition is high.',
        backup_plan: opt.backup_plan || 'Look into alternative courses.',
        roadmap_steps: mappedRoad ? mappedRoad.years : []
      }
    }),
    scholarship_to_check: state.scholarshipRecommendations.length ? state.scholarshipRecommendations[0].name : 'Post-Matric Scholarship Scheme',
    one_thing_to_do_this_week: state.finalSummary.oneThingToDoThisWeek,
    scholarships_list: state.scholarshipRecommendations.map(s => ({
      name: s.name,
      application_url: s.applicationUrl,
      deadline_pattern: 'Rolling basis',
      description: `${s.description} | Eligibility: ${s.eligibility} | Value: ${s.amount}`
    })),
    study_abroad: state.studyAbroadGuidance,
    mentors: state.mentorMatches,
    youtube_videos: state.youtubeResources,
    colleges_data: state.retrievedColleges.reduce((acc, c) => {
      acc[c.name] = {
        source_url:      c.source_url,
        yearly_cost_min: c.yearly_cost_min,
        yearly_cost_max: c.yearly_cost_max,
        city:            c.city,
        state:           c.state,
        college_type:    c.college_type,
      }
      return acc
    }, {}),
    explainability: {
      totalDurationMs: totalDuration,
      steps: state.executionLogs,
      profile: state.profileAnalysis
    }
  }
}
