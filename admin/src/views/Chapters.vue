<template>
  <div class="chapters-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>章节列表</span>
          <div>
            <el-select
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
        <el-table-column prop="title" label="章节名称" min-width="200" />
        <el-table-column prop="courseName" label="所属课程" width="150" />
        <el-table-column prop="audio" label="音频" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.audio" type="success">已上传</el-tag>
            <el-tag v-else type="warning">未上传</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
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
          <el-select v-model="form.course" placeholder="请选择课程" style="width: 100%">
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
        <el-form-item label="关联音频" prop="audio">
          <el-select v-model="form.audio" placeholder="请选择音频" clearable style="width: 100%">
            <el-option
              v-for="audio in audios"
              :key="audio._id"
              :label="audio.title"
              :value="audio._id"
            />
          </el-select>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { getChapters, createChapter, updateChapter, deleteChapter, getCourses, getAudios, batchUpdateSeq } from '@/api/cloud'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)
const selectedCourse = ref('')

const chapters = ref([])
const courses = ref([])
const audios = ref([])

const form = reactive({
  course: '',
  seq: 1,
  title: '',
  audio: '',
  status: 'published'
})

const rules = {
  course: [{ required: true, message: '请选择课程', trigger: 'change' }],
  title: [{ required: true, message: '请输入章节名称', trigger: 'blur' }]
}

// 加载章节列表
async function loadChapters() {
  loading.value = true
  try {
    const res = await getChapters(selectedCourse.value || null)
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

// 加载音频列表
async function loadAudios() {
  try {
    const res = await getAudios()
    if (res.success) {
      audios.value = res.data
    }
  } catch (err) {
    console.error('加载音频失败:', err)
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
    course: row.course,
    seq: row.seq || 1,
    title: row.title,
    audio: row.audio || '',
    status: row.status || 'published'
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(form, {
    course: '',
    seq: 1,
    title: '',
    audio: '',
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
      res = await updateChapter(currentId.value, form)
    } else {
      res = await createChapter(form)
    }

    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadChapters()
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
  await loadAudios()
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
</style>