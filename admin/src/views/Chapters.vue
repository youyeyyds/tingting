<template>
  <div class="chapters-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ courseTitle ? courseTitle + ' - 章节列表' : '章节列表' }}</span>
          <div>
            <el-button v-if="courseId" @click="goBack" style="margin-right: 10px">
              <el-icon><ArrowLeft /></el-icon>
              返回课程
            </el-button>
            <el-select
              v-if="!courseId"
              v-model="selectedCourse"
              placeholder="筛选课程"
              clearable
              style="width: 200px; margin-right: 10px"
              @change="loadChapters"
            >
              <el-option
                v-for="course in courses"
                :key="course._id"
                :label="course.title"
                :value="course._id"
              />
            </el-select>
            <el-button type="primary" @click="showAddDialog">
              <el-icon><Plus /></el-icon>
              新增章节
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="chapters"
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
        <el-table-column prop="title" label="章节名称" min-width="200">
          <template #default="{ row }">
            {{ row.title }}
            <el-tag v-if="row.favorite" type="warning" size="small" style="margin-left: 8px">已收藏</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="!courseId" prop="courseName" label="课程名称" width="150" />
        <el-table-column prop="audio" label="音频" width="80">
          <template #default="{ row }">
            <el-icon v-if="row.audioUrl" class="audio-icon play-icon" @click="playAudio(row)"><VideoPlay /></el-icon>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastPlayTime" label="上次播放" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.lastPlayTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="progress" label="学习进度" width="100">
          <template #default="{ row }">
            <el-tag v-if="calcProgress(row) === 0" type="info">未学习</el-tag>
            <el-tag v-else-if="isCompleted(row)" type="success">已学完</el-tag>
            <el-tag v-else>已学{{ calcProgress(row) }}%</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="playCount" label="播放量" width="100">
          <template #default="{ row }">
            {{ row.playCount || 0 }}
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
      :title="isEdit ? '编辑章节' : '新增章节'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="所属课程" prop="course">
          <el-input v-if="courseId" :value="courseTitle" disabled />
          <el-select v-else v-model="form.course" placeholder="请选择课程" style="width: 100%">
            <el-option
              v-for="course in courses"
              :key="course._id"
              :label="course.title"
              :value="course._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="序号" prop="seq">
          <el-input-number v-model="form.seq" :min="1" />
        </el-form-item>
        <el-form-item label="章节名称" prop="title">
          <el-input v-model="form.title" placeholder="请输入章节名称" />
        </el-form-item>
        <el-form-item label="音频文件" prop="audioFile">
          <div class="audio-upload-wrapper">
            <el-upload
              ref="uploadRef"
              class="audio-upload"
              :auto-upload="false"
              :show-file-list="false"
              :accept="audioAccept"
              :on-change="handleAudioChange"
            >
              <el-button type="primary">上传音频</el-button>
            </el-upload>
            <div v-if="form.audioFile" class="audio-info">
              <span class="audio-name">{{ form.audioFile.name }}</span>
              <span class="audio-size">{{ formatFileSize(form.audioFileSize) }}</span>
              <el-button type="danger" size="small" @click="clearAudio">删除</el-button>
            </div>
            <div v-if="audioLoading" class="audio-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
              正在解析音频...
            </div>
          </div>
        </el-form-item>
        <el-form-item label="时长(秒)" prop="duration">
          <div @dblclick.stop>
            <el-input-number v-model="form.duration" :min="0" @change="validateLastPlayTime" />
          </div>
          <div v-if="audioDuration > 0" class="form-tip">
            音频时长: {{ formatDuration(audioDuration) }} ({{ audioDuration }}秒)
          </div>
        </el-form-item>
        <el-form-item label="上次播放(秒)" prop="lastPlayTime">
          <div @dblclick.stop>
            <el-input-number v-model="form.lastPlayTime" :min="0" :max="form.duration || 0" />
          </div>
          <div class="form-tip">取值范围：0 ~ 时长（{{ form.duration || 0 }}秒）</div>
        </el-form-item>
        <el-form-item label="播放量" prop="playCount">
          <div @dblclick.stop>
            <el-input-number v-model="form.playCount" :min="0" />
          </div>
        </el-form-item>
        <el-form-item label="收藏" prop="favorite">
          <el-switch v-model="form.favorite" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 播放弹窗 -->
    <el-dialog v-model="playDialogVisible" title="音频播放" width="400px" @close="stopAudio">
      <div class="audio-player">
        <p>{{ currentAudio?.title }}</p>
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
import { ref, reactive, onMounted, nextTick, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Upload, Loading, VideoPlay } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { getChapters, createChapter, updateChapter, deleteChapter, getCourses, batchUpdateSeq, uploadAudio, getFileTempUrl } from '@/api/cloud'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)
const uploadRef = ref(null)
const audioRef = ref(null)
const selectedCourse = ref('')

