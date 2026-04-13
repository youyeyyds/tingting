/**
 * 认证工具
 * 管理登录状态和用户信息
 * 注意：云开发凭证由后端环境变量配置，前端不再存储凭证
 */

const USER_KEY = 'tingting_admin_user'

// 清除所有登录信息
export function clearCredentials() {
  localStorage.removeItem(USER_KEY)
}

// 退出登录
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
  return getCurrentUser() !== null
}