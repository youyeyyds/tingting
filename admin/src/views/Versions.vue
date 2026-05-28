<template>
  <div class="versions-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>版本列表</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            新增版本
          </el-button>
        </div>
      </template>

      <el-table
        :data="versions"
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
        <el-table-column prop="title" label="标题" min-width="150" />
        <el-table-column prop="publishDate" label="发布时间" width="120">
          <template #default="{ row }">
            {{ row.publishDate || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="300">
          <template #default="{ row }">
            <span class="description-text">{{ row.description || '-' }}</span>
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
      :title="isEdit ? '编辑版本' : '新增版本'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="序号" prop="seq">
          <el-input-number v-model="form.seq" :min="1" />
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="发布时间" prop="publishDate">
          <el-date-picker
            v-model="form.publishDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="请输入版本描述（支持多行）"
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
import Sortable from 'sortablejs'
import { getVersions, createVersion, updateVersion, deleteVersion } from '@/api/cloud'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)

const versions = ref([])

const form = reactive({
  seq: 1,
  title: '',
  publishDate: '',
  description: ''
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }]
}

// 加载版本列表
async function loadVersions() {
  loading.value = true
  try {
    const res = await getVersions()
    if (res.success) {
      versions.value = res.data
    } else {
      ElMessage.error('加载版本失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载版本失败')
  } finally {
    loading.value = false
  }
}

// 显示新增弹窗
function showAddDialog() {
  isEdit.value = false
  resetForm()
  // 序号自动设为最大+1
  if (versions.value.length > 0) {
    form.seq = Math.max(...versions.value.map(v => v.seq || 0)) + 1
  }
  dialogVisible.value = true
}

// 显示编辑弹窗
function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  Object.assign(form, {
    seq: row.seq || 1,
    title: row.title,
    publishDate: row.publishDate || '',
    description: row.description || ''
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    seq: 1,
    title: '',
    publishDate: '',
    description: ''
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
      res = await updateVersion(currentId.value, form)
    } else {
      res = await createVersion(form)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadVersions()
    } else {
      ElMessage.error('操作失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除版本
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除版本 "${row.title}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteVersion(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadVersions()
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
        const movedItem = versions.value.splice(oldIndex, 1)[0]
        versions.value.splice(newIndex, 0, movedItem)

        // 更新序号
        const updates = versions.value.map((version, index) => ({
          _id: version._id,
          seq: index + 1
        }))

        // 批量更新（这里简化处理，逐个更新）
        try {
          for (const item of updates) {
            await updateVersion(item._id, { seq: item.seq })
          }
          ElMessage.success('排序已保存')
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadVersions()
        }
      }
    })
  })
}

onMounted(async () => {
  await loadVersions()
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

.description-text {
  white-space: pre-line;
}
</style>