// 音频相关
const audioAccept = '.mp3,.m4a,.wav,.ogg,.flac,.aac'
const audioLoading = ref(false)
const audioDuration = ref(0)

// 播放相关
const playDialogVisible = ref(false)
const currentAudio = ref(null)

// 从路由获取课程ID
const courseId = computed(() => route.params.id || '')
const courseTitle = computed(() => {
  if (!courseId.value) return ''
  const course = courses.value.find(c => c._id === courseId.value)
  return course ? course.title : ''
})

const chapters = ref([])
const courses = ref([])

const form = reactive({
  course: '',
  seq: 1,
  title: '',
  audioFile: null,
  audioFileSize: 0,
  audioUrl: '',
  duration: 0,
  lastPlayTime: 0,
  playCount: 0,
  favorite: false
})

const rules = {
  course: [{ required: true, message: '请选择课程', trigger: 'change' }],
  title: [{ required: true, message: '请输入章节名称', trigger: 'blur' }]
}

// 格式化时长（秒转为 mm:ss）
function formatDuration(seconds) {
  if (!seconds) return '-'
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// 计算学习进度
function calcProgress(row) {
  const lastPlayTime = Number(row.lastPlayTime) || 0
  const playCount = Number(row.playCount) || 0
  const duration = Number(row.duration) || 0

  // 播放量>=1，进度为100%（已学完）
  if (playCount >= 1) return 100

  // 上次播放为0且播放量为0，进度为0%（未学习）
  if (lastPlayTime === 0 && playCount === 0) return 0

  // 上次播放>0且播放量为0，进度=上次播放/时长
  if (lastPlayTime > 0 && playCount === 0 && duration > 0) {
    const percent = Math.round((lastPlayTime / duration) * 100)
    return Math.min(percent, 100)
  }

  return 0
}

// 检查是否已学完（用于显示）
function isCompleted(row) {
  const playCount = Number(row.playCount) || 0
  const lastPlayTime = Number(row.lastPlayTime) || 0
  const duration = Number(row.duration) || 0

  // 播放量>=1，已学完
  if (playCount >= 1) return true

  // 上次播放达到时长，也算已学完
  if (duration > 0 && lastPlayTime >= duration) return true

  return false
}

// 验证上次播放时间不超过时长
function validateLastPlayTime() {
  if (form.lastPlayTime > form.duration) {
    form.lastPlayTime = form.duration
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 处理音频文件选择
async function handleAudioChange(file) {
  audioLoading.value = true
  audioDuration.value = 0

  try {
    // 获取文件大小
    form.audioFile = file.raw
    form.audioFileSize = file.raw.size

    // 获取音频时长
    const duration = await getAudioDuration(file.raw)
    audioDuration.value = Math.round(duration)
    form.duration = audioDuration.value

    ElMessage.success(`音频解析成功，时长: ${formatDuration(audioDuration.value)}`)
  } catch (err) {
    console.error('解析音频失败:', err)
    ElMessage.error('解析音频失败，请检查文件格式')
    clearAudio()
  } finally {
    audioLoading.value = false
  }
}

// 获取音频时长
function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)

    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    })

    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法加载音频'))
    })

    audio.src = url
  })
}

// 清除音频
function clearAudio() {
  form.audioFile = null
  form.audioFileSize = 0
  form.audioUrl = ''
  audioDuration.value = 0
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
}

