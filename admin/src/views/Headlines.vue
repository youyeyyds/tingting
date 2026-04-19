<template>
  <div class="headlines-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>头条列表</span>
          <div class="header-right">
            <div class="protect-setting">
              <span class="protect-label">首页保护：</span>
              <el-switch v-model="homeProtect" size="small" @change="saveHomeProtect" />
            </div>
            <div class="speed-setting" @dblclick.stop>
              <span class="speed-label">轮播速度：</span>
              <el-input-number v-model="bannerSpeed" :min="1" :step="1" size="small" />
              <span class="speed-unit">秒</span>
              <el-button @click="saveBannerSpeed">保存</el-button>
            </div>
            <el-button type="primary" @click="showAddDialog">
              <el-icon><Plus /></el-icon>
              新增头条
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="headlines"
        v-loading="loading"
        stripe
        ref="tableRef"
        row-key="_id"
      >
        <el-table-column label="" width="50">
          <template #default>
            <span class="drag-handle" @click.stop>
              <span class="drag-line"></span>
              <span class="drag-line"></span>
              <span class="drag-line"></span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="seq" label="序号" width="80" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="image" label="图片" width="120">
          <template #default="{ row }">
            <el-image
              v-if="row.image"
              :src="row.image"
              style="width: 80px; height: 60px"
              fit="cover"
              @click.stop
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="imageRandom" label="随机" width="70">
          <template #default="{ row }">
            <el-switch v-model="row.imageRandom" size="small" @change="toggleRowImageRandom(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="image" label="链接" min-width="250">
          <template #default="{ row }">
            <el-link :href="row.image" target="_blank" type="primary">
              {{ row.image }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row._createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div @click.stop>
              <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑头条' : '新增头条'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="序号" prop="seq">
          <el-input-number v-model="form.seq" :min="1" />
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="随机" prop="imageRandom">
          <el-switch v-model="form.imageRandom" @change="updateImageUrl" />
        </el-form-item>
        <el-form-item label="链接" prop="image">
          <el-input v-model="form.image" readonly placeholder="自动生成" />
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
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { getHeadlines, createHeadline, updateHeadline, deleteHeadline, batchUpdateSeq, getBannerConfig, saveBannerConfig } from '@/api/cloud'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)

const headlines = ref([])
const bannerSpeed = ref(3) // 轮播速度，默认3秒
const homeProtect = ref(true) // 首页保护，默认开启

const form = reactive({
  seq: 1,
  title: '',
  image: '',
  imageRandom: true
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }]
}

// 监听序号变化，更新图片URL
watch(() => form.seq, () => {
  if (dialogVisible.value) {
    updateImageUrl()
  }
})

// 更新图片 URL
function updateImageUrl() {
  form.image = form.imageRandom
    ? `https://picsum.photos/400/200?random=${form.seq}`
    : `https://picsum.photos/seed/index${form.seq}/400/200`
}

