/**
 * ID 品牌类型。运行时依然是 string (UUID v4)，编译期防止误用。
 */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UUID = Brand<string, 'UUID'>;
export type UserId = Brand<string, 'UserId'>;
export type SpaceId = Brand<string, 'SpaceId'>;

export type RecordId = Brand<string, 'RecordId'>;
export type RecordTypeId = Brand<string, 'RecordTypeId'>;
export type FieldId = Brand<string, 'FieldId'>;
export type RelationId = Brand<string, 'RelationId'>;
export type ViewId = Brand<string, 'ViewId'>;
export type SceneItemId = Brand<string, 'SceneItemId'>;
export type AnnotationId = Brand<string, 'AnnotationId'>;

/** 无校验强制转型工具。调用方需保证入参为合法 UUID v4。 */
export const asId = <T extends Brand<string, string>>(s: string): T => s as T;
