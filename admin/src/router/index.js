import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '@/utils/auth'

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
        path: 'courses/:id/chapters',
        name: 'CourseChapters',
        component: () => import('@/views/Chapters.vue')
      },
      {
        path: 'audios',
        name: 'Audios',
        component: () => import('@/views/Audios.vue')
      },
      {
        path: 'headlines',
        name: 'Headlines',
        component: () => import('@/views/Headlines.vue')
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
  const isLoggedIn = isAuthenticated()

  // 未登录时，跳转到登录页（除了登录页和配置页本身）
  if (!isLoggedIn && to.meta.requiresAuth) {
    next('/login')
    return
  }

  // 已登录时，不允许访问登录页
  if (isLoggedIn && to.path === '/login') {
    next('/')
    return
  }

  next()
})

export default router