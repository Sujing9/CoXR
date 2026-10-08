import type { AnnotationId, FieldId, SceneItemId, ViewId } from './ids.js';

export type Vec3 = [number, number, number];

export interface Transform3D {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

// --------------------------- Bar3DItem ---------------------------

/**
 * 3D 柱状图场景元素。
 * xField / zField 为类别轴（决定柱子在 XZ 平面上的位置），
 * yField 为数值轴（决定柱子高度）。
 * 三个字段均指向 sourceViewId 所属 RecordType 的 FieldId。
 */
export interface Bar3DItem {
  id: SceneItemId;
  kind: 'bar3d';
  name?: string;
  sourceViewId: ViewId;
  /** X 轴（类别/数值）列 */
  xField: FieldId | null;
  /** Y 轴（高度，通常为数值列）列 */
  yField: FieldId | null;
  /** Z 轴（类别/数值）列，可选 */
  zField: FieldId | null;
  transform3d: Transform3D;
}

// --------------------------- Scatter3DItem ---------------------------

/**
 * 3D 散点图场景元素。
 * xField / yField / zField 均为数值轴，决定每个数据点的空间坐标。
 * colorField 可选，用于着色分组。
 * sizeField 可选，用于缩放球体大小。
 */
export interface Scatter3DItem {
  id: SceneItemId;
  kind: 'scatter3d';
  name?: string;
  sourceViewId: ViewId;
  xField: FieldId | null;
  yField: FieldId | null;
  zField: FieldId | null;
  colorField: FieldId | null;
  sizeField: FieldId | null;
  transform3d: Transform3D;
}

// --------------------------- Line3DItem ---------------------------

/**
 * 3D 折线图场景元素。
 * xField 为类别/时间轴（X 方向排列），yField 为数值轴（线的高低）。
 * colorField 可选，用于按字段值拆分为多系列折线，每系列独立着色。
 */
export interface Line3DItem {
  id: SceneItemId;
  kind: 'line3d';
  name?: string;
  sourceViewId: ViewId;
  /** X 轴（类别 / 时间），决定数据点沿 X 方向的排布顺序和标签 */
  xField: FieldId | null;
  /** Y 轴（数值），决定折线的高低 */
  yField: FieldId | null;
  /** 分系列字段（可选）：按此字段的不同值绘制多条折线 */
  colorField: FieldId | null;
  transform3d: Transform3D;
}

// --------------------------- LabelItem ---------------------------

export interface LabelItem {
  id: SceneItemId;
  kind: 'label';
  annotationId: AnnotationId;
  transform3d: Transform3D;
}

// --------------------------- Scene ---------------------------

export type SceneItem = Bar3DItem | Scatter3DItem | Line3DItem | LabelItem;

/**
 * 一个协同文档只有一个 scene（单例）。
 * items 以 id 索引，Yjs 同步态下为 Y.Map<SceneItemId, SceneItem>。
 */
export interface Scene {
  items: { [itemId: string]: SceneItem };
}
