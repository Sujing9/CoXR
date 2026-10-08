import { useSpaceUIStore } from '../../data/spaceUIStore';
import { RecordTypePanel } from './RecordTypePanel';
import { ViewPanel } from './ViewPanel';
import { RecordDetailPanel } from './RecordDetailPanel';
import { SceneItemPanel } from './SceneItemPanel';

export function DetailPanel() {
  const { focus } = useSpaceUIStore();

  if (!focus) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-base font-bold text-slate-500">从左侧选择一个项目</p>
      </div>
    );
  }

  switch (focus.kind) {
    case 'recordType':
      return <RecordTypePanel id={focus.id} />;
    case 'view':
      return <ViewPanel id={focus.id} />;
    case 'record':
      return <RecordDetailPanel id={focus.id} returnViewId={focus.returnViewId} />;
    case 'sceneItem':
      return <SceneItemPanel id={focus.id} />;
  }
}
