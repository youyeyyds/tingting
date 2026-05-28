<template>
  <div class="audios-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>音频列表</span>
          <div>
            <el-select
              v-model="selectedCourse"
              placeholder="请选择课程"
              style="width: 200px; margin-right: 10px"
              @change="loadAudios"
            >
              <el-option
                v-for="course in courses"
                :key="course._id"
                :label="course.title"
                :value="course._id"
              />
            </el-select>
            <el-button type="primary" @click="showUploadDialog">上传音频</el-button>
            <el-button type="success" @click="handleBatchUploadClick" style="margin-left: 10px">批量上传</el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="audios"
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
        <el-table-column prop="chapterName" label="章节名称" min-width="200">
          <template #default="{ row }">
            {{ row.chapterName || row.title || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="文件大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="上传时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createTime || row._createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="playAudio(row)">播放</el-button>
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > 0 && selectedCourse"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadAudios"
        @current-change="loadAudios"
        style="margin-top: 20px; display: flex; justify-content: flex-end"
      />
    </el-card>

    <!-- 上传弹窗 -->
    <el-dialog v-model="uploadDialogVisible" title="上传音频" width="500px">
      <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="100px">
        <el-form-item label="章节序号" prop="seq">
          <el-input-number v-model="uploadForm.seq" :min="1" />
          <span class="seq-tip">当前课程最大序号：{{ maxSeqInCourse }}</span>
        </el-form-item>
        <el-form-item label="章节标题" prop="title">
          <el-input v-model="uploadForm.title" placeholder="请输入章节标题" />
        </el-form-item>
        <el-form-item label="音频文件" prop="file">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".mp3,.m4a,.wav,.ogg,.flac,.aac"
            :on-change="handleFileChange"
          >
            <el-button type="primary">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">支持 mp3、m4a、wav、ogg、flac、aac 格式</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">
          上传
        </el-button>
      </template>
    </el-dialog>

    <!-- 播放弹窗 -->
    <el-dialog v-model="playDialogVisible" title="音频播放" width="400px" @close="stopAudio">
      <div class="audio-player">
        <p>{{ currentAudio?.chapterName || currentAudio?.title }}</p>
        <audio
          ref="audioRef"
          v-if="currentAudio?.playUrl"
          :src="currentAudio.playUrl"
          controls
          autoplay
          @loadedmetadata="setPlaybackRate"
          style="width: 100%"
        />
      </div>
    </el-dialog>

    <!-- 批量上传弹窗 -->
    <el-dialog v-model="batchUploadDialogVisible" title="批量上传音频" width="500px">
      <div class="batch-upload-tip">已选 {{ batchFiles.length }} 条音频（支持400条批量上传）</div>
      <div class="batch-file-list" v-if="batchFiles.length > 0">
        <div v-for="(file, index) in batchFiles" :key="index" class="batch-file-item">
          <span>{{ file.name }}</span>
          <el-button type="danger" size="small" link @click="removeBatchFile(index)">删除</el-button>
        </div>
      </div>
      <div v-else class="no-file-tip">未选择文件</div>

      <template #footer>
        <el-button @click="cancelBatchUpload">{{ batchUploading ? '关闭' : '取消' }}</el-button>
        <el-button type="primary" :loading="batchUploading" @click="handleBatchUpload">
          开始导入
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑音频" width="500px">
      <el-form ref="editFormRef" :model="editForm" label-width="100px">
        <el-form-item label="序号">
          <el-input-number v-model="editForm.seq" :min="1" />
        </el-form-item>
        <el-form-item label="章节名称">
          <el-input v-model="editForm.title" placeholder="请输入章节名称" />
        </el-form-item>
        <el-form-item label="上传时间">
          <el-date-picker v-model="editForm.createTime" type="datetime" placeholder="选择上传时间" style="width: 100%" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="handleEditSave">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { getAudios, uploadAudio, batchUploadAudio, deleteAudio, updateAudio, getCourses, getChapters, batchUpdateSeq, getFileTempUrl } from '@/api/cloud'

const loading = ref(false)
const uploading = ref(false)
const uploadDialogVisible = ref(false)
const playDialogVisible = ref(false)
const uploadFormRef = ref(null)
const uploadRef = ref(null)
const tableRef = ref(null)
const audioRef = ref(null)
const selectedFile = ref(null)

const audios = ref([])
const courses = ref([])
const chapters = ref([])
const currentAudio = ref(null)
const selectedCourse = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const maxSeqInCourse = ref(0)

const editDialogVisible = ref(false)
const editSaving = ref(false)
const editFormRef = ref(null)
const editForm = reactive({
  _id: '',
  seq: 0,
  title: '',
  createTime: null
})

const uploadForm = reactive({
  seq: 1,
  title: '',
  file: null
})

const uploadRules = {
  title: [{ required: true, message: '请输入章节标题', trigger: 'blur' }]
}

const batchUploadDialogVisible = ref(false)
const batchUploadRef = ref(null)
const batchUploading = ref(false)
const batchFiles = ref([])

// 加载音频列表
async function loadAudios() {
  if (!selectedCourse.value) {
    audios.value = []
    total.value = 0
    return
  }

  loading.value = true
  try {
    const res = await getAudios(currentPage.value, pageSize.value, selectedCourse.value)
    if (res.success) {
      // 关联课程和章节名称
      const audioData = res.data.data || res.data;
      audios.value = (audioData || [])
        .map(audio => {
          const course = courses.value.find(c => c._id === audio.course)
          const chapter = chapters.value.find(ch => ch.audio === audio._id || ch.audioUrl === audio.audioFile)
          return {
            ...audio,
            courseName: course ? course.title : '-',
            chapterName: chapter ? chapter.title : audio.title,
            seq: audio.seq || chapter?.seq || 0
          }
        })
      total.value = res.data.total || 0
      initSortable()
    } else {
      ElMessage.error('加载音频失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载音频失败')
  } finally {
    loading.value = false
  }
}

// 加载课程列表
async function loadCourses() {
  try {
    const res = await getCourses()
    if (res.success) {
      courses.value = res.data
    }
  } catch (err) {
  }
}

// 加载章节列表
async function loadChapters() {
  try {
    const res = await getChapters()
    if (res.success) {
      chapters.value = res.data.data || res.data
    }
  } catch (err) {
  }
}

// 显示上传弹窗
function showUploadDialog() {
  // 使用总数作为下一个序号（因为seq是连续的）
  maxSeqInCourse.value = total.value > 0 ? total.value : 0
  uploadForm.seq = maxSeqInCourse.value + 1
  uploadDialogVisible.value = true
}

// 文件选择
function handleFileChange(file) {
  selectedFile.value = file.raw
  // 从文件名提取序号和标题
  const name = file.name
  const match = name.match(/^(\d+)\.\s*(.+)\.(mp3|m4a|wav|ogg|flac|aac)$/i)
  if (match) {
    uploadForm.seq = parseInt(match[1])
    uploadForm.title = match[2]
  }
}

// 上传音频
async function handleUpload() {
  try {
    await uploadFormRef.value.validate()
  } catch {
    return
  }

  if (!selectedFile.value) {
    ElMessage.warning('请选择音频文件')
    return
  }

  uploading.value = true
  try {
    const res = await uploadAudio(
      selectedFile.value,
      selectedCourse.value,
      uploadForm.seq,
      uploadForm.title
    )

    if (res.success) {
      ElMessage.success('上传成功')
      uploadDialogVisible.value = false
      await loadAudios()
      // 重置表单
      uploadRef.value?.clearFiles()
      selectedFile.value = null
    } else {
      ElMessage.error('上传失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('上传失败')
  } finally {
    uploading.value = false
  }
}

// 显示批量上传弹窗
function showBatchUploadDialog() {
  batchFiles.value = []
  batchUploadDialogVisible.value = true
}

// 处理批量上传按钮点击 - 直接打开文件选择窗口，选完后再显示弹窗
function handleBatchUploadClick() {
  batchFiles.value = []
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.mp3,.m4a,.wav,.ogg,.flac,.aac'
  input.onchange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      batchFiles.value = files
      batchUploadDialogVisible.value = true
    }
  }
  input.click()
}

// 取消批量上传
function cancelBatchUpload() {
  batchUploadDialogVisible.value = false
  batchFiles.value = []
}

// 删除单个批量文件
function removeBatchFile(index) {
  batchFiles.value.splice(index, 1)
}

// 批量文件选择
function handleBatchFileChange(file, fileList) {
  batchFiles.value = fileList.map(f => f.raw)
}

// 删除批量文件
function handleBatchFileRemove(file, fileList) {
  batchFiles.value = fileList.map(f => f.raw)
}

// 批量上传
async function handleBatchUpload() {
  if (batchFiles.value.length === 0) {
    ElMessage.warning('请选择音频文件')
    return
  }

  const loading = ElMessage({
    message: '正在导入音频数据，请稍候...',
    duration: 0
  })

  batchUploading.value = true
  try {
    const res = await batchUploadAudio(batchFiles.value, selectedCourse.value)

    loading.close()

    if (res.success) {
      const msg = `导入成功 ${res.data.success} 个，失败 ${res.data.failed} 个`
      if (res.data.failed > 0) {
        ElMessage.warning(msg)
        const errors = res.data.errors.map(e => `${e.file}: ${e.error}`).join('；')
        ElMessage.warning(errors)
      } else {
        ElMessage.success(msg)
      }
      batchUploadDialogVisible.value = false
      batchUploadRef.value?.clearFiles()
      batchFiles.value = []
    } else {
      loading.close()
      ElMessage.error('导入失败: ' + (res.error || '未知错误'))
    }
  } catch (err) {
    loading.close()
    ElMessage.error('导入失败')
  } finally {
    batchUploading.value = false
  }
}

// 显示编辑弹窗
function showEditDialog(row) {
  editForm._id = row._id
  editForm.seq = row.seq || 0
  editForm.title = row.chapterName || row.title || ''
  editForm.createTime = row.createTime ? new Date(row.createTime) : (row._createTime ? new Date(row._createTime) : new Date())
  editDialogVisible.value = true
}

// 保存编辑
async function handleEditSave() {
  editSaving.value = true
  try {
    const res = await updateAudio(editForm._id, {
      seq: editForm.seq,
      title: editForm.title,
      createTime: editForm.createTime.toISOString()
    })

    if (res.success) {
      ElMessage.success('保存成功')
      editDialogVisible.value = false
    } else {
      ElMessage.error('保存失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('保存失败')
  } finally {
    editSaving.value = false
  }
}

// 播放音频
async function playAudio(row) {
  // 先设置基本信息
  currentAudio.value = { ...row, playUrl: '' }
  playDialogVisible.value = true

  // 如果 audioFile 是云存储 fileID，需要获取临时 URL
  if (row.audioFile && row.audioFile.startsWith('cloud://')) {
    try {
      const res = await getFileTempUrl(row.audioFile)
      if (res.success && res.data.tempFileURL) {
        currentAudio.value.playUrl = res.data.tempFileURL
      } else {
        playDialogVisible.value = false
        ElMessage.error('获取音频链接失败')
      }
    } catch (err) {
      playDialogVisible.value = false
      ElMessage.error('获取音频链接失败')
    }
  } else {
    currentAudio.value.playUrl = row.audioFile
  }
}

// 设置播放速度为2倍
function setPlaybackRate() {
  if (audioRef.value) {
    audioRef.value.playbackRate = 2
  }
}

// 停止播放
function stopAudio() {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.currentTime = 0
  }
}

// 删除音频
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除音频 "${row.chapterName || row.title}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteAudio(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadAudios()
    } else {
      ElMessage.error('删除失败: ' + res.error)
    }
  } catch {
    // 用户取消
  }
}

// 初始化拖拽排序
let sortableInstance = null
function initSortable() {
  nextTick(() => {
    if (!tableRef.value) return

    const tbody = tableRef.value.$el.querySelector('.el-table__body-wrapper tbody')
    if (!tbody) return

    if (sortableInstance) {
      sortableInstance.destroy()
    }

    sortableInstance = Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: async (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex === newIndex) return

        const movedItem = audios.value.splice(oldIndex, 1)[0]
        audios.value.splice(newIndex, 0, movedItem)

        // 计算基础序号（考虑分页偏移）
        const baseSeq = (currentPage.value - 1) * pageSize.value + 1
        const updates = audios.value.map((audio, index) => ({
          _id: audio._id,
          seq: baseSeq + index
        }))

        try {
          const res = await batchUpdateSeq('audios', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            audios.value.forEach((audio, index) => {
              audio.seq = baseSeq + index
            })
          } else {
            ElMessage.error('保存排序失败')
            loadAudios()
          }
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadAudios()
        }
      }
    })
  })
}

