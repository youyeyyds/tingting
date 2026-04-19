<template>
  <div class="courses-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程列表</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            新增课程
          </el-button>
        </div>
      </template>

      <el-table
        :data="courses"
        v-loading="loading"
        stripe
        ref="tableRef"
        row-key="_id"
        @row-click="goToChapters"
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
        <el-table-column prop="cover" label="封面" width="100">
          <template #default="{ row }">
            <div @click.stop>
              <el-image
                v-if="row.cover"
                :src="row.cover"
                style="width: 80px; height: 80px"
                fit="cover"
              />
              <span v-else>-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="课程名称" min-width="200" />
        <el-table-column prop="author" label="作者" width="120" />
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column prop="chapters" label="章节数" width="80">
          <template #default="{ row }">{{ row.chapters || 0 }} 章</template>
        </el-table-column>
        <el-table-column prop="totalDuration" label="总时长" width="100">
          <template #default="{ row }">
            {{ formatTotalDuration(calcTotalDuration(row._id)) }}
          </template>
        </el-table-column>
        <el-table-column prop="progress" label="学习进度" width="100">
          <template #default="{ row }">
            <el-tag v-if="calcCourseProgress(row._id) === 0" type="info">未学习</el-tag>
            <el-tag v-else-if="isCourseCompleted(row._id)" type="success">已学完</el-tag>
            <el-tag v-else>已学{{ calcCourseProgress(row._id) }}%</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="onlineTime" label="上线时间" width="120">
          <template #default="{ row }">
            {{ row.onlineTime ? row.onlineTime.substring(0, 10) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div @click.stop>
              <el-button size="small" type="primary" @click="goToChapters(row)">章节</el-button>
              <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
              <el-button size="small" :type="row.status === 'published' ? '' : 'success'" @click="toggleStatus(row)">
                {{ row.status === 'published' ? '下架' : '发布' }}
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑课程' : '新增课程'"
      width="600px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="序号" prop="seq">
          <el-input-number v-model="form.seq" :min="1" />
        </el-form-item>
        <el-form-item label="课程名称" prop="title">
          <el-input v-model="form.title" placeholder="请输入课程名称" />
        </el-form-item>
        <el-form-item label="作者" prop="author">
          <el-input v-model="form.author" placeholder="请输入作者" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat._id"
              :label="cat.name"
              :value="cat._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="随机" prop="coverRandom">
          <el-switch v-model="form.coverRandom" @change="updateCoverUrl" />
        </el-form-item>
        <el-form-item label="链接" prop="cover">
          <el-input v-model="form.cover" readonly placeholder="自动生成" />
        </el-form-item>
        <el-form-item label="简介" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入课程简介"
          />
        </el-form-item>
        <el-form-item label="上线时间" prop="onlineTime">
          <el-date-picker
            v-model="form.onlineTime"
            type="date"
            placeholder="请选择上线时间"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
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
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { getCourses, createCourse, updateCourse, deleteCourse, getCategories, batchUpdateSeq, getChapters, getUserProgress } from '@/api/cloud'

const router = useRouter()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)

const courses = ref([])
const categories = ref([])
const chapters = ref([])

// 获取当前登录用户
function getCurrentUser() {
  const stored = localStorage.getItem('tingting_admin_user')
  if (stored) {
    try {
      const data = JSON.parse(stored)
      // 检查是否过期（2小时）
      if (data.loginTime && Date.now() - data.loginTime < 2 * 60 * 60 * 1000) {
        return data
      }
    } catch (e) {
      console.error('解析用户信息失败:', e)
    }
  }
  return null
}

const form = reactive({
  seq: 1,
  title: '',
  author: '',
  category: '',
  cover: '',
  coverRandom: true,
  description: '',
  onlineTime: '',
  status: 'published'
})

const rules = {
  title: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  author: [{ required: true, message: '请输入作者', trigger: 'blur' }]
}

// 监听序号变化，更新封面URL
watch(() => form.seq, () => {
  if (dialogVisible.value) {
    updateCoverUrl()
  }
})

// 更新封面 URL
function updateCoverUrl() {
  form.cover = form.coverRandom
    ? `https://picsum.photos/400?random=${form.seq}`
    : `https://picsum.photos/seed/course${form.seq}/400/400`
}

// 加载课程列表
async function loadCourses() {
  loading.value = true
  try {
    const res = await getCourses()
    if (res.success) {
      courses.value = res.data
    } else {
      ElMessage.error('加载课程失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('加载课程失败')
  } finally {
    loading.value = false
  }
}

// 加载章节列表（用于计算课程学习进度）
async function loadChapters() {
  try {
    const res = await getChapters()
    if (res.success) {
      let chaptersData = res.data

      // 加载当前用户进度
      const currentUser = getCurrentUser()
      if (currentUser && currentUser.userId) {
        const progressRes = await getUserProgress(currentUser.userId)
        if (progressRes.success) {
          // 构建进度映射
          const progressMap = {}
          progressRes.data.forEach(p => {
            progressMap[p.chapterId] = p
          })
          // 合并用户进度到章节
          chaptersData = chaptersData.map(chapter => ({
            ...chapter,
            userProgress: progressMap[chapter._id] || null
          }))
        }
      }

      chapters.value = chaptersData
    }
  } catch (err) {
    console.error('加载章节失败:', err)
  }
}

// 计算章节学习进度（基于用户进度）
function calcChapterProgress(chapter) {
  const userProgress = chapter.userProgress
  if (!userProgress) return 0

  const finished = userProgress.finished === true
  const lastPlayTime = Number(userProgress.lastPlayTime) || 0
  const duration = Number(chapter.duration) || 0

  // 完播=true，进度为100%
  if (finished) return 100

  // 上次播放为0，进度为0%
  if (lastPlayTime === 0) return 0

  // 上次播放>0且时长>0，进度=上次播放/时长
  if (lastPlayTime > 0 && duration > 0) {
    const percent = Math.round((lastPlayTime / duration) * 100)
    return Math.min(percent, 100)
  }

  return 0
}

// 计算课程学习进度（基于章节）
function calcCourseProgress(courseId) {
  const courseChapters = chapters.value.filter(c => c.course === courseId)
  if (courseChapters.length === 0) return 0

  // 计算所有章节的平均进度
  const totalProgress = courseChapters.reduce((sum, chapter) => {
    return sum + calcChapterProgress(chapter)
  }, 0)

  return Math.round(totalProgress / courseChapters.length)
}

// 检查课程是否已学完
function isCourseCompleted(courseId) {
  const courseChapters = chapters.value.filter(c => c.course === courseId)
  if (courseChapters.length === 0) return false

  // 所有章节都已学完
  return courseChapters.every(chapter => {
    const progress = calcChapterProgress(chapter)
    return progress === 100
  })
}

// 计算课程总时长（秒）
function calcTotalDuration(courseId) {
  const courseChapters = chapters.value.filter(c => c.course === courseId)
  return courseChapters.reduce((sum, chapter) => {
    return sum + (Number(chapter.duration) || 0)
  }, 0)
}

// 格式化总时长（秒转为 HH:MM:SS 或 MM:SS）
function formatTotalDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// 加载分类列表
async function loadCategories() {
  try {
    const res = await getCategories()
    if (res.success) {
      categories.value = res.data
    }
  } catch (err) {
    console.error('加载分类失败:', err)
  }
}

// 显示新增弹窗
function showAddDialog() {
  isEdit.value = false
  resetForm()
  // 计算下一个序号
  const maxSeq = courses.value.length > 0 ? Math.max(...courses.value.map(c => c.seq || 0)) : 0
  form.seq = maxSeq + 1
  updateCoverUrl()
  dialogVisible.value = true
}

// 显示编辑弹窗
function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  Object.assign(form, {
    seq: row.seq || 1,
    title: row.title,
    author: row.author,
    category: row.category,
    cover: row.cover || '',
    coverRandom: row.coverRandom !== false,
    description: row.description,
    onlineTime: row.onlineTime || '',
    status: row.status || 'published'
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    seq: 1,
    title: '',
    author: '',
    category: '',
    cover: '',
    coverRandom: true,
    description: '',
    onlineTime: '',
    status: 'published'
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
      res = await updateCourse(currentId.value, form)
    } else {
      res = await createCourse(form)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadCourses()
    } else {
      ElMessage.error('操作失败: ' + res.error)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除课程
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除课程 "${row.title}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await deleteCourse(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadCourses()
    } else {
      ElMessage.error('删除失败: ' + res.error)
    }
  } catch {
    // 用户取消
  }
}

// 切换课程状态（发布/下架）
async function toggleStatus(row) {
  const newStatus = row.status === 'published' ? 'draft' : 'published'
  const actionText = newStatus === 'published' ? '发布' : '下架'

  try {
    const res = await updateCourse(row._id, { ...row, status: newStatus })
    if (res.success) {
      ElMessage.success(`${actionText}成功`)
      loadCourses()
    } else {
      ElMessage.error(`${actionText}失败: ` + res.error)
    }
  } catch (err) {
    ElMessage.error(`${actionText}失败`)
  }
}

// 跳转到章节管理
function goToChapters(row) {
  router.push(`/courses/${row._id}/chapters`)
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
        const movedItem = courses.value.splice(oldIndex, 1)[0]
        courses.value.splice(newIndex, 0, movedItem)

        // 更新序号
        const updates = courses.value.map((course, index) => ({
          _id: course._id,
          seq: index + 1
        }))

        // 调用批量更新API
        try {
          const res = await batchUpdateSeq('courses', updates)
          if (res.success) {
            ElMessage.success('排序已保存')
            // 更新本地数据的seq值
            courses.value.forEach((course, index) => {
              course.seq = index + 1
            })
          } else {
            ElMessage.error('保存排序失败')
            loadCourses() // 重新加载恢复原顺序
          }
        } catch (err) {
          ElMessage.error('保存排序失败')
          loadCourses()
        }
      }
    })
  })
}

onMounted(async () => {
  await loadCategories()
  await loadChapters()
  await loadCourses()
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

:deep(.el-table__row) {
  cursor: pointer;
}
</style>