<script setup lang="ts">
import type { OperationLog } from '#/api/system/operation-log';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, message, Modal, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  clearOperationLogs,
  deleteOperationLogs,
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
const cleaning = ref(false);
const confirming = ref(false);
const selected = ref<OperationLog[]>([]);
const busy = computed(
  () => exporting.value || querying.value || cleaning.value || confirming.value,
);
let appliedFilters: Record<string, unknown> = {};
let queryRevision = 0;
let latestPage = { items: [] as OperationLog[], total: 0 };
const queryAllowed = computed(() => hasAccessByCodes([logQueryPermission]));
const [DetailDrawer, detailApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid<OperationLog>({
  gridEvents: {
    checkboxChange: ({ records }: { records: OperationLog[] }) => {
      selected.value = records;
    },
    checkboxAll: ({ records }: { records: OperationLog[] }) => {
      selected.value = records;
    },
  },
  formOptions: {
    schema: searchSchema(),
    submitOnChange: false,
    collapsed: false,
  },
  gridOptions: {
    columns: useColumns(can('delete')),
    checkboxConfig: { reserve: false, checkMethod: () => !busy.value },
    height: 'auto',
    rowConfig: { keyField: 'id' },
    proxyConfig: {
      ajax: {
        query: async (
          { page }: { page: { currentPage: number; pageSize: number } },
          values: Record<string, unknown>,
        ) => {
          selected.value = [];
          await gridApi.grid.clearCheckboxRow();
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
  if (busy.value) return;
  exporting.value = true;
  try {
    await exportOperationLogs(appliedFilters);
  } catch {
    /* 统一请求层已提示错误，失败时不下载文件。 */
  } finally {
    exporting.value = false;
  }
}
function confirmCleanup(all: boolean) {
  if (busy.value || (!all && selected.value.length === 0)) return;
  // 确认框固定本次选择，翻页或搜索不会悄悄改变待删除的 ID。
  const rows = selected.value.map(({ id, version }) => ({ id, version }));
  confirming.value = true;
  Modal.confirm({
    title: all ? '清空全部操作日志' : `删除选中的 ${rows.length} 条日志`,
    content: all
      ? '将清空全系统全部操作日志，包括当前筛选范围之外的数据。此操作不可撤销，本次清理记录会保留。'
      : '确认删除所选日志？此操作不可撤销，本次删除记录会保留。',
    okText: all ? '清空全部' : '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onCancel: () => {
      confirming.value = false;
    },
    async onOk() {
      cleaning.value = true;
      try {
        const result = all
          ? await clearOperationLogs()
          : await deleteOperationLogs(rows);
        message.success(`已${all ? '清空' : '删除'} ${result.affected} 条日志`);
        detailApi.close();
        selected.value = [];
        // 重置到全量首页，立即展示新写入的清理记录。
        await gridApi.formApi.reset();
        const values = await gridApi.formApi.getValues();
        gridApi.formApi.setLatestSubmissionValues(values);
        await gridApi.reload(values);
      } finally {
        cleaning.value = false;
        confirming.value = false;
      }
    },
  });
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
          :disabled="busy && !exporting"
          @click="exportRows"
        >
          <IconifyIcon icon="lucide:download" class="size-4" />导出
        </Button>
        <Button
          v-if="can('delete')"
          danger
          :disabled="busy || selected.length === 0"
          @click="confirmCleanup(false)"
        >
          <IconifyIcon icon="lucide:trash-2" class="size-4" />删除选中<span
            v-if="selected.length"
            >（{{ selected.length }}）</span>
        </Button>
        <Button
          v-if="can('clear')"
          danger
          :disabled="busy"
          @click="confirmCleanup(true)"
        >
          <IconifyIcon icon="lucide:eraser" class="size-4" />清空
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
