/**
 * 云开发 API 封装
 * 所有数据操作通过此模块与微信云开发交互
 */

import axios from 'axios'

// API 基础地址（后端服务）
const API_BASE = '/api'

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000
})

// 请求拦截器 - 只添加用户身份信息（不传递敏感凭证）
api.interceptors.request.use(config => {
  // 获取当前登录用户信息
  const user = getCurrentUserFromStorage()
  if (user) {
    config.headers['X-User-Id'] = user.userId
    config.headers['X-Role-Code'] = user.roleCode || ''
  }
  return config
})

// 从存储获取当前用户
function getCurrentUserFromStorage() {
  const stored = localStorage.getItem('tingting_admin_user')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

// ========== 认证 API ==========

/**
 * 测试云开发连接
 * @param {object} credentials 可选凭证对象 { secretId, secretKey, envId }
 * @returns {Promise<object>}
 */
export async function testConnection(credentials = null) {
  try {
    const response = await api.post('/auth/test', credentials || {})
    return response.data
  } catch (error) {
    console.error('连接测试失败:', error)
    return { success: false, error: error.message || '连接失败' }
  }
}

/**
 * 手机号登录
 * @param {string} phone 手机号
 * @param {string} password 密码
 * @returns {Promise<object>}
 */
export async function loginByPhone(phone, password) {
  try {
    const response = await api.post('/auth/login', { phone, password })
    return response.data
  } catch (error) {
    console.error('登录失败:', error)
    return { success: false, error: error.message || '登录失败' }
  }
}

/**
 * 获取账号信息
 * @returns {Promise<object>}
 */
export async function getAccountInfo() {
  try {
    const response = await api.get('/auth/account')
    return response.data
  } catch (error) {
    console.error('获取账号信息失败:', error)
    return { success: false, error: error.message || '获取失败' }
  }
}

// ========== 课程 API ==========

/**
 * 获取课程列表
 */
export async function getCourses() {
  const response = await api.get('/courses')
  return response.data
}

/**
 * 创建课程
 */
export async function createCourse(data) {
  const response = await api.post('/courses', data)
  return response.data
}

/**
 * 更新课程
 */
export async function updateCourse(id, data) {
  const response = await api.put(`/courses/${id}`, data)
  return response.data
}

/**
 * 删除课程
 */
export async function deleteCourse(id) {
  const response = await api.delete(`/courses/${id}`)
  return response.data
}

/**
 * 批量更新序号
 */
export async function batchUpdateSeq(collection, updates) {
  const response = await api.post('/batch-update-seq', { collection, updates })
  return response.data
}

// ========== 章节 API ==========

/**
 * 获取章节列表
 * @param {string} courseId 课程ID（可选）
 */
export async function getChapters(courseId = null) {
  const params = courseId ? { courseId } : {}
  const response = await api.get('/chapters', { params })
  return response.data
}

/**
 * 创建章节
 */
export async function createChapter(data) {
  const response = await api.post('/chapters', data)
  return response.data
}

/**
 * 更新章节
 */
export async function updateChapter(id, data) {
  const response = await api.put(`/chapters/${id}`, data)
  return response.data
}

/**
 * 删除章节
 */
export async function deleteChapter(id) {
  const response = await api.delete(`/chapters/${id}`)
  return response.data
}

// ========== 音频 API ==========

/**
 * 获取音频列表
 */
export async function getAudios() {
  const response = await api.get('/audios')
  return response.data
}

/**
 * 上传音频
 * @param {File} file 音频文件
 * @param {string} courseId 课程ID
 * @param {number} seq 章节序号
 * @param {string} title 章节标题
 */
export async function uploadAudio(file, courseId, seq, title) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('courseId', courseId)
  formData.append('seq', seq)
  formData.append('title', title)

  const response = await api.post('/audios/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

/**
 * 删除音频
 */
export async function deleteAudio(id) {
  const response = await api.delete(`/audios/${id}`)
  return response.data
}

// ========== 头条 API ==========

/**
 * 获取头条列表
 */
export async function getHeadlines() {
  const response = await api.get('/headlines')
  return response.data
}

/**
 * 创建头条
 */
export async function createHeadline(data) {
  const response = await api.post('/headlines', data)
  return response.data
}

/**
 * 更新头条
 */
export async function updateHeadline(id, data) {
  const response = await api.put(`/headlines/${id}`, data)
  return response.data
}

/**
 * 删除头条
 */
export async function deleteHeadline(id) {
  const response = await api.delete(`/headlines/${id}`)
  return response.data
}

// ========== 分类 API ==========

/**
 * 获取分类列表
 */
export async function getCategories() {
  const response = await api.get('/categories')
  return response.data
}

/**
 * 创建分类
 */
export async function createCategory(data) {
  const response = await api.post('/categories', data)
  return response.data
}

/**
 * 更新分类
 */
export async function updateCategory(id, data) {
  const response = await api.put(`/categories/${id}`, data)
  return response.data
}

/**
 * 删除分类
 */
export async function deleteCategory(id) {
  const response = await api.delete(`/categories/${id}`)
  return response.data
}

// ========== 角色 API ==========

/**
 * 获取角色列表
 */
export async function getRoles() {
  const response = await api.get('/roles')
  return response.data
}

/**
 * 创建角色
 */
export async function createRole(data) {
  const response = await api.post('/roles', data)
  return response.data
}

/**
 * 更新角色
 */
export async function updateRole(id, data) {
  const response = await api.put(`/roles/${id}`, data)
  return response.data
}

/**
 * 删除角色
 */
export async function deleteRole(id) {
  const response = await api.delete(`/roles/${id}`)
  return response.data
}

// ========== 用户 API ==========

/**
 * 获取用户列表
 */
export async function getUsers() {
  const response = await api.get('/users')
  return response.data
}

/**
 * 创建用户
 */
export async function createUser(data) {
  const response = await api.post('/users', data)
  return response.data
}

/**
 * 更新用户
 */
export async function updateUser(id, data) {
  const response = await api.put(`/users/${id}`, data)
  return response.data
}

/**
 * 删除用户
 */
export async function deleteUser(id) {
  const response = await api.delete(`/users/${id}`)
  return response.data
}

/**
 * 上传头像
 * @param {File} file 图片文件
 * @param {string} userId 用户ID
 */
export async function uploadAvatar(file, userId) {
  const formData = new FormData()
  formData.append('avatar', file)

  const response = await api.post('/users/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'X-Upload-User-Id': userId
    }
  })
  return response.data
}

/**
 * 获取云存储文件临时链接
 * @param {string} fileID 云存储文件ID
 * @returns {Promise<object>}
 */
export async function getFileTempUrl(fileID) {
  const response = await api.post('/file/temp-url', { fileID })
  return response.data
}

/**
 * 获取菜单配置
 * @returns {Promise<object>}
 */
export async function getMenuConfig() {
  const response = await api.get('/menu-config')
  return response.data
}

/**
 * 保存菜单配置
 * @param {Array} menuOrder 菜单顺序数组
 * @returns {Promise<object>}
 */
export async function saveMenuConfig(menuOrder) {
  const response = await api.post('/menu-config', { menuOrder })
  return response.data
}

/**
 * 获取环境配置
 * @returns {Promise<object>}
 */
export async function getEnvConfig() {
  const response = await api.get('/env-config')
  return response.data
}

/**
 * 保存环境配置
 * @param {object} config 配置对象
 * @returns {Promise<object>}
 */
export async function saveEnvConfig(config) {
  const response = await api.post('/env-config', config)
  return response.data
}

/**
 * 获取当前登录用户最新信息
 * @returns {Promise<object>}
 */
export async function getCurrentUserInfo() {
  const response = await api.get('/auth/current-user')
  return response.data
}

export default api