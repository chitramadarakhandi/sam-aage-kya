import { createClient } from '@supabase/supabase-js'

// Real project defaults, used when the VITE_* build-time env vars aren't set
// (e.g. a Render/host build that didn't have them configured). This is safe:
// the anon key is PUBLIC by design — it's embedded in every deployed Supabase
// frontend and access is protected by Row Level Security, not by hiding this
// key. (The service_role key is the secret one and lives only in server/.env,
// never here.) Setting VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build
// time still overrides these — e.g. to point a build at a different project.
const DEFAULT_SUPABASE_URL = 'https://aylddzknxkntjmidxsxm.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bGRkemtueGtudGptaWR4c3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjcwNDgsImV4cCI6MjEwMDc0MzA0OH0.jYrF9vUxvc3ppmahq0CHoHgg7FZRgVAeg7wF8fLEjvw'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseUrl = (rawUrl && rawUrl.startsWith('http')) ? rawUrl : DEFAULT_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseAnonKey = (rawKey && rawKey.startsWith('eyJ')) ? rawKey : DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
