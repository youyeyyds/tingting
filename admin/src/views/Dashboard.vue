<template>
  <div class="dashboard">
    <!-- 系统信息卡（基础信息 / CPU / 内存 / 运行时长） -->
    <el-card class="system-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="card-header-left">
            <span class="card-title">
              <el-icon class="title-icon"><Monitor /></el-icon>
              系统信息
            </span>
            <span class="sys-status" :class="connectionStatus">
              <span class="sys-status-dot"></span>
              {{ statusLabel }}
            </span>
          </div>
          <span v-if="healthInfo?.system" class="system-hostname mono">
            {{ healthInfo.system.hostname }}
          </span>
        </div>
      </template>

      <el-skeleton v-if="!hasSystemInfo" :rows="6" animated />
      <div v-else class="system-grid">
        <div class="sys-cell">
          <div class="sys-label">操作系统</div>
          <div class="sys-value">{{ healthInfo.system.type }} · {{ healthInfo.system.platform }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">架构</div>
          <div class="sys-value">{{ healthInfo.system.arch }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">内核版本</div>
          <div class="sys-value mono">{{ healthInfo.system.release }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">CPU 型号</div>
          <div class="sys-value" :title="healthInfo.cpu.model">{{ healthInfo.cpu.model || '-' }}</div>
        </div>

        <div class="sys-cell">
          <div class="sys-label">CPU 核心</div>
          <div class="sys-value">{{ healthInfo.cpu.count }} 核</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">负载 (1/5/15m)</div>
          <div class="sys-value mono">{{ formatLoadavg(healthInfo.cpu.loadavg) }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">系统内存</div>
          <div class="sys-value">{{ healthInfo.systemMemory.freeHuman }} / {{ healthInfo.systemMemory.totalHuman }}</div>
          <div class="sys-progress">
            <div class="sys-progress-bar" :style="{ width: healthInfo.systemMemory.usedPercent + '%' }"></div>
          </div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">进程内存 (RSS / Heap)</div>
          <div class="sys-value mono">{{ healthInfo.memoryHuman.rss }} / {{ healthInfo.memoryHuman.heapUsed }}</div>
        </div>

        <div class="sys-cell">
          <div class="sys-label">Node 版本</div>
          <div class="sys-value mono">{{ healthInfo.nodeVersion }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">云环境</div>
          <div class="sys-value mono" :title="healthInfo.env">{{ healthInfo.env }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">进程运行时长</div>
          <div class="sys-value">{{ formatUptime(healthInfo.uptime) }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">系统运行时长</div>
          <div class="sys-value">{{ formatUptime(healthInfo.systemUptime) }}</div>
        </div>
        <div class="sys-cell">
          <div class="sys-label">启动时间</div>
          <div class="sys-value mono">{{ formatStartedAt(healthInfo.startedAt, true) }}</div>
        </div>
      </div>
    </el-card>

    <!-- 数据脉搏：5 个核心数字 -->
    <div class="pulse-row">
      <div v-for="card in statCards" :key="card.key" class="stat-card" :style="{ '--card-color': card.color }">
        <div class="stat-deco"></div>
        <div class="stat-icon">
          <el-icon><component :is="card.icon" /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">
            <span class="stat-num">{{ card.value }}</span>
            <span class="stat-suffix">{{ card.suffix }}</span>
          </div>
          <div class="stat-label">{{ card.label }}</div>
        </div>
      </div>
    </div>

    <!-- 近 30 天趋势 -->
    <el-card class="trend-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">近 30 天趋势</span>
          <div class="trend-legend">
            <span class="legend-item" v-for="s in activeTrend.series" :key="s.name">
              <i class="dot" :style="{ background: s.color }"></i>{{ s.name }}
            </span>
          </div>
        </div>
      </template>
      <el-skeleton v-if="loading" :rows="6" animated />
      <v-chart v-else-if="hasTrendData" class="trend-chart" :option="trendOption" autoresize />
      <div v-else class="empty-block">近 30 天暂无播放数据，用户首次播放后这里会显示曲线</div>
    </el-card>

    <!-- 课程排行 TOP 5 + 热门内容 TOP 5 -->
    <el-row :gutter="20" class="middle-row">
      <el-col :xs="24" :md="14">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">课程排行 TOP 5</span>
              <span class="chart-sub">按播放量</span>
            </div>
          </template>

          <el-skeleton v-if="loading" :rows="5" animated />
          <v-chart v-else-if="topCourses.length > 0" class="rank-chart" :option="topCoursesChartOption" autoresize />
          <div v-else class="empty-block">暂无播放数据</div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="10">
        <el-card class="rank-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">热门内容 TOP 5</span>
              <el-radio-group v-model="rankType" size="small">
                <el-radio-button value="play">播放</el-radio-button>
                <el-radio-button value="favorite">收藏</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <el-skeleton v-if="loading" :rows="3" animated />
          <div v-else-if="currentRankList.length === 0" class="empty-block">暂无数据</div>
          <ol v-else class="rank-list">
            <li v-for="(item, idx) in currentRankList" :key="item._id" @click="goToChapter(item)">
              <span class="rank-num" :class="`rank-${idx + 1}`">{{ idx + 1 }}</span>
              <div class="rank-info">
                <div class="rank-course">{{ item.courseTitle }}</div>
                <div class="rank-title">第 {{ item.seq }} 章 · {{ item.title || '(无标题)' }}</div>
              </div>
              <span class="rank-value">
                <el-icon><Headset v-if="rankType === 'play'" /><Star v-else /></el-icon>
                {{ rankType === 'play' ? item.playCount : item.favoriteCount }}
              </span>
            </li>
          </ol>
        </el-card>
      </el-col>
    </el-row>

    <!-- 课程分类（饼图） + 最近活动 -->
    <el-row :gutter="20" class="middle-row">
      <el-col :xs="24" :md="10">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">课程分类</span>
              <el-tag size="small">{{ categoryDistribution.length }} 个分类</el-tag>
            </div>
          </template>

          <el-skeleton v-if="loading" :rows="6" animated />
          <v-chart v-else-if="categoryDistribution.length > 0" class="category-chart" :option="categoryChartOption" autoresize />
          <div v-else class="empty-block">暂无分类数据</div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="14">
        <el-card class="activity-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">最近活动</span>
              <el-tag size="small">{{ activity.length }} 条</el-tag>
            </div>
          </template>
          <el-skeleton v-if="loading" :rows="3" animated />
          <div v-else-if="activity.length === 0" class="empty-block">暂无活动</div>
          <ul v-else class="activity-list">
            <li v-for="a in activity" :key="a._id">
              <el-avatar :size="28" :src="a.userAvatar" class="activity-avatar">
                {{ (a.userName || '?')[0] }}
              </el-avatar>
              <span class="activity-user">{{ a.userName }}</span>
              <span class="activity-action" :class="`action-${a.type}`">{{ activityLabel(a.type) }}</span>
              <div class="activity-target">
                <div class="activity-course">{{ a.courseTitle }}</div>
                <div class="activity-chapter">第 {{ a.chapterSeq }} 章 · {{ a.chapterTitle || '(已删除章节)' }}</div>
              </div>
              <span class="activity-time">{{ formatActivityTime(a.time) }}</span>
            </li>
          </ul>
        </el-card>
      </el-col>
    </el-row>

    <!-- 工具台 -->
    <el-card class="tools-card" shadow="never">
      <template #header>
        <span class="card-title">快捷工具台</span>
      </template>
      <el-row :gutter="14">
        <el-col v-for="t in tools" :key="t.key" :xs="12" :sm="8" :md="6">
          <div class="tool-item" :style="{ '--tool-color': t.color }" @click="t.action">
            <div class="tool-deco"></div>
            <div class="tool-icon">
              <el-icon><component :is="t.icon" /></el-icon>
            </div>
            <div class="tool-text">
              <div class="tool-name">{{ t.name }}</div>
              <div class="tool-desc">{{ t.desc }}</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Reading, Document, User, Headset, Star, Timer,
  Plus, Upload, Edit, Refresh, Download, Setting, Promotion, Monitor
} from '@element-plus/icons-vue'
import { getDashboardStats, getServerHealth } from '@/api/cloud'

const router = useRouter()

const loading = ref(true)

const counts = reactive({ courses: 0, chapters: 0, users: 0, plays: 0 })

// 趋势数据：engagement.minutes = 近 30 天每日播放时长（分钟）
// 后端可能仍下发 dau（每日活跃用户），前端暂不使用
const trends = reactive({
  engagement: { minutes: [], dau: [] },
  content: { courses: [], chapters: [], users: [] }
})
const topPlayed = ref([])
const topFavorited = ref([])
const activity = ref([])
const rankType = ref('play')
const healthInfo = ref(null)
const categoryDistribution = ref([])
const topCourses = ref([])

// 心跳连接状态
const lastHealthSuccessAt = ref(0)
const now = ref(Date.now())
const connectionStatus = computed(() => {
  if (lastHealthSuccessAt.value === 0) return 'pending'
  return now.value - lastHealthSuccessAt.value < 30000 ? 'connected' : 'disconnected'
})
const statusLabel = computed(() => ({
  pending: '检测中…',
  connected: '已连接',
  disconnected: '已断开'
}[connectionStatus.value]))

const currentRankList = computed(() => rankType.value === 'play' ? topPlayed.value : topFavorited.value)

// 系统信息卡就绪判断：新接口（带 system/cpu/systemMemory）才渲染，否则显示骨架
const hasSystemInfo = computed(() =>
  !!healthInfo.value?.system && !!healthInfo.value?.cpu && !!healthInfo.value?.systemMemory
)

// 趋势图：仅显示"播放时长（分钟）"
const activeTrend = computed(() => {
  const e = trends.engagement
  return {
    series: [
      { name: '播放时长（分钟）', color: '#FF6B00', area: 'rgba(255,107,0,0.10)', data: e.minutes }
    ]
  }
})

const hasTrendData = computed(() => {
  const sum = arr => arr.reduce((s, x) => s + (x.count || 0), 0)
  return activeTrend.value.series.some(s => sum(s.data) > 0)
})

// ECharts 趋势图配置
const trendOption = computed(() => {
  const t = activeTrend.value
  const dates = (t.series[0]?.data || []).map(x => x.date.slice(5))
  return {
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#e0e0e0' } },
      axisLabel: { color: '#909399', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: '分钟',
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      axisLabel: { color: '#909399', fontSize: 11 },
      nameTextStyle: { color: '#FF6B00' }
    },
    series: t.series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: s.data.map(x => x.count),
      itemStyle: { color: s.color },
      lineStyle: { width: 2 },
      areaStyle: { color: s.area }
    }))
  }
})

// 课程分类：标准饼图 + 切片标签（分类名 + 百分比），最大切片向外推出强调
const CATEGORY_PALETTE = ['#FF6B00', '#FFB36B', '#FFD9A8', '#409EFF', '#67C23A', '#9C27B0', '#E6A23C', '#F56C6C']
const categoryChartOption = computed(() => {
  const data = categoryDistribution.value.map((c, i) => ({
    name: c.name,
    value: c.count,
    selected: i === 0,   // 最大切片自动 selected，配合 selectedOffset 外推
    itemStyle: {
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
      borderColor: '#fff',
      borderWidth: 3,
      shadowBlur: i === 0 ? 16 : 0,
      shadowColor: 'rgba(255, 107, 0, 0.25)'
    }
  }))
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(50, 50, 50, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: p => `${p.name}<br/>${p.value} 门课程 · <b>${p.percent}%</b>`
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['38%', '78%'],
      center: ['50%', '52%'],
      selectedMode: 'single',
      selectedOffset: 12,
      itemStyle: { borderRadius: 8 },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}\n{d}%',
        color: '#303133',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 16,
        textBorderColor: '#fff',
        textBorderWidth: 3
      },
      labelLine: {
        show: true,
        length: 10,
        length2: 16,
        lineStyle: { color: '#dcdfe6', width: 1 }
      },
      labelLayout: { hideOverlap: true },
      emphasis: {
        scale: true,
        scaleSize: 6,
        itemStyle: { shadowBlur: 18, shadowColor: 'rgba(255,107,0,0.35)' }
      },
      data
    }]
  }
})

