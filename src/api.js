/**
 * Central API helper.
 * In production  → VITE_API_URL points to your deployed backend (Railway/Render)
 * In development → falls back to localhost:5000 (Vite proxy handles it)
 */
const BASE_URL = import.meta.env.VITE_API_URL || ''

/**
 * Build a full API URL from a path.
 * In dev, BASE_URL is empty and the Vite proxy forwards /api/* to localhost:5000.
 * In production, BASE_URL points to the deployed backend.
 */
export function apiUrl(path) {
  return `${BASE_URL}${path}`
}

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const { headers, ...rest } = options
  const res = await fetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  })
  return res
}

export async function getHealth() {
  return apiFetch('/api/health')
}

export async function postGuidance(formData, authToken) {
  return apiFetch('/api/guidance', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ formData }),
  })
}

export async function postRoadmap(formData, option, authToken) {
  return apiFetch('/api/roadmap', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ formData, option }),
  })
}

export async function getMentors() {
  return apiFetch('/api/mentors')
}

export async function postMentorApply(payload) {
  return apiFetch('/api/mentors/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function postMentorBook(payload, authToken) {
  return apiFetch('/api/mentors/book', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify(payload),
  })
}

export async function postMentorAsk(payload, authToken) {
  return apiFetch('/api/mentors/ask', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify(payload),
  })
}

export async function patchMentorReply(id, reply, authToken) {
  return apiFetch(`/api/mentor/messages/${id}/reply`, {
    method: 'PATCH',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ reply }),
  })
}

export async function postSync(formData, result, authToken) {
  return apiFetch('/api/sync', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ formData, result }),
  })
}

export async function postReOnboard(authToken) {
  return apiFetch('/api/re-onboard', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  })
}

export async function putWallet(wallet, authToken) {
  return apiFetch('/api/wallet', {
    method: 'PUT',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ wallet }),
  })
}

export async function postScenario(label, formData, guidanceResult, authToken) {
  return apiFetch('/api/scenarios', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ label, formData, guidanceResult }),
  })
}

export async function getScenarios(authToken) {
  return apiFetch('/api/scenarios', {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  })
}

export async function deleteScenario(id, authToken) {
  return apiFetch(`/api/scenarios/${id}`, {
    method: 'DELETE',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  })
}

export async function getQAPosts(params) {
  return apiFetch(`/api/qa?${params}`)
}

export async function postQAQuestion(question, streamTag, authToken) {
  return apiFetch('/api/qa', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ question, streamTag }),
  })
}

export async function postChat(messages, profile) {
  return apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, profile }),
  })
}

export async function getCollegeDetails(name) {
  return apiFetch(`/api/college-details?name=${encodeURIComponent(name)}`)
}

export async function getCourseFeedback(stream, options = {}) {
  return apiFetch(`/api/course-feedback?stream=${encodeURIComponent(stream)}`, options)
}

export async function postGenerateCareerPath(profession, formData) {
  return apiFetch('/api/generate-career-path', {
    method: 'POST',
    body: JSON.stringify({ profession, formData }),
  })
}

export async function postGenerateCourse(courseName) {
  return apiFetch('/api/generate-course', {
    method: 'POST',
    body: JSON.stringify({ courseName }),
  })
}

export async function postTranscribe(audio, mimeType, authToken) {
  return apiFetch('/api/transcribe', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ audio, mimeType }),
  })
}

// ─── Pathway Advisor (adaptive discovery flow) ────────────────────────────────

export async function getPathwayStartQuestions(classLevel) {
  return apiFetch(`/api/pathways/questions/start?classLevel=${encodeURIComponent(classLevel || '')}`)
}

export async function postPathwayNextQuestions(answers, classLevel) {
  return apiFetch('/api/pathways/questions/next', {
    method: 'POST',
    body: JSON.stringify({ answers, classLevel }),
  })
}

export async function postPathwayRecommend(formData, answers, useJudge = false) {
  return apiFetch('/api/pathways/recommend', {
    method: 'POST',
    body: JSON.stringify({ formData, answers, useJudge }),
  })
}
