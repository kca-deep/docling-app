/**
 * 인증 관련 API 함수
 */
import { API_BASE_URL } from './api-config'

// === 타입 정의 ===

export interface User {
  id: number
  username: string
  email?: string
  name?: string
  team_name?: string
  role: string
  status: string
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

// === 회원가입 타입 ===

export interface RegisterCredentials {
  username: string
  email: string
  password: string
  password_confirm: string
  name: string
  team_name?: string
}

export interface RegisterResponse {
  id: number
  username: string
  email: string
  name: string
  status: string
  message: string
}

export interface DuplicateCheckResult {
  is_duplicate: boolean
  field: string
  message: string
}

// === 관리자 타입 ===

export interface UserListItem {
  id: number
  username: string
  email?: string
  name?: string
  team_name?: string
  role: string
  status: string
  is_active: boolean
  created_at?: string
  last_login?: string
}

export interface ApproveRejectResult {
  success: boolean
  user_id: number
  status: string
  message: string
}

// === 에러 타입 ===

export interface AuthError {
  message: string
  error_code: string
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
    const errorData = await response.json()
    // detail이 객체인 경우 (AuthError 형태)
    if (errorData.detail && typeof errorData.detail === 'object') {
      const authError = errorData.detail as AuthError
      const error = new Error(authError.message) as Error & { errorCode?: string }
      error.errorCode = authError.error_code
      throw error
    }
    throw new Error(errorData.detail || 'Login failed')
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

// === 회원가입 API ===

/**
 * 회원가입
 */
export async function register(credentials: RegisterCredentials): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const errorData = await response.json()
    if (errorData.detail && typeof errorData.detail === 'object') {
      const authError = errorData.detail as AuthError
      const error = new Error(authError.message) as Error & { errorCode?: string }
      error.errorCode = authError.error_code
      throw error
    }
    throw new Error(errorData.detail || 'Registration failed')
  }

  return response.json()
}

/**
 * 중복 체크
 */
export async function checkDuplicate(
  field: 'username' | 'email',
  value: string
): Promise<DuplicateCheckResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/check-duplicate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ field, value }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Duplicate check failed')
  }

  return response.json()
}

// === 관리자 API ===

/**
 * 사용자 목록 조회 (관리자)
 */
export async function getUsers(params?: {
  status?: string
  skip?: number
  limit?: number
}): Promise<UserListItem[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status_filter', params.status)
  if (params?.skip !== undefined) searchParams.set('skip', String(params.skip))
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit))

  const url = `${API_BASE_URL}/api/auth/users${searchParams.toString() ? `?${searchParams}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get users')
  }

  return response.json()
}

/**
 * 대기 사용자 목록 조회 (관리자)
 */
export async function getPendingUsers(): Promise<UserListItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/pending`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get pending users')
  }

  return response.json()
}

/**
 * 사용자 승인 (관리자)
 */
export async function approveUser(userId: number): Promise<ApproveRejectResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    if (errorData.detail && typeof errorData.detail === 'object') {
      throw new Error(errorData.detail.message || 'Failed to approve user')
    }
    throw new Error(errorData.detail || 'Failed to approve user')
  }

  return response.json()
}

/**
 * 사용자 거절 (관리자)
 */
export async function rejectUser(userId: number, reason?: string): Promise<ApproveRejectResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId, reason }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    if (errorData.detail && typeof errorData.detail === 'object') {
      throw new Error(errorData.detail.message || 'Failed to reject user')
    }
    throw new Error(errorData.detail || 'Failed to reject user')
  }

  return response.json()
}

/**
 * 사용자 삭제 (관리자)
 */
export async function deleteUser(userId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete user')
  }
}
