<script setup lang="ts">
import type { Row } from '#/api/system/admin';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { getDetail } from '#/api/system/admin';
const data = ref<Row>();
const items = computed(() =>
  [
    ['username', '账号'],
    ['name', '姓名'],
    ['employeeNo', '工号'],
    ['fullPinyin', '全拼'],
    ['gender', '性别'],
    ['unitName', '所属单位'],
    ['attendanceNo', '考勤号'],
    ['createdAt', '创建时间'],
    ['updatedAt', '修改时间'],
  ].map(([key, label]) => ({
    label,
    content: key ? data.value?.[key] : undefined,
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
