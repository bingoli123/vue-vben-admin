<script setup lang="ts">
import type { Kind, Row } from '#/api/system/admin';
import type { DictionaryOption } from '#/api/system/dictionary-options';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Alert, Button, message, Modal, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  changeStatus,
  deleteRecord,
  getList,
  permission,
} from '#/api/system/admin';
import {
  dictionaryLabel,
  getDictionaryOptions,
  UNIT_CATEGORY_DICTIONARY,
} from '#/api/system/dictionary-options';

import { dictionaryField } from '../shared/schema';
import { useColumns } from './data';
import { filterUnitsByCategory } from './filter';
import Form from './modules/form.vue';

const dictionaryOptions = ref<DictionaryOption[]>([]);
const kind: Kind = 'units';
const { hasAccessByCodes: canCodes } = useAccess();
const users = useUserStore();
const can = (code: string) => canCodes([code]);
const queryAllowed = computed(() => can(permission(kind, 'query')));
const createAllowed = computed(() => can(permission(kind, 'add')));
const [FormDrawer, formApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: [
      dictionaryField('category', '单位类别', UNIT_CATEGORY_DICTIONARY, true),
    ],
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    rowConfig: { keyField: 'id' },
    pagerConfig: { enabled: false },
    treeConfig: {
      transform: true,
      rowField: 'id',
      parentField: 'parentId',
      expandAll: true,
    },
    proxyConfig: {
      ajax: {
        query: async (_params: unknown, values: Record<string, unknown>) => {
          if (!queryAllowed.value) return [];
          const dictionary = await getDictionaryOptions(
            UNIT_CATEGORY_DICTIONARY,
          );
          dictionaryOptions.value = dictionary.items;
          const rows = await getList(kind, {});
          return Array.isArray(rows)
            ? filterUnitsByCategory(rows, values.category)
            : [];
        },
      },
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  },
});
function reloadAfterSave() {
  void gridApi.reload();
}
function refresh() {
  void gridApi.query();
}
function create() {
  formApi.setData({}).open();
}
function edit(row: Row) {
  formApi.setData(row).open();
}
async function remove(row: Row) {
  await deleteRecord(kind, row);
  message.success('已删除');
  refresh();
}
function toggle(row: Row) {
  Modal.confirm({
    title: '修改状态',
    content: `确认${row.enabled ? '停用' : '启用'}${row.name || row.username}？`,
    async onOk() {
      await changeStatus(kind, row);
      refresh();
    },
  });
}
function actions(row: Row) {
  return [
    {
      text: '编辑',
      icon: 'lucide:edit',
      auth: [permission(kind, 'edit', row)],
      ifShow: !row.administrator || row.id === users.userInfo?.userId,
      onClick: () => edit(row),
    },
  ];
}
function more(row: Row) {
  return [
    {
      text: '新增下级',
      icon: 'lucide:folder-plus',
      auth: [permission(kind, 'add')],
      onClick: () => formApi.setData({ parentId: row.id }).open(),
    },
    {
      text: row.enabled ? '停用' : '启用',
      icon: 'lucide:power',
      auth: [permission(kind, 'status', row)],
      ifShow: !row.administrator,
      onClick: () => toggle(row),
    },
    {
      text: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: [permission(kind, 'delete', row)],
      ifShow: !row.administrator,
      popConfirm: {
        title: `确认删除 ${row.name || row.username}？`,
        confirm: () => remove(row),
      },
    },
  ];
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="reloadAfterSave" />

    <Alert
      v-if="!queryAllowed"
      class="mb-4"
      type="info"
      message="当前账号拥有菜单访问权限，但尚未授予查询权限。"
    />

    <Grid table-title="单位管理">
      <template #toolbar-tools>
        <Button v-if="createAllowed" type="primary" @click="create">
          <Plus class="size-5" />新增单位
        </Button>
      </template>
      <template #category="{ row }">
        {{ dictionaryLabel(dictionaryOptions, row.category) }}
      </template>
      <template #state="{ row }">
        <Tag :color="row.enabled ? 'success' : 'error'">
          {{ row.enabled ? '已启用' : '已禁用' }}
        </Tag>
      </template>
      <template #action="{ row }">
        <VbenTableAction
          :actions="actions(row as Row)"
          :dropdown-actions="more(row as Row)"
        />
      </template>
    </Grid>
  </Page>
</template>
