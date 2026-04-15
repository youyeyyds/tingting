<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <h2>听听管理后台</h2>
        </div>
      </template>

      <!-- 连接状态显示 -->
      <div v-if="connectionStatus" class="connection-status">
        <el-tag :type="connectionStatus.type" size="small">
          {{ connectionStatus.text }}
        </el-tag>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" class="login-form" @submit.prevent="handleLogin">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password @keyup.enter="handleLogin" />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            @click="handleLogin"
            style="width: 100%"
          >
            {{ loading ? '登录中...' : '登录' }}
          </el-button>
        </el-form-item>

        <!-- 连通测试和环境配置按钮 -->
        <div class="action-buttons">
          <el-button
            type="primary"
            :loading="testingConnection"
            @click="testCloudConnection"
          >
            连通测试
          </el-button>
          <el-button
            type="primary"
            @click="goToSetup"
          >
            环境配置
          </el-button>
        </div>
      </el-form>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        style="margin-top: 16px"
      />

      <el-alert
        v-if="success"
        title="登录成功，正在跳转..."
        type="success"
        :closable="false"
        style="margin-top: 16px"
      />

      <div class="login-tip">
        <el-divider />
        <p>提示：</p>
        <ol>
          <li>请使用已在系统中注册的手机号登录</li>
          <li>连接失败时可通过"环境配置"更新云开发凭证</li>
        </ol>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { saveUser } from '@/utils/auth'
import { loginByPhone, testConnection } from '@/api/cloud'

const router = useRouter()
const route = useRoute()
const formRef = ref(null)
const loading = ref(false)
const testingConnection = ref(false)
const error = ref('')
const success = ref(false)
const connectionStatus = ref(null)

// 连通测试频率控制
const testClickCount = ref(0)
const testClickTimer = ref(null)
const testCooldown = ref(false)

// 表单数据
const form = reactive({
  phone: '',
  password: ''
})

// 表单验证规则
const rules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

// 测试云环境连接
async function testCloudConnection() {
  // 冷静期，禁止测试
  if (testCooldown.value) {
    return
  }

  // 清除之前的计时器
  if (testClickTimer.value) {
    clearTimeout(testClickTimer.value)
  }

  // 记录点击次数
  testClickCount.value++

  // 10秒内点击超过5次
  if (testClickCount.value > 5) {
    connectionStatus.value = { type: 'warning', text: '都TM连接正常了，还按！' }
    testCooldown.value = true
    testingConnection.value = true  // 让按钮显示 loading 状态
    testClickCount.value = 0

    // 10秒后恢复
    setTimeout(() => {
      testCooldown.value = false
      testingConnection.value = false
      connectionStatus.value = null
    }, 10000)
    return
  }

  // 10秒内没有继续点击，重置计数
  testClickTimer.value = setTimeout(() => {
    testClickCount.value = 0
  }, 10000)

  testingConnection.value = true
  connectionStatus.value = null

  try {
    const result = await testConnection()

    if (result.success) {
      connectionStatus.value = { type: 'success', text: '云环境连接正常' }
    } else {
      connectionStatus.value = { type: 'danger', text: '云环境连接失败' }
    }
  } catch (err) {
    connectionStatus.value = { type: 'danger', text: '连接测试异常' }
  } finally {
    testingConnection.value = false
  }
}

// 页面加载时自动检查连接
onMounted(async () => {
  await testCloudConnection()
})

// 登录处理
async function handleLogin() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  // 如果连接状态显示失败，先测试连接
  if (connectionStatus.value?.type === 'danger') {
    await testCloudConnection()
    if (connectionStatus.value?.type === 'danger') {
      error.value = '云环境连接失败，请点击"环境配置"检查凭证'
      return
    }
  }

  loading.value = true
  error.value = ''

  try {
    const result = await loginByPhone(form.phone, form.password)

    if (result.success) {
      success.value = true
      // 保存用户信息
      saveUser(result.data)

      ElMessage.success('登录成功')

      // 延迟跳转
      setTimeout(() => {
        router.push('/')
      }, 500)
    } else {
      error.value = result.error || '登录失败'
    }
  } catch (err) {
    error.value = '登录失败: ' + (err.message || '未知错误')
  } finally {
    loading.value = false
  }
}

// 跳转到环境配置页面
function goToSetup() {
  router.push('/setup')
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 400px;
}

.login-header h2 {
  margin: 0;
  color: #FF6B00;
  text-align: center;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  justify-content: center;
}

.login-form {
  margin-top: 12px;
}

.login-tip {
  font-size: 13px;
  color: #666;
}

.login-tip ol {
  margin: 8px 0;
  padding-left: 20px;
}

.login-tip li {
  margin: 4px 0;
}

.login-card :deep(.el-form-item) {
  margin-bottom: 22px;
}

.login-card :deep(.el-form-item__error) {
  position: relative;
  top: 0;
  padding-top: 4px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-left: 80px;
}

.action-buttons .el-button {
  flex: 1;
  background-color: #4a90d9;
  border-color: #4a90d9;
}

.action-buttons .el-button:hover,
.action-buttons .el-button:focus {
  background-color: #5aa0e9;
  border-color: #5aa0e9;
}

.action-buttons .el-button span {
  color: #fff;
}
</style>