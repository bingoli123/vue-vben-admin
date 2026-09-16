import type { VbenFormSchema } from '#/adapter/form';
import type { Kind, Row } from '#/api/system/admin';

import { z } from '#/adapter/form';
import {
  asTree,
  menuOptions,
  roleOptions,
  unitOptions,
} from '#/api/system/admin';
import {
  GENDER_DICTIONARY,
  UNIT_CATEGORY_DICTIONARY,
} from '#/api/system/dictionary-options';

export function dictionaryField(
  fieldName: string,
  label: string,
  dictionaryType: string,
  allowUnknown = false,
): VbenFormSchema {
  return {
    component: 'DictionarySelect',
    fieldName,
    label,
    componentProps: {
      dictionaryType,
      allowUnknown,
      placeholder: `请选择${label}`,
    },
  };
}
type Field = Exclude<VbenFormSchema, { type: 'group' }>;
export const passwordRule = z
  .string()
  .refine((value) => [...value].length >= 9, '至少 9 个字符')
  .regex(/[A-Z]/, '须包含大写字母')
  .regex(/[a-z]/, '须包含小写字母')
  .regex(/\d/, '须包含数字')
  .regex(
    /[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]/,
    '须包含英文标点符号',
  );
const input = (
  fieldName: string,
  label: string,
  max = 200,
  required = false,
): Extract<Field, { component: 'Input' }> => ({
  component: 'Input',
  fieldName,
  label,
  componentProps: { maxlength: max },
  rules: required
    ? z.string().trim().min(1, `请填写${label}`).max(max)
    : undefined,
});
const enabled: Field = {
  component: 'RadioGroup',
  fieldName: 'enabled',
  label: '状态',
  defaultValue: true,
  componentProps: {
    options: [
      { label: '已启用', value: true },
      { label: '已禁用', value: false },
    ],
    optionType: 'button',
    buttonStyle: 'solid',
  },
};
const sort: Field = {
  component: 'InputNumber',
  fieldName: 'sortOrder',
  label: '排序',
  defaultValue: 0,
  componentProps: { min: 0, precision: 0 },
  rules: 'required',
};
const description: Field = {
  component: 'Textarea',
  formItemClass: 'col-span-full',
  fieldName: 'description',
  label: '说明',
  componentProps: { maxlength: 1000 },
};
const depends = (fn: (v: Record<string, any>) => boolean) => ({
  show: fn,
  triggerFields: ['menuType', 'pageType'],
});
export function schemaFor(kind: Kind, existing?: Row): VbenFormSchema[] {
  const status = {
    ...enabled,
    componentProps: { ...enabled.componentProps, disabled: !!existing },
  };
  const parent: VbenFormSchema = {
    component: 'ApiTreeSelect',
    fieldName: 'parentId',
    label: '上级',
    componentProps: {
      api: async () =>
        kind === 'units'
          ? asTree(await unitOptions(existing?.id))
          : asTree(await menuOptions(existing?.id)),
      labelField: 'name',
      valueField: 'id',
      childrenField: 'children',
      allowClear: true,
      class: 'w-full',
      treeDefaultExpandAll: true,
    },
  };
  if (kind === 'units')
    return [
      parent,
      input('code', '单位编码', 64, true),
      input('name', '单位名称', 200, true),
      dictionaryField('category', '单位类别', UNIT_CATEGORY_DICTIONARY),
      sort,
      status,
      description,
    ];
  if (kind === 'roles')
    return [
      input('code', '角色编码', 64, true),
      input('name', '角色名称', 200, true),
      { ...input('unitName', '所属单位'), help: '角色所属单位的文字说明' },
      input('roleType', '角色类型', 64),
      sort,
      status,
      description,
    ];
  if (kind === 'users')
    return [
      input('username', '账号', 64, true),
      input('name', '姓名'),
      {
        ...input('phone', '手机号', 32, true),
        rules:
          existing && !existing.phone
            ? z
                .string()
                .trim()
                .regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号')
                .optional()
                .or(z.literal(''))
                .nullable()
            : z
                .string()
                .trim()
                .regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号'),
      },
      input('employeeNo', '工号', 64),
      dictionaryField('gender', '性别', GENDER_DICTIONARY),
      {
        component: 'ApiTreeSelect',
        fieldName: 'unitId',
        label: '所属单位',
        rules: 'required',
        componentProps: {
          api: async () => asTree(await unitOptions()),
          placeholder: '请选择所属单位',
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
          class: 'w-full',
          treeDefaultExpandAll: true,
        },
      },
      ...(existing
        ? []
        : [
            {
              component: 'InputPassword',
              fieldName: 'password',
              label: '初始密码',
              rules: passwordRule,
              help: '至少 9 个字符，包含大小写字母、数字和特殊字符',
            } as VbenFormSchema,
          ]),
    ];
  const nonButton = depends((v) => v.menuType !== 'F');
  const businessPage = input('url', '业务页面', 1000, true);
  return [
    {
      component: 'RadioGroup',
      fieldName: 'menuType',
      label: '类型',
      defaultValue: 'C',
      componentProps: {
        optionType: 'button',
        buttonStyle: 'solid',
        options: [
          { label: '目录', value: 'M' },
          { label: '菜单', value: 'C' },
          { label: '按钮', value: 'F' },
        ],
      },
    },
    input('name', '名称', 200, true),
    parent,
    {
      ...input('code', '菜单编码', 64, true),
      dependencies: {
        ...nonButton,
        rules: (v: Record<string, any>) =>
          v.menuType === 'F' ? null : 'required',
      },
    },
    {
      ...input('perms', '权限标识', 128, true),
      dependencies: {
        ...depends((v) => v.menuType === 'F'),
        rules: (v: Record<string, any>) =>
          v.menuType === 'F' ? 'required' : null,
      },
    },
    {
      ...input('platformType', '所属平台', 64, true),
      defaultValue: '管理端',
      dependencies: {
        ...nonButton,
        rules: (v: Record<string, any>) =>
          v.menuType === 'F' ? null : 'required',
      },
    },
    {
      component: 'Select',
      fieldName: 'pageType',
      label: '页面用途',
      defaultValue: '普通页面',
      componentProps: {
        options: ['普通页面', '报表查看'].map((value) => ({
          label: value,
          value,
        })),
      },
      dependencies: depends((v) => v.menuType === 'C'),
    },
    {
      ...businessPage,
      componentProps: {
        ...businessPage.componentProps,
        placeholder: '请输入业务页面地址，例如 /admin/users',
      },
      dependencies: {
        ...depends((v) => v.menuType === 'C' && v.pageType === '普通页面'),
        rules: (v: Record<string, any>) =>
          v.menuType === 'C' && v.pageType === '普通页面'
            ? (businessPage.rules ?? null)
            : null,
      },
    },
    {
      ...input('reportFile', '报表文件名'),
      help: '填写已存在的 .xml 文件名，不包含目录',
      dependencies: {
        ...depends((v) => v.menuType === 'C' && v.pageType === '报表查看'),
        rules: (v: Record<string, any>) =>
          v.pageType === '报表查看' ? 'required' : null,
      },
    },
    ...[
      ['icon', '图标'],
      ['activeIcon', '激活图标'],
    ].map(
      ([fieldName, label]) =>
        ({
          component: 'IconPicker',
          fieldName: fieldName ?? '',
          label,
          componentProps: { prefix: 'lucide', autoFetchApi: false },
          dependencies: nonButton,
        }) as VbenFormSchema,
    ),
    {
      ...input('resourceType', '资源类型', 64),
      dependencies: depends((v) => v.menuType === 'F'),
    },
    {
      ...input('operationType', '操作类型', 64),
      dependencies: depends((v) => v.menuType === 'F'),
    },
    sort,
    status,
    {
      ...description,
      dependencies: {
        triggerFields: ['menuType'],
        rules: (v: Record<string, any>) =>
          v.menuType === 'F' ? null : 'required',
      },
    },
  ];
}
export function searchSchema(kind: Kind): VbenFormSchema[] {
  if (kind === 'roles')
    return [input('name', '角色名称'), input('roleType', '角色类型', 64)];
  if (kind === 'users')
    return [
      input('name', '姓名'),
      input('username', '账号', 64),
      input('employeeNo', '工号', 64),
      dictionaryField('gender', '性别', GENDER_DICTIONARY, true),
      {
        component: 'ApiSelect',
        fieldName: 'roleId',
        label: '角色',
        componentProps: {
          api: roleOptions,
          labelField: 'name',
          valueField: 'id',
          allowClear: true,
        },
      },
    ];
  return [];
}
