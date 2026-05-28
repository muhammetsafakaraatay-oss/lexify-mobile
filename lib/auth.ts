export interface ReplitUser {
  id: string
  name: string
  avatar_url: string | null
}

let cachedUser: ReplitUser | null | undefined = undefined

export async function getCurrentUser(): Promise<ReplitUser | null> {
  if (cachedUser !== undefined) return cachedUser
  try {
    const res = await fetch('/api/auth/me')
    const data = await res.json()
    cachedUser = data.user ?? null
    return cachedUser
  } catch {
    cachedUser = null
    return null
  }
}

export function clearUserCache() {
  cachedUser = undefined
}

export function signOut() {
  clearUserCache()
  if (typeof window !== 'undefined') {
    window.location.href = '/__replauthlogout'
  }
}

export function signIn() {
  if (typeof window !== 'undefined') {
    window.location.href = '/__replauth'
  }
}