// 课程排行 TOP 5（横向柱状图，#1 强调）
const topCoursesChartOption = computed(() => {
  const items = [...topCourses.value].slice(0, 5)
  const names = items.map(i => i.title)
  const values = items.map(i => i.playCount)
  // #1 用深橙渐变，其他用浅暖橙
  const makeColor = (idx) => idx === 0
    ? {
        type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
        colorStops: [
          { offset: 0, color: '#FF8C3A' },
          { offset: 1, color: '#FF6B00' }
        ]
      }
    : {
        type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
        colorStops: [
          { offset: 0, color: '#FFD9A8' },
          { offset: 1, color: '#FFB36B' }
        ]
      }
  return {
    grid: { left: 92, right: 56, top: 8, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const p = params[0]
        return `${p.name}<br/>播放量 <b>${p.value} 次</b>`
      }
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f5f5f5', type: 'dashed' } },
      axisLabel: { color: '#c0c4cc', fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'category',
      data: names,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#303133',
        fontSize: 13,
        fontWeight: 600,
        formatter: (val, idx) => `${idx + 1}.  ${val}`
      }
    },
    series: [{
      type: 'bar',
      data: values.map((v, idx) => ({
        value: v,
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: makeColor(idx)
        }
      })),
      barWidth: 18,
      label: {
        show: true,
        position: 'right',
        color: '#FF6B00',
        fontSize: 12,
        fontWeight: 700,
        formatter: '{c} 次'
      }
    }]
  }
})

