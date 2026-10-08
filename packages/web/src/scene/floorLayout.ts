import {
  applyView,
  type Bar3DItem,
  type FieldDef,
  type FieldValue,
  type Line3DItem,
  type SceneItem,
  type Scatter3DItem,
  type SerializedDoc,
  type Transform3D,
} from '@coxr/shared';
import * as THREE from 'three';
import { WORLD } from '../constants/world';

const DEG2RAD = Math.PI / 180;
const BAR_GAP = 1.2;
const SCATTER_RANGE = 4;
const LINE_RANGE = 4;
const AXIS_EXTRA = 0.5;
const FLOOR_MARGIN = 1;
const LINE_HALF_DEPTH = 0.14;
const BAR_HALF_SIZE = 0.3;
const SCATTER_MAX_RADIUS = 0.35;
const LINE_POINT_RADIUS = 0.14;
const ORIGIN_RADIUS = 0.12;
const BAR_MAX_HEIGHT = 4.6;
const CHART_AXIS_HEIGHT = 4.5;

interface BoundsXZ {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Bounds3D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface FloorLayout {
  size: number;
  divisions: number;
}

function toDisplayStr(v: FieldValue, fieldDef?: FieldDef): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (fieldDef?.type === 'select' && typeof v === 'string') {
    return fieldDef.options.find((option) => option.id === v)?.name ?? v;
  }
  if (fieldDef?.type === 'multiSelect' && Array.isArray(v)) {
    return v.map((id) => fieldDef.options.find((option) => option.id === id)?.name ?? id).join(', ');
  }
  return String(v);
}

function emptyBounds(): BoundsXZ {
  return {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };
}

function includePoint(bounds: BoundsXZ, x: number, z: number) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxZ = Math.max(bounds.maxZ, z);
}

function mergeBounds(target: BoundsXZ, patch: BoundsXZ | null) {
  if (!patch) return;
  includePoint(target, patch.minX, patch.minZ);
  includePoint(target, patch.maxX, patch.maxZ);
}

function toWorldPoint(localX: number, localY: number, localZ: number, transform: Transform3D): THREE.Vector3 {
  const [rotX, rotY, rotZ] = transform.rotation;
  const euler = new THREE.Euler(rotX * DEG2RAD, rotY * DEG2RAD, rotZ * DEG2RAD);
  const point = new THREE.Vector3(
    localX * transform.scale[0],
    localY * transform.scale[1],
    localZ * transform.scale[2],
  );

  point.applyEuler(euler);
  point.x += transform.position[0];
  point.y += transform.position[1];
  point.z += transform.position[2];

  return point;
}

function transformLocalBox(transform: Transform3D, bounds3d: Bounds3D): BoundsXZ {
  const bounds = emptyBounds();
  const corners: Array<[number, number, number]> = [
    [bounds3d.minX, bounds3d.minY, bounds3d.minZ],
    [bounds3d.minX, bounds3d.minY, bounds3d.maxZ],
    [bounds3d.minX, bounds3d.maxY, bounds3d.minZ],
    [bounds3d.minX, bounds3d.maxY, bounds3d.maxZ],
    [bounds3d.maxX, bounds3d.minY, bounds3d.minZ],
    [bounds3d.maxX, bounds3d.minY, bounds3d.maxZ],
    [bounds3d.maxX, bounds3d.maxY, bounds3d.minZ],
    [bounds3d.maxX, bounds3d.maxY, bounds3d.maxZ],
  ];

  corners.forEach(([x, y, z]) => {
    const worldPoint = toWorldPoint(x, y, z, transform);
    includePoint(bounds, worldPoint.x, worldPoint.z);
  });

  return bounds;
}

