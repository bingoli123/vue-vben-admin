<script setup lang="ts">
import type { FormInstance } from 'antdv-next';

import type { Personnel } from '#/api/cadre/personnel';
import type { Option } from '#/api/system/admin';

import { computed, onUnmounted, reactive, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Divider,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  TreeSelect,
} from 'antdv-next';

import {
  getPersonnel,
  getPersonnelUnits,
  savePersonnel,
  suggestInitials,
} from '#/api/cadre/personnel';
import { asTree } from '#/api/system/admin';

const emit = defineEmits<{ success: [] }>();
const current = ref<Personnel>();
const formRef = ref<FormInstance>();
const options = ref<Option[]>([]);
const unitTree = computed(() =>
  asTree(options.value.map((u) => ({ ...u, disabled: !u.enabled }))),
);
const values = reactive({
  unitId: undefined as string | undefined,
  name: '',
  initials: '',
  employeeNo: '',
  phone: '',
  position: '',
  sortOrder: null as null | number,
  undergroundCount: null as null | number,
  onsiteCount: null as null | number,
  watchDutyCount: null as null | number,
  stopWorkCount: null as null | number,
  dCardCount: null as null | number,
  penaltyAmount: null as null | string,
  safetySalary: null as null | string,
  salaryCoefficient: null as null | string,
});
let generation = 0;
let suggestion = 0;
let ready = false;
let saved = false;
let lastAutomatic = '';
const generating = ref(false);
const countRules = [
  {
    type: 'integer' as const,
    min: 0,
    max: 2_147_483_647,
    message: '须为非负整数或留空',
  },
];
/** 字符串模式避免金额和系数先转成浏览器浮点数；后端仍执行最终精度校验。 */
function decimalRules(label: string, integer: number, fraction: number) {
  return [
    {
      validator: async (_rule: unknown, value: null | string) => {
        if (value === null || value === '') return;
        const pattern = new RegExp(
          `^(?:0|[1-9]\\d{0,${integer - 1}})(?:\\.\\d{1,${fraction}})?$`,
        );
        if (!pattern.test(String(value)))
          throw new Error(`${label}须为非负数，最多${fraction}位小数`);
      },
    },
  ];
}
onUnmounted(() => {
  generation++;
  suggestion++;
});
const title = computed(() => (current.value ? '编辑管理人员' : '新增管理人员'));
/** 空简拼自动建议；已有人工修正保持原值，可显式重新生成。慢响应不能覆盖用户新输入。 */
async function generate(force = false) {
  if (
    !ready ||
    !values.name.trim() ||
    (!force && values.initials !== '' && values.initials !== lastAutomatic)
  )
    return;
  const request = ++suggestion;
  const active = generation;
  const name = values.name;
  const previous = values.initials;
  generating.value = true;
  try {
    const result = await suggestInitials(name);
    if (
      request === suggestion &&
      active === generation &&
      values.name === name &&
      values.initials === previous
    ) {
      values.initials = result;
      lastAutomatic = result;
    }
  } catch {
    /* 失败不伪造建议，保存时仍由后端生成空简拼。 */
  } finally {
    if (request === suggestion) generating.value = false;
  }
}
const [Drawer, api] = useVbenDrawer<{ id?: string; unitId?: string }>({
  async onOpenChange(open) {
    const request = ++generation;
    suggestion++;
    ready = false;
    generating.value = false;
    if (!open) return;
    // 在任何await前捕获目标，避免后续选择树节点改变本次新增的归属。
    const target = api.getData();
    saved = false;
    current.value = undefined;
    lastAutomatic = '';
    Object.assign(values, {
      unitId: undefined,
      name: '',
      initials: '',
      employeeNo: '',
      phone: '',
      position: '',
      sortOrder: null,
      undergroundCount: null,
      onsiteCount: null,
      watchDutyCount: null,
      stopWorkCount: null,
      dCardCount: null,
      penaltyAmount: null,
      safetySalary: null,
      salaryCoefficient: null,
    });
    api.setState({ loading: true, showConfirmButton: false });
    try {
      const [units, record] = await Promise.all([
        getPersonnelUnits(),
        target?.id ? getPersonnel(target.id) : Promise.resolve(undefined),
      ]);
      if (request !== generation) return;
      options.value = units;
      current.value = record;
      Object.assign(
        values,
        record
          ? {
              unitId: record.unitId,
              name: record.name,
              initials: record.initials ?? '',
              employeeNo: record.employeeNo ?? '',
              phone: record.phone ?? '',
              position: record.position ?? '',
              sortOrder: record.sortOrder,
              undergroundCount: record.undergroundCount,
              onsiteCount: record.onsiteCount,
              watchDutyCount: record.watchDutyCount,
              stopWorkCount: record.stopWorkCount,
              dCardCount: record.dCardCount,
              penaltyAmount: record.penaltyAmount,
              safetySalary: record.safetySalary,
              salaryCoefficient: record.salaryCoefficient,
            }
          : { unitId: target?.unitId },
      );
      formRef.value?.clearValidate();
      ready = true;
      api.setState({ showConfirmButton: true });
    } catch {
      /* 详情或单位加载失败时禁止提交，避免把编辑误作为新增。 */
    } finally {
      if (request === generation) api.setState({ loading: false });
    }
  },
  onClosed() {
    if (saved) {
      saved = false;
      emit('success');
    }
  },
  async onConfirm() {
    if (!ready || !formRef.value) return;
    try {
      await formRef.value.validate();
    } catch {
      return;
    }
    api.lock();
    try {
      await savePersonnel({ ...values }, current.value);
      saved = true;
      message.success('人员资料已保存');
      await api.close();
    } catch (error) {
      if (
        (error as { response?: { data?: { code?: string } } }).response?.data
          ?.code === 'VERSION_CONFLICT'
      ) {
        ready = false;
        api.setState({ showConfirmButton: false });
      }
      // 手机号冲突保留输入供修正，只有版本冲突必须重新加载。
    } finally {
      api.unlock();
    }
  },
});
</script>
<template>
  <Drawer :title="title" class="w-full max-w-180">
    <div class="mx-4">
      <Alert
        type="info"
        class="mb-4"
        message="人员编号保存时自动生成。所属单位和人员名称必填，其他资料可留空。"
      />
      <Form ref="formRef" :model="values" layout="vertical">
        <FormItem label="人员编号">
          <Input
            :value="current?.number ?? ''"
            readonly
            placeholder="保存后自动生成"
          />
        </FormItem>
        <FormItem
          label="所属单位"
          name="unitId"
          :rules="[{ required: true, message: '请选择所属单位' }]"
        >
          <TreeSelect
            v-model:value="values.unitId"
            :tree-data="unitTree"
            :field-names="{ label: 'name', value: 'id', children: 'children' }"
            tree-default-expand-all
            show-search
            tree-node-filter-prop="name"
            placeholder="请选择所属单位"
            class="w-full"
          />
        </FormItem>
        <FormItem
          label="人员名称"
          name="name"
          :rules="[
            { required: true, whitespace: true, message: '请填写人员名称' },
            { max: 200, message: '人员名称不能超过200字' },
          ]"
        >
          <Input
            v-model:value="values.name"
            :maxlength="200"
            placeholder="请输入人员名称"
            @blur="generate()"
          />
        </FormItem>
        <FormItem label="名称简拼" name="initials">
          <div class="flex gap-2">
            <Input
              v-model:value="values.initials"
              :maxlength="200"
              placeholder="自动生成，可按实际读音修正"
            /><Button :loading="generating" @click="generate(true)">
              重新生成
            </Button>
          </div>
        </FormItem>
        <FormItem label="工号" name="employeeNo">
          <Input
            v-model:value="values.employeeNo"
            :maxlength="64"
            placeholder="选填，独立于人员编号"
          />
        </FormItem>
        <FormItem
          label="手机号"
          name="phone"
          :rules="[
            {
              pattern: /^\s*(?:1[3-9][0-9]{9})?\s*$/,
              message: '请填写正确的11位手机号或留空',
            },
          ]"
        >
          <Input
            v-model:value="values.phone"
            :maxlength="32"
            placeholder="选填，填写后不能与其他人员重复"
          />
        </FormItem>
        <FormItem label="职务" name="position">
          <Input
            v-model:value="values.position"
            :maxlength="200"
            placeholder="请输入职务（选填）"
          />
        </FormItem>
        <FormItem
          label="序号"
          name="sortOrder"
          :rules="[
            { type: 'integer', min: 0, message: '序号须为非负整数或留空' },
          ]"
        >
          <InputNumber
            v-model:value="values.sortOrder"
            :min="0"
            :max="2147483647"
            placeholder="未配置"
            class="w-full"
          />
        </FormItem>
        <Divider>当前考核指标</Divider>
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <FormItem
            label="下井指标（次）"
            name="undergroundCount"
            :rules="countRules"
          >
            <InputNumber
              v-model:value="values.undergroundCount"
              :min="0"
              :max="2147483647"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
          <FormItem
            label="下现场指标（次）"
            name="onsiteCount"
            :rules="countRules"
          >
            <InputNumber
              v-model:value="values.onsiteCount"
              :min="0"
              :max="2147483647"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
          <FormItem
            label="盯班指标（次）"
            name="watchDutyCount"
            :rules="countRules"
          >
            <InputNumber
              v-model:value="values.watchDutyCount"
              :min="0"
              :max="2147483647"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
          <FormItem
            label="停止作业指标（次）"
            name="stopWorkCount"
            :rules="countRules"
          >
            <InputNumber
              v-model:value="values.stopWorkCount"
              :min="0"
              :max="2147483647"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
          <FormItem
            label="D 卡指标（个）"
            name="dCardCount"
            :rules="countRules"
          >
            <InputNumber
              v-model:value="values.dCardCount"
              :min="0"
              :max="2147483647"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
          <FormItem
            label="罚款指标（元）"
            name="penaltyAmount"
            :rules="decimalRules('罚款指标', 16, 2)"
          >
            <InputNumber
              v-model:value="values.penaltyAmount"
              string-mode
              :min="0"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
          <FormItem
            label="安全工资标准（元）"
            name="safetySalary"
            :rules="decimalRules('安全工资标准', 16, 2)"
          >
            <InputNumber
              v-model:value="values.safetySalary"
              string-mode
              :min="0"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
          <FormItem
            label="工资系数"
            name="salaryCoefficient"
            :rules="decimalRules('工资系数', 14, 4)"
          >
            <InputNumber
              v-model:value="values.salaryCoefficient"
              string-mode
              :min="0"
              placeholder="未配置"
              class="w-full"
            />
          </FormItem>
        </div>
      </Form>
    </div>
  </Drawer>
</template>
