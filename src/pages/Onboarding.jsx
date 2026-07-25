import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PrivacyConsentModal, { useConsent } from '../components/PrivacyConsentModal'
import { STREAM_VALUES } from '../config/streams'
import { postTranscribe } from '../api'

// ─── Data ─────────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
]

const INCOME_RANGES = [
  { value: 'below_2.5L', label: 'Below ₹2.5 Lakh / year' },
  { value: '2.5L-5L',   label: '₹2.5L – ₹5 Lakh / year' },
  { value: '5L-10L',    label: '₹5L – ₹10 Lakh / year' },
  { value: 'above_10L', label: 'Above ₹10 Lakh / year' },
]

const CITY_OPTIONS = [
  { value: 'same_city', label: 'Same City',          icon: '🏠', desc: 'Stay close to home' },
  { value: 'nearby',    label: 'Nearby Cities',       icon: '🚆', desc: 'Within the state'  },
  { value: 'anywhere',  label: 'Anywhere in India',   icon: '✈️', desc: 'Open to relocation' },
]

const STEPS = [
  { id: 1, title: 'Basic Info',     subtitle: 'Tell us about your results and background.', icon: '📋' },
  { id: 2, title: 'Your Situation', subtitle: "This shapes what's actually realistic for you.", icon: '🏡' },
  { id: 3, title: 'The Real You',   subtitle: 'Honest answers get honest guidance. No judgment.', icon: '💬' },
]

const INITIAL_FORM = {
  fullName: '', state: '', board: '', stream: '', marks: '',
  incomeRange: '', firstGenCollege: null, preferredCities: [],
  interests: '', biggestFear: '',
  // Class 10 extensions
  classLevel: 'class12',
  parentPressure: null,
  parentExpectations: '',
  riskComfort: '',
  coachingAccess: null,
  // Task 2 extensions
  favoriteSubjects: '',
  preferredState: '',
  preferredCity: '',
  budget: '',
  careerGoals: '',
  preferredModeOfAdmission: '',
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(step, form, classLevel = 'class12') {
  const e = {}
  if (step === 1) {
    if (!form.fullName.trim())    e.fullName = 'Please enter your name.'
    if (!form.state)              e.state    = 'Please select your state.'
    if (!form.board)              e.board    = 'Please select your board.'
    if (classLevel === 'class12' && !form.stream) {
      e.stream = 'Please pick your stream.'
    }
    if (!form.marks || isNaN(form.marks) || +form.marks < 0 || +form.marks > 100)
      e.marks = 'Enter a valid percentage between 0 and 100.'
  }
  if (step === 2) {
    if (!form.incomeRange)              e.incomeRange      = 'Please select a range.'
    if (form.firstGenCollege === null)  e.firstGenCollege  = 'Please select Yes or No.'
    if (form.preferredCities.length === 0) e.preferredCities = 'Pick at least one option.'
    if (!form.preferredState)           e.preferredState   = 'Please select your preferred state.'
    if (!form.preferredCity.trim())     e.preferredCity    = 'Please enter your preferred city (or enter \'Any\').'
    if (!form.budget)                   e.budget           = 'Please select your budget.'
  }
  if (step === 3) {
    if (classLevel === 'class10') {
      if (!form.interests.trim())   e.interests = 'Please fill this in — it really matters.'
      if (!form.favoriteSubjects.trim()) e.favoriteSubjects = 'Please share your favorite subjects — this helps us understand you.'
      if (!form.careerGoals.trim())      e.careerGoals      = 'Please share your career goals or dreams.'
      if (form.parentPressure === null) e.parentPressure = 'Please select Yes or No.'
      if (form.parentPressure === true && !form.parentExpectations.trim()) {
        e.parentExpectations = 'Please share what stream/career your parents expect.'
      }
      if (!form.riskComfort)        e.riskComfort = 'Please pick your risk comfort preference.'
      if (form.coachingAccess === null) e.coachingAccess = 'Please select Yes or No.'
      if (!form.biggestFear.trim()) e.biggestFear = 'Please fill this in — it really matters.'

    } else {
      if (!form.interests.trim())   e.interests   = 'Please fill this in — it really matters.'
      if (!form.preferredModeOfAdmission) e.preferredModeOfAdmission = 'Please select your preferred mode of admission.'
      if (!form.biggestFear.trim()) e.biggestFear = 'Please fill this in — it really matters.'
    }
  }
  return e
}

// ─── Reusable Field Primitives ────────────────────────────────────────────────

const base =
  'w-full bg-navy-800 border rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-saffron/40'
const normal  = `${base} border-white/10 hover:border-white/20 focus:border-saffron/60`
const invalid = `${base} border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/30`

function Label({ children, required }) {
  return (
    <label className="block text-sm font-semibold text-gray-200 mb-1.5">
      {children}{required && <span className="text-saffron ml-0.5">*</span>}
    </label>
  )
}

function Hint({ children }) {
  return <p className="field-hint">{children}</p>
}

function FieldError({ msg }) {
  if (!msg) return null
  return (
    <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      {msg}
    </p>
  )
}

function TextField({ id, label, hint, required, error, ...rest }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input id={id} className={error ? invalid : normal} {...rest} />
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError msg={error} />
    </div>
  )
}