function getBarLocalBounds(doc: SerializedDoc, item: Bar3DItem): Bounds3D {
  const view = doc.views[item.sourceViewId];
  const recordType = view ? doc.recordTypes[view.recordTypeId] : undefined;
  const rows = view ? applyView(doc, view) : [];
  if (!item.xField || !item.yField || !recordType) {
    return {
      minX: -BAR_HALF_SIZE,
      maxX: 1.5,
      minY: -ORIGIN_RADIUS,
      maxY: BAR_MAX_HEIGHT,
      minZ: -BAR_HALF_SIZE,
      maxZ: 1.5,
    };
  }

  const xFieldDef = recordType.fields[item.xField];
  const zFieldDef = item.zField ? recordType.fields[item.zField] : undefined;
  const xCategories = new Set<string>();
  const zCategories = new Set<string>();

  rows.forEach((row) => {
    xCategories.add(toDisplayStr((row.data as Record<string, FieldValue>)[item.xField!] ?? null, xFieldDef));
    if (item.zField) {
      zCategories.add(toDisplayStr((row.data as Record<string, FieldValue>)[item.zField] ?? null, zFieldDef));
    }
  });

  const xCount = xCategories.size;
  const zCount = item.zField ? zCategories.size : 1;
  const hasBars = rows.length > 0;
  const maxBarX = xCount > 0 ? (xCount - 1) * BAR_GAP : 0;
  const maxBarZ = zCount > 0 ? (zCount - 1) * BAR_GAP : 0;
  const xAxisLen = (hasBars ? maxBarX + 1 : 1) + AXIS_EXTRA;
  const zAxisLen = (hasBars ? maxBarZ + 1 : 1) + AXIS_EXTRA;

  return {
    minX: -Math.max(BAR_HALF_SIZE, ORIGIN_RADIUS),
    maxX: Math.max(xAxisLen, maxBarX + BAR_HALF_SIZE),
    minY: -ORIGIN_RADIUS,
    maxY: BAR_MAX_HEIGHT,
    minZ: -Math.max(BAR_HALF_SIZE, ORIGIN_RADIUS),
    maxZ: Math.max(zAxisLen, maxBarZ + BAR_HALF_SIZE),
  };
}

function getScatterLocalBounds(): Bounds3D {
  const axisLen = SCATTER_RANGE + AXIS_EXTRA;
  return {
    minX: -Math.max(SCATTER_MAX_RADIUS, ORIGIN_RADIUS),
    maxX: axisLen,
    minY: -ORIGIN_RADIUS,
    maxY: CHART_AXIS_HEIGHT,
    minZ: -Math.max(SCATTER_MAX_RADIUS, ORIGIN_RADIUS),
    maxZ: axisLen,
  };
}

function getLineLocalBounds(): Bounds3D {
  const axisLen = LINE_RANGE + AXIS_EXTRA;
  return {
    minX: -Math.max(LINE_POINT_RADIUS, ORIGIN_RADIUS),
    maxX: axisLen,
    minY: -ORIGIN_RADIUS,
    maxY: CHART_AXIS_HEIGHT,
    minZ: -LINE_HALF_DEPTH,
    maxZ: LINE_HALF_DEPTH,
  };
}

function getItemBounds(doc: SerializedDoc, item: SceneItem): BoundsXZ | null {
  switch (item.kind) {
    case 'bar3d':
      return transformLocalBox(item.transform3d, getBarLocalBounds(doc, item));
    case 'scatter3d': {
      const local = getScatterLocalBounds();
      return transformLocalBox(item.transform3d, local);
    }
    case 'line3d': {
      const local = getLineLocalBounds();
      return transformLocalBox(item.transform3d, local);
    }
    case 'label': {
      const worldPoint = toWorldPoint(0, 0, 0, item.transform3d);
      return { minX: worldPoint.x, maxX: worldPoint.x, minZ: worldPoint.z, maxZ: worldPoint.z };
    }
    default:
      return null;
  }
}

export function getFloorLayout(doc: SerializedDoc | null | undefined): FloorLayout {
  const bounds = emptyBounds();

  includePoint(bounds, 0, 0);

  if (doc) {
    Object.values(doc.scene.items).forEach((item) => {
      mergeBounds(bounds, getItemBounds(doc, item));
    });
  }

  const halfExtent = Math.max(
    Math.abs(bounds.minX),
    Math.abs(bounds.maxX),
    Math.abs(bounds.minZ),
    Math.abs(bounds.maxZ),
  );
  const size = Math.max(WORLD.FLOOR_SIZE, Math.ceil(halfExtent * 2 + FLOOR_MARGIN * 2));

  return {
    size,
    divisions: Math.max(WORLD.FLOOR_DIVISIONS, Math.ceil(size)),
  };
}