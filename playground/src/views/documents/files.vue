<script setup lang="ts">
import type { DocumentFile } from '#/api/documents/files';
import type { Folder } from '#/api/documents/folders';

import { computed, reactive, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Space,
  Table,
} from 'antdv-next';

import {
  downloadFile,
  filePermission,
  getFile,
  getFiles,
  uploadFile,
} from '#/api/documents/files';

const props = defineProps<{ folder?: Folder }>();
const { hasAccessByCodes } = useAccess();
const can = (action: string) => hasAccessByCodes([filePermission(action)]);
const rows = ref<DocumentFile[]>([]);
const loading = ref(false);
const filters = reactive({ name: '', category: '' });
const applied = reactive({ name: '', category: '' });
const pager = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
});
let requestId = 0;
async function load() {
  const current = ++requestId;
  const folderId = props.folder?.id;
  if (!folderId || !can('query')) {
    rows.value = [];
    pager.total = 0;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const result = await getFiles({
      folderId,
      name: applied.name,
      fileCategory: applied.category,
      page: pager.current,
      size: pager.pageSize,
    });
    if (current !== requestId) return;
    rows.value = result.records;
    pager.total = result.total;
  } catch {
    if (current === requestId) {
      rows.value = [];
      pager.total = 0;
    }
  } finally {
    if (current === requestId) loading.value = false;
  }
}
function search() {
  Object.assign(applied, filters);
  pager.current = 1;
  void load();
}
function pageChanged(value: { current?: number; pageSize?: number }) {
  pager.current = value.current ?? 1;
  pager.pageSize = value.pageSize ?? 20;
  void load();
}
const uploadOpen = ref(false);
const uploading = ref(false);
const uploadTarget = ref<Folder>();
const uploadCategory = ref('');
const chosen = ref<File>();
const picker = ref<HTMLInputElement>();
function openUpload() {
  // 上传位置固定为打开弹窗时的目录，切树不能悄悄改变文件的归属。
  uploadTarget.value = props.folder;
  chosen.value = undefined;
  uploadCategory.value = '';
  if (picker.value) picker.value.value = '';
  uploadOpen.value = true;
}
function chooseFile(event: Event) {
  chosen.value = (event.target as HTMLInputElement).files?.[0];
}
async function submitUpload() {
  const target = uploadTarget.value;
  if (!chosen.value || !target) {
    message.warning('请选择原文件');
    return;
  }
  uploading.value = true;
  try {
    await uploadFile(target.id, chosen.value, uploadCategory.value);
    uploadOpen.value = false;
    message.success(`文件已上传到“${target.name}”`);
    if (props.folder?.id === target.id) {
      pager.current = 1;
      await load();
    }
  } catch {
    // 失败保留选择和分类，重试仍使用用户确认的目录。
  } finally {
    uploading.value = false;
  }
}
const detail = ref<DocumentFile>();
const detailOpen = ref(false);
const detailLoading = ref(false);
let detailRequest = 0;
async function showDetail(id: string) {
  const current = ++detailRequest;
  detail.value = undefined;
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const result = await getFile(id);
    if (current === detailRequest) detail.value = result;
  } catch {
    if (current === detailRequest) detailOpen.value = false;
  } finally {
    if (current === detailRequest) detailLoading.value = false;
  }
}
watch(
  () => props.folder?.id,
  () => {
    ++detailRequest;
    detailOpen.value = false;
    detail.value = undefined;
    detailLoading.value = false;
    Object.assign(filters, { name: '', category: '' });
    Object.assign(applied, filters);
    pager.current = 1;
    void load();
  },
  { immediate: true },
);
const downloading = ref<string[]>([]);
async function download(file: DocumentFile) {
  downloading.value.push(file.id);
  try {
    await downloadFile(file);
  } catch {
    /* 请求错误已显示，不能提示下载成功。 */
  } finally {
    downloading.value = downloading.value.filter((id) => id !== file.id);
  }
}
const columns = computed(() => [
  {
    title: '文件名称',
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    width: 240,
  },
  { title: '业务分类', dataIndex: 'category', key: 'category', width: 120 },
  { title: '大小', key: 'size', width: 110 },
  {
    title: '上传人',
    dataIndex: 'uploaderName',
    key: 'uploaderName',
    width: 110,
  },
  {
    title: '上传时单位',
    dataIndex: 'uploaderUnitName',
    key: 'uploaderUnitName',
    width: 150,
  },
  { title: '上传时间', key: 'createdAt', width: 180 },
  {
    title: '操作',
    key: 'actions',
    width: can('download') ? 140 : 80,
    fixed: 'right' as const,
  },
]);
function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const timeLabel = (value: string) => new Date(value).toLocaleString();
</script>

