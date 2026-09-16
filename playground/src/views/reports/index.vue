<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Spin } from 'antdv-next';

import { requestClient } from '#/api/request';
const route = useRoute();
const errorMessage = ref('');
const loading = ref(false);
const source = ref('');
let revision = 0;
async function open() {
  const current = ++revision;
  source.value = '';
  errorMessage.value = '';
  loading.value = true;
  try {
    const result = await requestClient.post<{ name: string; url: string }>(
      `/reports/menus/${String(route.meta.menuId)}/open`,
    );
    const url = new URL(result.url, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/ureport/'))
      throw new Error('报表地址无效');
    if (current === revision) source.value = url.href;
  } catch (error) {
    if (current === revision)
      errorMessage.value =
        error instanceof Error ? error.message : '报表打开失败';
  } finally {
    if (current === revision) loading.value = false;
  }
}
watch(() => route.meta.menuId, open, { immediate: true });
onBeforeUnmount(() => {
  revision++;
});
</script>
<template>
  <Page auto-content-height>
    <Spin :spinning="loading" class="h-full">
      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        type="error"
        class="mb-4"
      /><Button v-if="errorMessage" @click="open"> 重新打开报表 </Button><iframe
        v-if="source"
        :src="source"
        :title="String(route.meta.title)"
        class="size-full min-h-[70vh] rounded-lg border-0 bg-white"
      ></iframe>
    </Spin>
  </Page>
</template>
