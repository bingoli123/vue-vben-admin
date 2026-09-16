<script setup lang="ts">
import type { DictionaryOption } from '#/api/system/dictionary-options';

import { computed, ref, watch } from 'vue';

import Select from 'antdv-next/dist/select/index';

import {
  getDictionaryOptions,
  optionsWithCurrent,
} from '#/api/system/dictionary-options';

const props = defineProps<{
  dictionaryType: string;
  value?: null | string;
  placeholder?: string;
  allowUnknown?: boolean;
}>();
const emit = defineEmits<{
  'update:value': [value: null | string];
  change: [value: null | string];
}>();
const options = ref<DictionaryOption[]>([]);
const loading = ref(false);
const failed = ref(false);
const search = ref('');
let revision = 0;
const choices = computed(() =>
  optionsWithCurrent(
    optionsWithCurrent(options.value, props.value),
    props.allowUnknown ? search.value.trim() : null,
  ),
);
async function load() {
  const attempt = ++revision;
  loading.value = true;
  failed.value = false;
  try {
    const result = await getDictionaryOptions(props.dictionaryType);
    if (attempt === revision) options.value = result.items;
  } catch {
    // 请求层显示错误；保留原值且允许下次展开重试，不把加载失败当用户清空。
    if (attempt === revision) {
      failed.value = true;
      options.value = [];
    }
  } finally {
    if (attempt === revision) loading.value = false;
  }
}
watch(
  () => props.dictionaryType,
  () => {
    options.value = [];
    void load();
  },
  { immediate: true },
);
function change(value: unknown) {
  const next = value === undefined || value === null ? null : String(value);
  emit('update:value', next);
  emit('change', next);
}
</script>
<template>
  <Select
    :data-dictionary-type="dictionaryType"
    :value="value === '' ? undefined : value"
    :options="choices"
    :loading="loading"
    :placeholder="placeholder"
    :not-found-content="failed ? '加载失败，请重新展开' : '暂无字典选项'"
    allow-clear
    show-search
    option-filter-prop="label"
    @search="
      (value) => {
        search = value;
      }
    "
    @update:value="change"
    @open-change="
      (open) => {
        if (open) void load();
      }
    "
  />
</template>
