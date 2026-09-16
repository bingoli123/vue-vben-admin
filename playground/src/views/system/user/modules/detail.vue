<script setup lang="ts">
import type { Row } from '#/api/system/admin';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { getDetail } from '#/api/system/admin';
const data = ref<Row>();
const items = computed(() =>
  [
    ['username', '账号'],
    ['name', '姓名'],
    ['phone', '手机号'],
    ['employeeNo', '工号'],
    ['gender', '性别'],
    ['unitName', '所属单位'],
    ['createdAt', '创建时间'],
    ['updatedAt', '修改时间'],
  ].map(([key, label]) => ({
    label,
    content:
      key &&
      (key.endsWith('At')
        ? formatDateTime(data.value?.[key])
        : data.value?.[key]),
  })),
);
const [Drawer, api] = useVbenDrawer<Row>({
  async onOpenChange(open) {
    if (open) {
      const row = api.getData();
      if (!row) return;
      api.setState({ loading: true });
      try {
        data.value = await getDetail('users', row.id);
      } finally {
        api.setState({ loading: false });
      }
    }
  },
});
</script>
<template>
  <Drawer title="用户详情" :footer="false">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
