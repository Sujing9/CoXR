/**
 * 世界 / 场景级常量（单位：米）
 */
export const WORLD = {
  /** 地板边长 */
  FLOOR_SIZE: 20,
  /** 地板网格分段数（1m 一格）*/
  FLOOR_DIVISIONS: 20,
  /** 默认视点高度 */
  EYE_HEIGHT: 1.6,
} as const;

export const COLORS = {
  /** 背景 */
  BG: '#bbb',
  /** 地板 */
  FLOOR: '#ffffff',
  /** 网格主线 */
  GRID_MAJOR: '#94a3b8',
  /** 网格副线 */
  GRID_MINOR: '#e2e8f0',
  /** 原点标记 */
  ORIGIN: '#374151',
  /** 天空色（半球光上方） */
  SKY: '#cbd5e1',
  /** 地色（半球光下方） */
  GROUND: '#cbd5e1',
} as const;

/**
 * 字体资源路径（放置于 /public 下，Vite 会直接以根路径暴露）。
 * troika-three-text (drei `<Text>`) 支持在线加载 TTF/OTF/WOFF/WOFF2，
 * 按需生成 SDF，避免打包体积膨胀。
 */
export const FONTS = {
  /** 默认中文字体：阿里巴巴普惠体 3 - 65 Medium */
  DEFAULT: '/font/AlibabaPuHuiTi-3-65-Medium.ttf',
} as const;
