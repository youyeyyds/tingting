<template>
  <div class="setup-container">
    <el-card class="setup-card">
      <template #header>
        <div class="setup-header">
          <h2>听听课程管理后台</h2>
          <p>首次使用，请配置云开发凭证</p>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="云环境ID" prop="envId">
          <el-input v-model="form.envId" placeholder="如: cloud1-2g5y53suf638dfb9" />
          <div class="form-tip">微信云开发环境ID，可在云开发控制台查看</div>
        </el-form-item>

        <el-form-item label="SecretId" prop="secretId">
          <el-input v-model="form.secretId" placeholder="请输入 SecretId" />
        </el-form-item>

        <el-form-item label="SecretKey" prop="secretKey">
          <el-input
            v-model="form.secretKey"
            type="password"
            placeholder="请输入 SecretKey"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSetup" style="width: 100%">
            {{ loading ? '配置中...' : '保存配置并测试' }}
          </el-button>
        </el-form-item>

        <el-form-item style="margin-bottom: 0">
          <el-button class="back-btn" @click="goBack" style="width: 100%">
            返回登录页
          </el-button>
        </el-form-item>
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
        title="配置成功，正在跳转到登录页..."
        type="success"
        :closable="false"
        style="margin-top: 16px"
      />

      <div class="setup-guide">
        <el-divider />
        <h4>配置说明</h4>
        <ol>
          <li>访问 <a href="https://console.cloud.tencent.com/cam" target="_blank">腾讯云访问管理</a></li>
          <li>创建子用户，授权策略：<code>QcloudTCBFullAccess</code>（云开发全读写访问）和 <code>QcloudCAMReadOnlyAccess</code>（用户与权限只读访问）</li>
          <li>创建完成后获取 SecretId 和 SecretKey</li>
        </ol>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { saveCredentials } from '@/utils/auth'
import { testConnection } from '@/api/cloud'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const error = ref('')
const success = ref(false)

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

async function handleSetup() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  error.value = ''

  try {
    // 先测试连接
    const result = await testConnection(form.secretId, form.secretKey, form.envId)

    if (!result.success) {
      error.value = '连接失败：' + (result.error || '请检查凭证是否正确')
      return
    }

    // 保存配置
    saveCredentials({
      envId: form.envId,
      secretId: form.secretId,
      secretKey: form.secretKey
    })

    success.value = true
    ElMessage.success('配置成功')

    // 延迟跳转到登录页
    setTimeout(() => {
      router.push('/login')
    }, 1000)
  } catch (err) {
    error.value = '配置失败: ' + (err.message || '未知错误')
  } finally {
    loading.value = false
  }
}

// 返回登录页
function goBack() {
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
  width: 450px;
}

.setup-header h2 {
  margin: 0;
  color: #FF6B00;
}

.setup-header p {
  margin: 8px 0 0;
  color: #666;
  font-size: 14px;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.setup-guide h4 {
  color: #333;
  margin: 0 0 10px;
}

.setup-guide ol {
  margin: 8px 0;
  padding-left: 20px;
  color: #666;
}

.setup-guide li {
  margin: 5px 0;
}

.setup-guide a {
  color: #FF6B00;
}

.back-btn {
  background-color: #4a90d9;
  border-color: #4a90d9;
  color: #fff;
}

.back-btn:hover,
.back-btn:focus {
  background-color: #5aa0e9;
  border-color: #5aa0e9;
  color: #fff;
}

.setup-card :deep(.el-form-item__error) {
  position: relative;
  top: 0;
  padding-top: 4px;
}
</style>