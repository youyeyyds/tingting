<template>
  <div class="system-page">
    <!-- 菜单排序 -->
    <el-card>
      <template #header>
        <span>菜单排序</span>
      </template>

      <div class="menu-tip">拖拽调整左侧菜单的显示顺序（首页始终在最前面），调整后自动保存</div>

      <div ref="menuListRef" class="menu-list">
        <div v-for="key in menuOrder" :key="key" class="menu-item">
          <span class="drag-handle">
            <span class="drag-line"></span>
            <span class="drag-line"></span>
            <span class="drag-line"></span>
          </span>
          <span class="menu-name">{{ menuLabels[key] }}</span>
        </div>
      </div>
    </el-card>

    <!-- 账号信息 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>账号信息</span>
          <el-button size="small" @click="loadAccountInfo" :loading="loadingAccount">
            刷新
          </el-button>
        </div>
      </template>

      <el-descriptions v-if="accountInfo" :column="3" border>
        <el-descriptions-item label="用户名称">
          {{ accountInfo.userName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="用户类型">
          <el-tag :type="accountInfo.userType === '子用户' ? 'warning' : 'success'">
            {{ accountInfo.userType || '主账号' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="账号ID">
          {{ accountInfo.currentUin || '-' }}
          <span v-if="accountInfo.userType === '子用户'" class="account-tip">
            (主账号: {{ accountInfo.ownerUin }})
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="快捷登录">
          <el-link
            type="primary"
            :href="`https://cloud.tencent.com/login/subAccount/${accountInfo.ownerUin}?type=subAccount&username=${accountInfo.userName || 'localhost'}`"
            target="_blank"
          >
            点击跳转到腾讯云控制台
          </el-link>
        </el-descriptions-item>
      </el-descriptions>

      <el-empty v-else-if="!loadingAccount" description="暂无账号信息" />
    </el-card>

    <!-- 系统配置 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>环境配置</span>
          <el-button type="primary" :loading="testing" @click="handleTest">
            连通测试
          </el-button>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="云环境ID" prop="envId">
          <el-input v-model="form.envId" placeholder="如: cloud1-2g5y53suf638dfb9" />
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

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">
            保存配置
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 测试结果 -->
    <el-card v-if="testResult" style="margin-top: 20px">
      <template #header>
        <span>测试结果</span>
      </template>
      <el-alert
        :title="testResult.success ? '连接成功' : '连接失败'"
        :type="testResult.success ? 'success' : 'error'"
        :closable="false"
        show-icon
      >
        <template #default>
          <div v-if="testResult.success">
            <p>云环境连接正常</p>
            <p>检测到 {{ testResult.count }} 条用户数据</p>
          </div>
          <div v-else>
            <p>{{ testResult.error }}</p>
          </div>
        </template>
      </el-alert>
    </el-card>

    <!-- 配置说明 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <span>配置说明</span>
      </template>
      <div class="config-guide">
        <h4>1. 获取云环境ID</h4>
        <p>登录微信云开发控制台，在环境设置中查看环境ID</p>

        <h4>2. 创建子用户并获取凭证</h4>
        <ol>
          <li>访问 <a href="https://console.cloud.tencent.com/cam" target="_blank">腾讯云访问管理</a></li>
          <li>创建子用户，授权策略：<code>QcloudTCBFullAccess</code>（云开发全读写访问）和 <code>QcloudCAMReadOnlyAccess</code>（用户与权限只读访问）</li>
          <li>创建完成后获取 SecretId 和 SecretKey</li>
        </ol>

        <h4>3. 安全提示</h4>
        <ul>
          <li>请妥善保管 SecretKey，不要泄露给他人</li>
          <li>建议定期更换子用户凭证</li>
          <li>如发现凭证泄露，请立即在腾讯云控制台禁用</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { saveCredentials, getCredentials, clearCredentials } from '@/utils/auth'
import { testConnection, getAccountInfo, getMenuConfig, saveMenuConfig } from '@/api/cloud'
import Sortable from 'sortablejs'

const formRef = ref(null)
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)
const loadingAccount = ref(false)
const accountInfo = ref(null)
const menuListRef = ref(null)

// 菜单配置
const menuLabels = {
  courses: '课程管理',
  chapters: '章节管理',
  audios: '音频管理',
  categories: '分类管理',
  users: '用户管理',
  roles: '角色管理',
  system: '系统配置'
}

const menuOrder = ref(['courses', 'chapters', 'audios', 'categories', 'users', 'roles', 'system'])

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

// 加载当前配置
onMounted(async () => {
  const credentials = getCredentials()
  if (credentials) {
    form.envId = credentials.envId || ''
    form.secretId = credentials.secretId || ''
    form.secretKey = credentials.secretKey || ''
  }
  loadAccountInfo()
  loadMenuConfig()
})

// 加载菜单配置
async function loadMenuConfig() {
  try {
    const result = await getMenuConfig()
    if (result.success && result.data.menuOrder) {
      menuOrder.value = result.data.menuOrder
    }
    initMenuSortable()
  } catch (err) {
    console.error('加载菜单配置失败:', err)
  }
}

// 初始化菜单拖拽排序
function initMenuSortable() {
  if (!menuListRef.value) return

  const el = menuListRef.value
  Sortable.create(el, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async (evt) => {
      const { oldIndex, newIndex } = evt
      if (oldIndex === newIndex) return

      const movedItem = menuOrder.value.splice(oldIndex, 1)[0]
      menuOrder.value.splice(newIndex, 0, movedItem)

      // 自动保存
      try {
        const result = await saveMenuConfig(menuOrder.value)
        if (result.success) {
          ElMessage.success('菜单排序已保存')
          // 触发自定义事件，通知 Layout 更新菜单
          window.dispatchEvent(new CustomEvent('menu-order-updated', { detail: menuOrder.value }))
        } else {
          ElMessage.error('保存失败: ' + result.error)
        }
      } catch (err) {
        ElMessage.error('保存失败: ' + (err.message || '未知错误'))
      }
    }
  })
}

// 加载账号信息
async function loadAccountInfo() {
  loadingAccount.value = true
  try {
    const result = await getAccountInfo()
    if (result.success) {
      accountInfo.value = result.data
    } else {
      accountInfo.value = null
    }
  } catch (err) {
    accountInfo.value = null
  } finally {
    loadingAccount.value = false
  }
}

// 连通测试
async function handleTest() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const connected = await testConnection(form.secretId, form.secretKey, form.envId)
    if (connected.success) {
      testResult.value = {
        success: true,
        count: connected.data?.count || 0
      }
    } else {
      testResult.value = {
        success: false,
        error: connected.error || '连接失败'
      }
    }
  } catch (err) {
    testResult.value = {
      success: false,
      error: err.message || '连接测试失败'
    }
  } finally {
    testing.value = false
  }
}