// 加载章节列表
async function loadChapters() {
  loading.value = true
  try {
    // 优先使用路由中的课程ID，否则使用筛选的课程
    const filterCourseId = courseId.value || selectedCourse.value || null
    const res = await getChapters(filterCourseId)
    if (res.success) {
      // 关联课程名称
      chapters.value = res.data.map(chapter => {
        const course = courses.value.find(c => c._id === chapter.course)
        return {
          ...chapter,
          courseName: course ? course.title : '-'
        }
      })
      initSortable()
    } else {
      ElMessage.error('加载章节失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载章节失败')
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

// 显示新增弹窗
function showAddDialog() {
  isEdit.value = false
  resetForm()
  // 自动计算下一个序号
  const maxSeq = chapters.value.length > 0 ? Math.max(...chapters.value.map(c => c.seq || 0)) : 0
  form.seq = maxSeq + 1
  // 如果从课程页面进入，预设课程ID
  if (courseId.value) {
    form.course = courseId.value
  }
  dialogVisible.value = true
}

// 返回课程列表
function goBack() {
  router.push('/courses')
}

// 播放音频
async function playAudio(row) {
  if (!row.audioUrl) return

  currentAudio.value = { ...row, playUrl: '' }

  // 如果 audioUrl 是云存储 fileID，需要获取临时 URL
  if (row.audioUrl.startsWith('cloud://')) {
    try {
      const res = await getFileTempUrl(row.audioUrl)
      if (res.success && res.data.tempFileURL) {
        currentAudio.value.playUrl = res.data.tempFileURL
      } else {
        ElMessage.error('获取音频链接失败')
        return
      }
    } catch (err) {
      ElMessage.error('获取音频链接失败')
      return
    }
  } else {
    currentAudio.value.playUrl = row.audioUrl
  }

  playDialogVisible.value = true
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

// 显示编辑弹窗
function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  Object.assign(form, {
    course: row.course,
    seq: row.seq || 1,
    title: row.title,
    audioFile: null,
    audioFileSize: row.audioFileSize || 0,
    audioUrl: row.audioUrl || '',
    duration: row.duration || 0,
    lastPlayTime: row.lastPlayTime || 0,
    playCount: row.playCount || 0,
    favorite: row.favorite || false
  })
  audioDuration.value = row.duration || 0
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    course: '',
    seq: 1,
    title: '',
    audioFile: null,
    audioFileSize: 0,
    audioUrl: '',
    duration: 0,
    lastPlayTime: 0,
    playCount: 0,
    favorite: false
  })
  audioDuration.value = 0
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
      course: form.course,
      seq: form.seq,
      title: form.title,
      duration: form.duration,
      lastPlayTime: form.lastPlayTime,
      playCount: form.playCount,
      favorite: form.favorite,
      audioUrl: form.audioUrl,
      audioFileSize: form.audioFileSize
    }

    // 如果上次播放>=时长且播放量=0，自动设置播放量为1
    if (submitData.lastPlayTime >= submitData.duration && submitData.playCount === 0) {
      submitData.playCount = 1
    }

    // 如果有新上传的音频文件，先上传到云端
    if (form.audioFile) {
      ElMessage.info('正在上传音频...')
      try {
        const uploadRes = await uploadAudio(form.audioFile, form.course, form.seq, form.title)
        if (uploadRes.success) {
          submitData.audioUrl = uploadRes.data.fileID || uploadRes.data.tempFileURL || ''
          submitData.audioFileSize = form.audioFileSize
          // 如果后端返回了时长，使用后端的
          if (uploadRes.data.duration) {
            submitData.duration = uploadRes.data.duration
          }
          ElMessage.success('音频上传成功')
        } else {
          ElMessage.error('音频上传失败: ' + uploadRes.error)
          submitLoading.value = false
          return
        }
      } catch (uploadErr) {
        ElMessage.error('音频上传失败')
        submitLoading.value = false
        return
      }
    }

    let res
    if (isEdit.value) {
      res = await updateChapter(currentId.value, submitData)
    } else {
      res = await createChapter(submitData)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      await loadChapters()
    } else {
      ElMessage.error('操作失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除章节
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除章节 "${row.title}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteChapter(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadChapters()
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

    // 销毁旧实例
    if (sortableInstance) {
      sortableInstance.destroy()
    }

    sortableInstance = Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: async (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex === newIndex) return

        // 更新本地数据顺序
        const movedItem = chapters.value.splice(oldIndex, 1)[0]
        chapters.value.splice(newIndex, 0, movedItem)

        // 更新序号
        const updates = chapters.value.map((chapter, index) => ({
          _id: chapter._id,
          seq: index + 1
        }))

        // 调用批量更新API
        try {
          const res = await batchUpdateSeq('chapters', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            chapters.value.forEach((chapter, index) => {
              chapter.seq = index + 1
            })
          } else {
            ElMessage.error('保存排序失败')
            loadChapters()
          }
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadChapters()
        }
      }
    })
  })
}

onMounted(async () => {
  await loadCourses()
  await loadChapters()
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

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.audio-upload-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.audio-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio-name {
  font-size: 13px;
  color: #606266;
}

.audio-size {
  font-size: 12px;
  color: #999;
}

.audio-loading {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #409EFF;
  font-size: 13px;
}

.audio-icon {
  font-size: 18px;
  color: #FF6B00;
}

.play-icon {
  cursor: pointer;
  transition: transform 0.2s;
}

.play-icon:hover {
  transform: scale(1.2);
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