// 工具台
const tools = [
  { key: 'new-course', name: '新建课程', desc: '创建新课程', icon: Plus, color: '#409eff', action: () => router.push('/courses') },
  { key: 'upload-audio', name: '上传音频', desc: '批量上传音频', icon: Upload, color: '#67c23a', action: () => router.push('/audios') },
  { key: 'chapters', name: '章节管理', desc: '管理章节内容', icon: Edit, color: '#e6a23c', action: () => router.push('/chapters') },
  { key: 'users', name: '用户管理', desc: '用户与权限', icon: User, color: '#f56c6c', action: () => router.push('/users') },
  { key: 'headlines', name: '横幅头条', desc: '首页横幅配置', icon: Promotion, color: '#909399', action: () => router.push('/headlines') },
  { key: 'categories', name: '课程分类', desc: '分类管理', icon: Reading, color: '#9c27b0', action: () => router.push('/categories') },
  { key: 'system', name: '系统配置', desc: '系统参数', icon: Setting, color: '#00bcd4', action: () => router.push('/system') },
  { key: 'refresh', name: '刷新数据', desc: '立即拉取最新', icon: Refresh, color: '#FF6B00', action: () => loadDashboard() }
]

// 5 个数据脉搏卡
const statCards = computed(() => [
  { key: 'courses', value: counts.courses, label: '课程总数', icon: Reading, color: '#409eff', suffix: '门' },
  { key: 'chapters', value: counts.chapters, label: '章节总数', icon: Document, color: '#67c23a', suffix: '章' },
  { key: 'users', value: counts.users, label: '用户总数', icon: User, color: '#e6a23c', suffix: '人' },
  { key: 'plays', value: counts.plays, label: '播放总数', icon: Headset, color: '#f56c6c', suffix: '次' },
  { key: 'todayMinutes', value: counts.todayMinutes || 0, label: '今日播放', icon: Timer, color: '#FF6B00', suffix: '分' }
])

