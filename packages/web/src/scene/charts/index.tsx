import { useMemo } from 'react';
import type { Bar3DItem, Scatter3DItem, Line3DItem, SceneItem, Transform3D } from '@coxr/shared';
import { useDoc } from '../../data/DocContext';
import { Bar3DChart } from './Bar3DChart';
import { Scatter3DChart } from './Scatter3DChart';
import { Line3DChart } from './Line3DChart';

/**
 * 图表子树入口。消费 scene.items 中所有图表类型的 item。
 */
export function Charts() {
  const { doc, upsertSceneItem } = useDoc();

  const bar3dItems = useMemo(() => {
    if (!doc) return [];
    return (Object.values(doc.scene.items) as SceneItem[]).filter(
      (it): it is Bar3DItem => it.kind === 'bar3d',
    );
  }, [doc]);

  const scatter3dItems = useMemo(() => {
    if (!doc) return [];
    return (Object.values(doc.scene.items) as SceneItem[]).filter(
      (it): it is Scatter3DItem => it.kind === 'scatter3d',
    );
  }, [doc]);

  const line3dItems = useMemo(() => {
    if (!doc) return [];
    return (Object.values(doc.scene.items) as SceneItem[]).filter(
      (it): it is Line3DItem => it.kind === 'line3d',
    );
  }, [doc]);

  if (!doc) return null;

  return (
    <>
      {bar3dItems.map((item) => (
        <Bar3DChart
          key={item.id}
          item={item}
          doc={doc}
          onTransformChange={(t: Transform3D) => upsertSceneItem({ ...item, transform3d: t })}
        />
      ))}
      {scatter3dItems.map((item) => (
        <Scatter3DChart
          key={item.id}
          item={item}
          doc={doc}
          onTransformChange={(t: Transform3D) => upsertSceneItem({ ...item, transform3d: t })}
        />
      ))}
      {line3dItems.map((item) => (
        <Line3DChart
          key={item.id}
          item={item}
          doc={doc}
          onTransformChange={(t: Transform3D) => upsertSceneItem({ ...item, transform3d: t })}
        />
      ))}
    </>
  );
}

