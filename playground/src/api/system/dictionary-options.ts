import { requestClient } from '#/api/request';

export interface DictionaryOption {
  label: string;
  value: string;
  sortOrder: number;
}
export interface DictionaryOptions {
  type: string;
  items: DictionaryOption[];
}
export const GENDER_DICTIONARY = 'sys_gender';
export const UNIT_CATEGORY_DICTIONARY = 'sys_unit_category';

/** 缓存由后端统一管理；页面每次加载/展开读取，避免浏览器长期保存另一份过期缓存。 */
export const getDictionaryOptions = (type: string) =>
  requestClient.get<DictionaryOptions>(
    `/dictionaries/${encodeURIComponent(type)}`,
  );
export const refreshDictionaryCache = (type: string) =>
  requestClient.post('/admin/dictionaries/cache/refresh', undefined, {
    params: { type },
  });

/** 空值仍为空，未匹配值原样显示；绝不按默认选项猜测历史含义。 */
export function dictionaryLabel(
  options: DictionaryOption[],
  value: unknown,
): string {
  if (value === null || value === undefined || value === '') return '';
  const key = String(value);
  return options.find((option) => option.value === key)?.label ?? key;
}
export function optionsWithCurrent(
  options: DictionaryOption[],
  value: unknown,
): DictionaryOption[] {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    options.some((option) => option.value === String(value))
  )
    return options;
  return [
    ...options,
    { value: String(value), label: String(value), sortOrder: 0 },
  ];
}
