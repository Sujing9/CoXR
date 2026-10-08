import type { FieldId } from './ids.js';

export interface SelectOption {
  id: string;
  name: string;
  color?: string;
}

interface FieldDefBase {
  id: FieldId;
  name: string;
}

export interface TextField extends FieldDefBase {
  type: 'text';
}
export interface LongTextField extends FieldDefBase {
  type: 'longText';
}
export interface NumberField extends FieldDefBase {
  type: 'number';
}
export interface BooleanField extends FieldDefBase {
  type: 'boolean';
}
export interface SelectField extends FieldDefBase {
  type: 'select';
  options: SelectOption[];
}
export interface MultiSelectField extends FieldDefBase {
  type: 'multiSelect';
  options: SelectOption[];
}
export interface DateField extends FieldDefBase {
  type: 'date';
}
export interface UrlField extends FieldDefBase {
  type: 'url';
}

export type FieldDef =
  | TextField
  | LongTextField
  | NumberField
  | BooleanField
  | SelectField
  | MultiSelectField
  | DateField
  | UrlField;

/**
 * 字段的序列化态取值。
 * - longText 在同步态为 Y.Text，序列化后变成 string。
 * - date 使用 epoch ms (number)。
 */
export type FieldValue = string | number | boolean | string[] | null;
