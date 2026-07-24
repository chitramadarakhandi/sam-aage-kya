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
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
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

export async function postSync(formData, result, authToken) {
  return apiFetch('/api/sync', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: JSON.stringify({ formData, result }),
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

export async function getPathwayStartQuestions() {
  return apiFetch('/api/pathways/questions/start')
}

export async function postPathwayNextQuestions(answers) {
  return apiFetch('/api/pathways/questions/next', {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
}

export async function postPathwayRecommend(formData, answers, useJudge = false) {
  return apiFetch('/api/pathways/recommend', {
    method: 'POST',
    body: JSON.stringify({ formData, answers, useJudge }),
  })
}
