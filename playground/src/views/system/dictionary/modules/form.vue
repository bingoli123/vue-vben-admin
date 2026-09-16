<script setup lang="ts">
import type { Dictionary, DictionaryItem } from '#/api/system/dictionary';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import {
  getDictionary,
  getDictionaryItem,
  saveDictionary,
  saveDictionaryItem,
} from '#/api/system/dictionary';

import { editorSchema } from '../schema';

type EditorData =
  | { kind: 'dictionary'; row?: Dictionary }
  | { kind: 'item'; dictionaryId: string; row?: DictionaryItem };
const emit = defineEmits<{ success: [] }>();
const current = ref<Dictionary | DictionaryItem>();
const context = ref<EditorData>({ kind: 'dictionary' });
const ready = ref(false);
let saved = false;
let revision = 0;
const [Form, formApi] = useVbenForm({
  schema: editorSchema(false),
  showDefaultActions: false,
  commonConfig: { labelWidth: 90, componentProps: { class: 'w-full' } },
  wrapperClass: 'grid-cols-1',
});
const [Drawer, drawerApi] = useVbenDrawer<EditorData>({
  async onOpenChange(open) {
    const attempt = ++revision;
    ready.value = false;
    if (!open) return;
    saved = false;
    const data = drawerApi.getData();
    if (!data) return;
    context.value = data;
    current.value = undefined;
    drawerApi.setState({ loading: true, showConfirmButton: false });
    try {
      let row: Dictionary | DictionaryItem | undefined;
      if (data.row) {
        row =
          data.kind === 'dictionary'
            ? await getDictionary(data.row.id)
            : await getDictionaryItem(data.dictionaryId, data.row.id);
      }
      // 关闭或重新打开后，丢弃旧详情请求，避免表单被晚到的数据覆盖。
      if (attempt !== revision) return;
      current.value = row;
      await formApi.reset();
      formApi.setState({ schema: editorSchema(data.kind === 'item') });
      await nextTick();
      if (attempt !== revision) return;
      await formApi.setValues(row ?? { sortOrder: 0 });
      ready.value = true;
      drawerApi.setState({ showConfirmButton: true });
    } finally {
      if (attempt === revision) drawerApi.setState({ loading: false });
    }
  },
  onClosed() {
    if (saved) {
      saved = false;
      emit('success');
    }
  },
  async onConfirm() {
    if (!ready.value) return;
    const validation = await formApi.validate();
    if (!validation.valid) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      const common = {
        remark: values.remark ? String(values.remark).trim() || null : null,
        ...(current.value ? { version: current.value.version } : {}),
      };
      const data = context.value;
      const saving =
        data.kind === 'dictionary'
          ? saveDictionary(
              {
                ...common,
                name: String(values.name).trim(),
                type: String(values.type).trim(),
              },
              current.value?.id,
            )
          : saveDictionaryItem(
              data.dictionaryId,
              {
                ...common,
                label: String(values.label).trim(),
                value: String(values.value).trim(),
                sortOrder: Number(values.sortOrder),
              },
              current.value?.id,
            );
      await saving;
      saved = true;
      await drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
});
const title = computed(
  () =>
    `${context.value.row ? '编辑' : '新增'}${context.value.kind === 'item' ? '字典项' : '字典'}`,
);
</script>
<template>
  <Drawer class="w-full max-w-140" :title="title"><Form class="mx-4" /></Drawer>
</template>
