<script setup lang="ts">
import type { Kind, Row } from '#/api/system/admin';

import { computed } from 'vue';

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

import Grants from '../shared/grants.vue';
import { searchSchema } from '../shared/schema';
import { useColumns } from './data';
import Form from './modules/form.vue';

const kind: Kind = 'roles';
const { hasAccessByCodes: canCodes } = useAccess();
const users = useUserStore();
const can = (code: string) => canCodes([code]);
const queryAllowed = computed(() => can(permission(kind, 'query')));
const createAllowed = computed(() => can(permission(kind, 'add')));
const [FormDrawer, formApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [GrantsDrawer, grantsApi] = useVbenDrawer({
  connectedComponent: Grants,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema(kind), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    rowConfig: { keyField: 'id' },

    proxyConfig: {
      ajax: {
        query: async (
          { page }: { page: { currentPage: number; pageSize: number } },
          values: Record<string, unknown>,
        ) => {
          if (!queryAllowed.value) return { items: [], total: 0 };
          return getList(kind, {
            ...values,
            page: page.currentPage,
            size: Math.min(page.pageSize, 200),
          });
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
    {
      text: '授权',
      icon: 'lucide:shield-check',
      ifShow: can('platform:role:authorize') || can('platform:role:units'),
      onClick: () => grantsApi.setData({ kind: 'roles', row }).open(),
    },
  ];
}
function more(row: Row) {
  return [
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
    <FormDrawer @success="refresh" /><GrantsDrawer @success="refresh" />

    <Alert
      v-if="!queryAllowed"
      class="mb-4"
      type="info"
      message="当前账号拥有菜单访问权限，但尚未授予查询权限。"
    />

    <Grid table-title="角色管理">
      <template #toolbar-tools>
        <Button v-if="createAllowed" type="primary" @click="create">
          <Plus class="size-5" />新增角色
        </Button>
      </template>
      <template #state="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? '有效' : '无效' }}
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
