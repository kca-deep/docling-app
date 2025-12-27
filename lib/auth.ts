/**
 * 인증 관련 API 함수
 */
import { API_BASE_URL } from './api-config'

// === 타입 정의 ===

export interface UserPermissions {
  selfcheck: { execute: boolean; history: boolean }
  documents: { parse: boolean; view: boolean; delete: boolean }
  qdrant: { upload: boolean; collections: boolean }
  dify: { upload: boolean; config: boolean }
  chat: { use: boolean; all_collections: boolean }
  analytics: { view: boolean }
  excel: { upload: boolean }
  admin: { users: boolean; system: boolean }
}

export interface User {
  id: number
  username: string
  email?: string
  name?: string
  team_name?: string
  role: string
  status: string
  is_active: boolean
  permissions?: UserPermissions
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

// === 권한 관련 API ===

export interface PermissionsResponse {
  user_id: number
  username: string
  role: string
  permissions: UserPermissions
}

export interface PermissionsUpdateResult {
  success: boolean
  user_id: number
  message: string
  permissions: UserPermissions
}

/**
 * 내 권한 조회
 */
export async function getMyPermissions(): Promise<PermissionsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me/permissions`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get permissions')
  }

  return response.json()
}

/**
 * 사용자 권한 조회 (관리자)
 */
export async function getUserPermissions(userId: number): Promise<PermissionsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}/permissions`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get user permissions')
  }

  return response.json()
}

/**
 * 사용자 권한 업데이트 (관리자)
 */
export async function updateUserPermissions(
  userId: number,
  permissions: UserPermissions
): Promise<PermissionsUpdateResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}/permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ permissions }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    if (errorData.detail && typeof errorData.detail === 'object') {
      throw new Error(errorData.detail.message || 'Failed to update permissions')
    }
    throw new Error(errorData.detail || 'Failed to update permissions')
  }

  return response.json()
}

/**
 * 사용자 권한 초기화 (관리자)
 */
export async function resetUserPermissions(userId: number): Promise<PermissionsUpdateResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}/permissions/reset`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json()
    if (errorData.detail && typeof errorData.detail === 'object') {
      throw new Error(errorData.detail.message || 'Failed to reset permissions')
    }
    throw new Error(errorData.detail || 'Failed to reset permissions')
  }

  return response.json()
}

/**
 * 기본 사용자 권한 템플릿
 */
export function getDefaultPermissions(): UserPermissions {
  return {
    selfcheck: { execute: true, history: true },
    documents: { parse: true, view: true, delete: false },
    qdrant: { upload: true, collections: false },
    dify: { upload: true, config: false },
    chat: { use: true, all_collections: false },
    analytics: { view: false },
    excel: { upload: true },
    admin: { users: false, system: false }
  }
}

/**
 * 관리자 권한 템플릿
 */
export function getAdminPermissions(): UserPermissions {
  return {
    selfcheck: { execute: true, history: true },
    documents: { parse: true, view: true, delete: true },
    qdrant: { upload: true, collections: true },
    dify: { upload: true, config: true },
    chat: { use: true, all_collections: true },
    analytics: { view: true },
    excel: { upload: true },
    admin: { users: true, system: true }
  }
}

/**
 * 권한 체크 헬퍼 함수
 */
export function hasPermission(
  user: User | null,
  category: keyof UserPermissions,
  action: string
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true

  const permissions = user.permissions
  if (!permissions) return false

  const categoryPermissions = permissions[category] as Record<string, boolean> | undefined
  if (!categoryPermissions) return false

  return categoryPermissions[action] ?? false
}
