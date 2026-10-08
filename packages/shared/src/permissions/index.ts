// ─── Permission bit flags ─────────────────────────────────────────────────────

export const Permission = {
  /** bit 0: 账号可登录 */
  LOGIN: 1 << 0,
  /** bit 1: 管理员 */
  ADMIN: 1 << 1,
} as const;

export type PermissionFlag = (typeof Permission)[keyof typeof Permission];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 检测是否拥有指定权限位 */
export function hasPermission(permissions: number, flag: PermissionFlag): boolean {
  return (permissions & flag) !== 0;
}

/** 授予指定权限位，返回新值 */
export function grantPermission(permissions: number, flag: PermissionFlag): number {
  return permissions | flag;
}

/** 撤销指定权限位，返回新值 */
export function revokePermission(permissions: number, flag: PermissionFlag): number {
  return permissions & ~flag;
}

// ─── Preset permission sets ───────────────────────────────────────────────────

/** 普通用户默认权限：仅可登录 */
export const DEFAULT_USER_PERMISSIONS = Permission.LOGIN;

/** 首个注册用户的权限：登录 + 管理员 */
export const FIRST_USER_PERMISSIONS = Permission.LOGIN | Permission.ADMIN;