function SelectField({ id, label, hint, required, error, value, onChange, options, placeholder }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="relative">
        <select id={id} value={value} onChange={onChange}
          className={`${error ? invalid : normal} appearance-none pr-10 cursor-pointer`}>
          <option value="" disabled>{placeholder}</option>
          {options.map((o) =>
            typeof o === 'string'
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.value} value={o.value}>{o.label}</option>
          )}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError msg={error} />
    </div>
  )
}

function PillGroup({ label, hint, options, value, onToggle, error, required }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map((opt) => {
          const val = opt.value ?? opt
          const selected = value === val
          return (
            <button key={val} type="button" onClick={() => onToggle(val)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200
                ${selected
                  ? 'bg-saffron text-white border-saffron shadow-md shadow-saffron/25 scale-[1.03]'
                  : 'bg-navy-800 border-white/10 text-gray-300 hover:border-saffron/40 hover:text-white'
                }`}>
              {opt.label ?? opt}
            </button>
          )
        })}
      </div>
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError msg={error} />
    </div>
  )
}

function YesNoToggle({ label, hint, value, onChange, error, required }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="grid grid-cols-2 gap-3 mt-2">
        {[{ v: true, label: 'Yes 🙋' }, { v: false, label: 'No 🤷' }].map(({ v, label: l }) => (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            className={`py-3.5 rounded-xl text-sm font-semibold border transition-all duration-200
              ${value === v
                ? 'bg-saffron text-white border-saffron shadow-md shadow-saffron/25'
                : 'bg-navy-800 border-white/10 text-gray-300 hover:border-saffron/40'
              }`}>
            {l}
          </button>
        ))}
      </div>
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError msg={error} />
    </div>
  )
}

function CityCard({ option, selected, onToggle }) {
  return (
    <button type="button" onClick={() => onToggle(option.value)}
      className={`flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-2xl border text-center transition-all duration-200
        ${selected
          ? 'bg-saffron/15 border-saffron text-white shadow-md shadow-saffron/20 scale-[1.03]'
          : 'bg-navy-800 border-white/10 text-gray-300 hover:border-saffron/30 hover:bg-saffron/5'
        }`}>
      <span className="text-2xl sm:text-3xl">{option.icon}</span>
      <span className="font-semibold text-xs sm:text-sm leading-tight">{option.label}</span>
      <span className="text-xs text-gray-400 hidden sm:block">{option.desc}</span>
      {selected && (
        <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-saffron flex items-center justify-center mt-0.5">
          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
        </span>
      )}
    </button>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ form, setForm, errors, classLevel = 'class12' }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const streams = STREAM_VALUES

  return (
    <div className="space-y-6">

      <TextField
        id="fullName" label="Full Name" required type="text"
        placeholder="e.g. Priya Sharma"
        value={form.fullName} onChange={set('fullName')}
        error={errors.fullName}
        hint="We'll use your first name to personalise your result. Nothing gets shared."
      />

      <div className="grid sm:grid-cols-2 gap-5">
        <SelectField
          id="state" label="Your State" required
          placeholder="Select state"
          value={form.state} onChange={set('state')}
          options={INDIAN_STATES} error={errors.state}
          hint="Helps us show colleges and schemes relevant to where you live."
        />
        <SelectField
          id="board" label="Board" required
          placeholder="Select board"
          value={form.board} onChange={set('board')}
          options={['CBSE', 'ICSE', 'State Board']} error={errors.board}
          hint="This affects which entrance exams you're eligible for."
        />
      </div>

      {classLevel === 'class12' && (
        <PillGroup
          label="Stream" required
          options={streams}
          value={form.stream}
          onToggle={(v) => setForm((f) => ({ ...f, stream: v }))}
          error={errors.stream}
          hint="Pick the stream you appeared for — it's okay if you wish it was different."
        />
      )}

      <div>
        <Label required>
          {classLevel === 'class10' ? 'Marks Percentage (9th Grade or Board Pre-marks)' : 'Marks Percentage'}
        </Label>
        <div className="relative">
          <input
            id="marks" type="number" min="0" max="100" step="0.01"
            placeholder="e.g. 78.5"
            value={form.marks}
            onChange={set('marks')}
            className={`${errors.marks ? invalid : normal} pr-10`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">%</span>
        </div>
        {/* Live score bar */}
        {form.marks && !isNaN(+form.marks) && +form.marks >= 0 && +form.marks <= 100 && (
          <div className="mt-2.5 h-1.5 bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                +form.marks >= 75 ? 'bg-emerald-400' : +form.marks >= 50 ? 'bg-saffron' : 'bg-rose-400'
              }`}
              style={{ width: `${form.marks}%` }}
            />
          </div>
        )}
        {form.marks && !isNaN(+form.marks) && (
          <p className="mt-1 text-xs text-saffron font-semibold">
            {(+form.marks).toFixed(2)}% entered
          </p>
        )}
        {!errors.marks && (
          <Hint>Be honest. Your guidance is only useful if it&apos;s based on reality &mdash; not what you wish your marks were.</Hint>
        )}
        <FieldError msg={errors.marks} />
      </div>
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ form, setForm, errors, classLevel = 'class12' }) {
  const toggleCity = (val) =>
    setForm((f) => ({
      ...f,
      preferredCities: f.preferredCities.includes(val)
        ? f.preferredCities.filter((c) => c !== val)
        : [...f.preferredCities, val],
    }))

  return (
    <div className="space-y-7">

      <SelectField
        id="incomeRange" label="Family Income Range" required
        placeholder="Select income range"
        value={form.incomeRange}
        onChange={(e) => setForm((f) => ({ ...f, incomeRange: e.target.value }))}
        options={INCOME_RANGES} error={errors.incomeRange}
        hint="No judgment — this shapes what's actually realistic and affordable for you. Colleges and scholarships depend on this."
      />

      <YesNoToggle
        label="Are you the first person in your family to go to college?"
        required
        value={form.firstGenCollege}
        onChange={(v) => setForm((f) => ({ ...f, firstGenCollege: v }))}
        error={errors.firstGenCollege}
        hint="First-gen students face different challenges — hostel, family pressure, feeling like an outsider. Knowing this helps us guide you better."
      />

      <div className="grid sm:grid-cols-2 gap-5">
        <SelectField
          id="preferredState" label="Preferred State" required
          placeholder="Select state"
          value={form.preferredState}
          onChange={(e) => setForm((f) => ({ ...f, preferredState: e.target.value }))}
          options={['Any State', ...INDIAN_STATES]} error={errors.preferredState}
          hint="Which state would you prefer to study in?"
        />
        <TextField
          id="preferredCity" label="Preferred City / Town" required type="text"
          placeholder="e.g. Bangalore (or 'Any')"
          value={form.preferredCity}
          onChange={(e) => setForm((f) => ({ ...f, preferredCity: e.target.value }))}
          error={errors.preferredCity}
          hint="Enter your target city or 'Any'."
        />
      </div>

      <SelectField
        id="budget"
        label={classLevel === 'class10' ? 'Preferred Annual Budget for High School & Coaching' : 'Preferred Annual College Fee Budget'}
        required
        placeholder="Select budget limit"
        value={form.budget}
        onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
        options={classLevel === 'class10' ? [
          { value: 'below_20k', label: 'Below ₹20,000 / year (Highly Affordable / Govt)' },
          { value: '20k-60k', label: '₹20,000 – ₹60,000 / year (Moderate / Private School)' },
          { value: '60k-1.5L', label: '₹60,000 – ₹1.5 Lakh / year (Private School + Tuition)' },
          { value: 'above_1.5L', label: 'Above ₹1.5 Lakh / year (No budget constraint)' }
        ] : [
          { value: 'below_1L', label: 'Below ₹1 Lakh / year (Highly Subsidised / Govt)' },
          { value: '1L-3L', label: '₹1 Lakh – ₹3 Lakh / year (Moderate / State colleges)' },
          { value: '3L-6L', label: '₹3 Lakh – ₹6 Lakh / year (Premium / Private colleges)' },
          { value: 'above_6L', label: 'Above ₹6 Lakh / year (No budget constraint)' }
        ]}
        error={errors.budget}
        hint={classLevel === 'class10' ? 'Includes high school fees + local coaching/tuitions' : 'Includes tuition fees, hostel, and other academic expenses'}
      />

      <div>
        <Label required>
          {classLevel === 'class10' ? 'Where are you open to going for high school or coaching?' : 'Where are you open to studying?'}
        </Label>
        <p className="field-hint mb-3">Select all that apply. You can always change your mind later — this is just for now.</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {CITY_OPTIONS.map((opt) => (
            <CityCard
              key={opt.value}
              option={opt}
              selected={form.preferredCities.includes(opt.value)}
              onToggle={toggleCity}
            />
          ))}
        </div>
        <FieldError msg={errors.preferredCities} />
      </div>
    </div>
  )
}

