import { projectId, publicAnonKey } from "/utils/supabase/info.js";
import { MENTORS } from "../data/mockData";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-64a0c849`;

// Mentor endpoints are public — no Authorization header needed
const headers = () => ({
  "Content-Type": "application/json",
});

// Fallback to local mock data if server is unreachable
const FALLBACK = MENTORS;

export async function fetchMentors() {
  try {
    const res = await fetch(`${BASE}/mentors`, { headers: headers() });
    if (!res.ok) {
      // Silently fallback for 401/403/500 errors
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        console.log(`📦 Using local mentor data (API unavailable: ${res.status})`);
        return FALLBACK;
      }
      console.log(`fetchMentors: API returned ${res.status}, using fallback`);
      return FALLBACK;
    }
    const data = await res.json();
    if (data.success && Array.isArray(data.mentors) && data.mentors.length > 0) {
      console.log(`✅ Loaded ${data.mentors.length} mentors from API`);
      return data.mentors;
    }
    console.log("📦 Using local mentor data (API returned empty data)");
    return FALLBACK;
  } catch (err) {
    // Network error - silently use fallback
    console.log("📦 Using local mentor data (network error)");
    return FALLBACK;
  }
}

export async function fetchMentor(id) {
  try {
    const res = await fetch(`${BASE}/mentors/${id}`, { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) {
      // Silently fallback for auth/server errors
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        console.log(`📦 Using local mentor data for ID ${id} (API unavailable: ${res.status})`);
        return FALLBACK.find((m) => m.id === id) ?? null;
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.success && data.mentor) {
      console.log(`✅ Loaded mentor ${id} from API`);
      return data.mentor;
    }
    return FALLBACK.find((m) => m.id === id) ?? null;
  } catch (err) {
    // Network error - silently use fallback
    console.log(`📦 Using local mentor data for ID ${id}`);
    return FALLBACK.find((m) => m.id === id) ?? null;
  }
}