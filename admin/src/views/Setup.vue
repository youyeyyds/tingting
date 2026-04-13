<template>
  <div class="setup-container">
    <el-card class="setup-card">
      <template #header>
        <div class="setup-header">
          <span>环境配置</span>
        </div>
      </template>

      <!-- 连接状态显示 -->
      <div v-if="connectionStatus" class="connection-status">
        <el-tag :type="connectionStatus.type" size="small">
          {{ connectionStatus.text }}
        </el-tag>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="setup-form">
        <el-form-item label="云环境ID" prop="envId">
          <el-input v-model="form.envId" placeholder="请输入云环境ID" />
          <div class="form-tip">微信云开发环境ID，可在云开发控制台查看</div>
        </el-form-item>

        <el-form-item label="SecretId" prop="secretId">
          <el-input v-model="form.secretId" placeholder="请输入 SecretId" />
          <div class="form-tip">腾讯云子用户的 SecretId</div>
        </el-form-item>

        <el-form-item label="SecretKey" prop="secretKey">
          <el-input
            v-model="form.secretKey"
            type="password"
            placeholder="请输入 SecretKey"
            show-password
          />
          <div class="form-tip">腾讯云子用户的 SecretKey</div>
        </el-form-item>

        <el-form-item label-width="100px" class="button-row">
          <div class="button-group">
            <el-button class="btn-half orange-btn" :loading="testing" @click="handleTest">
              连通测试
            </el-button>
            <el-button type="primary" class="btn-half orange-btn" :loading="saving" @click="handleSave">
              保存配置
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label-width="100px">
          <el-button class="btn-full blue-btn" @click="goToLogin">
            返回登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="setup-tip">
        <el-divider />
        <h4>1. 获取云环境ID</h4>
        <ul>
          <li>登录微信云开发控制台，在环境设置中查看环境ID</li>
        </ul>

        <h4>2. 创建子用户并获取凭证</h4>
        <ul>
          <li>访问 <a href="https://console.cloud.tencent.com/cam" target="_blank">腾讯云访问管理</a></li>
          <li>创建子用户，授权策略：<code>QcloudTCBFullAccess</code>（云开发全读写访问）和 <code>QcloudCamReadOnlyAccess</code>（用户与权限只读访问权限）</li>
          <li>创建完成后获取 SecretId 和 SecretKey</li>
        </ul>

        <h4>3. 安全提示</h4>
        <ul>
          <li>凭证保存在项目根目录的 <code>.env</code> 文件</li>
          <li>请妥善保管 SecretKey，不要泄露</li>
          <li>建议定期更换子用户凭证</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { testConnection, saveEnvConfig } from '@/api/cloud'

const router = useRouter()
const formRef = ref(null)
const testing = ref(false)
const saving = ref(false)
const connectionStatus = ref(null)

const form = reactive({
  envId: '',
  secretId: '',
  secretKey: ''
})

const rules = {
  envId: [{ required: true, message: '请输入云环境ID', trigger: 'blur' }],
  secretId: [{ required: true, message: '请输入 SecretId', trigger: 'blur' }],
  secretKey: [{ required: true, message: '请输入 SecretKey', trigger: 'blur' }]
}

// 连通测试
async function handleTest() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  testing.value = true
  connectionStatus.value = null

  try {
    // 使用用户输入的新凭证测试
    const result = await testConnection({
      envId: form.envId,
      secretId: form.secretId,
      secretKey: form.secretKey
    })
    if (result.success) {
      connectionStatus.value = { type: 'success', text: '连接成功' }
    } else {
      connectionStatus.value = { type: 'danger', text: '连接失败' }
    }
  } catch (err) {
    connectionStatus.value = { type: 'danger', text: '连接失败' }
  } finally {
    testing.value = false
  }
}

// 保存配置（先测试连接，成功才保存）
async function handleSave() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  connectionStatus.value = null

  try {
    // 先进行连通测试
    const testResult = await testConnection({
      envId: form.envId,
      secretId: form.secretId,
      secretKey: form.secretKey
    })

    if (!testResult.success) {
      connectionStatus.value = { type: 'danger', text: '连接失败' }
      ElMessage.error('连接失败，配置未保存')
      return
    }

    connectionStatus.value = { type: 'success', text: '连接成功' }

    // 连接成功后再保存配置
    const result = await saveEnvConfig({
      envId: form.envId,
      secretId: form.secretId,
      secretKey: form.secretKey
    })

    if (result.success) {
      ElMessage.success('配置已保存')
    } else {
      ElMessage.error('保存失败: ' + result.error)
    }
  } catch (err) {
    connectionStatus.value = { type: 'danger', text: '连接失败' }
    ElMessage.error('连接失败，配置未保存')
  } finally {
    saving.value = false
  }
}

// 返回登录
function goToLogin() {
  router.push('/login')
}
</script>

<style scoped>
.setup-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.setup-card {
  width: 680px;
}

.setup-header {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.connection-status {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.setup-form {
  margin-top: 12px;
  max-width: 450px;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  line-height: 1.5;
  width: 100%;
}

.button-row {
  margin-bottom: 12px;
}

.button-group {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn-full {
  width: 100%;
}

.btn-half {
  flex: 1;
  width: calc(50% - 6px);
}

.blue-btn {
  background-color: #4a90d9;
  border-color: #4a90d9;
  color: #fff;
}

.blue-btn:hover,
.blue-btn:focus {
  background-color: #5aa0e9;
  border-color: #5aa0e9;
  color: #fff;
}

.orange-btn {
  background-color: #FF6B00;
  border-color: #FF6B00;
  color: #fff;
}

.orange-btn:hover,
.orange-btn:focus {
  background-color: #ff8533;
  border-color: #ff8533;
  color: #fff;
}

.setup-tip {
  font-size: 13px;
  color: #666;
}

.setup-tip h4 {
  color: #333;
  margin: 24px 0 8px;
}

.setup-tip ol {
  margin: 6px 0;
  padding-left: 20px;
  color: #666;
}

.setup-tip ul {
  margin: 4px 0;
  padding-left: 20px;
  color: #666;
  list-style-type: disc;
}

.setup-tip li {
  margin: 4px 0;
}

.setup-tip ol > li > ul {
  margin-top: 4px;
}

.setup-tip a {
  color: #FF6B00;
}

.setup-tip code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}

.setup-card :deep(.el-form-item__content) {
  flex-wrap: wrap;
}

.setup-card :deep(.el-form-item) {
  margin-bottom: 24px;
}

.setup-card :deep(.el-form-item__error) {
  position: relative;
  top: 0;
  padding-top: 4px;
}
</style>