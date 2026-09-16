<script setup lang="ts">
import type { Personnel } from '#/api/cadre/personnel';
import type { Option } from '#/api/system/admin';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, Tree, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Alert, Button, Card } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  getPersonnelList,
  getPersonnelUnits,
  personnelPermission,
} from '#/api/cadre/personnel';
import { asTree } from '#/api/system/admin';

import { columns, searchSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();
const can = (action: string) => hasAccessByCodes([personnelPermission(action)]);
const queryAllowed = computed(() => can('query'));
const selectedUnit = ref('');
const units = ref<Option[]>([]);
const unitTree = computed(() => asTree(units.value));
const [FormDrawer, formApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [DetailDrawer, detailApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});
onMounted(async () => {
  if (!queryAllowed.value) return;
  try {
    units.value = await getPersonnelUnits();
  } catch {
    /* 请求层已提示，空树不授予额外范围。 */
  }
});
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: searchSchema },
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
            ? getPersonnelList({
                ...values,
                unitId: selectedUnit.value,
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
function selectUnit(node: { value?: { id?: string } }) {
  selectedUnit.value = node.value?.id ?? '';
  void gridApi.reload();
}
function refresh() {
  void gridApi.reload();
}
function actions(row: Personnel) {
  return [
    {
      text: '详情',
      auth: [personnelPermission('query')],
      onClick: () => detailApi.setData(row).open(),
    },
    {
      text: '编辑',
      icon: 'lucide:edit',
      auth: [personnelPermission('edit')],
      onClick: () => formApi.setData({ id: row.id }).open(),
    },
  ];
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="refresh" /><DetailDrawer />
    <Alert
      v-if="!queryAllowed"
      class="mb-4"
      type="info"
      message="当前账号尚未授予人员查询权限。"
    />
    <div class="flex size-full gap-4">
      <Card class="w-1/5 min-w-48" title="所属单位">
        <Button
          type="link"
          @click="
            selectedUnit = '';
            refresh();
          "
        >
          全部授权单位
        </Button>
        <Tree
          :tree-data="unitTree"
          value-field="id"
          label-field="name"
          :default-expanded-level="2"
          :show-toolbar="false"
          @select="selectUnit"
        />
      </Card>
      <div class="min-w-0 flex-1">
        <Grid table-title="管理人员">
          <template #toolbar-tools>
            <Button
              v-if="can('add')"
              type="primary"
              @click="
                formApi.setData({ unitId: selectedUnit || undefined }).open()
              "
            >
              <Plus class="size-5" />新增人员
            </Button>
          </template>
          <template #action="{ row }">
            <VbenTableAction :actions="actions(row as Personnel)" />
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
