<script setup lang="ts">
import type { Dictionary } from '#/api/system/dictionary';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Alert, Button, Empty, message } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteDictionary,
  dictionaryPermission,
  getDictionaries,
} from '#/api/system/dictionary';

import Form from './modules/form.vue';
import Items from './modules/items.vue';
import { searchSchema } from './schema';

const selected = ref<Dictionary>();
const { hasAccessByCodes } = useAccess();
const can = (action: string) =>
  hasAccessByCodes([dictionaryPermission(action)]);
const queryAllowed = computed(() => can('query'));
const [FormDrawer, formApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
let queryRevision = 0;
let latestPage: { items: Dictionary[]; total: number } = {
  items: [],
  total: 0,
};
const [Grid, gridApi] = useVbenVxeGrid<Dictionary>({
  formOptions: {
    schema: searchSchema(false),
    wrapperClass: 'grid-cols-1',
    submitOnChange: false,
    showCollapseButton: false,
  },
  gridOptions: {
    height: 'auto',
    rowConfig: { keyField: 'id' },
    rowClassName: ({ row }: { row: Dictionary }) =>
      row.id === selected.value?.id ? 'bg-primary/10' : '',
    columns: [
      { field: 'name', title: '字典名称', minWidth: 140, align: 'left' },
      {
        field: 'type',
        title: '字典类型',
        minWidth: 170,
        slots: { default: 'type' },
      },
      { field: 'remark', title: '备注', minWidth: 130, align: 'left' },
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
          const revision = ++queryRevision;
          const result = queryAllowed.value
            ? await getDictionaries({
                ...values,
                page: page.currentPage,
                size: Math.min(page.pageSize, 200),
              })
            : { items: [], total: 0 };
          // 搜索、分页或删除使选中行不可见时同步清空右侧；晚到的旧查询不覆盖当前选择。
          if (revision === queryRevision) {
            latestPage = result;
            if (selected.value)
              selected.value = result.items.find(
                (row) => row.id === selected.value?.id,
              );
          }
          return latestPage;
        },
      },
    },
    toolbarConfig: { refresh: true, search: true, export: false, custom: true },
  },
});
function edit(row?: Dictionary) {
  formApi.setData({ kind: 'dictionary', row }).open();
}
async function remove(row: Dictionary) {
  await deleteDictionary(row);
  if (selected.value?.id === row.id) selected.value = undefined;
  message.success('已删除');
  await gridApi.query();
}
function actions(row: Dictionary) {
  return [
    {
      text: '编辑',
      auth: [dictionaryPermission('edit')],
      onClick: () => edit(row),
    },
    {
      text: '删除',
      auth: [dictionaryPermission('delete')],
      danger: true,
      popConfirm: {
        okText: '确定',
        cancelText: '取消',
        title: `确认删除 ${row.name} 及其字典项？`,
        confirm: () => remove(row),
      },
    },
  ];
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="() => gridApi.reload()" />
    <div class="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <section
        data-testid="dictionary-list"
        class="flex min-h-100 min-w-0 flex-col xl:min-h-0"
      >
        <Alert
          v-if="!queryAllowed"
          type="info"
          message="当前账号拥有菜单访问权限，但尚未授予字典查询权限。"
        />
        <Grid
          class="min-h-0 flex-1"
          table-title="数据字典"
          table-title-help="点击字典类型维护右侧字典项"
        >
          <template #toolbar-tools>
            <Button v-if="can('add')" type="primary" @click="() => edit()">
              <Plus class="size-4" />新增字典
            </Button>
          </template>
          <template #type="{ row }">
            <Button
              type="link"
              :aria-pressed="selected?.id === row.id"
              @click="selected = row"
            >
              {{ row.type }}
            </Button>
          </template>
          <template #action="{ row }">
            <VbenTableAction :actions="actions(row)" />
          </template>
        </Grid>
      </section>
      <section
        data-testid="dictionary-items"
        class="min-h-100 min-w-0 xl:min-h-0"
      >
        <!-- 切换父字典时销毁旧表单、分页与请求状态，防止串到另一组字典项。 -->
        <Items v-if="selected" :key="selected.id" :dictionary="selected" />
        <div
          v-else
          class="bg-card flex h-full min-h-100 items-center justify-center rounded-lg border"
        >
          <Empty description="请选择左侧字典" />
        </div>
      </section>
    </div>
  </Page>
</template>
