<template>
  <div class="roles-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>角色列表</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            新增角色
          </el-button>
        </div>
      </template>

      <el-table
        :data="roles"
        v-loading="loading"
        stripe
        ref="tableRef"
        row-key="_id"
      >
        <el-table-column label="" width="50">
          <template #default>
            <span class="drag-handle">
              <span class="drag-line"></span>
              <span class="drag-line"></span>
              <span class="drag-line"></span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="seq" label="序号" width="80" />
        <el-table-column prop="name" label="角色名称" min-width="150" />
        <el-table-column prop="code" label="角色代码" width="150" />
        <el-table-column prop="description" label="描述" min-width="200">
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="permissions" label="权限" min-width="300">
          <template #default="{ row }">
            <div class="permission-header">
              <el-tag :type="(row.permissions || []).length === menuOrder.length ? 'success' : 'warning'" size="small">
                {{ (row.permissions || []).length }}/{{ menuOrder.length }}
              </el-tag>
            </div>
            <div class="permission-tags">
              <el-tag v-for="perm in getOrderedPermissions(row.permissions)" :key="perm" class="permission-tag">
                {{ permissionLabels[perm] || perm }}
              </el-tag>
              <span v-if="!row.permissions || row.permissions.length === 0" class="no-permission">无权限</span>
            </div>
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
      :title="isEdit ? '编辑角色' : '新增角色'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="序号" prop="seq">
          <el-input-number v-model="form.seq" :min="1" />
        </el-form-item>
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="角色代码" prop="code">
          <el-input v-model="form.code" placeholder="如: admin, course_manager" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="权限" prop="permissions">
          <el-checkbox-group v-model="form.permissions">
            <el-checkbox v-for="perm in menuOrder" :key="perm" :value="perm">
              {{ permissionLabels[perm] }}
            </el-checkbox>
          </el-checkbox-group>
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
import Sortable from 'sortablejs'
import { getRoles, createRole, updateRole, deleteRole, batchUpdateSeq, getMenuConfig } from '@/api/cloud'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)

const roles = ref([])

// 菜单排序（从系统配置获取）
const defaultMenuOrder = ['courses', 'audios', 'headlines', 'categories', 'users', 'roles', 'system']
const menuOrder = ref(defaultMenuOrder)

const permissionLabels = {
  courses: '课程管理',
  audios: '音频管理',
  headlines: '首尾管理',
  categories: '分类管理',
  users: '用户管理',
  roles: '角色管理',
  system: '系统配置'
}

// 根据菜单排序返回有序的权限列表
function getOrderedPermissions(permissions) {
  if (!permissions || permissions.length === 0) return []
  return menuOrder.value.filter(p => permissions.includes(p))
}

// 加载菜单配置
async function loadMenuConfig() {
  try {
    const result = await getMenuConfig()
    if (result.success && result.data.menuOrder) {
      // 过滤掉无效的菜单项（只保留权限相关的）
      menuOrder.value = result.data.menuOrder.filter(key => permissionLabels[key])
    }
  } catch (err) {
    console.error('加载菜单配置失败:', err)
  }
}

const form = reactive({
  seq: 1,
  name: '',
  code: '',
  description: '',
  permissions: []
})

const rules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入角色代码', trigger: 'blur' }]
}

// 加载角色列表
async function loadRoles() {
  loading.value = true
  try {
    const res = await getRoles()
    if (res.success) {
      roles.value = res.data
    } else {
      ElMessage.error('加载角色失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载角色失败')
  } finally {
    loading.value = false
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
  Object.assign(form, {
    seq: row.seq || 1,
    name: row.name,
    code: row.code,
    description: row.description || '',
    // 过滤掉无效的权限项
    permissions: (row.permissions || []).filter(p => permissionLabels[p])
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    seq: 1,
    name: '',
    code: '',
    description: '',
    permissions: []
  })
}

// 提交表单
async function handleSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitLoading.value = true
  try {
    let res
    if (isEdit.value) {
      res = await updateRole(currentId.value, form)
    } else {
      res = await createRole(form)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadRoles()
    } else {
      ElMessage.error('操作失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除角色
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除角色 "${row.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteRole(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadRoles()
    } else {
      ElMessage.error('删除失败: ' + res.error)
    }
  } catch {
    // 用户取消
  }
}

// 初始化拖拽排序
function initSortable() {
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
        const movedItem = roles.value.splice(oldIndex, 1)[0]
        roles.value.splice(newIndex, 0, movedItem)

        // 更新序号
        const updates = roles.value.map((role, index) => ({
          _id: role._id,
          seq: index + 1
        }))

        // 调用批量更新API
        try {
          const res = await batchUpdateSeq('roles', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            roles.value.forEach((role, index) => {
              role.seq = index + 1
            })
          } else {
            ElMessage.error('保存排序失败')
            loadRoles()
          }
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadRoles()
        }
      }
    })
  })
}

onMounted(async () => {
  await loadMenuConfig()
  await loadRoles()
  initSortable()
})

// 监听菜单排序更新事件
window.addEventListener('menu-order-updated', (e) => {
  if (e.detail) {
    menuOrder.value = e.detail.filter(key => permissionLabels[key])
  }
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

.permission-header {
  margin-bottom: 8px;
}

.permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 5px;
}

.permission-tag {
  margin: 0;
}

.no-permission {
  color: #999;
}
</style>