// 保存配置
async function handleSave() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true

  try {
    // 先测试连接
    const connected = await testConnection(form.secretId, form.secretKey, form.envId)
    if (!connected.success) {
      ElMessage.error('连接测试失败，请检查配置是否正确')
      testResult.value = {
        success: false,
        error: connected.error || '连接失败'
      }
      return
    }

    // 保存配置
    saveCredentials({
      envId: form.envId,
      secretId: form.secretId,
      secretKey: form.secretKey
    })

    ElMessage.success('配置已保存')
    testResult.value = {
      success: true,
      count: connected.data?.count || 0
    }

    // 等待账号信息刷新完成
    await loadAccountInfo()
  } catch (err) {
    ElMessage.error('保存失败: ' + (err.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

// 重置表单
function handleReset() {
  const credentials = getCredentials()
  if (credentials) {
    form.envId = credentials.envId || ''
    form.secretId = credentials.secretId || ''
    form.secretKey = credentials.secretKey || ''
  } else {
    form.envId = ''
    form.secretId = ''
    form.secretKey = ''
  }
  testResult.value = null
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.config-guide h4 {
  color: #333;
  margin: 15px 0 8px;
}

.config-guide p {
  color: #666;
  margin: 5px 0;
}

.config-guide ol,
.config-guide ul {
  margin: 8px 0;
  padding-left: 20px;
  color: #666;
}

.config-guide li {
  margin: 5px 0;
}

.config-guide a {
  color: #FF6B00;
}

.account-tip {
  font-size: 12px;
  color: #999;
  margin-left: 5px;
}

.menu-tip {
  font-size: 13px;
  color: #666;
  margin-bottom: 15px;
}

.menu-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 15px;
  background: #f5f7fa;
  border-radius: 4px;
  cursor: move;
}

.menu-item:hover {
  background: #e6e8eb;
}

.drag-handle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3px;
  margin-right: 8px;
}

.drag-line {
  width: 14px;
  height: 2px;
  background: #999;
  margin: 1px 0;
  border-radius: 1px;
}

.drag-handle:hover .drag-line {
  background: #FF6B00;
}

.menu-name {
  font-size: 14px;
  color: #333;
}

.sortable-ghost {
  opacity: 0.5;
  background: #FF6B00;
}
</style>