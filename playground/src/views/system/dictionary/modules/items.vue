<script setup lang="ts">
import type { Dictionary, DictionaryItem } from '#/api/system/dictionary';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Alert, Button, message } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteDictionaryItem,
  exportDictionaryItems,
  getDictionaryItems,
  itemPermission,
} from '#/api/system/dictionary';

import { searchSchema } from '../schema';
import Form from './form.vue';

const props = defineProps<{ dictionary: Dictionary }>();
const { hasAccessByCodes } = useAccess();
const can = (action: string) => hasAccessByCodes([itemPermission(action)]);
const exporting = ref(false);
// 记录已提交的查询条件；表单尚未提交的输入不改变当前列表的导出范围。
let appliedFilters: Record<string, unknown> = {};
const queryAllowed = computed(() => can('query'));
const [FormDrawer, formApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid<DictionaryItem>({
  formOptions: {
    schema: searchSchema(true),
    wrapperClass: 'grid-cols-1',
    submitOnChange: false,
    showCollapseButton: false,
  },
  gridOptions: {
    height: 'auto',
    rowConfig: { keyField: 'id' },
    columns: [
      { field: 'label', title: '字典标签', minWidth: 120, align: 'left' },
      { field: 'value', title: '键值', minWidth: 90 },
      { field: 'sortOrder', title: '排序', width: 70 },
      { field: 'remark', title: '备注', minWidth: 120, align: 'left' },
      {
        field: 'createdAt',
        title: '创建时间',
        minWidth: 170,
        formatter: 'formatDateTime',
      },
      {
        title: '操作',
        width: 130,
        fixed: 'right',
        slots: { default: 'action' },
      },
    ],
    proxyConfig: {
      ajax: {
        query: async (
          { page }: { page: { currentPage: number; pageSize: number } },
          values: Record<string, unknown>,
        ) => {
          appliedFilters = { ...values };
          return queryAllowed.value
            ? getDictionaryItems(props.dictionary.id, {
                ...values,
                page: page.currentPage,
                size: Math.min(page.pageSize, 200),
              })
            : { items: [], total: 0 };
        },
      },
    },
    toolbarConfig: { refresh: true, search: true, export: false, custom: true },
  },
});
async function exportRows() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    await exportDictionaryItems(props.dictionary.id, appliedFilters);
  } catch {
    // 请求层已提示业务或网络错误，失败时不触发下载。
  } finally {
    exporting.value = false;
  }
}
function edit(row?: DictionaryItem) {
  formApi
    .setData({ kind: 'item', dictionaryId: props.dictionary.id, row })
    .open();
}
async function remove(row: DictionaryItem) {
  await deleteDictionaryItem(props.dictionary.id, row);
  message.success('已删除');
  await gridApi.query();
}
function actions(row: DictionaryItem) {
  return [
    { text: '编辑', auth: [itemPermission('edit')], onClick: () => edit(row) },
    {
      text: '删除',
      auth: [itemPermission('delete')],
      danger: true,
      popConfirm: {
        okText: '确定',
        cancelText: '取消',
        title: `确认删除 ${row.label}？`,
        confirm: () => remove(row),
      },
    },
  ];
}
</script>
<template>
  <div class="flex h-full min-h-0 flex-col">
    <FormDrawer @success="() => gridApi.reload()" />
    <Alert
      v-if="!queryAllowed"
      type="info"
      message="当前账号尚未授予字典项查询权限。"
    />
    <Grid
      class="min-h-0 flex-1"
      :table-title="`字典项 · ${dictionary.name}`"
      :table-title-help="dictionary.type"
    >
      <template #toolbar-tools>
        <Button v-if="can('export')" :loading="exporting" @click="exportRows">
          导出字典项
        </Button>
        <Button v-if="can('add')" type="primary" @click="() => edit()">
          <Plus class="size-4" />新增字典项
        </Button>
      </template>
      <template #action="{ row }">
        <VbenTableAction :actions="actions(row)" />
      </template>
    </Grid>
  </div>
</template>
