<script setup lang="ts">
import type { CodeRule } from '#/api/system/code-rule';

import { computed } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Alert, Button, message } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  codeRulePermission,
  deleteCodeRule,
  getCodeRules,
} from '#/api/system/code-rule';

import { columns, searchSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();
const can = (action: string) => hasAccessByCodes([codeRulePermission(action)]);
const queryAllowed = computed(() => can('query'));
const [FormDrawer, formApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [DetailDrawer, detailApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema, submitOnChange: true },
  gridOptions: {
    columns: columns(),
    height: 'auto',
    rowConfig: { keyField: 'id' },
    proxyConfig: {
      ajax: {
        query: async (
          { page }: { page: { currentPage: number; pageSize: number } },
          values: Record<string, unknown>,
        ) =>
          queryAllowed.value
            ? getCodeRules({
                ...values,
                page: page.currentPage,
                size: Math.min(page.pageSize, 200),
              })
            : { items: [], total: 0 },
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
async function remove(row: CodeRule) {
  try {
    await deleteCodeRule(row);
    message.success('已删除');
  } catch {
    // 取号可能使删除版本过期；请求层已提示原因，刷新后展示真实进度。
  } finally {
    void gridApi.query();
  }
}
function actions(row: CodeRule) {
  return [
    {
      text: '详情',
      auth: [codeRulePermission('query')],
      onClick: () => detailApi.setData(row).open(),
    },
    {
      text: '编辑',
      icon: 'lucide:edit',
      auth: [codeRulePermission('edit')],
      onClick: () => formApi.setData(row).open(),
    },
  ];
}
function more(row: CodeRule) {
  return [
    {
      text: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: [codeRulePermission('delete')],
      ifShow: row.currentSequence === '0',
      popConfirm: {
        title: `确认删除 ${row.name}？`,
        confirm: () => remove(row),
      },
    },
  ];
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="reloadAfterSave" /><DetailDrawer />
    <Alert
      v-if="!queryAllowed"
      class="mb-4"
      type="info"
      message="当前账号拥有菜单访问权限，但尚未授予查询权限。"
    />
    <Grid table-title="编码管理">
      <template #toolbar-tools>
        <Button
          v-if="can('add')"
          type="primary"
          @click="formApi.setData({}).open()"
        >
          <Plus class="size-5" />新增规则
        </Button>
      </template>
      <template #progress="{ row }">
        <span class="font-mono tabular-nums">{{ row.currentSerial }}</span><span
          v-if="row.currentSequence === '0'"
          class="text-muted-foreground ml-2"
          >未发号</span>
      </template>
      <template #action="{ row }">
        <VbenTableAction
          :actions="actions(row as CodeRule)"
          :dropdown-actions="more(row as CodeRule)"
        />
      </template>
    </Grid>
  </Page>
</template>
