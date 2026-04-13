/**
 * 认证工具
 * 管理登录状态和凭证存储
 */

const AUTH_KEY = 'tingke_admin_auth'
const USER_KEY = 'tingke_admin_user'

// 默认云环境ID
const DEFAULT_ENV_ID = 'cloud1-2g5y53suf638dfb9'

// 获取存储的凭证（系统配置）
export function getCredentials() {
  const stored = localStorage.getItem(AUTH_KEY)
  if (stored) {
    try {
      const creds = JSON.parse(stored)
      if (!creds.envId) {
        creds.envId = DEFAULT_ENV_ID
      }
      return creds
    } catch {
      return null
    }
  }
  return null
}

// 保存凭证（系统配置）
export function saveCredentials(credentials) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(credentials))
}

// 清除凭证（仅在需要更换凭证时使用）
export function clearCredentials() {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(USER_KEY)
}

// 退出登录（只清除用户信息，保留凭证配置）
export function logout() {
  localStorage.removeItem(USER_KEY)
}

// 获取当前登录用户
export function getCurrentUser() {
  const stored = localStorage.getItem(USER_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

// 保存用户信息
export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// 检查是否已登录
export function isAuthenticated() {
  return getCurrentUser() !== null && getCredentials() !== null
}

// 获取当前凭证
export function getCurrentCredentials() {
  return getCredentials()
}

// 获取云环境ID
export function getEnvId() {
  const creds = getCredentials()
  return creds?.envId || DEFAULT_ENV_ID
}