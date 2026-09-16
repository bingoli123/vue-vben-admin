<script setup lang="ts">
import type { Row } from '#/api/system/admin';
import type { DictionaryOption } from '#/api/system/dictionary-options';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { getDetail } from '#/api/system/admin';
import {
  dictionaryLabel,
  GENDER_DICTIONARY,
  getDictionaryOptions,
} from '#/api/system/dictionary-options';
const options = ref<DictionaryOption[]>([]);
const data = ref<Row>();
function displayValue(key: string | undefined) {
  if (!key) return '';
  if (key.endsWith('At')) return formatDateTime(data.value?.[key]);
  if (key === 'gender')
    return dictionaryLabel(options.value, data.value?.[key]);
  return data.value?.[key];
}
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
    content: displayValue(key),
  })),
);
const [Drawer, api] = useVbenDrawer<Row>({
  async onOpenChange(open) {
    if (open) {
      const row = api.getData();
      if (!row) return;
      api.setState({ loading: true });
      try {
        const [detail, dictionary] = await Promise.all([
          getDetail('users', row.id),
          getDictionaryOptions(GENDER_DICTIONARY),
        ]);
        data.value = detail;
        options.value = dictionary.items;
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
