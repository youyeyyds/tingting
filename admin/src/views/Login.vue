<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <h2>听听APP管理后台</h2>
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

        <!-- 连通测试和重新配置按钮 -->
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
          <li>首次使用请先在系统配置中设置云开发凭证</li>
        </ol>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getCredentials, saveUser } from '@/utils/auth'
import { loginByPhone, testConnection } from '@/api/cloud'

const router = useRouter()
const route = useRoute()
const formRef = ref(null)
const loading = ref(false)
const testingConnection = ref(false)
const error = ref('')
const success = ref(false)
const connectionStatus = ref(null)

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

// 检查系统是否已配置凭证
const credentials = getCredentials()

// 测试云环境连接
async function testCloudConnection() {
  if (!credentials) {
    connectionStatus.value = { type: 'danger', text: '未配置凭证' }
    return
  }

  testingConnection.value = true
  connectionStatus.value = null

  try {
    const result = await testConnection(credentials.secretId, credentials.secretKey, credentials.envId)

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
  if (!credentials) {
    error.value = '系统未配置凭证，请联系管理员先配置系统'
    connectionStatus.value = { type: 'danger', text: '未配置凭证' }
    return
  }

  // 自动检查云环境连接
  await testCloudConnection()
})

// 登录处理
async function handleLogin() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  if (!credentials) {
    error.value = '系统未配置凭证，请联系管理员'
    return
  }

  // 如果连接状态显示失败，先测试连接
  if (connectionStatus.value?.type === 'danger') {
    await testCloudConnection()
    if (connectionStatus.value?.type === 'danger') {
      error.value = '云环境连接失败，请检查配置'
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

// 跳转到setup页面
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