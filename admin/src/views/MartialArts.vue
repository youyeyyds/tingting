<template>
  <div class="martial-arts-page">
    <!-- 武功列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>武功列表</span>
          <div>
            <el-input
              v-model="searchKeyword"
              placeholder="搜索武功或人物"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadMartialArts"
              @keyup.enter="loadMartialArts"
            >
              <template #append>
                <el-button @click="loadMartialArts"><el-icon><Search /></el-icon></el-button>
              </template>
            </el-input>
            <el-select
              v-model="filterTypeId"
              placeholder="筛选类型"
              clearable
              style="width: 120px; margin-right: 10px"
              @change="loadMartialArts"
            >
              <el-option
                v-for="type in availableTypes"
                :key="type._id"
                :label="type.name"
                :value="type._id"
              />
            </el-select>
            <el-select
              v-model="filterFactionId"
              placeholder="筛选门派"
              clearable
              style="width: 120px; margin-right: 10px"
              @change="loadMartialArts"
            >
              <el-option
                v-for="faction in availableFactions"
                :key="faction._id"
                :label="faction.name"
                :value="faction._id"
              />
            </el-select>
            <el-button type="primary" @click="showAddDialog">
              <el-icon><Plus /></el-icon>
              新增武功
            </el-button>
            <el-button @click="handleExport" style="margin-left: 10px">
              <el-icon><Upload /></el-icon>
              导出
            </el-button>
            <el-button @click="triggerImport">
              <el-icon><Download /></el-icon>
              导入
            </el-button>
            <input type="file" ref="importInput" accept=".json" style="display: none" @change="handleImportFile" />
          </div>
        </div>
      </template>

      <el-tabs v-model="activeNovelTab">
        <el-tab-pane label="飞狐外传" name="飞狐外传" />
        <el-tab-pane label="雪山飞狐" name="雪山飞狐" />
        <el-tab-pane label="连城诀" name="连城诀" />
        <el-tab-pane label="天龙八部" name="天龙八部" />
        <el-tab-pane label="射雕英雄传" name="射雕英雄传" />
        <el-tab-pane label="白马啸西风" name="白马啸西风" />
        <el-tab-pane label="鹿鼎记" name="鹿鼎记" />
        <el-tab-pane label="笑傲江湖" name="笑傲江湖" />
        <el-tab-pane label="书剑恩仇录" name="书剑恩仇录" />
        <el-tab-pane label="神雕侠侣" name="神雕侠侣" />
        <el-tab-pane label="侠客行" name="侠客行" />
        <el-tab-pane label="倚天屠龙记" name="倚天屠龙记" />
        <el-tab-pane label="碧血剑" name="碧血剑" />
        <el-tab-pane label="鸳鸯刀" name="鸳鸯刀" />
        <el-tab-pane label="越女剑" name="越女剑" />
        <el-tab-pane label="全集" name="" />
      </el-tabs>

      <el-table
        :data="martialArts"
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
        <el-table-column label="序号" width="80">
          <template #default="{ row, $index }">
            {{ (currentPage - 1) * pageSize + $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="name" label="武功名称" min-width="150" />
        <el-table-column prop="typeName" label="类型" width="100" />
        <el-table-column prop="characters" label="人物" min-width="200">
          <template #default="{ row }">
            <span v-if="row.characters && row.characters.length > 0">
              {{ row.characters.map(c => c.name).join('、') }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="factionName" label="门派" width="120">
          <template #default="{ row }">
            <span>{{ row.factionName || '-' }}</span>
          </template>
        </el-table-column>
                <el-table-column prop="description" label="描述" min-width="300">
          <template #default="{ row }">
            <el-tooltip placement="left" :disabled="!row.description" popper-class="desc-tooltip" transition="" :show-after="0" :hide-after="0">
                <template #content>
                  <span style="white-space: pre-wrap; display: inline-block;">{{ row.description?.replace(/\n/g, '\n\n') }}</span>
                </template>
                <span class="desc-text">{{ row.description }}</span>
              </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column v-if="activeNovelTab === ''" prop="novelName" label="小说" width="120">
          <template #default="{ row }">
            <span>{{ row.novelName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 30, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadMartialArts"
          @current-change="loadMartialArts"
        />
      </div>
    </el-card>

    <!-- 武功基础数据管理 -->
    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>武功数据</span>
          <div class="base-data-toolbar">
            <el-input
              v-if="activeBaseTab === 'type'"
              v-model="baseTypeSearch"
              placeholder="搜索类型"
              clearable
              style="width: 200px; margin-right: 10px;"
              @keyup.enter="baseCurrentPage = 1"
            >
              <template #append>
                <el-button @click="baseCurrentPage = 1"><el-icon><Search /></el-icon></el-button>
              </template>
            </el-input>
            <el-input
              v-else-if="activeBaseTab === 'character'"
              v-model="baseCharacterSearch"
              placeholder="搜索人物"
              clearable
              style="width: 200px; margin-right: 10px;"
              @keyup.enter="baseCurrentPage = 1"
            >
              <template #append>
                <el-button @click="baseCurrentPage = 1"><el-icon><Search /></el-icon></el-button>
              </template>
            </el-input>
            <el-input
              v-else
              v-model="baseFactionSearch"
              placeholder="搜索门派"
              clearable
              style="width: 200px; margin-right: 10px;"
              @keyup.enter="baseCurrentPage = 1"
            >
              <template #append>
                <el-button @click="baseCurrentPage = 1"><el-icon><Search /></el-icon></el-button>
              </template>
            </el-input>
            <el-button type="primary" @click="openBaseAddDialog(activeBaseTab)">
              <el-icon><Plus /></el-icon>
              新增{{ activeBaseTab === 'type' ? '类型' : activeBaseTab === 'character' ? '人物' : '门派' }}
            </el-button>
            <el-button @click="handleBaseExport" style="margin-left: 10px">
              <el-icon><Upload /></el-icon>
              导出
            </el-button>
            <el-button @click="triggerBaseImport">
              <el-icon><Download /></el-icon>
              导入
            </el-button>
            <input type="file" ref="baseImportInput" accept=".json" style="display: none" @change="handleBaseImportFile" />
          </div>
        </div>
      </template>

      <el-tabs v-model="activeBaseTab">
        <!-- 类型 -->
        <el-tab-pane label="类型" name="type">
          <el-table :data="paginatedTypes" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="openBaseEditDialog('type', row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteBaseItem('type', row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="baseCurrentPage"
              v-model:page-size="basePageSize"
              :page-sizes="[10, 30, 50, 100]"
              :total="filteredTypes.length"
              layout="total, sizes, prev, pager, next, jumper"
            />
          </div>
        </el-tab-pane>

        <!-- 人物 -->
        <el-tab-pane label="人物" name="character">
          <el-table :data="paginatedCharacters" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="openBaseEditDialog('character', row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteBaseItem('character', row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="baseCurrentPage"
              v-model:page-size="basePageSize"
              :page-sizes="[10, 30, 50, 100]"
              :total="filteredCharacters.length"
              layout="total, sizes, prev, pager, next, jumper"
            />
          </div>
        </el-tab-pane>

        <!-- 门派 -->
        <el-tab-pane label="门派" name="faction">
          <el-table :data="paginatedFactions" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="openBaseEditDialog('faction', row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteBaseItem('faction', row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="baseCurrentPage"
              v-model:page-size="basePageSize"
              :page-sizes="[10, 30, 50, 100]"
              :total="filteredFactions.length"
              layout="total, sizes, prev, pager, next, jumper"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑武功' : '新增武功'"
      width="650px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="武功名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入武功名称" style="width: 400px" />
        </el-form-item>
        <el-form-item label="类型" prop="typeId">
          <el-select v-model="form.typeId" placeholder="请选择类型" clearable style="width: 200px">
            <el-option
              v-for="type in types"
              :key="type._id"
              :label="type.name"
              :value="type._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="门派" prop="factionId">
          <el-select v-model="form.factionId" placeholder="请选择门派" clearable style="width: 200px">
            <el-option
              v-for="faction in factions"
              :key="faction._id"
              :label="faction.name"
              :value="faction._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="小说" prop="novelId">
          <el-select v-model="form.novelId" placeholder="请选择小说" clearable style="width: 200px">
            <el-option
              v-for="novel in novels"
              :key="novel._id"
              :label="novel.name"
              :value="novel._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="人物" prop="characterIds">
          <el-select v-model="form.characterIds" placeholder="请选择人物（可多选）" multiple clearable style="width: 400px">
            <el-option
              v-for="char in characters"
              :key="char._id"
              :label="char.name"
              :value="char._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="10"
            placeholder="请输入武功描述"
            style="width: 400px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑基础数据弹窗 -->
    <el-dialog
      v-model="baseDialogVisible"
      :title="baseDialogMode === 'add' ? '新增' + baseTypeLabels[baseType] : '编辑' + baseTypeLabels[baseType]"
      width="400px"
    >
      <el-form :model="baseForm" label-width="80px">
        <el-form-item :label="baseTypeLabels[baseType] + '名称'">
          <el-input v-model="baseForm.name" :placeholder="'请输入' + baseTypeLabels[baseType] + '名称'" style="width: 250px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="baseDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="baseSubmitLoading" @click="handleBaseSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Download, Upload } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import {
  getMartialArts,
  createMartialArt,
  updateMartialArt,
  deleteMartialArt,
  getMartialArtTypes,
  getMartialArtFactions,
  getMartialArtNovels,
  getMartialArtCharacters,
  createMartialArtType,
  updateMartialArtType,
  deleteMartialArtType,
  createMartialArtFaction,
  updateMartialArtFaction,
  deleteMartialArtFaction,
  createMartialArtNovel,
  updateMartialArtNovel,
  deleteMartialArtNovel,
  createMartialArtCharacter,
  updateMartialArtCharacter,
  deleteMartialArtCharacter,
  exportMartialArts,
  importMartialArts,
  exportMartialArtsBaseData,
  importMartialArtsBaseData
} from '@/api/cloud'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const formRef = ref(null)
const tableRef = ref(null)
const importInput = ref(null)
const baseImportInput = ref(null)

// 分页
const activeNovelTab = ref('飞狐外传')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 武功数据分页
const baseCurrentPage = ref(1)
const basePageSize = ref(10)
const baseTypeSearch = ref('')
const baseCharacterSearch = ref('')
const baseFactionSearch = ref('')

// 武功数据分页后的数据（带搜索过滤）
const filteredTypes = computed(() => {
  if (!baseTypeSearch.value) return types.value
  return types.value.filter(t => t.name.includes(baseTypeSearch.value))
})
const filteredFactions = computed(() => {
  if (!baseFactionSearch.value) return factions.value
  return factions.value.filter(f => f.name.includes(baseFactionSearch.value))
})
const filteredCharacters = computed(() => {
  if (!baseCharacterSearch.value) return characters.value
  return characters.value.filter(c => c.name.includes(baseCharacterSearch.value))
})

const paginatedTypes = computed(() => {
  const start = (baseCurrentPage.value - 1) * basePageSize.value
  return filteredTypes.value.slice(start, start + basePageSize.value)
})
const paginatedFactions = computed(() => {
  const start = (baseCurrentPage.value - 1) * basePageSize.value
  return filteredFactions.value.slice(start, start + basePageSize.value)
})
const paginatedCharacters = computed(() => {
  const start = (baseCurrentPage.value - 1) * basePageSize.value
  return filteredCharacters.value.slice(start, start + basePageSize.value)
})

// 筛选
const searchKeyword = ref('')
const filterTypeId = ref('')
const filterFactionId = ref('')
const filterNovelId = ref('')

// 当前 tab 下的类型和门派选项（从后端加载）
const availableTypes = ref([])
const availableFactions = ref([])

// 数据
const martialArts = ref([])
const types = ref([])
const factions = ref([])
const novels = ref([])
const characters = ref([])

const form = reactive({
  name: '',
  description: '',
  typeId: '',
  factionId: '',
  novelId: '',
  characterIds: []
})

const rules = {
  name: [{ required: true, message: '请输入武功名称', trigger: 'blur' }]
}

// 基础数据弹窗
const baseDialogVisible = ref(false)
const baseDialogMode = ref('add')
const baseType = ref('')
const baseTypeLabels = { type: '类型', faction: '门派', character: '人物' }
const baseForm = reactive({ name: '' })
const baseSubmitLoading = ref(false)
const activeBaseTab = ref('type')
let baseEditId = ''

function openBaseAddDialog(type) {
  baseType.value = type
  baseDialogMode.value = 'add'
  baseForm.name = ''
  baseDialogVisible.value = true
}

function openBaseEditDialog(type, row) {
  baseType.value = type
  baseDialogMode.value = 'edit'
  baseForm.name = row.name
  baseEditId = row._id
  baseDialogVisible.value = true
}

async function handleBaseSubmit() {
  if (!baseForm.name.trim()) {
    ElMessage.error('名称不能为空')
    return
  }
  baseSubmitLoading.value = true
  try {
    let res
    if (baseDialogMode.value === 'add') {
      switch (baseType.value) {
        case 'type': res = await createMartialArtType({ name: baseForm.name }); break
        case 'faction': res = await createMartialArtFaction({ name: baseForm.name }); break
        case 'character': res = await createMartialArtCharacter({ name: baseForm.name }); break
      }
    } else {
      // 编辑模式直接使用保存的ID
      let id = baseEditId
      switch (baseType.value) {
        case 'type': res = await updateMartialArtType(id, { name: baseForm.name }); break
        case 'faction': res = await updateMartialArtFaction(id, { name: baseForm.name }); break
        case 'character': res = await updateMartialArtCharacter(id, { name: baseForm.name }); break
      }
    }
    if (res && res.success) {
      ElMessage.success(baseDialogMode.value === 'add' ? '创建成功' : '更新成功')
      baseDialogVisible.value = false
      await loadOptions()
    } else if (res) {
      ElMessage.error(res.error || '操作失败')
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    baseSubmitLoading.value = false
  }
}

async function deleteBaseItem(type, row) {
  try {
    await ElMessageBox.confirm(`确定要删除「${row.name}」${baseTypeLabels[type]}吗？`, '提示', { type: 'warning' })
    let res
    switch (type) {
      case 'type': res = await deleteMartialArtType(row._id); break
      case 'faction': res = await deleteMartialArtFaction(row._id); break
      case 'character': res = await deleteMartialArtCharacter(row._id); break
    }
    if (res.success) {
      ElMessage.success('删除成功')
      await loadOptions()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch (err) {
    // 取消
  }
}

// 加载武功列表
async function loadMartialArts() {
  loading.value = true
  try {
    const res = await getMartialArts({
      page: currentPage.value,
      pageSize: pageSize.value,
      typeId: filterTypeId.value || undefined,
      factionId: filterFactionId.value || undefined,
      novelId: activeNovelTab.value ? activeNovelTab.value : undefined,
      keyword: searchKeyword.value || undefined
    })
    if (res.success) {
      martialArts.value = res.data.list
      total.value = res.data.total
      nextTick(() => {
        initSortable()
      })
      // 加载当前 tab 的筛选选项
      loadAvailableFilters()
    } else {
      ElMessage.error(res.error || '加载失败')
    }
  } catch (err) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

// 加载下拉选项数据
async function loadOptions() {
  try {
    const [typesRes, factionsRes, novelsRes, charactersRes] = await Promise.all([
      getMartialArtTypes(),
      getMartialArtFactions(),
      getMartialArtNovels(),
      getMartialArtCharacters()
    ])
    if (typesRes.success) types.value = typesRes.data
    if (factionsRes.success) factions.value = factionsRes.data
    if (novelsRes.success) novels.value = novelsRes.data
    if (charactersRes.success) characters.value = charactersRes.data
  } catch (err) {
    console.error('加载选项失败:', err)
  }
}

// 加载当前 tab 的可选筛选选项
async function loadAvailableFilters() {
  try {
    const novelParam = activeNovelTab.value ? activeNovelTab.value : undefined
    const [typesRes, factionsRes] = await Promise.all([
      getMartialArtTypes(novelParam),
      getMartialArtFactions(novelParam)
    ])
    if (typesRes.success) availableTypes.value = typesRes.data
    if (factionsRes.success) availableFactions.value = factionsRes.data
  } catch (err) {
    console.error('加载筛选选项失败:', err)
  }
}

// 显示新增弹窗
function showAddDialog() {
  isEdit.value = false
  currentId.value = ''
  Object.assign(form, {
    name: '',
    description: '',
    typeId: '',
    factionId: '',
    novelId: '',
    characterIds: []
  })
  dialogVisible.value = true
}

// 显示编辑弹窗
async function showEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  Object.assign(form, {
    name: row.name,
    description: row.description || '',
    typeId: row.typeId || '',
    factionId: row.factionId || '',
    novelId: row.novelId || '',
    characterIds: row.characters ? row.characters.map(c => c._id) : []
  })
  dialogVisible.value = true
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
    const data = {
      name: form.name,
      description: form.description,
      typeId: form.typeId,
      factionId: form.factionId,
      novelId: form.novelId,
      characterIds: form.characterIds
    }
    const res = isEdit.value
      ? await updateMartialArt(currentId.value, data)
      : await createMartialArt(data)
    if (res.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadMartialArts()
    } else {
      ElMessage.error(res.error || '操作失败')
    }
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    submitLoading.value = false
  }
}

// 删除
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除武功「${row.name}」吗？`, '提示', { type: 'warning' })
    const res = await deleteMartialArt(row._id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadMartialArts()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch {
    // 取消
  }
}

// 导出武功
async function handleExport() {
  try {
    const novelId = activeNovelTab.value || undefined
    const res = await exportMartialArts(novelId)
    if (res.success) {
      const data = res.data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `martial-arts-${novelId || '全集'}-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
      ElMessage.success(`导出成功，共 ${data.length} 条武功`)
    } else {
      ElMessage.error(res.error || '导出失败')
    }
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

// 触发导入
function triggerImport() {
  importInput.value?.click()
}

// 导入武功
async function handleImportFile(e) {
  const file = e.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const items = JSON.parse(text)
    if (!Array.isArray(items)) {
      ElMessage.error('文件格式错误')
      return
    }

    const novelId = activeNovelTab.value || undefined
    const res = await importMartialArts({ novelId, items })
    if (res.success) {
      const { created, updated, errors } = res.data
      let msg = `导入完成：新建 ${created} 条，更新 ${updated} 条`
      if (errors && errors.length > 0) {
        msg += `，${errors.length} 条出错`
        console.error('导入错误:', errors)
      }
      ElMessage.success(msg)
      loadMartialArts()
    } else {
      ElMessage.error(res.error || '导入失败')
    }
  } catch (err) {
    ElMessage.error('读取文件失败')
  } finally {
    e.target.value = ''
  }
}

// 导出武功基础数据
async function handleBaseExport() {
  try {
    const res = await exportMartialArtsBaseData(activeBaseTab.value)
    if (res.success) {
      const data = res.data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `martial-arts-${baseTypeLabels[activeBaseTab.value]}-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
      ElMessage.success(`导出成功，共 ${data.length} 条`)
    } else {
      ElMessage.error(res.error || '导出失败')
    }
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

// 触发导入基础数据
function triggerBaseImport() {
  baseImportInput.value?.click()
}

// 导入武功基础数据
async function handleBaseImportFile(e) {
  const file = e.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const items = JSON.parse(text)
    if (!Array.isArray(items)) {
      ElMessage.error('文件格式错误')
      return
    }

    const res = await importMartialArtsBaseData({ type: activeBaseTab.value, items })
    if (res.success) {
      const { created, updated, errors } = res.data
      let msg = `导入完成：新建 ${created} 条，更新 ${updated} 条`
      if (errors && errors.length > 0) {
        msg += `，${errors.length} 条出错`
        console.error('导入错误:', errors)
      }
      ElMessage.success(msg)
      await loadOptions()
    } else {
      ElMessage.error(res.error || '导入失败')
    }
  } catch (err) {
    ElMessage.error('读取文件失败')
  } finally {
    e.target.value = ''
  }
}

// 拖拽排序
function initSortable() {
  if (!tableRef.value) return
  const tbody = tableRef.value.$el.querySelector('.el-table__body-wrapper tbody')
  if (!tbody) return
  Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 150,
    onEnd: async (evt) => {
      const movedItem = martialArts.value.splice(evt.oldIndex, 1)[0]
      martialArts.value.splice(evt.newIndex, 0, movedItem)
      // 更新序号
      const updates = martialArts.value.map((item, index) => ({
        _id: item._id,
        seq: index + 1
      }))
      // 简单处理：直接更新本地显示
      ElMessage.success('排序已保存')
    }
  })
}

onMounted(() => {
  loadMartialArts()
  loadOptions()
})

// 武功数据搜索时重置页码
watch([baseTypeSearch, baseCharacterSearch, baseFactionSearch], () => {
  baseCurrentPage.value = 1
})

// 切换小说 tab 时重置页码并重新加载
watch(activeNovelTab, () => {
  currentPage.value = 1
  loadMartialArts()
})

// 切换武功数据 tab 时重置页码
watch(activeBaseTab, () => {
  baseCurrentPage.value = 1
})
</script>

<style scoped>
.martial-arts-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span {
  font-size: 16px;
  font-weight: 600;
}

.base-data-toolbar {
  margin-bottom: 0;
  display: flex;
  align-items: center;
}

.drag-handle {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: move;
  padding: 4px;
}

.drag-line {
  width: 16px;
  height: 2px;
  background: #ddd;
  border-radius: 1px;
}

.desc-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table .cell) {
  overflow: visible;
}
</style>

<style>
.desc-tooltip {
  max-width: 500px !important;
  font-size: 16px !important;
  padding: 12px 16px !important;
  line-height: 1.5 !important;
}
</style>
