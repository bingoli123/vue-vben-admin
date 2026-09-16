<script setup lang="ts">
import type { OperationLog } from '#/api/system/operation-log';

import { computed } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';

import { Alert, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  getOperationLogs,
  logQueryParams,
  logQueryPermission,
} from '#/api/system/operation-log';

import { searchSchema, useColumns } from './data';
import Detail from './modules/detail.vue';

const { hasAccessByCodes } = useAccess();
const queryAllowed = computed(() => hasAccessByCodes([logQueryPermission]));
const [DetailDrawer, detailApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});
const [Grid] = useVbenVxeGrid({
  formOptions: {
    schema: searchSchema(),
    submitOnChange: false,
    collapsed: false,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    rowConfig: { keyField: 'id' },
    proxyConfig: {
      ajax: {
        query: async (
          { page }: { page: { currentPage: number; pageSize: number } },
          values: Record<string, unknown>,
        ) => {
          if (!queryAllowed.value) return { items: [], total: 0 };
          return getOperationLogs(
            logQueryParams(values, page.currentPage, page.pageSize),
          );
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
function actions(row: OperationLog) {
  return [
    {
      text: '详情',
      icon: 'lucide:eye',
      auth: [logQueryPermission],
      onClick: () => detailApi.setData(row).open(),
    },
  ];
}
</script>
<template>
  <Page auto-content-height>
    <DetailDrawer />
    <Alert
      v-if="!queryAllowed"
      class="mb-4"
      type="info"
      message="当前账号拥有菜单访问权限，但尚未授予日志查询权限。"
    />
    <Grid v-else table-title="操作日志">
      <template #state="{ row }">
<Tag :color="row.status === 'SUCCESS' ? 'success' : 'error'">
{{
          row.status === 'SUCCESS' ? '成功' : '失败'
        }}
</Tag>
</template>
      <template #action="{ row }">
<VbenTableAction :actions="actions(row as OperationLog)" />
</template>
    </Grid>
  </Page>
</template>
