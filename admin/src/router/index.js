import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated, getCredentials } from '@/utils/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('@/views/Setup.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'courses',
        name: 'Courses',
        component: () => import('@/views/Courses.vue')
      },
      {
        path: 'chapters',
        name: 'Chapters',
        component: () => import('@/views/Chapters.vue')
      },
      {
        path: 'audios',
        name: 'Audios',
        component: () => import('@/views/Audios.vue')
      },
      {
        path: 'categories',
        name: 'Categories',
        component: () => import('@/views/Categories.vue')
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/Users.vue')
      },
      {
        path: 'roles',
        name: 'Roles',
        component: () => import('@/views/Roles.vue')
      },
      {
        path: 'system',
        name: 'System',
        component: () => import('@/views/System.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const hasCredentials = getCredentials() !== null
  const isLoggedIn = isAuthenticated()

  // 如果没有配置凭证，跳转到设置页面
  if (!hasCredentials && to.path !== '/setup') {
    next('/setup')
    return
  }

  // 如果已配置凭证但未登录，跳转到登录页
  if (hasCredentials && !isLoggedIn && to.meta.requiresAuth) {
    next('/login')
    return
  }

  // 如果已登录，不允许访问登录页
  if (isLoggedIn && to.path === '/login') {
    next('/')
    return
  }

  next()
})

export default router