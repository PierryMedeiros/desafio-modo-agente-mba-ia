import { apiFetch } from './client'

export type User = {
  id: string
  name: string
  email: string
  role: 'customer' | 'agent' | 'admin'
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  localStorage.setItem('token', data.token)
  localStorage.setItem('user', JSON.stringify(data.user))
  return data.user
}

export function register(name: string, email: string, password: string) {
  return apiFetch<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}
