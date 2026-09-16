<script setup lang="ts">
import type { OperationLog } from '#/api/system/operation-log';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  exportOperationLogs,
  getOperationLogs,
  logPermission,
  logQueryParams,
  logQueryPermission,
} from '#/api/system/operation-log';

import { searchSchema, useColumns } from './data';
import Detail from './modules/detail.vue';

const { hasAccessByCodes } = useAccess();
const can = (action: string) => hasAccessByCodes([logPermission(action)]);
const exporting = ref(false);
const querying = ref(false);
let appliedFilters: Record<string, unknown> = {};
let queryRevision = 0;
let latestPage = { items: [] as OperationLog[], total: 0 };
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
          if (!queryAllowed.value) {
            appliedFilters = { ...values };
            return { items: [], total: 0 };
          }
          const revision = ++queryRevision;
          querying.value = true;
          try {
            const result = await getOperationLogs(
              logQueryParams(values, page.currentPage, page.pageSize),
            );
            if (revision === queryRevision) {
              latestPage = result;
              appliedFilters = { ...values };
            }
            return latestPage;
          } finally {
            if (revision === queryRevision) querying.value = false;
          }
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
async function exportRows() {
  if (exporting.value || querying.value) return;
  exporting.value = true;
  try {
    await exportOperationLogs(appliedFilters);
  } catch {
    /* 统一请求层已提示错误，失败时不下载文件。 */
  } finally {
    exporting.value = false;
  }
}
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
    <Grid table-title="操作日志">
      <template #toolbar-tools>
        <Button
          v-if="can('export')"
          :loading="exporting"
          :disabled="querying"
          @click="exportRows"
        >
          <IconifyIcon icon="lucide:download" class="size-4" />导出
        </Button>
      </template>
      <template #state="{ row }">
        <Tag :color="row.status === 'SUCCESS' ? 'success' : 'error'">
          {{ row.status === 'SUCCESS' ? '成功' : '失败' }}
        </Tag>
      </template>
      <template #action="{ row }">
        <VbenTableAction :actions="actions(row as OperationLog)" />
      </template>
    </Grid>
  </Page>
</template>
