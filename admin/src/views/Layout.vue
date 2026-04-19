<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <el-container class="layout-main">
      <el-aside width="180px" class="layout-aside">
        <div class="logo">
          <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#FF6B00"/>
            <path d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
            <rect x="8" y="16" width="3" height="6" rx="1" fill="#fff"/>
            <rect x="21" y="16" width="3" height="6" rx="1" fill="#fff"/>
          </svg>
          <h1>听听管理后台</h1>
        </div>

        <el-menu
          :default-active="activeMenu"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#FF6B00"
        >
          <el-menu-item index="/">
            <el-icon><HomeFilled /></el-icon>
            <span>首页</span>
          </el-menu-item>

          <template v-for="key in menuOrder" :key="key">
            <el-menu-item v-if="hasPermission(key)" :index="'/' + key">
              <el-icon>
                <component :is="menuIcons[key]" />
              </el-icon>
              <span>{{ menuLabels[key] }}</span>
            </el-menu-item>
          </template>
        </el-menu>
      </el-aside>

      <!-- 主内容区 -->
      <el-container>
        <!-- 顶部栏 -->
        <el-header class="layout-header">
          <div class="header-left">
            <span class="breadcrumb">{{ breadcrumb }}</span>
          </div>
          <div class="header-right">
            <span class="user-info">
              <el-avatar :src="getAvatarUrl(user?.avatarUrl)" :size="24">
                <el-icon :size="14"><UserFilled /></el-icon>
              </el-avatar>
              <span class="user-name">你好，{{ user?.nickName || '用户' }}！</span>
              <el-tag v-if="user?.roleCode === 'admin'" type="danger" size="small">管理员</el-tag>
              <el-tag v-else-if="user?.roleName" type="primary" size="small">{{ user.roleName }}</el-tag>
            </span>
            <el-button type="danger" size="small" @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              退出
            </el-button>
          </div>
        </el-header>

        <!-- 内容区 -->
        <el-main class="layout-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { HomeFilled, Reading, Document, Headset, Folder, User, Lock, Setting, SwitchButton, UserFilled, Tickets } from '@element-plus/icons-vue'
import { clearCredentials, getCurrentUser, logout, saveUser } from '@/utils/auth'
import { getMenuConfig } from '@/api/cloud'

const router = useRouter()
const route = useRoute()

// 当前登录用户（响应式）
const storedUser = getCurrentUser()
const user = ref(storedUser)

// 是否是管理员
const isAdmin = computed(() => user.value?.roleCode === 'admin')

// 获取用户权限列表
const userPermissions = computed(() => user.value?.permissions || [])

// 菜单配置
const menuLabels = {
  courses: '课程管理',
  audios: '音频管理',
  headlines: '首尾管理',
  categories: '分类管理',
  users: '用户管理',
  roles: '角色管理',
  system: '系统配置'
}

const menuIcons = {
  courses: Reading,
  audios: Headset,
  headlines: Tickets,
  categories: Folder,
  users: User,
  roles: Lock,
  system: Setting
}

const menuOrder = ref(['courses', 'audios', 'headlines', 'categories', 'users', 'roles', 'system'])

// 获取头像URL（兼容新旧格式）
function getAvatarUrl(avatarUrl) {
  if (!avatarUrl) return ''
  // 本地路径直接返回
  if (avatarUrl.startsWith('/avatars/')) {
    return avatarUrl
  }
  // http/https 直接返回
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }
  // cloud:// 格式不显示（旧格式，需要用户重新上传头像）
  return ''
}

// 检查是否有某个权限
function hasPermission(permission) {
  // 管理员有所有权限
  if (isAdmin.value) return true
  // 如果没有权限列表，只显示首页
  if (userPermissions.value.length === 0) return false
  // 检查用户权限列表
  return userPermissions.value.includes(permission)
}

// 初始化
onMounted(async () => {
  // 加载菜单配置
  try {
    const result = await getMenuConfig()
    if (result.success && result.data.menuOrder) {
      // 过滤掉无效的菜单项
      menuOrder.value = result.data.menuOrder.filter(key => menuLabels[key])
    }
  } catch (err) {
    console.error('加载菜单配置失败:', err)
  }
})

// 监听 storage 变化，更新用户信息（跨标签页）
window.addEventListener('storage', (e) => {
  if (e.key === 'tingting_admin_user') {
    user.value = getCurrentUser()
  }
})

// 监听自定义事件，更新用户信息（同页面）
window.addEventListener('user-info-updated', () => {
  user.value = getCurrentUser()
})

// 监听菜单排序更新事件
window.addEventListener('menu-order-updated', (e) => {
  if (e.detail) {
    menuOrder.value = e.detail.filter(key => menuLabels[key])
  }
})

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 面包屑
const breadcrumb = computed(() => {
  const map = {
    '/': '首页',
    '/courses': '课程管理',
    '/audios': '音频管理',
    '/headlines': '首尾管理',
    '/categories': '分类管理',
    '/users': '用户管理',
    '/roles': '角色管理',
    '/system': '系统配置'
  }
  // 课程章节页面
  if (route.path.startsWith('/courses/') && route.path.includes('/chapters')) {
    return '章节管理'
  }
  return map[route.path] || '首页'
})

// 退出登录
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.layout-main {
  height: 100%;
}

.layout-aside {
  background-color: #304156;
  overflow-x: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background-color: #263445;
}

.logo-icon {
  width: 28px;
  height: 28px;
}

.logo h1 {
  color: #FF6B00;
  font-size: 18px;
  margin: 0;
  line-height: 28px;
}

.el-menu {
  border-right: none;
}

.layout-header {
  background-color: #fff;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.breadcrumb {
  font-size: 16px;
  color: #333;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: nowrap;
}

.user-name {
  font-size: 14px;
  color: #333;
}

.layout-content {
  background-color: #f5f5f5;
  padding: 20px;
  overflow-y: auto;
}
</style>