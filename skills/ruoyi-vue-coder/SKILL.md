---
name: ruoyi-vue-coder
description: Use when developing or modifying Vue 3 frontend code in this RuoYi-Vue based project. Covers view/list page patterns, API layer, Pinia stores, route registration, dictionary usage, permission directives (v-hasPermi/v-hasRole), and component conventions. Trigger when the user asks to add new pages, modify existing views, or create frontend modules in expert-management-system-web-pc.
---

# RuoYi Vue 3 Development - Expert Management Platform

## Project Context

This is a customized RuoYi-Vue v3.8.7 frontend for the Expert Management System.

### Tech Stack

```js
{
  "name": "",
  "version": "2.1.0514",
  "description": "",
  "author": "",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build:prod": "vite build",
    "build:stage": "vite build --mode staging",
    "preview": "vite preview"
  },
  "repository": {
    "type": "git",
    "url": ""
  },
  "dependencies": {
    "@amap/amap-jsapi-loader": "^1.0.1",
    "@element-plus/icons-vue": "^2.3.2",
    "@vueup/vue-quill": "1.2.0",
    "@vueuse/core": "^14.1.0",
    "axios": "^1.13.6",
    "echarts": "^6.0.0",
    "element-plus": "^2.13.0",
    "file-saver": "2.0.5",
    "fuse.js": "^7.1.0",
    "js-cookie": "3.0.5",
    "jsencrypt": "^3.5.4",
    "lodash": "^4.17.23",
    "nprogress": "0.2.0",
    "pinia": "^3.0.4",
    "vue": "^3.5.26",
    "vue-cropper": "^1.1.4",
    "vue-router": "^4.6.4",
    "xlsx": ""
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.3",
    "fast-glob": "^3.3.3",
    "sass": "^1.97.1",
    "unplugin-auto-import": "^19.0.0",
    "unplugin-vue-setup-extend-plus": "^1.0.1",
    "vite": "^7.3.0",
    "vite-plugin-compression": "0.5.1",
    "vite-plugin-svg-icons": "^2.0.1"
  }
}

```



### Directory Structure

```
src/
├── api/           → API 接口层，按业务模块分目录
├── assets/        → 静态资源 (icons/images/styles/logo)
├── components/    → 全局组件 (Pagination/RightToolbar/FileUpload...)
├── directive/     → 自定义指令 (hasPermi/hasRole/copyText)
├── hooks/         → 组合式函数 (useRegionTree/useRetireWarn/useRoleStructs...)
├── layout/        → 布局组件
├── plugins/       → 全局插件 ($modal/$auth/$cache/$tab/$download)
├── router/        → 路由配置 (constantRoutes + dynamicRoutes)
├── store/         → Pinia 状态管理
├── utils/         → 工具函数 (request/auth/ruoyi/dict...)
└── views/         → 页面视图，按业务模块分目录
```

---

## Naming Conventions

| Layer          | Pattern                                  | Example                         |
| -------------- | ---------------------------------------- | ------------------------------- |
| API file       | camelCase, 按业务分目录                        | `src/api/project/expert.js`     |
| API function   | `verbNounApi` or `verbNoun`              | `getExpertListApi`, `addExpert` |
| View directory | kebab-case 按模块分                          | `views/project/expert/`         |
| View file      | index.vue (列表), edit.vue (编辑), camelCase for others | `index.vue`, `ExpertStats.vue`  |
| Store module   | camelCase                                | `user.js`, `permission.js`      |
| Hook           | `useXxx`                                 | `useRegionTree.js`              |
| Component      | PascalCase                               | `Pagination`, `RightToolbar`    |

---

## Standard List Page Pattern (index.vue)

Every CRUD list page follows this exact structure:

```vue
<template>
  <div class="app-container">
    <!-- Search Form -->
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
      label-width="auto"
    >
      <el-form-item label="..." prop="...">
        <el-input
          v-model="queryParams.xxx"
          placeholder="..."
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery"
          >搜索</el-button
        >
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- Toolbar -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Plus"
          @click="handleAdd"
          v-hasPermi="['xxx:xxx:add']"
          >新增</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <!-- Table -->
    <el-table
      v-loading="loading"
      :data="list"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="..." prop="..." />
      <el-table-column label="操作" align="center" fixed="right">
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['xxx:xxx:edit']"
            >修改</el-button
          >
          <el-button
            link
            type="danger"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['xxx:xxx:remove']"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- Add/Edit Dialog -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" />
        </el-form-item>
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

<script setup name="ModuleName">
import {
  listXxxApi,
  getXxxApi,
  addXxxApi,
  updateXxxApi,
  delXxxApi,
} from "@/api/xxx/xxx";
import { getCurrentInstance, ref, reactive, toRefs } from "vue";

const { proxy } = getCurrentInstance();
const { xxx_dict } = proxy.useDict("xxx_dict");

const loading = ref(true);
const showSearch = ref(true);
const list = ref([]);
const total = ref(0);
const open = ref(false);
const title = ref("");
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);

const queryParams = ref({ pageNum: 1, pageSize: 10 });
const form = ref({});
const rules = ref({
  name: [{ required: true, message: "不能为空", trigger: "blur" }],
});

function getList() {
  loading.value = true;
  listXxxApi(queryParams.value).then((res) => {
    list.value = res.rows;
    total.value = res.total;
    loading.value = false;
  });
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}
function resetQuery() {
  proxy.resetForm("queryRef");
  handleQuery();
}
function handleSelectionChange(selection) {
  ids.value = selection.map((i) => i.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}
function handleAdd() {
  reset();
  open.value = true;
  title.value = "新增";
}
function handleUpdate(row) {
  reset();
  getXxxApi(row.id).then((res) => {
    form.value = res.data;
    open.value = true;
    title.value = "修改";
  });
}
function handleDelete(row) {
  const delIds = row.id || ids.value;
  proxy.$modal.confirm("确认删除?").then(() =>
    delXxxApi(delIds).then(() => {
      getList();
      proxy.$modal.msgSuccess("删除成功");
    }),
  );
}
function submitForm() {
  proxy.$refs.formRef.validate((valid) => {
    if (valid) {
      const fn = form.value.id ? updateXxxApi : addXxxApi;
      fn(form.value.id ? form.value : form.value).then(() => {
        proxy.$modal.msgSuccess("操作成功");
        open.value = false;
        getList();
      });
    }
  });
}
function cancel() {
  open.value = false;
  reset();
}
function reset() {
  form.value = {};
  proxy.resetForm("formRef");
}

getList();
</script>

<style lang="scss" scoped>
.app-container {
  padding: 20px;
}
</style>
```