<template>
  <Card title="当前目录文件">
    <template #extra>
      <Button
        v-if="can('upload')"
        type="primary"
        :disabled="!folder"
        @click="openUpload"
      >
        上传文件
      </Button>
    </template>
    <Empty v-if="!folder" description="选择文件夹后查看文件" />
    <Alert
      v-else-if="!can('query')"
      type="info"
      message="当前账号尚未授予文件查询权限。"
    />
    <template v-else>
      <Form layout="inline" class="mb-4 gap-y-2" @submit.prevent="search">
        <FormItem label="文件名称">
          <Input
            v-model:value="filters.name"
            aria-label="文件名称筛选"
            allow-clear
            :maxlength="200"
          />
        </FormItem>
        <FormItem label="业务分类">
          <Input
            v-model:value="filters.category"
            aria-label="业务分类筛选"
            allow-clear
            :maxlength="100"
          />
        </FormItem>
        <Space>
          <Button type="primary" html-type="submit" :loading="loading">
            查询文件
</Button><Button :loading="loading" @click="load">刷新文件</Button>
        </Space>
      </Form>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pager"
        :scroll="{ x: 1050 }"
        row-key="id"
        @change="pageChanged"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'size'">
            {{ sizeLabel(record.size) }}
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ timeLabel(record.createdAt) }}
          </template>
          <template
            v-else-if="
              column.key === 'category' || column.key === 'uploaderUnitName'
            "
          >
            {{ record[column.key] || '—' }}
          </template>
          <Space v-else-if="column.key === 'actions'" size="small">
            <Button type="link" size="small" @click="showDetail(record.id)">
              详情
            </Button>
            <Button
              v-if="can('download')"
              type="link"
              size="small"
              :loading="downloading.includes(record.id)"
              @click="download(record)"
            >
              下载
            </Button>
          </Space>
        </template>
      </Table>
    </template>
  </Card>
  <Modal
    v-model:open="uploadOpen"
    title="上传原文件"
    ok-text="上传"
    cancel-text="取消"
    :confirm-loading="uploading"
    :closable="!uploading"
    :mask-closable="false"
    :cancel-button-props="{ disabled: uploading }"
    destroy-on-hidden
    @ok="submitUpload"
  >
    <Form layout="vertical" class="mt-4">
      <FormItem label="目标文件夹">
        <div>{{ uploadTarget?.name }} · {{ uploadTarget?.unitName }}</div>
      </FormItem>
      <FormItem label="原文件" required>
        <input
          ref="picker"
          type="file"
          aria-label="选择原文件"
          class="w-full"
          :disabled="uploading"
          @change="chooseFile"
        />
        <div class="text-muted-foreground mt-2 text-xs">
          单文件默认上限20MB，以服务端配置为准。
        </div>
      </FormItem>
      <FormItem label="业务分类">
        <Input
          v-model:value="uploadCategory"
          :maxlength="100"
          placeholder="选填，如通知、制度"
          :disabled="uploading"
        />
      </FormItem>
    </Form>
  </Modal>
  <Modal
    v-model:open="detailOpen"
    title="文件详情"
    :footer="null"
    :loading="detailLoading"
    :width="760"
  >
    <Descriptions v-if="detail" :column="2" bordered size="small" class="mt-4">
      <DescriptionsItem label="文件名称" :span="2">
        {{ detail.name }}
      </DescriptionsItem>
      <DescriptionsItem label="业务分类">
        {{ detail.category || '—' }}
      </DescriptionsItem>
      <DescriptionsItem label="文件后缀">
        {{ detail.extension || '—' }}
      </DescriptionsItem>
      <DescriptionsItem label="SHA-256" :span="2">
        <span class="break-all">{{ detail.sha256 || '—' }}</span>
      </DescriptionsItem>
      <DescriptionsItem label="文件大小">
        {{ detail.size }} 字节
      </DescriptionsItem>
      <DescriptionsItem label="内容类型">
        {{ detail.contentType }}
      </DescriptionsItem>
      <DescriptionsItem label="所属文件夹">{{ folder?.name }}</DescriptionsItem>
      <DescriptionsItem label="所属单位">
        {{ folder?.unitName }}
      </DescriptionsItem>
      <DescriptionsItem label="上传人">
        {{ detail.uploaderName }}
      </DescriptionsItem>
      <DescriptionsItem label="上传时单位">
        {{ detail.uploaderUnitName || '—' }}
      </DescriptionsItem>
      <DescriptionsItem label="上传时间">
        {{ timeLabel(detail.createdAt) }}
      </DescriptionsItem>
      <DescriptionsItem label="修改时间">
        {{ timeLabel(detail.updatedAt) }}
      </DescriptionsItem>
    </Descriptions>
    <Button
      v-if="detail && can('download')"
      class="mt-4"
      type="primary"
      :loading="downloading.includes(detail.id)"
      @click="download(detail)"
    >
      下载原文件
    </Button>
  </Modal>
</template>
