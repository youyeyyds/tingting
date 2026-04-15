<template>
  <div class="audios-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>音频列表</span>
          <div>
            <el-select
              v-model="selectedCourse"
              placeholder="筛选课程"
              clearable
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
        <el-table-column prop="courseName" label="课程名称" width="150">
          <template #default="{ row }">
            {{ row.courseName || '-' }}
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { getAudios, uploadAudio, deleteAudio, getCourses, getChapters, batchUpdateSeq, getFileTempUrl } from '@/api/cloud'

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
      // 关联课程和章节名称，并根据课程筛选
      audios.value = res.data
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
        .filter(audio => {
          // 如果选择了课程，只显示该课程的音频
          if (selectedCourse.value) {
            return audio.course === selectedCourse.value
          }
          return true
        })
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
    console.error('加载课程失败:', err)
  }
}

// 加载章节列表
async function loadChapters() {
  try {
    const res = await getChapters()
    if (res.success) {
      chapters.value = res.data
    }
  } catch (err) {
    console.error('加载章节失败:', err)
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
      uploadForm.courseId,
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

        const updates = audios.value.map((audio, index) => ({
          _id: audio._id,
          seq: index + 1
        }))

        try {
          const res = await batchUpdateSeq('audios', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            audios.value.forEach((audio, index) => {
              audio.seq = index + 1
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
  await loadAudios()
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
</style>