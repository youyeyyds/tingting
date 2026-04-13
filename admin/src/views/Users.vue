<template>
  <div class="users-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户列表</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            新增用户
          </el-button>
        </div>
      </template>

      <el-table
        :data="users"
        v-loading="loading"
        stripe
        ref="tableRef"
        row-key="_id"
      >
        <el-table-column v-if="isAdmin" label="" width="50">
          <template #default>
            <span class="drag-handle">
              <span class="drag-line"></span>
              <span class="drag-line"></span>
              <span class="drag-line"></span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="seq" label="序号" width="80" />
        <el-table-column prop="avatarUrl" label="头像" width="80" align="center">
          <template #default="{ row }">
            <el-avatar :src="getAvatarUrl(row.avatarUrl)" :size="40">
              <el-icon :size="24"><UserFilled /></el-icon>
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="nickName" label="昵称" min-width="120" />
        <el-table-column prop="phone" label="手机号" width="130">
          <template #default="{ row }">
            {{ row.phone || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="roleName" label="角色" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.roleName" :type="row.roleCode === 'admin' ? 'danger' : 'primary'">{{ row.roleName }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginTime" label="最后登录" width="160">
          <template #default="{ row }">
            {{ formatDate(row.lastLoginTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="注册时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑用户' : '新增用户'"
      width="450px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item v-if="isEdit && isAdmin" label="序号" prop="seq">
          <el-input-number v-model="form.seq" :min="1" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" :placeholder="isEdit ? '不修改请留空' : '默认密码为1'" show-password />
        </el-form-item>
        <el-form-item label="昵称" prop="nickName">
          <el-input v-model="form.nickName" placeholder="可选，为空自动生成：用户+手机号后4位" />
        </el-form-item>
        <el-form-item label="头像" prop="avatarUrl">
          <div class="avatar-upload">
            <el-upload
              class="avatar-uploader"
              :show-file-list="false"
              :before-upload="beforeAvatarUpload"
              :http-request="handleAvatarUpload"
            >
              <el-avatar v-if="getAvatarUrl(form.avatarUrl)" :src="getAvatarUrl(form.avatarUrl)" :size="95" />
              <el-avatar v-else :size="95">
                <el-icon :size="60"><UserFilled /></el-icon>
              </el-avatar>
            </el-upload>
            <div class="avatar-tip">点击上传头像，支持 JPG/PNG/WebP，不超过 2MB</div>
          </div>
        </el-form-item>
        <el-form-item v-if="isAdmin" label="角色" prop="role">
          <el-select v-model="form.role" placeholder="可选，为空默认为普通用户" style="width: 100%">
            <el-option
              v-for="role in roles"
              :key="role._id"
              :label="role.name"
              :value="role._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isEdit && isAdmin" label="最后登录" prop="lastLoginTime">
          <el-date-picker
            v-model="form.lastLoginTime"
            type="datetime"
            placeholder="选择日期时间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, UserFilled } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { getUsers, createUser, updateUser, deleteUser, getRoles, batchUpdateSeq, uploadAvatar } from '@/api/cloud'
import { getCurrentUser, saveUser } from '@/utils/auth'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)

// 当前登录用户
const currentUser = getCurrentUser()
const isAdmin = currentUser?.roleCode === 'admin'

const users = ref([])
const roles = ref([])

const form = reactive({
  seq: 1,
  avatarUrl: '',
  avatarFileID: '',
  nickName: '',
  phone: '',
  password: '',
  role: '',
  lastLoginTime: null
})

const rules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }]
}

// 加载用户列表
async function loadUsers() {
  loading.value = true
  try {
    const res = await getUsers()
    if (res.success) {
      // 关联角色名称和代码
      users.value = res.data.map(user => {
        const role = roles.value.find(r => r._id === user.role)
        return {
          ...user,
          roleName: role ? role.name : '-',
          roleCode: role ? role.code : ''
        }
      })
    } else {
      ElMessage.error('加载用户失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载用户失败')
  } finally {
    loading.value = false
  }
}

// 加载角色列表
async function loadRoles() {
  try {
    const res = await getRoles()
    if (res.success) {
      roles.value = res.data
    }
  } catch (err) {
    console.error('加载角色失败:', err)
  }
}

// 显示新增弹窗
function showAddDialog() {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

// 显示编辑弹窗
function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  // 处理云开发日期格式
  let lastLoginTime = null
  if (row.lastLoginTime) {
    if (typeof row.lastLoginTime === 'object' && row.lastLoginTime._seconds) {
      lastLoginTime = new Date(row.lastLoginTime._seconds * 1000)
    } else {
      lastLoginTime = new Date(row.lastLoginTime)
    }
  }
  Object.assign(form, {
    seq: row.seq || 1,
    avatarUrl: row.avatarUrl || '',
    avatarFileID: row.avatarFileID || '',
    nickName: row.nickName,
    phone: row.phone || '',
    password: '',
    role: row.role || '',
    lastLoginTime: lastLoginTime
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    seq: 1,
    avatarUrl: '',
    avatarFileID: '',
    nickName: '',
    phone: '',
    password: '',
    role: '',
    lastLoginTime: null
  })
}

// 上传头像前验证（限制格式和大小）
function beforeAvatarUpload(file) {
  const isImage = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg' || file.type === 'image/webp'
  const isLt2M = file.size / 1024 / 1024 < 2  // 限制2MB

  if (!isImage) {
    ElMessage.error('头像图片只能是 JPG/PNG/WebP 格式!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('头像图片大小不能超过 2MB!')
    return false
  }
  return true
}

// 上传头像
async function handleAvatarUpload(options) {
  try {
    // 传递被编辑用户的ID（新增时传当前ID，编辑时传表单中的用户ID）
    const uploadUserId = isEdit.value ? currentId.value : currentUser?.userId
    const res = await uploadAvatar(options.file, uploadUserId)
    if (res.success) {
      form.avatarUrl = res.data.localUrl
      form.avatarFileID = res.data.fileID

      // 如果是编辑模式，立即更新用户数据（不用等点击确认）
      if (isEdit.value && currentId.value) {
        // 更新数据库
        const updateRes = await updateUser(currentId.value, {
          avatarUrl: res.data.localUrl,
          avatarFileID: res.data.fileID
        })
        if (updateRes.success) {
          // 刷新用户列表
          await loadUsers()
          ElMessage.success('头像更新成功')
        } else {
          ElMessage.error('头像保存失败: ' + updateRes.error)
        }
      } else {
        ElMessage.success('头像上传成功')
      }

      // 如果上传的是当前用户头像，立即更新顶部显示
      if (uploadUserId === currentUser?.userId) {
        saveUser({
          ...currentUser,
          avatarUrl: res.data.localUrl,
          avatarFileID: res.data.fileID
        })
        window.dispatchEvent(new Event('user-info-updated'))
      }
    } else {
      ElMessage.error('上传失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('上传失败')
  }
}

// 提交表单
async function handleSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  // 校验手机号是否重复
  const phoneExists = users.value.find(u =>
    u.phone === form.phone && u._id !== currentId.value
  )
  if (phoneExists) {
    ElMessage.error(`手机号 ${form.phone} 已被用户 "${phoneExists.nickName}" 使用`)
    return
  }

  submitLoading.value = true
  try {
    // 处理默认值
    let submitData = { ...form }

    // 昵称为空时自动生成
    if (!submitData.nickName && submitData.phone) {
      submitData.nickName = '用户' + submitData.phone.slice(-4)
    }

    // 角色为空时自动为普通用户
    if (!submitData.role) {
      const normalUserRole = roles.value.find(r => r.code === 'user')
      if (normalUserRole) {
        submitData.role = normalUserRole._id
      }
    }

    // 处理最后登录时间（只有管理员可以修改）
    if (isAdmin && isEdit.value && submitData.lastLoginTime) {
      submitData.lastLoginTime = new Date(submitData.lastLoginTime)
    } else {
      delete submitData.lastLoginTime
    }

    // 处理密码
    if (!submitData.password) {
      delete submitData.password
    }

    let res
    if (isEdit.value) {
      res = await updateUser(currentId.value, submitData)
    } else {
      // 新增时不传 seq，后端自动计算
      delete submitData.seq
      res = await createUser(submitData)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      await loadUsers()
      // 如果更新的是当前用户，更新 localStorage 中的用户信息
      if (isEdit.value && currentId.value === currentUser?.userId) {
        const updatedUser = users.value.find(u => u._id === currentUser.userId)
        if (updatedUser) {
          saveUser({
            ...currentUser,
            nickName: updatedUser.nickName,
            avatarUrl: updatedUser.avatarUrl
          })
          // 触发自定义事件，通知 Layout 更新显示
          window.dispatchEvent(new Event('user-info-updated'))
        }
      }
    } else {
      ElMessage.error('操作失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除用户
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除用户 "${row.nickName}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteUser(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadUsers()
    } else {
      ElMessage.error('删除失败: ' + res.error)
    }
  } catch {
    // 用户取消
  }
}

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

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  // 处理云开发日期格式
  if (typeof dateStr === 'object' && dateStr._seconds) {
    return new Date(dateStr._seconds * 1000).toLocaleString('zh-CN')
  }
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 初始化拖拽排序（仅管理员）
function initSortable() {
  if (!isAdmin) return

  nextTick(() => {
    if (!tableRef.value) return

    const tbody = tableRef.value.$el.querySelector('.el-table__body-wrapper tbody')
    if (!tbody) return

    Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: async (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex === newIndex) return

        // 更新本地数据顺序
        const movedItem = users.value.splice(oldIndex, 1)[0]
        users.value.splice(newIndex, 0, movedItem)

        // 更新序号
        const updates = users.value.map((user, index) => ({
          _id: user._id,
          seq: index + 1
        }))

        // 调用批量更新API
        try {
          const res = await batchUpdateSeq('users', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            users.value.forEach((user, index) => {
              user.seq = index + 1
            })
          } else {
            ElMessage.error('保存排序失败')
            loadUsers()
          }
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadUsers()
        }
      }
    })
  })
}

onMounted(async () => {
  await loadRoles()
  await loadUsers()
  initSortable()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drag-handle {
  cursor: move;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5px;
}

.drag-line {
  width: 18px;
  height: 2px;
  background: #999;
  margin: 2px 0;
  border-radius: 1px;
}

.drag-handle:hover .drag-line {
  background: #FF6B00;
}

.users-page :deep(.el-table__cell) {
  padding: 12px 0;
}

/* 确保头像列单元格高度一致 */
.users-page :deep(.el-table__body tr) {
  height: 46px;
}

.users-page :deep(.el-avatar) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.avatar-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-uploader:hover {
  border-color: #409eff;
}

.avatar-tip {
  margin-top: 10px;
  color: #999;
  font-size: 12px;
  line-height: 1.4;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}
</style>