---

## API Pattern (src/api/)

```javascript
import request from "@/utils/request";

// List with pagination
export function listXxxApi(query) {
  return request({ url: "/xxx/list", method: "get", params: query });
}

// Get by ID
export function getXxxApi(id) {
  return request({ url: "/xxx/" + id, method: "get" });
}

// Create
export function addXxxApi(data) {
  return request({ url: "/xxx", method: "post", data });
}

// Update
export function updateXxxApi(data) {
  return request({ url: "/xxx", method: "put", data });
}

// Delete
export function delXxxApi(ids) {
  return request({ url: "/xxx/" + ids, method: "delete" });
}

// Export (blob response)
export function exportXxxApi(query) {
  return request({
    url: "/xxx/export",
    method: "post",
    params: query,
    responseType: "blob",
  });
}
```

---

## Route Registration

**Step 1:** Add route in `src/router/index.js` under `constantRoutes`:

```javascript
{
  path: '/xxx',
  component: Layout,
  redirect: '/xxx/index',
  meta: { title: '模块名', icon: 'svg-name' },
  children: [
    {
      path: 'index',
      component: () => import('@/views/xxx/index'),
      name: 'XxxIndex',
      meta: { title: '列表', icon: 'list' }
    }
  ]
}
```

**Step 2:** Insert menu record in `sys_menu` table on backend.

---

## Dictionary Usage

```javascript
// In <script setup>
const { proxy } = getCurrentInstance();
const { sys_normal_disable } = proxy.useDict("sys_normal_disable");

// In template: use as reactive ref
// <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
```

---

## Permission Directives

```html
<!-- Button-level: element removed if no permission -->
<el-button v-hasPermi="['system:user:add']">新增</el-button>

<!-- Role-level -->
<el-button v-hasRole="['admin']">管理员操作</el-button>
```

---

## Global Components (auto-registered in main.js)

| Component         | Usage                                    |
| ----------------- | ---------------------------------------- |
| `<pagination>`    | `v-show="total>0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList"` |
| `<right-toolbar>` | `v-model:showSearch="showSearch" @queryTable="getList"` |
| `<dict-tag>`      | `:options="dict_list" :value="row.status"` |
| `<file-upload>`   | `v-model="form.filePath"`                |
| `<image-upload>`  | `v-model="form.imageUrl"`                |
| `<image-preview>` | `:src="url"`                             |
| `<tree-select>`   | `v-model="form.parentId" :options="treeData"` |
| `<editor>`        | `v-model="form.content"`                 |

## Global Plugins (via proxy)

```javascript
const { proxy } = getCurrentInstance()
proxy.$modal.msgSuccess('操作成功')
proxy.$modal.msgError('操作失败')
proxy.$modal.confirm('确认?').then(...)
proxy.$modal.prompt('输入理由', '标题', { ... })
proxy.$auth.hasPermi('xxx:xxx:xxx')
proxy.$cache.session.setJSON('key', data)
proxy.$tab.closePage(view)
proxy.$download.excel(data, 'filename.xlsx')
```

---

## Store Pattern (Pinia)

```javascript
import { defineStore } from "pinia";

const useXxxStore = defineStore("xxx", {
  state: () => ({
    data: null,
  }),
  actions: {
    setData(val) {
      this.data = val;
    },
    async fetchData() {
      const res = await apiMethod();
      this.data = res.data;
    },
  },
});
export default useXxxStore;
```

---

## Key Imports Quick Reference

```javascript
import {
  getCurrentInstance,
  ref,
  reactive,
  toRefs,
  computed,
  onMounted,
  watch,
} from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getToken } from "@/utils/auth";
import request from "@/utils/request";

const router = useRouter();
const route = useRoute();
const { proxy } = getCurrentInstance();
```

---

## Verification Checklist

- [ ] View uses `<script setup name="...">` syntax
- [ ] Search form has `v-show="showSearch"` and `<right-toolbar>`
- [ ] Table has `v-loading="loading"` and `@selection-change`
- [ ] Pagination calls `@pagination="getList"`
- [ ] Write buttons have `v-hasPermi` directive
- [ ] Dialog has `append-to-body` and `:title="title"`
- [ ] `reset()` clears form and calls `proxy.resetForm('formRef')`
- [ ] Route registered in `router/index.js` under correct parent
- [ ] Menu record inserted in database `sys_menu`

---

## References

For complete file templates with `{{placeholder}}` variables:

| Template                          | Description                              |
| --------------------------------- | ---------------------------------------- |
| references/list-page-template.vue | Full CRUD list page (search + table + dialog + pagination) |
| references/api-template.js        | API module with list/get/add/update/delete/export |
| references/store-template.js      | Pinia store module                       |