// 格式化时长
function formatDuration(seconds) {
  if (!seconds) return '-'
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
  const sec = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${min}:${sec}`
}

onMounted(async () => {
  await loadCourses()
  await loadChapters()
  // 默认选择最新的课程
  if (courses.value.length > 0) {
    const sorted = [...courses.value].sort((a, b) => {
      const timeA = new Date(a._createTime || a.createTime || 0).getTime()
      const timeB = new Date(b._createTime || b.createTime || 0).getTime()
      return timeB - timeA
    })
    selectedCourse.value = sorted[0]._id
    await loadAudios()
  }
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header > div {
  display: flex;
  align-items: center;
}

.audio-player {
  text-align: center;
}

.audio-player p {
  margin-bottom: 15px;
  font-size: 16px;
  color: #333;
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

.file-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 10px;
}

.file-item {
  padding: 4px 0;
  font-size: 13px;
  color: #666;
}

.no-file {
  color: #999;
  font-size: 13px;
}

.seq-tip {
  margin-left: 10px;
  color: #999;
  font-size: 13px;
}

:deep(.el-upload-list) {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}

:deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.batch-file-list {
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 10px;
}

.batch-file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
  overflow-x: hidden;
  word-break: break-all;
}

.batch-file-item:last-child {
  border-bottom: none;
}

.batch-file-item span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 10px;
}

.batch-upload-tip {
  color: #999;
  font-size: 13px;
  margin-bottom: 15px;
}

.no-file-tip {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 20px;
}
</style>