// 加载头条列表
async function loadHeadlines() {
  loading.value = true
  try {
    const res = await getHeadlines()
    if (res.success) {
      headlines.value = res.data
      initSortable()
    } else {
      ElMessage.error('加载头条失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载头条失败')
  } finally {
    loading.value = false
  }
}

// 加载轮播速度
async function loadBannerSpeed() {
  try {
    const res = await getBannerConfig()
    if (res.success && res.data) {
      bannerSpeed.value = res.data.speed || 3
      homeProtect.value = res.data.homeProtect !== false
    }
  } catch (err) {
    console.error('加载配置失败:', err)
  }
}

// 保存轮播速度
async function saveBannerSpeed() {
  try {
    const res = await saveBannerConfig({
      speed: bannerSpeed.value,
      homeProtect: homeProtect.value
    })
    if (res.success) {
      ElMessage.success('轮播速度已保存')
    } else {
      ElMessage.error('保存失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

// 保存首页保护状态
async function saveHomeProtect() {
  try {
    const res = await saveBannerConfig({
      speed: bannerSpeed.value,
      homeProtect: homeProtect.value
    })
    if (res.success) {
      ElMessage.success(homeProtect.value ? '首页保护已开启' : '首页保护已关闭')
    } else {
      ElMessage.error('保存失败: ' + res.error)
      homeProtect.value = !homeProtect.value
    }
  } catch (err) {
    ElMessage.error('保存失败')
    homeProtect.value = !homeProtect.value
  }
}

// 显示新增弹窗
function showAddDialog() {
  isEdit.value = false
  resetForm()
  // 计算下一个序号
  const maxSeq = headlines.value.length > 0 ? Math.max(...headlines.value.map(h => h.seq || 0)) : 0
  form.seq = maxSeq + 1
  updateImageUrl()
  dialogVisible.value = true
}

// 显示编辑弹窗
function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  Object.assign(form, {
    seq: row.seq || 1,
    title: row.title,
    image: row.image || '',
    imageRandom: row.imageRandom !== false
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    seq: 1,
    title: '',
    image: '',
    imageRandom: true
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
    const submitData = {
      seq: form.seq,
      title: form.title,
      image: form.image,
      imageRandom: form.imageRandom
    }

    let res
    if (isEdit.value) {
      res = await updateHeadline(currentId.value, submitData)
    } else {
      res = await createHeadline(submitData)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadHeadlines()
    } else {
      ElMessage.error('操作失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除头条
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除头条 "${row.title}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteHeadline(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadHeadlines()
    } else {
      ElMessage.error('删除失败: ' + res.error)
    }
  } catch {
    // 用户取消
  }
}

// 切换表格行图片随机状态
async function toggleRowImageRandom(row) {
  // 生成新的图片 URL
  const imageUrl = row.imageRandom
    ? `https://picsum.photos/400/200?random=${row.seq}`
    : `https://picsum.photos/seed/index${row.seq}/400/200`

  // 更新本地数据
  row.image = imageUrl

  // 保存到数据库
  try {
    const res = await updateHeadline(row._id, {
      seq: row.seq,
      title: row.title,
      image: imageUrl,
      imageRandom: row.imageRandom
    })
    if (res.success) {
      ElMessage.success(row.imageRandom ? '已切换为随机' : '已切换为固定')
    } else {
      ElMessage.error('保存失败: ' + res.error)
      // 恢复原状态
      row.imageRandom = !row.imageRandom
      row.image = row.imageRandom
        ? `https://picsum.photos/400/200?random=${row.seq}`
        : `https://picsum.photos/seed/index${row.seq}/400/200`
    }
  } catch (err) {
    ElMessage.error('保存失败')
    row.imageRandom = !row.imageRandom
    row.image = row.imageRandom
      ? `https://picsum.photos/400/200?random=${row.seq}`
      : `https://picsum.photos/seed/index${row.seq}/400/200`
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
        const movedItem = headlines.value.splice(oldIndex, 1)[0]
        headlines.value.splice(newIndex, 0, movedItem)

        // 更新序号
        const updates = headlines.value.map((headline, index) => ({
          _id: headline._id,
          seq: index + 1
        }))

        // 调用批量更新API
        try {
          const res = await batchUpdateSeq('headlines', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            headlines.value.forEach((headline, index) => {
              headline.seq = index + 1
            })
          } else {
            ElMessage.error('保存排序失败')
            loadHeadlines()
          }
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadHeadlines()
        }
      }
    })
  })
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${min}`
}

onMounted(() => {
  loadHeadlines()
  loadBannerSpeed()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.speed-setting {
  display: flex;
  align-items: center;
  gap: 8px;
}

.protect-setting {
  display: flex;
  align-items: center;
  gap: 8px;
}

.protect-label {
  font-size: 14px;
  color: #666;
}

.speed-label {
  font-size: 14px;
  color: #666;
}

.speed-unit {
  font-size: 14px;
  color: #666;
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

:deep(.el-table__row) {
  cursor: pointer;
}
</style>