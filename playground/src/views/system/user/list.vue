<script setup lang="ts">
import type { Kind, Option, Row } from '#/api/system/admin';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, Tree, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Alert, Button, Card, message, Modal, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  asTree,
  changeStatus,
  deleteRecord,
  getList,
  permission,
  unitOptions,
} from '#/api/system/admin';

import Grants from '../shared/grants.vue';
import Password from '../shared/password.vue';
import { searchSchema } from '../shared/schema';
import { useColumns } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const kind: Kind = 'users';
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
const [DetailDrawer, detailApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});
const [PasswordModal, passwordApi] = useVbenModal({
  connectedComponent: Password,
  destroyOnClose: true,
});

const unitList = ref<Option[]>([]);
const selectedUnit = ref<string>('');
const unitTree = computed(() => asTree(unitList.value));
onMounted(async () => {
  if (queryAllowed.value) unitList.value = await unitOptions();
});
function selectUnit(node: any) {
  selectedUnit.value = String(node.value?.id ?? '');
  refresh();
}

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
            unitId: selectedUnit.value,
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
  formApi.setData({ unitId: selectedUnit.value || undefined }).open();
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
    content: `确认${row.locked ? '解锁' : '锁定'}${row.name || row.username}？`,
    async onOk() {
      await changeStatus(kind, row);
      refresh();
    },
  });
}
function actions(row: Row) {
  return [
    {
      text: '详情',
      icon: 'lucide:eye',
      auth: [permission(kind, 'query', row)],
      onClick: () => detailApi.setData(row).open(),
    },
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
      text: '分配角色',
      icon: 'lucide:users',
      auth: ['platform:user:assign-role'],
      ifShow: !row.administrator,
      onClick: () => grantsApi.setData({ kind: 'users', row }).open(),
    },
    {
      text: '重置密码',
      icon: 'lucide:key-round',
      auth: ['platform:user:reset-password'],
      ifShow: !row.administrator || row.id === users.userInfo?.userId,
      onClick: () => passwordApi.setData(row).open(),
    },
    {
      text: row.locked ? '解锁' : '锁定',
      icon: 'lucide:power',
      auth: [permission(kind, 'lock', row)],
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
    <DetailDrawer /><PasswordModal @success="refresh" />
    <Alert
      v-if="!queryAllowed"
      class="mb-4"
      type="info"
      message="当前账号拥有菜单访问权限，但尚未授予查询权限。"
    />
    <div class="flex size-full gap-4">
      <Card class="w-1/5 min-w-48">
        <Button
          type="link"
          @click="
            selectedUnit = '';
            refresh();
          "
        >
          全部单位
</Button><Tree
          :tree-data="unitTree"
          value-field="id"
          label-field="name"
          :default-expanded-level="2"
          :show-toolbar="false"
          @select="selectUnit"
        />
      </Card>
      <div class="min-w-0 flex-1">
        <Grid table-title="用户管理">
          <template #toolbar-tools>
            <Button v-if="createAllowed" type="primary" @click="create">
              <Plus class="size-5" />新增用户
            </Button>
          </template>
          <template #state="{ row }">
            <Tag :color="row.locked ? 'error' : 'success'">
              {{ row.locked ? '锁定' : '正常' }}
            </Tag>
          </template>
          <template #action="{ row }">
            <VbenTableAction
              :actions="actions(row as Row)"
              :dropdown-actions="more(row as Row)"
            />
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
