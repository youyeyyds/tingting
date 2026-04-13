<template>
  <div class="audios-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>音频列表</span>
          <el-button type="primary" @click="showUploadDialog">
            <el-icon><Upload /></el-icon>
            上传音频
          </el-button>
        </div>
      </template>

      <el-table :data="audios" v-loading="loading" stripe>
        <el-table-column prop="title" label="音频名称" min-width="200" />
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="_createTime" label="上传时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row._createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="playAudio(row)">播放</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 上传弹窗 -->
    <el-dialog v-model="uploadDialogVisible" title="上传音频" width="500px">
      <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="100px">
        <el-form-item label="选择课程" prop="courseId">
          <el-select v-model="uploadForm.courseId" placeholder="请选择课程" style="width: 100%">
            <el-option
              v-for="course in courses"
              :key="course._id"
              :label="course.title"
              :value="course._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="章节序号" prop="seq">
          <el-input-number v-model="uploadForm.seq" :min="1" />
        </el-form-item>
        <el-form-item label="章节标题" prop="title">
          <el-input v-model="uploadForm.title" placeholder="请输入章节标题" />
        </el-form-item>
        <el-form-item label="音频文件" prop="file">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".mp3,.m4a,.wav"
            :on-change="handleFileChange"
          >
            <el-button type="primary">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">支持 mp3、m4a、wav 格式</div>
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
    <el-dialog v-model="playDialogVisible" title="音频播放" width="400px">
      <div class="audio-player">
        <p>{{ currentAudio?.title }}</p>
        <audio
          v-if="currentAudio?.audioFile"
          :src="currentAudio.audioFile"
          controls
          style="width: 100%"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAudios, uploadAudio, deleteAudio, getCourses } from '@/api/cloud'

const loading = ref(false)
const uploading = ref(false)
const uploadDialogVisible = ref(false)
const playDialogVisible = ref(false)
const uploadFormRef = ref(null)
const uploadRef = ref(null)
const selectedFile = ref(null)

const audios = ref([])
const courses = ref([])
const currentAudio = ref(null)

const uploadForm = reactive({
  courseId: '',
  seq: 1,
  title: '',
  file: null
})

const uploadRules = {
  courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
  title: [{ required: true, message: '请输入章节标题', trigger: 'blur' }]
}

// 加载音频列表
async function loadAudios() {
  loading.value = true
  try {
    const res = await getAudios()
    if (res.success) {
      audios.value = res.data
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
    console.error('加载课程失败:', err)
  }
}

// 显示上传弹窗
function showUploadDialog() {
  uploadDialogVisible.value = true
}

// 文件选择
function handleFileChange(file) {
  selectedFile.value = file.raw
  // 从文件名提取序号和标题
  const name = file.name
  const match = name.match(/^(\d+)\.\s*(.+)\.(mp3|m4a|wav)$/i)
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
      uploadForm.courseId,
      uploadForm.seq,
      uploadForm.title
    )

    if (res.success) {
      ElMessage.success('上传成功')
      uploadDialogVisible.value = false
      loadAudios()
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

// 播放音频
function playAudio(row) {
  currentAudio.value = row
  playDialogVisible.value = true
}

// 删除音频
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除音频 "${row.title}" 吗？`, '提示', {
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
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(async () => {
  await loadCourses()
  await loadAudios()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
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
</style>