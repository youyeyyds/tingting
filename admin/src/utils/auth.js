/**
 * 认证工具
 * 管理登录状态和用户信息
 * 注意：云开发凭证由后端环境变量配置，前端不再存储凭证
 */

const USER_KEY = 'tingting_admin_user'

// 登录过期时间（毫秒），默认 2 小时
const LOGIN_EXPIRE_TIME = 2 * 60 * 60 * 1000

// 清除所有登录信息
export function clearCredentials() {
  localStorage.removeItem(USER_KEY)
}

// 退出登录
export function logout() {
  localStorage.removeItem(USER_KEY)
}

// 获取当前登录用户（检查过期）
export function getCurrentUser() {
  const stored = localStorage.getItem(USER_KEY)
  if (stored) {
    try {
      const data = JSON.parse(stored)
      // 检查是否过期
      if (data.loginTime && Date.now() - data.loginTime > LOGIN_EXPIRE_TIME) {
        // 已过期，清除登录状态
        localStorage.removeItem(USER_KEY)
        return null
      }
      return data
    } catch {
      return null
    }
  }
  return null
}

// 保存用户信息（记录登录时间）
export function saveUser(user) {
  const data = {
    ...user,
    loginTime: Date.now()
  }
  localStorage.setItem(USER_KEY, JSON.stringify(data))
}

// 检查是否已登录（检查过期）
export function isAuthenticated() {
  return getCurrentUser() !== null
}

// 获取登录剩余时间（毫秒）
export function getRemainingTime() {
  const user = getCurrentUser()
  if (user && user.loginTime) {
    const remaining = LOGIN_EXPIRE_TIME - (Date.now() - user.loginTime)
    return remaining > 0 ? remaining : 0
  }
  return 0
}