// ─── Voice Input Button (Phase 7 — Voice Input) ──────────────────────────────

function VoiceInputButton({ onTranscribe, isTranscribing }) {
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [timer, setTimer] = useState(0)
  const [timerInterval, setTimerInterval] = useState(null)

  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval)
    }
  }, [timerInterval])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const options = { mimeType: 'audio/webm' }
      let recorder
      try {
        recorder = new MediaRecorder(stream, options)
      } catch (e) {
        recorder = new MediaRecorder(stream) // fallback
      }

      let chunks = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        chunks = []
        
        // Release mic
        stream.getTracks().forEach(track => track.stop())

        if (audioBlob.size > 0) {
          const reader = new FileReader()
          reader.readAsDataURL(audioBlob)
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1]
            onTranscribe(base64data, audioBlob.type || recorder.mimeType)
          }
        }
      }

      setMediaRecorder(recorder)
      recorder.start()
      setRecording(true)
      
      setTimer(0)
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev >= 29) {
            clearInterval(interval)
            recorder.stop()
            setRecording(false)
            return 30
          }
          return prev + 1
        })
      }, 1000)
      setTimerInterval(interval)

    } catch (err) {
      console.error('Error starting audio recording:', err)
      alert('Could not access microphone. Please check permissions in your browser.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop()
      setRecording(false)
      if (timerInterval) {
        clearInterval(timerInterval)
        setTimerInterval(null)
      }
    }
  }

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={isTranscribing}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
        recording
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
          : 'bg-navy-800 border-white/10 text-gray-400 hover:border-saffron/40 hover:text-white'
      } disabled:opacity-50`}
    >
      <span className="text-sm leading-none">{recording ? '⏹️' : '🎤'}</span>
      <span>{recording ? 'Stop Recording' : 'Speak (Hindi/Tamil/etc.)'}</span>
      {recording && <span className="font-mono text-[10px] ml-1 text-rose-500 font-bold">{30 - timer}s</span>}
      {isTranscribing && <span className="text-[10px] text-saffron animate-pulse">Transcribing...</span>}
    </button>
  )
}

function Step3({ form, setForm, errors, classLevel = 'class12' }) {
  const MAX = 500
  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value.slice(0, MAX) }))

  const [transcribingInterests, setTranscribingInterests] = useState(false)
  const [transcribingFear, setTranscribingFear] = useState(false)

  const handleTranscribe = (field) => async (base64data, mimeType) => {
    if (field === 'interests') setTranscribingInterests(true)
    else setTranscribingFear(true)

    try {
      const res = await postTranscribe(base64data, mimeType)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || 'Transcription failed')
      }

      const data = await res.json()
      if (data.transcription) {
        setForm((prev) => {
          const currentVal = prev[field] ? prev[field] + ' ' : ''
          return {
            ...prev,
            [field]: (currentVal + data.transcription).slice(0, MAX)
          }
        })
      }
    } catch (err) {
      console.error('Transcription error:', err)
      alert(err.message || 'Could not transcribe speech. Please try typing instead.')
    } finally {
      if (field === 'interests') setTranscribingInterests(false)
      else setTranscribingFear(false)
    }
  }

  return (
    <div className="space-y-7">

      {classLevel === 'class10' && (
        <>
          <PillGroup
            label="Do you already have a preferred stream? (Optional)"
            options={[
              { value: 'Science (PCM)', label: '⚗️ Science (PCM)' },
              { value: 'Science (PCB)', label: '🧬 Science (PCB)' },
              { value: 'Science (PCMB)', label: '🔬 Science (PCMB)' },
              { value: 'Commerce', label: '📊 Commerce' },
              { value: 'Arts / Humanities', label: '🎭 Arts / Humanities' },
              { value: 'Diploma / Polytechnic', label: '🛠️ Diploma / Polytechnic' },
              { value: 'ITI / Vocational', label: '🔧 ITI / Vocational' },
              { value: 'Undecided', label: '🤔 Undecided' },
            ]}
            value={form.stream}
            onToggle={(v) => setForm((f) => ({ ...f, stream: v === f.stream ? '' : v }))}
            error={errors.stream}
            hint="Completely optional — skip this if you're unsure. We will help you explore all options based on your interests."
          />
        </>
      )}

      <div>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
          <Label required>
            {classLevel === 'class10' ? 'What are your core interests and hobbies?' : 'What are you actually interested in?'}
          </Label>
          <VoiceInputButton
            onTranscribe={handleTranscribe('interests')}
            isTranscribing={transcribingInterests}
          />
        </div>
        <Hint>
          {classLevel === 'class10' 
            ? 'Hobbies, extra-curriculars, things you like to read or do for fun — literally anything. No wrong answers.'
            : 'Hobbies, things you google at 2am, subjects you liked, stuff you do for fun — literally anything. There are no wrong answers here.'}
        </Hint>
        <textarea
          id="interests" rows={4}
          placeholder={classLevel === 'class10' 
            ? "e.g. I love designing posters, reading history novels, and tinkering with computers in my spare time..."
            : "e.g. I love designing posters and spend hours on YouTube watching tech reviews. I also really like debating with people..."}
          value={form.interests} onChange={set('interests')}
          className={`${errors.interests ? invalid : normal} resize-none mt-2`}
        />
        <div className="flex justify-between items-start mt-1">
          <FieldError msg={errors.interests} />
          <span className={`text-xs ml-auto flex-shrink-0 ${form.interests.length > 450 ? 'text-rose-400' : 'text-gray-600'}`}>
            {form.interests.length}/{MAX}
          </span>
        </div>
      </div>

      {classLevel === 'class10' && (
        <>
          <div>
            <Label required>What school subjects or topics do you enjoy the most and why?</Label>
            <Hint>Specific school subjects (e.g. Mathematics, Science, English, Arts) and why you find them enjoyable.</Hint>
            <textarea
              id="favoriteSubjects" rows={3}
              placeholder="e.g. I really enjoy Physics because of mechanics and experiments, and English because I like reading literature..."
              value={form.favoriteSubjects} onChange={(e) => setForm((f) => ({ ...f, favoriteSubjects: e.target.value.slice(0, MAX) }))}
              className={`${errors.favoriteSubjects ? invalid : normal} resize-none mt-2`}
            />
            <div className="flex justify-between items-start mt-1">
              <FieldError msg={errors.favoriteSubjects} />
              <span className={`text-xs ml-auto flex-shrink-0 ${form.favoriteSubjects.length > 450 ? 'text-rose-400' : 'text-gray-600'}`}>
                {form.favoriteSubjects.length}/{MAX}
              </span>
            </div>
          </div>

          <div>
            <Label required>What are your long-term career goals or dreams?</Label>
            <Hint>Where do you see yourself in 10 years? Talk about jobs, industries, or areas you want to impact.</Hint>
            <textarea
              id="careerGoals" rows={3}
              placeholder="e.g. I want to build a startup in clean energy or work as an aerospace engineer at a space agency..."
              value={form.careerGoals} onChange={(e) => setForm((f) => ({ ...f, careerGoals: e.target.value.slice(0, MAX) }))}
              className={`${errors.careerGoals ? invalid : normal} resize-none mt-2`}
            />
            <div className="flex justify-between items-start mt-1">
              <FieldError msg={errors.careerGoals} />
              <span className={`text-xs ml-auto flex-shrink-0 ${form.careerGoals.length > 450 ? 'text-rose-400' : 'text-gray-600'}`}>
                {form.careerGoals.length}/{MAX}
              </span>
            </div>
          </div>
        </>
      )}

      {classLevel === 'class12' && (
        <SelectField
          id="preferredModeOfAdmission"
          label="Preferred Mode of Admission / Target Entrance Exam"
          required
          placeholder="Select admission mode / exam"
          value={form.preferredModeOfAdmission}
          onChange={(e) => setForm((f) => ({ ...f, preferredModeOfAdmission: e.target.value }))}
          options={[
            { value: 'JEE Main', label: 'JEE Main (NITs, IIITs, State GFTIs)' },
            { value: 'JEE Advanced', label: 'JEE Advanced (for IITs)' },
            { value: 'NEET', label: 'NEET (for MBBS/BDS/Medical)' },
            { value: 'CUET', label: 'CUET (Central & many State Universities)' },
            { value: 'State CET', label: 'State CET (your state — KCET/MHT-CET/AP EAMCET/WBJEE/etc.)' },
            { value: 'COMEDK', label: 'COMEDK / Private Consortium (state private colleges)' },
            { value: 'Management Quota', label: 'Management Quota (Direct Admission)' },
            { value: 'Diploma Lateral Entry', label: 'Diploma Lateral Entry (to Engineering)' },
            { value: 'Other', label: 'Other / Direct Merit Admissions' }
          ]}
          error={errors.preferredModeOfAdmission}
          hint="This determines which colleges you can get into and directly filters target institutions."
        />
      )}

      {classLevel === 'class10' && (
        <>
          <YesNoToggle
            label="Do you feel pressure or specific expectations from parents about your stream selection?"
            required
            value={form.parentPressure}
            onChange={(v) => setForm((f) => ({ ...f, parentPressure: v, parentExpectations: v ? f.parentExpectations : '' }))}
            error={errors.parentPressure}
            hint="Indian parents often push for Science (PCM/PCB) or Commerce. We will help you navigate this honestly."
          />

          {form.parentPressure === true && (
            <div>
              <Label required>What do your parents want or expect you to study?</Label>
              <textarea
                id="parentExpectations" rows={3}
                placeholder="e.g. They want me to take PCM and prepare for JEE to become a software engineer, but I'm not good at math..."
                value={form.parentExpectations} onChange={set('parentExpectations')}
                className={`${errors.parentExpectations ? invalid : normal} resize-none mt-2`}
              />
              <FieldError msg={errors.parentExpectations} />
            </div>
          )}

          <PillGroup
            label="Risk Comfort: What kind of future path do you prefer?"
            required
            options={[
              { value: 'safe', label: 'Safe Path (Stable, traditional options)' },
              { value: 'exploratory', label: 'Exploratory Path (Emerging tech, creative, okay with risk)' }
            ]}
            value={form.riskComfort}
            onToggle={(v) => setForm((f) => ({ ...f, riskComfort: v }))}
            error={errors.riskComfort}
            hint="Safe path leans on traditional degrees. Exploratory path targets design, humanities, newer vocational fields, or startups."
          />

          <YesNoToggle
            label="Do you have access to local or online coaching classes (for JEE, NEET, etc.) nearby?"
            required
            value={form.coachingAccess}
            onChange={(v) => setForm((f) => ({ ...f, coachingAccess: v }))}
            error={errors.coachingAccess}
            hint="Knowing this helps us guide your preparation strategy."
          />
        </>
      )}

      <div>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
          <Label required>
            {classLevel === 'class10' ? 'What is your biggest fear about stream selection?' : 'What is your biggest fear about what comes next?'}
          </Label>
          <VoiceInputButton
            onTranscribe={handleTranscribe('biggestFear')}
            isTranscribing={transcribingFear}
          />
        </div>
        <Hint>Be honest. This helps us give you real advice, not generic stuff. Your answer stays private — we don&apos;t share it with anyone.</Hint>
        <textarea
          id="biggestFear" rows={4}
          placeholder={classLevel === 'class10'
            ? "e.g. I'm scared of taking science and failing because it gets too hard, or taking arts and having people think I'm weak in studies..."
            : "e.g. I'm scared of picking the wrong degree and wasting 4 years. My parents want me to be an engineer but I have no idea if I'll like it..."}
          value={form.biggestFear} onChange={set('biggestFear')}
          className={`${errors.biggestFear ? invalid : normal} resize-none mt-2`}
        />
        <div className="flex justify-between items-start mt-1">
          <FieldError msg={errors.biggestFear} />
          <span className={`text-xs ml-auto flex-shrink-0 ${form.biggestFear.length > 450 ? 'text-rose-400' : 'text-gray-600'}`}>
            {form.biggestFear.length}/{MAX}
          </span>
        </div>
      </div>

      {/* Privacy reassurance */}
      <div className="flex items-start gap-3 p-4 bg-saffron/8 border border-saffron/20 rounded-xl">
        <span className="text-xl flex-shrink-0">🔒</span>
        <p className="text-gray-300 text-sm leading-relaxed">
          Your answers are used <strong className="text-white">only</strong> to personalise your guidance.
          We don&apos;t share them with colleges, parents, or anyone else. Ever.
        </p>
      </div>
    </div>
  )
}

// ─── Class Selection Screen ───────────────────────────────────────────────────

function ClassLevelSelection({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 px-4 sm:px-6 animate-fade-in relative z-10">
      <div className="text-center max-w-xl mb-12">
        <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-4 py-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
          <span className="text-saffron text-sm font-semibold">Choose Your Path</span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white mb-4">
          Where are you in your <span className="gradient-text">academic journey</span>?
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed">
          We will customize your profile builder and AI recommendations based on your choice.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl">
        <button
          onClick={() => onSelect('class10')}
          className="group relative flex flex-col items-start p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-gradient-to-br hover:from-saffron/20 hover:to-saffron-dark/5 hover:border-saffron/30 hover:scale-[1.03] transition-all duration-300 text-left shadow-lg shadow-black/40 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-saffron/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-saffron/10 border border-saffron/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
            📗
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-3 group-hover:text-saffron transition-colors">
            Post 10th Standard
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            For students seeking advice on stream selection (Science, Commerce, Arts), ITI, Polytechnic, or initial diploma tracks.
          </p>
          <div className="mt-auto flex items-center gap-2 text-xs font-semibold text-saffron group-hover:gap-3 transition-all">
            <span>Build Class 10 Profile</span>
            <span>→</span>
          </div>
        </button>

        <button
          onClick={() => onSelect('class12')}
          className="group relative flex flex-col items-start p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-gradient-to-br hover:from-indigo-500/20 hover:to-purple-500/5 hover:border-indigo-500/30 hover:scale-[1.03] transition-all duration-300 text-left shadow-lg shadow-black/40 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
            🎓
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-3 group-hover:text-indigo-400 transition-colors">
            Post 12th Standard
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            For students looking for specific degree paths, realistic colleges, competitive entrance exams, scholarships, and career roadmaps.
          </p>
          <div className="mt-auto flex items-center gap-2 text-xs font-semibold text-indigo-400 group-hover:gap-3 transition-all">
            <span>Build Class 12 Profile</span>
            <span>→</span>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { classLevel } = useParams()
  const [selectedClassLevel, setSelectedClassLevel] = useState(classLevel || '')
  const [step, setStep]     = useState(1)
  const [form, setForm]     = useState(() => ({ ...INITIAL_FORM, classLevel: classLevel || 'class12' }))
  const [errors, setErrors] = useState({})
  const navigate = useNavigate()
  const { consentGiven, giveConsent } = useConsent()

  useEffect(() => {
    if (classLevel) {
      setSelectedClassLevel(classLevel)
      setForm((f) => ({ ...f, classLevel }))
    }
  }, [classLevel])

  const total       = STEPS.length
  const currentStep = STEPS[step - 1]

  const handleNext = () => {
    const errs = validate(step, form, selectedClassLevel)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const firstId = Object.keys(errs)[0]
      document.getElementById(firstId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setErrors({})
    if (step < total) {
      setStep((s) => s + 1)
    } else {
      localStorage.setItem('aageKyaFormData', JSON.stringify(form))
      navigate(selectedClassLevel === 'class10' ? '/class10/result' : '/class12/result', { state: { formData: form } })
    }
  }

  const handleBack = () => {
    setErrors({})
    setStep((s) => Math.max(1, s - 1))
  }

  if (!selectedClassLevel) {
    return (
      <main className="pt-16 min-h-screen pb-12 relative flex flex-col items-center justify-center">
        <div className="fixed inset-0 bg-mesh-premium pointer-events-none" />
        {!consentGiven && <PrivacyConsentModal onConsent={giveConsent} />}
        <ClassLevelSelection onSelect={(lvl) => {
          setSelectedClassLevel(lvl)
          setForm((f) => ({ ...f, classLevel: lvl }))
          navigate(`/${lvl}/onboarding`, { replace: true })
        }} />
      </main>
    )
  }

  return (
    <main className="pt-16 min-h-screen pb-12">
      {/* Privacy consent gate — shown before any form renders */}
      {!consentGiven && <PrivacyConsentModal onConsent={giveConsent} />}

      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* ── Progress tracker ── */}
        <div className="pt-8 pb-7">
          {/* Step dots + connecting line */}
          <div className="flex items-center justify-between mb-5 relative">
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/10" />
            <div
              className="absolute top-4 left-4 h-0.5 bg-saffron transition-all duration-700"
              style={{ width: `calc(${((step - 1) / (total - 1)) * 100}%)` }}
            />
            {STEPS.map((s) => (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${s.id < step  ? 'bg-saffron border-saffron text-white'
                  : s.id === step ? 'bg-navy border-saffron text-saffron ring-4 ring-saffron/20'
                                  : 'bg-navy border-white/20 text-gray-600'}`}>
                  {s.id < step
                    ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    : s.id}
                </div>
                <span className={`text-xs font-medium hidden sm:block transition-colors
                  ${s.id === step ? 'text-saffron' : s.id < step ? 'text-gray-400' : 'text-gray-700'}`}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-saffron to-saffron-light rounded-full transition-all duration-700"
              style={{ width: `${(step / total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-600 text-xs">Step {step} of {total}</span>
            <span className="text-saffron text-xs font-semibold">{Math.round((step / total) * 100)}% done</span>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="glass-card p-5 sm:p-9">

          {/* Step header */}
          <div className="flex items-start gap-4 mb-7 pb-6 border-b border-white/8">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-saffron/15 border border-saffron/25 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
              {currentStep.icon}
            </div>
            <div>
              <p className="text-saffron text-xs font-bold uppercase tracking-widest mb-1">
                Step {step} — {currentStep.title}
              </p>
              <h2 className="font-display font-bold text-lg sm:text-2xl text-white leading-snug">
                {currentStep.subtitle}
              </h2>
            </div>
          </div>

          {/* Step content */}
          {step === 1 && <Step1 form={form} setForm={setForm} errors={errors} classLevel={classLevel} />}
          {step === 2 && <Step2 form={form} setForm={setForm} errors={errors} classLevel={classLevel} />}
          {step === 3 && <Step3 form={form} setForm={setForm} errors={errors} classLevel={classLevel} />}

          {/* ── Navigation ── */}
          <div className="mt-9 pt-6 border-t border-white/8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">

            <button
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center justify-center gap-2 py-3 sm:py-0 text-sm font-semibold text-gray-400
                         hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors group">
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Step pips */}
              <div className="flex gap-1.5 mr-1 flex-shrink-0">
                {STEPS.map((s) => (
                  <div key={s.id} className={`rounded-full transition-all duration-300
                    ${s.id === step ? 'w-5 h-1.5 bg-saffron' : s.id < step ? 'w-1.5 h-1.5 bg-saffron/50' : 'w-1.5 h-1.5 bg-white/20'}`}
                  />
                ))}
              </div>

              <button
                id="next-btn"
                onClick={handleNext}
                className="flex-1 sm:flex-none btn-primary py-3.5 sm:py-3 px-7 text-sm font-semibold flex items-center justify-center gap-2 group/btn">
                {step === total ? (
                  <><span>Get My Honest Guide</span><span>🎯</span></>
                ) : (
                  <><span>Next</span>
                    <svg className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-5">
          Saved locally · No account needed · Takes 3 minutes
        </p>
      </div>
    </main>
  )
}
