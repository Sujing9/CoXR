import { Environment } from './Environment';
import { Floor } from './Floor';
import { Charts } from './charts';
import { useDoc } from '../data/DocContext';
import { getFloorLayout } from './floorLayout';

/**
 * 根场景：仅描述世界内容，不感知 PC / XR 模式。
 * PC 与 XR 共用同一棵子树，由外层 Rig 组件提供相机与控制器。
 */
export function Scene() {
  const { doc } = useDoc();
  const floor = getFloorLayout(doc);

  return (
    <group>
      <Environment />
      <Floor size={floor.size} divisions={floor.divisions} />
      <Charts />
    </group>
  );
}
