import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import router from './router'
import App from './App.vue'
import './styles/index.css'

// 禁用 Element Plus 的调试警告
const originalWarn = console.warn
console.warn = (...args) => {
  // 过滤掉 Element Plus 表单验证的调试警告
  if (args[0] && typeof args[0] === 'string' && args[0].includes('[ElementPlus]')) {
    return
  }
  // 过滤掉表单验证错误对象（如 {phone: Array(1)}）
  if (args[0] && typeof args[0] === 'object') {
    const firstArg = args[0]
    // 检查是否是表单验证错误对象（包含字段名，值为数组）
    const keys = Object.keys(firstArg)
    if (keys.length > 0 && keys.some(key => Array.isArray(firstArg[key]))) {
      return
    }
  }
  originalWarn.apply(console, args)
}

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus)
app.use(router)
app.mount('#app')