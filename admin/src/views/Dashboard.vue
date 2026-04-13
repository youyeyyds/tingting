<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <!-- 统计卡片 -->
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #409eff">
            <el-icon><Reading /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.courses }}</div>
            <div class="stat-label">课程总数</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #67c23a">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.chapters }}</div>
            <div class="stat-label">章节总数</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #e6a23c">
            <el-icon><Headset /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.audios }}</div>
            <div class="stat-label">音频总数</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #f56c6c">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.users }}</div>
            <div class="stat-label">用户总数</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷操作 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <span>快捷操作</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-button type="primary" @click="$router.push('/courses')">
            <el-icon><Plus /></el-icon>
            新增课程
          </el-button>
        </el-col>
        <el-col :span="6">
          <el-button type="success" @click="$router.push('/audios')">
            <el-icon><Upload /></el-icon>
            上传音频
          </el-button>
        </el-col>
        <el-col :span="6">
          <el-button type="warning" @click="$router.push('/categories')">
            <el-icon><FolderAdd /></el-icon>
            管理分类
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 最近课程 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <span>最近课程</span>
      </template>
      <el-table :data="recentCourses" v-loading="loading">
        <el-table-column prop="title" label="课程名称" />
        <el-table-column prop="author" label="作者" />
        <el-table-column prop="chapters" label="章节数">
          <template #default="{ row }">{{ row.chapters || 0 }} 章</template>
        </el-table-column>
        <el-table-column prop="_createTime" label="创建时间">
          <template #default="{ row }">
            {{ formatDate(row._createTime) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 连接状态 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <span>系统状态</span>
      </template>
      <el-descriptions :column="3">
        <el-descriptions-item label="云环境ID">
          cloud1-2g5y53suf638dfb9
        </el-descriptions-item>
        <el-descriptions-item label="连接状态">
          <el-tag :type="connected ? 'success' : 'danger'">
            {{ connected ? '已连接' : '未连接' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前时间">
          {{ currentTime }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getCourses, getChapters, getAudios, getUsers, testConnection } from '@/api/cloud'

const loading = ref(false)
const connected = ref(false)
const currentTime = ref('')

const stats = reactive({
  courses: 0,
  chapters: 0,
  audios: 0,
  users: 0
})

const recentCourses = ref([])

// 检查连接状态
async function checkConnection() {
  connected.value = await testConnection()
}

// 加载统计数据
async function loadStats() {
  loading.value = true
  try {
    const [coursesRes, chaptersRes, audiosRes, usersRes] = await Promise.all([
      getCourses(),
      getChapters(),
      getAudios(),
      getUsers()
    ])

    if (coursesRes.success) {
      stats.courses = coursesRes.data.length
      recentCourses.value = coursesRes.data.slice(0, 5)
    }
    if (chaptersRes.success) stats.chapters = chaptersRes.data.length
    if (audiosRes.success) stats.audios = audiosRes.data.length
    if (usersRes.success) stats.users = usersRes.data.length

  } catch (err) {
    console.error('加载统计数据失败:', err)
  } finally {
    loading.value = false
  }
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

// 更新时间
function updateTime() {
  currentTime.value = new Date().toLocaleString('zh-CN')
}

onMounted(async () => {
  await checkConnection()
  await loadStats()
  updateTime()
  setInterval(updateTime, 1000)
})
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

.stat-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 28px;
}

.stat-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  height: 60px;
  display: flex;
  align-items: center;
}

.stat-label {
  font-size: 14px;
  color: #666;
  position: absolute;
  bottom: -20px;
}
</style>