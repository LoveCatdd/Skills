<template>
  <div class="app-container">
    <!-- 搜索表单 -->
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="auto">
{{SEARCH_FORM_ITEMS}}
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 工具栏 -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['{{PERM_PREFIX}}:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate" v-hasPermi="['{{PERM_PREFIX}}:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['{{PERM_PREFIX}}:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['{{PERM_PREFIX}}:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <!-- 表格 -->
    <el-table v-loading="loading" :data="{{LIST_VAR}}" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
{{TABLE_COLUMNS}}
      <el-table-column label="操作" align="center" width="180" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['{{PERM_PREFIX}}:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['{{PERM_PREFIX}}:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加/修改对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
{{DIALOG_FORM_ITEMS}}
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="{{VIEW_NAME}}">
import { {{LIST_API}}, {{GET_API}}, {{ADD_API}}, {{UPDATE_API}}, {{DEL_API}} } from '@/api/{{API_MODULE}}'
import { getCurrentInstance, ref, reactive } from 'vue'

const { proxy } = getCurrentInstance()
{{DICT_IMPORTS}}

const loading = ref(true)
const showSearch = ref(true)
const {{LIST_VAR}} = ref([])
const total = ref(0)
const open = ref(false)
const title = ref('')
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const dateRange = ref([])

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10{{QUERY_FIELDS}}
  }
})
const { form, queryParams } = toRefs(data)

const rules = ref({
{{RULES}}
})

/** 查询列表 */
function getList() {
  loading.value = true
  {{LIST_API}}(proxy.addDateRange(queryParams.value, dateRange.value)).then(response => {
    {{LIST_VAR}}.value = response.rows
    total.value = response.total
    loading.value = false
  })
}

/** 搜索 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置 */
function resetQuery() {
  dateRange.value = []
  proxy.resetForm('queryRef')
  handleQuery()
}

/** 多选 */
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.{{PK_FIELD}})
  single.value = selection.length !== 1
  multiple.value = !selection.length
}

/** 新增 */
function handleAdd() {
  reset()
  open.value = true
  title.value = '新增{{TABLE_COMMENT}}'
}

/** 修改 */
function handleUpdate(row) {
  reset()
  const {{PK_FIELD}} = row.{{PK_FIELD}} || ids.value
  {{GET_API}}({{PK_FIELD}}).then(response => {
    form.value = response.data
    open.value = true
    title.value = '修改{{TABLE_COMMENT}}'
  })
}

/** 提交 */
function submitForm() {
  proxy.$refs['formRef'].validate(valid => {
    if (valid) {
      if (form.value.{{PK_FIELD}} != null) {
        {{UPDATE_API}}(form.value).then(() => {
          proxy.$modal.msgSuccess('修改成功')
          open.value = false
          getList()
        })
      } else {
        {{ADD_API}}(form.value).then(() => {
          proxy.$modal.msgSuccess('新增成功')
          open.value = false
          getList()
        })
      }
    }
  })
}

/** 删除 */
function handleDelete(row) {
  const {{PK_FIELD}}s = row.{{PK_FIELD}} || ids.value
  proxy.$modal.confirm('是否确认删除?').then(() => {
    return {{DEL_API}}({{PK_FIELD}}s)
  }).then(() => {
    getList()
    proxy.$modal.msgSuccess('删除成功')
  })
}

/** 导出 */
function handleExport() {
  proxy.download('{{API_PATH}}/export', {
    ...queryParams.value
  }, `{{TABLE_COMMENT}}_${new Date().getTime()}.xlsx`)
}

/** 取消 */
function cancel() {
  open.value = false
  reset()
}

/** 重置表单 */
function reset() {
  form.value = {
{{FORM_RESET}}
  }
  proxy.resetForm('formRef')
}

getList()
</script>

<style lang="scss" scoped>
</style>
