/**
 * 인증 관련 API 함수
 */
import { API_BASE_URL } from './api-config'

// === 타입 정의 ===

export interface User {
  id: number
  username: string
  role: string
  is_active: boolean
}

export interface AuthStatus {
  authenticated: boolean
  user: User | null
}

export interface LoginCredentials {
  username: string
  password: string
}

// === API 함수 ===

/**
 * 로그인
 */
export async function login(credentials: LoginCredentials): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 쿠키 포함
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Login failed')
  }

  return response.json()
}

/**
 * 로그아웃
 */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Logout failed')
  }
}

/**
 * 현재 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Not authenticated')
  }

  return response.json()
}

/**
 * 인증 상태 확인
 */
export async function verifyAuth(): Promise<AuthStatus> {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    return { authenticated: false, user: null }
  }

  return response.json()
}
