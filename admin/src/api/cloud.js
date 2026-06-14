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
  timeout: 600000
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
export async function getChapters(courseId = null, page = 1, pageSize = 20) {
  const params = { page, pageSize }
  if (courseId) params.courseId = courseId
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

/**
 * 删除章节的音频文件
 * @param {string} chapterId 章节ID
 */
export async function deleteAudioFile(chapterId) {
  const response = await api.delete(`/chapters/${chapterId}/audio`)
  return response.data
}

// ========== 音频 API ==========

/**
 * 获取音频列表
 * @param {number} page 页码
 * @param {number} pageSize 每页数量
 * @param {string} course 课程ID筛选
 */
export async function getAudios(page = 1, pageSize = 20, course = '') {
  const params = { page, pageSize }
  if (course) params.course = course
  const response = await api.get('/audios', { params })
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
 * 批量上传音频
 * @param {File[]} files 音频文件数组
 * @param {string} courseId 课程ID
 */
export async function batchUploadAudio(files, courseId) {
  const formData = new FormData()
  files.forEach(file => formData.append('audios', file))
  formData.append('courseId', courseId)

  const response = await api.post('/audios/batch-upload', formData, {
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

/**
 * 更新音频
 * @param {string} id 音频ID
 * @param {object} data 更新数据
 */
export async function updateAudio(id, data) {
  const response = await api.put(`/audios/${id}`, data)
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

/**
 * 获取轮播配置
 */
export async function getBannerConfig() {
  const response = await api.get('/banner-config')
  return response.data
}

/**
 * 保存轮播配置
 */
export async function saveBannerConfig(data) {
  const response = await api.post('/banner-config', data)
  return response.data
}

/**
 * 获取版权配置
 */
export async function getCopyrightConfig() {
  const response = await api.get('/copyright-config')
  return response.data
}

/**
 * 保存版权配置
 */
export async function saveCopyrightConfig(data) {
  const response = await api.post('/copyright-config', data)
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

// ========== 版本 API ==========

/**
 * 获取版本列表
 */
export async function getVersions() {
  const response = await api.get('/versions')
  return response.data
}

/**
 * 创建版本
 */
export async function createVersion(data) {
  const response = await api.post('/versions', data)
  return response.data
}

/**
 * 更新版本
 */
export async function updateVersion(id, data) {
  const response = await api.put(`/versions/${id}`, data)
  return response.data
}

/**
 * 删除版本
 */
export async function deleteVersion(id) {
  const response = await api.delete(`/versions/${id}`)
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

// ========== 用户进度 API ==========

/**
 * 获取用户进度
 * @param {string} userId 用户ID
 * @param {string} courseId 课程ID（可选）
 * @returns {Promise<object>}
 */
export async function getUserProgress(userId, courseId = null) {
  const params = { userId }
  if (courseId) params.courseId = courseId
  const response = await api.get('/user-progress', { params })
  return response.data
}

/**
 * 更新用户进度
 * @param {string} userId 用户ID
 * @param {string} chapterId 章节ID
 * @param {object} data 进度数据
 * @returns {Promise<object>}
 */
export async function updateUserProgress(userId, chapterId, data) {
  const response = await api.put('/user-progress', { userId, chapterId, ...data })
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

// ========== Dashboard 统计 API ==========

/**
 * 获取 Dashboard 聚合数据
 * @returns {Promise<{success: boolean, data?: {counts, todos, health}}>}
 */
export async function getDashboardStats() {
  try {
    const response = await api.get('/stats/dashboard')
    return response.data
  } catch (error) {
    return { success: false, error: error.message || '获取统计失败' }
  }
}

/**
 * 获取服务健康状态
 * @returns {Promise<{success: boolean, data?: {status, uptime, memory, errors, ...}}>}
 */
export async function getServerHealth() {
  try {
    const response = await api.get('/health')
    return response.data
  } catch (error) {
    return { success: false, error: error.message || '获取健康状态失败' }
  }
}

// ========== 默认封面 API ==========

/**
 * 获取默认封面配置
 * @returns {Promise<object>}
 */
export async function getDefaultCover() {
  const response = await api.get('/default-cover')
  return response.data
}

/**
 * 上传默认封面
 * @param {File} file 图片文件
 * @returns {Promise<object>}
 */
export async function uploadDefaultCover(file) {
  const formData = new FormData()
  formData.append('cover', file)

  const response = await api.post('/default-cover/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

/**
 * 删除默认封面
 * @returns {Promise<object>}
 */
export async function deleteDefaultCover() {
  const response = await api.delete('/default-cover')
  return response.data
}

/**
 * 获取默认卡面配置
 * @returns {Promise<object>}
 */
export async function getDefaultCardFace() {
  const response = await api.get('/default-card-face')
  return response.data
}

/**
 * 上传默认卡面
 * @param {File} file 图片文件
 * @returns {Promise<object>}
 */
export async function uploadDefaultCardFace(file) {
  const formData = new FormData()
  formData.append('cardFace', file)

  const response = await api.post('/default-card-face/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

/**
 * 删除默认卡面
 * @returns {Promise<object>}
 */
export async function deleteDefaultCardFace() {
  const response = await api.delete('/default-card-face')
  return response.data
}

// ========== 武功 API ==========

/**
 * 获取武功列表（支持分页、筛选、搜索）
 * @param {object} params 参数 { page, pageSize, typeId, factionId, novelId, keyword }
 */
export async function getMartialArts(params = {}) {
  const response = await api.get('/martial-arts', { params })
  return response.data
}

/**
 * 获取所有类型（用于下拉选择）
 */
export async function getMartialArtTypes(novelId) {
  const params = novelId ? { novelId } : {}
  const response = await api.get('/martial-arts/types-by-novel', { params })
  return response.data
}

/**
 * 获取所有门派（用于下拉选择）
 */
export async function getMartialArtFactions(novelId) {
  const params = novelId ? { novelId } : {}
  const response = await api.get('/martial-arts/factions-by-novel', { params })
  return response.data
}

/**
 * 获取所有小说（用于下拉选择）
 */
export async function getMartialArtNovels() {
  const response = await api.get('/martial-arts/novels')
  return response.data
}

/**
 * 获取所有人物（用于下拉选择）
 */
export async function getMartialArtCharacters() {
  const response = await api.get('/martial-arts/characters')
  return response.data
}

// 类型 CRUD
export async function createMartialArtType(data) {
  const response = await api.post('/martial-arts/types', data)
  return response.data
}
export async function updateMartialArtType(id, data) {
  const response = await api.put(`/martial-arts/types/${id}`, data)
  return response.data
}
export async function deleteMartialArtType(id) {
  const response = await api.delete(`/martial-arts/types/${id}`)
  return response.data
}

// 门派 CRUD
export async function createMartialArtFaction(data) {
  const response = await api.post('/martial-arts/factions', data)
  return response.data
}
export async function updateMartialArtFaction(id, data) {
  const response = await api.put(`/martial-arts/factions/${id}`, data)
  return response.data
}
export async function deleteMartialArtFaction(id) {
  const response = await api.delete(`/martial-arts/factions/${id}`)
  return response.data
}

// 小说 CRUD
export async function createMartialArtNovel(data) {
  const response = await api.post('/martial-arts/novels', data)
  return response.data
}
export async function updateMartialArtNovel(id, data) {
  const response = await api.put(`/martial-arts/novels/${id}`, data)
  return response.data
}
export async function deleteMartialArtNovel(id) {
  const response = await api.delete(`/martial-arts/novels/${id}`)
  return response.data
}

// 人物 CRUD
export async function createMartialArtCharacter(data) {
  const response = await api.post('/martial-arts/characters', data)
  return response.data
}
export async function updateMartialArtCharacter(id, data) {
  const response = await api.put(`/martial-arts/characters/${id}`, data)
  return response.data
}
export async function deleteMartialArtCharacter(id) {
  const response = await api.delete(`/martial-arts/characters/${id}`)
  return response.data
}

/**
 * 获取单个武功详情
 */
export async function getMartialArt(id) {
  const response = await api.get(`/martial-arts/${id}`)
  return response.data
}

/**
 * 创建武功
 */
export async function createMartialArt(data) {
  const response = await api.post('/martial-arts', data)
  return response.data
}

/**
 * 更新武功
 */
export async function updateMartialArt(id, data) {
  const response = await api.put(`/martial-arts/${id}`, data)
  return response.data
}

/**
 * 删除武功
 */
export async function deleteMartialArt(id) {
  const response = await api.delete(`/martial-arts/${id}`)
  return response.data
}

/**
 * 导出武功列表
 */
export async function exportMartialArts(novelId) {
  const response = await api.get('/martial-arts/export-list', { params: { novelId } })
  return response.data
}

/**
 * 导入武功
 */
export async function importMartialArts(data) {
  const response = await api.post('/martial-arts/import', data)
  return response.data
}

/**
 * 导出武功基础数据（类型/门派/人物）
 */
export async function exportMartialArtsBaseData(type) {
  const response = await api.get('/martial-arts/base-data/export', { params: { type } })
  return response.data
}

/**
 * 导入武功基础数据
 */
export async function importMartialArtsBaseData(data) {
  const response = await api.post('/martial-arts/base-data/import', data)
  return response.data
}

// ========== 卡牌 API ==========

/**
 * 获取卡牌列表
 */
export async function getCards() {
  const response = await api.get('/cards')
  return response.data
}

/**
 * 创建卡牌
 */
export async function createCard(data) {
  const response = await api.post('/cards', data)
  return response.data
}

/**
 * 更新卡牌
 */
export async function updateCard(id, data) {
  const response = await api.put(`/cards/${id}`, data)
  return response.data
}

/**
 * 删除卡牌
 */
export async function deleteCard(id) {
  const response = await api.delete(`/cards/${id}`)
  return response.data
}

/**
 * 上传卡牌图片
 * @param {File} file 图片文件
 */
export async function uploadCardImage(file) {
  const formData = new FormData()
  formData.append('image', file)

  const response = await api.post('/cards/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

/**
 * 删除卡牌图片
 * @param {string} fileID 云存储文件ID
 */
export async function deleteCardImage(fileID) {
  const response = await api.delete('/cards/image', { data: { fileID } })
  return response.data
}

export default api