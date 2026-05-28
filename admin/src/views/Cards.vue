<template>
  <div class="cards-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>卡牌列表</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            新增卡牌
          </el-button>
        </div>
      </template>

      <el-table
        :data="paginatedCards"
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
        <el-table-column prop="image" label="卡面" width="100">
          <template #default="{ row }">
            <div @click.stop class="card-image-preview">
              <el-image
                v-if="row.image"
                :src="row.image"
                style="width: 50px; height: 89px"
                fit="cover"
              />
              <span v-else>-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="character" label="人物" min-width="150" />
        <el-table-column prop="faction" label="阵营" width="120" />
        <el-table-column prop="quote" label="台词" min-width="200">
          <template #default="{ row }">
            <span class="quote-text">{{ row.quote || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div @click.stop>
              <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
              <el-button size="small" :type="row.status === 'published' ? '' : 'success'" @click="toggleStatus(row)">
                {{ row.status === 'published' ? '下架' : '发布' }}
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="cards.length > 0"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="cards.length"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>

    <!-- 默认卡面配置 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>默认卡面</span>
          <el-button @click="loadDefaultCardFace" :loading="loadingCardFace">
            刷新
          </el-button>
        </div>
      </template>

      <div class="cover-config">
        <div class="cover-preview card-face-preview">
          <img v-if="defaultCardFaceUrl" :src="defaultCardFaceUrl" class="cover-image" />
          <div v-else class="cover-placeholder">
            <el-icon size="40"><Picture /></el-icon>
            <span>暂无默认卡面</span>
          </div>
        </div>

        <div class="cover-right">
          <div class="cover-actions">
            <el-upload
              :show-file-list="false"
              :before-upload="beforeCardFaceUpload"
              :http-request="handleCardFaceUpload"
              accept="image/jpeg,image/png,image/jpg,image/webp,image/gif"
            >
              <el-button type="primary" :loading="uploadingCardFace">
                上传卡面
              </el-button>
            </el-upload>
            <el-button
              v-if="defaultCardFaceUrl"
              type="danger"
              :loading="deletingCardFace"
              @click="handleDeleteCardFace"
            >
              删除
            </el-button>
          </div>
          <div class="cover-tip">
            建议尺寸：1080x1920 像素（9:16），支持 JPG/PNG/WebP/GIF 格式，最大 5MB
          </div>
        </div>
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑卡牌' : '新增卡牌'"
      width="600px"
      :before-close="handleDialogClose"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="序号" prop="seq">
          <el-input-number v-model="form.seq" :min="1" />
        </el-form-item>
        <el-form-item label="卡面" prop="image">
          <div class="image-upload-wrapper">
            <el-input v-model="form.image" readonly placeholder="请上传卡面图片" />
            <el-upload
              v-if="!form.image"
              :show-file-list="false"
              :http-request="handleImageUpload"
            >
              <el-button type="primary" :loading="uploading">上传图片</el-button>
            </el-upload>
            <el-button v-else type="danger" :loading="uploading" @click="deleteImage">
              删除图片
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="人物" prop="character">
          <el-input v-model="form.character" placeholder="请输入人物名称" />
        </el-form-item>
        <el-form-item label="阵营" prop="faction">
          <el-input v-model="form.faction" placeholder="请输入阵营" />
        </el-form-item>
        <el-form-item label="台词" prop="quote">
          <el-input
            v-model="form.quote"
            type="textarea"
            :rows="3"
            placeholder="请输入台词"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="published">已发布</el-radio>
            <el-radio value="draft">草稿</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="handleCancel">取消</el-button>
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
import { Picture } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { getCards, createCard, updateCard, deleteCard, batchUpdateSeq, uploadCardImage, deleteCardImage, getDefaultCardFace, uploadDefaultCardFace, deleteDefaultCardFace } from '@/api/cloud'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)
const uploading = ref(false)
const defaultCardFaceUrl = ref(null)
const loadingCardFace = ref(false)
const uploadingCardFace = ref(false)
const deletingCardFace = ref(false)

const cards = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const paginatedCards = ref([])

function updatePaginatedCards() {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  paginatedCards.value = cards.value.slice(start, end)
}

watch([currentPage, pageSize], () => {
  updatePaginatedCards()
})

const form = reactive({
  seq: 1,
  image: '',
  imageFileID: '',
  character: '',
  faction: '',
  quote: '',
  status: 'published'
})

const rules = {
  character: [{ required: true, message: '请输入人物名称', trigger: 'blur' }],
  faction: [{ required: true, message: '请输入阵营', trigger: 'blur' }]
}

// 加载卡牌列表
async function loadCards() {
  loading.value = true
  try {
    const res = await getCards()
    if (res.success) {
      cards.value = res.data
      updatePaginatedCards()
    } else {
      ElMessage.error('加载卡牌失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载卡牌失败')
  } finally {
    loading.value = false
  }
}

// 显示新增弹窗
function showAddDialog() {
  isEdit.value = false
  resetForm()
  form.seq = cards.value.length + 1
  dialogVisible.value = true
}

// 显示编辑弹窗
function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  Object.assign(form, {
    seq: row.seq || 1,
    image: row.image || '',
    imageFileID: row.imageFileID || '',
    character: row.character || '',
    faction: row.faction || '',
    quote: row.quote || '',
    status: row.status || 'published'
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    seq: 1,
    image: '',
    imageFileID: '',
    character: '',
    faction: '',
    quote: '',
    status: 'published'
  })
}

// 弹窗关闭前检查
async function handleDialogClose(done) {
  if (uploading.value) {
    ElMessage.warning('图片正在上传中，请等待上传完成')
    return
  }
  done()
}

// 取消按钮
function handleCancel() {
  if (uploading.value) {
    ElMessage.warning('图片正在上传中，请等待上传完成')
    return
  }
  handleDialogClose(() => {
    dialogVisible.value = false
  })
}

// 提交表单
async function handleSubmit() {
  if (uploading.value) {
    ElMessage.warning('图片正在上传中，请等待上传完成')
    return
  }

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitLoading.value = true
  try {
    let res
    if (isEdit.value) {
      res = await updateCard(currentId.value, form)
    } else {
      res = await createCard(form)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadCards()
    } else {
      ElMessage.error('操作失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除卡牌
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除卡牌 "${row.character}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const loading = ElMessage({
      message: '正在删除，请稍候...',
      duration: 0
    })

    const res = await deleteCard(row._id)

    loading.close()

    if (res.success) {
      await loadCards()
      ElMessage.success('删除成功')
    } else {
      loading.close()
      ElMessage.error('删除失败: ' + (res.error || '未知错误'))
    }
  } catch {
    // 用户取消
  }
}

// 切换卡牌状态（发布/下架）
async function toggleStatus(row) {
  const newStatus = row.status === 'published' ? 'draft' : 'published'
  const actionText = newStatus === 'published' ? '发布' : '下架'

  try {
    const res = await updateCard(row._id, { ...row, status: newStatus })
    if (res.success) {
      ElMessage.success(`${actionText}成功`)
      loadCards()
    } else {
      ElMessage.error(`${actionText}失败: ` + res.error)
    }
  } catch (err) {
    ElMessage.error(`${actionText}失败`)
  }
}

// 处理图片上传
async function handleImageUpload(options) {
  const { file } = options
  uploading.value = true
  try {
    const res = await uploadCardImage(file)
    if (res.success) {
      form.image = res.data.tempUrl || res.data.localUrl
      form.imageFileID = res.data.fileID
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error('图片上传失败: ' + (res.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('图片上传失败')
  } finally {
    uploading.value = false
  }
}

// 删除图片
async function deleteImage() {
  if (form.imageFileID) {
    try {
      await deleteCardImage(form.imageFileID)
    } catch (err) {
      console.error('删除云端图片失败:', err)
    }
  }
  form.image = ''
  form.imageFileID = ''
  ElMessage.success('图片已删除')
}

// 加载默认卡面
async function loadDefaultCardFace() {
  loadingCardFace.value = true
  try {
    const result = await getDefaultCardFace()
    if (result.success) {
      defaultCardFaceUrl.value = result.data.coverUrl || null
    } else {
      defaultCardFaceUrl.value = null
    }
  } catch (err) {
    defaultCardFaceUrl.value = null
  } finally {
    loadingCardFace.value = false
  }
}

// 卡面上传前校验
function beforeCardFaceUpload(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('只支持 JPG/PNG/WebP/GIF 格式的图片')
    return false
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

// 上传卡面
async function handleCardFaceUpload({ file }) {
  uploadingCardFace.value = true
  try {
    const result = await uploadDefaultCardFace(file)
    if (result.success) {
      defaultCardFaceUrl.value = result.data.localUrl
      ElMessage.success('默认卡面已更新')
    } else {
      ElMessage.error('上传失败: ' + result.error)
    }
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.message || '未知错误'))
  } finally {
    uploadingCardFace.value = false
  }
}

// 删除卡面
async function handleDeleteCardFace() {
  deletingCardFace.value = true
  try {
    const result = await deleteDefaultCardFace()
    if (result.success) {
      defaultCardFaceUrl.value = null
      ElMessage.success('默认卡面已删除')
    } else {
      ElMessage.error('删除失败: ' + result.error)
    }
  } catch (err) {
    ElMessage.error('删除失败: ' + (err.message || '未知错误'))
  } finally {
    deletingCardFace.value = false
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

        const movedItem = cards.value.splice(oldIndex, 1)[0]
        cards.value.splice(newIndex, 0, movedItem)

        const updates = cards.value.map((card, index) => ({
          _id: card._id,
          seq: index + 1
        }))

        try {
          const res = await batchUpdateSeq('cards', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            cards.value.forEach((card, index) => {
              card.seq = index + 1
            })
          } else {
            ElMessage.error('保存排序失败')
            loadCards()
          }
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadCards()
        }
      }
    })
  })
}

onMounted(async () => {
  await loadCards()
  await loadDefaultCardFace()
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
  background: #ccc;
  margin: 1px 0;
}

.quote-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: #666;
}

.image-upload-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.image-upload-wrapper .el-input {
  flex: 1;
}

.cover-config {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.cover-preview {
  width: 200px;
  height: 200px;
  border: 1px dashed #ddd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cover-preview .cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #999;
}

.cover-actions {
  display: flex;
  flex-direction: row;
  gap: 10px;
  align-items: center;
}

.cover-tip {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.card-face-preview {
  width: 120px;
  height: 213px;
}
</style>