const activityLabel = (type) => ({ play: '播放', finish: '学完', favorite: '收藏' }[type] || '操作')

function goToChapter(item) {
  if (item?.courseId) router.push(`/courses/${item.courseId}/chapters`)
  else router.push('/chapters')
}

// 今天显示 HH:mm，跨天显示 YYYY-MM-DD HH:mm
function formatActivityTime(t) {
  if (!t) return ''
  const d = new Date(t)
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return sameDay ? time : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`
}

function formatUptime(s) {
  if (s == null) return '-'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m} 分钟`
}

function formatLoadavg(load) {
  if (!load) return '-'
  const v = [load['1m'], load['5m'], load['15m']]
  // Windows 上 loadavg 恒为 [0,0,0]，提示一下
  if (v.every(x => x === 0)) return '不适用'
  return v.map(x => Number(x).toFixed(2)).join(' / ')
}

function formatStartedAt(iso, withSeconds = false) {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? ':' + pad(d.getSeconds()) : ''}`
  return `${date} ${time}`
}

// 心跳：拉一次健康信息，成功则更新 lastHealthSuccessAt；失败视为断开
async function loadHealth() {
  try {
    const res = await getServerHealth()
    if (res.success) {
      healthInfo.value = res.data
      lastHealthSuccessAt.value = Date.now()
    } else {
      lastHealthSuccessAt.value = 0
    }
  } catch {
    lastHealthSuccessAt.value = 0
  }
}

async function loadDashboard() {
  loading.value = true
  try {
    const statsRes = await getDashboardStats()

    if (statsRes.success && statsRes.data) {
      const d = statsRes.data
      Object.assign(counts, d.counts)
      if (d.trends) Object.assign(trends, d.trends)
      topPlayed.value = d.topPlayed || []
      topFavorited.value = d.topFavorited || []
      activity.value = d.activity || []
      categoryDistribution.value = d.categoryDistribution || []
      topCourses.value = d.topCourses || []
    }
  } finally {
    loading.value = false
  }
}

// 心跳检测：每 15s 一次，30s 内无成功响应视为连接断开
let heartbeatInterval = null
let dataRefreshInterval = null
let nowTickInterval = null
onMounted(async () => {
  await Promise.all([loadDashboard(), loadHealth()])
  heartbeatInterval = setInterval(loadHealth, 15000)
  dataRefreshInterval = setInterval(loadDashboard, 60000)
  // 5s tick 一次让 connectionStatus 在断线时能及时翻面
  nowTickInterval = setInterval(() => { now.value = Date.now() }, 5000)
})
onUnmounted(() => {
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  if (dataRefreshInterval) clearInterval(dataRefreshInterval)
  if (nowTickInterval) clearInterval(nowTickInterval)
})
</script>

<style scoped>
.dashboard {
  /* 全宽，跟其他页面一致 */
}

/* === 系统信息卡 === */
.system-card { margin-bottom: 20px; }
.card-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.sys-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fafafa;
  color: #606266;
  flex-shrink: 0;
}
.sys-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
  box-shadow: 0 0 0 0 rgba(192,196,204,0);
  transition: background 0.3s, box-shadow 0.3s;
}
.sys-status.connected .sys-status-dot {
  background: #67c23a;
  box-shadow: 0 0 0 3px rgba(103,194,58,0.18);
  animation: pulse-green 2s ease-in-out infinite;
}
.sys-status.connected { color: #67c23a; background: #f0f9eb; }
.sys-status.disconnected .sys-status-dot {
  background: #f56c6c;
  box-shadow: 0 0 0 3px rgba(245,108,108,0.18);
}
.sys-status.disconnected { color: #f56c6c; background: #fef0f0; }
@keyframes pulse-green {
  0%, 100% { box-shadow: 0 0 0 3px rgba(103,194,58,0.18); }
  50% { box-shadow: 0 0 0 6px rgba(103,194,58,0); }
}
.title-icon {
  font-size: 18px;
  color: #FF6B00;
  vertical-align: -3px;
  margin-right: 4px;
}
.system-hostname {
  font-size: 13px;
  color: #606266;
  background: #fafafa;
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
}
.system-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px 28px;
}
.sys-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #fafbfc;
  border-radius: 6px;
  border: 1px solid #f0f2f5;
}
.sys-label {
  font-size: 12px;
  color: #909399;
}
.sys-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sys-value.mono {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
}
.sys-progress {
  margin-top: 4px;
  height: 4px;
  background: #ebeef5;
  border-radius: 2px;
  overflow: hidden;
}
.sys-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #67c23a 0%, #e6a23c 70%, #f56c6c 100%);
  transition: width 0.5s ease;
}

/* === 数据脉搏 === */
.pulse-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
@media (min-width: 768px) {
  .pulse-row {
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
  }
}
.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--card-color) 10%, #ffffff) 0%,
    color-mix(in srgb, var(--card-color) 3%, #ffffff) 100%);
  border: 1px solid color-mix(in srgb, var(--card-color) 12%, transparent);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--card-color) 6%, transparent);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  overflow: hidden;
  cursor: default;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--card-color) 22%, transparent);
}
.stat-card::after {
  /* 顶部 3px 主题色条 */
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--card-color), color-mix(in srgb, var(--card-color) 50%, #ffffff));
}
.stat-deco {
  /* 右上角柔光斑 */
  position: absolute;
  top: -28px;
  right: -28px;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--card-color) 16%, transparent);
  filter: blur(2px);
  pointer-events: none;
}
.stat-icon {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  color: #fff;
  background: linear-gradient(135deg, var(--card-color), color-mix(in srgb, var(--card-color) 65%, #ffffff));
  box-shadow: 0 6px 14px color-mix(in srgb, var(--card-color) 35%, transparent);
}
.stat-body { flex: 1; min-width: 0; }
.stat-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  line-height: 1.1;
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--card-color);
  letter-spacing: -0.5px;
}
.stat-suffix {
  font-size: 13px;
  color: #909399;
  font-weight: 400;
}
.stat-label {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

/* === 中间区 === */
.middle-row {
  margin-bottom: 20px;
  align-items: stretch;  /* el-row 的 align prop 不支持 stretch，改用 CSS */
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

/* === 图表卡（饼图 / 横向柱状图）=== */
.chart-card { margin-bottom: 0; }
.chart-sub { font-size: 12px; color: #909399; }
.category-chart { width: 100%; height: 360px; }
.rank-chart { width: 100%; height: 280px; }

/* === 趋势图 === */
.trend-card { margin-bottom: 20px; }
.trend-legend { display: flex; gap: 16px; font-size: 13px; color: #606266; }
.trend-legend .legend-item { display: flex; align-items: center; gap: 6px; }
.trend-legend .dot { width: 10px; height: 10px; border-radius: 50%; }
.trend-chart { width: 100%; height: 280px; }
.empty-block { padding: 40px 0; text-align: center; color: #c0c4cc; font-size: 14px; }

/* === TOP 5 排行 === */
.rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rank-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
}
.rank-list li:hover { background: #fafafa; }
.rank-num {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: #f0f0f0;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.rank-num.rank-1 { background: #ff6b00; color: #fff; }
.rank-num.rank-2 { background: #ff9a3c; color: #fff; }
.rank-num.rank-3 { background: #ffc77a; color: #fff; }
.rank-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rank-course {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-title {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-value { color: #f56c6c; font-weight: 600; display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.rank-value .el-icon { font-size: 14px; }

/* === 活动流 === */
.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 560px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.activity-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f5;
}
.activity-list li:last-child { border-bottom: none; }
.activity-avatar { flex-shrink: 0; background: #FF6B00; color: #fff; font-size: 12px; }
.activity-user { color: #303133; font-weight: 500; flex-shrink: 0; }
.activity-action {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
.action-play { color: #409eff; background: #ecf5ff; }
.action-finish { color: #67c23a; background: #f0f9eb; }
.action-favorite { color: #e6a23c; background: #fdf6ec; }
.activity-target {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.activity-course {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-chapter {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-time { color: #c0c4cc; font-size: 12px; flex-shrink: 0; margin-right: 8px; }

/* === 工具台 === */
.tools-card { margin-bottom: 20px; }
.tools-card .el-row { row-gap: 14px; }
.tool-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  cursor: pointer;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--tool-color) 8%, #ffffff) 0%,
    color-mix(in srgb, var(--tool-color) 2%, #ffffff) 100%);
  border: 1px solid color-mix(in srgb, var(--tool-color) 12%, transparent);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--tool-color) 6%, transparent);
  transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
  overflow: hidden;
}
.tool-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--tool-color) 22%, transparent);
}
.tool-deco {
  position: absolute;
  top: -22px;
  right: -22px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--tool-color) 14%, transparent);
  filter: blur(2px);
  pointer-events: none;
}
.tool-icon {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--tool-color), color-mix(in srgb, var(--tool-color) 60%, #ffffff));
  box-shadow: 0 4px 10px color-mix(in srgb, var(--tool-color) 35%, transparent);
}
.tool-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tool-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
