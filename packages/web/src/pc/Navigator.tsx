import { useState } from 'react';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    DatabaseIcon,
    EyeIcon,
    LayersIcon,
    PlusIcon,
} from 'lucide-react';
import { getNextRecordTypeName, getNextSceneItemName, getNextViewName } from '@/lib/autoName';
import { cn } from '@/lib/utils';
import { useDoc } from '../data/DocContext';
import { useSpaceUIStore } from '../data/spaceUIStore';
import type { FieldId, RecordTypeId, SceneItemId, ViewId } from '@coxr/shared';
import { uuid } from '@coxr/shared';

// ── Section collapse ──────────────────────────────────────────────────────────

function Section({
    label,
    icon: Icon,
    children,
    onAdd,
    addTitle,
}: {
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    children: React.ReactNode;
    onAdd?: () => void;
    addTitle?: string;
}) {
    const [open, setOpen] = useState(true);
    return (
        <div>
            <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="flex flex-1 items-center gap-2 text-left text-[11px] font-bold uppercase tracking-wider text-black/40 hover:text-black/70 transition-colors"
                >
                    {open ? <ChevronDownIcon size={12} strokeWidth={2.5} /> : <ChevronRightIcon size={12} strokeWidth={2.5} />}
                    <Icon size={14} strokeWidth={2.5} />
                    {label}
                </button>
                {onAdd && (
                    <button
                        onClick={onAdd}
                        title={addTitle}
                        className="rounded-lg p-1 text-black/40 hover:bg-black/5 hover:text-black transition-colors"
                    >
                        <PlusIcon size={14} strokeWidth={2.5} />
                    </button>
                )}
            </div>
            {open && <div className="pb-1">{children}</div>}
        </div>
    );
}

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({
    label,
    sub,
    active,
    onClick,
}: {
    label: string;
    sub?: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all',
                active
                    ? 'bg-black/5 text-black font-bold shadow-sm ring-1 ring-black/5'
                    : 'text-black/60 font-semibold hover:bg-black/5 hover:text-black',
            )}
        >
            <span className="truncate">{label}</span>
            {sub && (
                <span className={cn(
                    "shrink-0 text-[10px] px-1.5 py-0.5 rounded-md transition-colors",
                    active ? "bg-black/10 text-black/70" : "bg-black/5 text-black/30"
                )}>{sub}</span>
            )}
        </button>
    );
}

// ── Navigator ─────────────────────────────────────────────────────────────────

export function Navigator() {
    const { doc, upsertRecordType, upsertView, upsertSceneItem } = useDoc();
    const { focus, focusRecordType, focusView, focusSceneItem, detailPanelVisible, toggleDetailPanelVisible } = useSpaceUIStore();

    if (!doc) return null;

    const recordTypes = Object.values(doc.recordTypes);
    const views = Object.values(doc.views);
    const sceneItems = Object.values(doc.scene.items);

    const focusKind = focus?.kind ?? null;
    const focusId = focus ? ('id' in focus ? focus.id : null) : null;

    // ── 创建处理 ──────────────────────────────────────────────────────────────

    const handleAddRecordType = () => {
        const newName = getNextRecordTypeName(recordTypes.map((rt) => rt.name));

        const id = uuid() as unknown as RecordTypeId;
        const primaryFieldId = uuid() as unknown as FieldId;
        upsertRecordType({
            id,
            name: newName,
            primaryFieldId,
            fields: {
                [primaryFieldId]: { id: primaryFieldId, name: '标题', type: 'text' },
            },
            fieldOrder: [primaryFieldId],
        });
        focusRecordType(id);
    };

    const handleAddView = () => {
        // 需要至少一个数据源
        const firstType = recordTypes[0];
        if (!firstType) return;
        const id = uuid() as unknown as ViewId;
        upsertView({
            id,
            name: getNextViewName(views.map((view) => view.name)),
            kind: 'table',
            recordTypeId: firstType.id,
            filter: [],
            sort: [],
            group: null,
            fieldVisibility: {},
            fieldOrder: [...firstType.fieldOrder],
        });
        focusView(id);
    };

    const handleAddSceneItem = () => {
        // 需要至少一个视图
        const firstView = views[0];
        if (!firstView) return;
        const id = uuid() as unknown as SceneItemId;
        upsertSceneItem({
            id,
            kind: 'bar3d',
            name: getNextSceneItemName(sceneItems.map((item) => ('name' in item ? item.name ?? '' : ''))),
            sourceViewId: firstView.id,
            xField: null,
            yField: null,
            zField: null,
            transform3d: { position: [0, 0.3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        });
        focusSceneItem(id);
    };

    return (
        <nav
            className={cn(
                'w-56 max-h-full overflow-hidden flex flex-col',
                'rounded-2xl border border-black/10 bg-white/90 shadow-xl backdrop-blur-xl',
                'py-3 px-1',
            )}
        >
            <div className='flex-1 flex flex-col gap-1 overflow-y-auto px-1'>
                {/* 数据源 */}
                <Section label="数据源" icon={DatabaseIcon} addTitle="新建数据源" onAdd={handleAddRecordType}>
                    {recordTypes.length === 0 && (
                        <p className="px-3 py-2 text-xs font-bold text-black/30">暂无数据源</p>
                    )}
                    {recordTypes.map((rt) => {
                        const count = Object.values(doc.records).filter(
                            (r) => r.typeId === rt.id,
                        ).length;
                        return (
                            <NavItem
                                key={rt.id}
                                label={rt.name}
                                sub={String(count)}
                                active={focusKind === 'recordType' && focusId === rt.id}
                                onClick={() => focusRecordType(rt.id as RecordTypeId)}
                            />
                        );
                    })}
                </Section>

                <div className="mx-2 my-1 border-t border-black/5" />

                {/* 视图 */}
                <Section label="视图" icon={EyeIcon} addTitle={recordTypes.length ? '新建视图' : '请先创建数据源'} onAdd={recordTypes.length ? handleAddView : undefined}>
                    {views.length === 0 && (
                        <p className="px-3 py-2 text-xs font-bold text-black/30">暂无视图</p>
                    )}
                    {views.map((v) => {
                        const rtName = doc.recordTypes[v.recordTypeId]?.name;
                        return (
                            <NavItem
                                key={v.id}
                                label={v.name}
                                sub={rtName}
                                active={focusKind === 'view' && focusId === v.id}
                                onClick={() => focusView(v.id as ViewId)}
                            />
                        );
                    })}
                </Section>

                <div className="mx-2 my-1 border-t border-black/5" />

                {/* 场景元素 */}
                <Section label="场景元素" icon={LayersIcon} addTitle={views.length ? '新建场景元素' : '请先创建视图'} onAdd={views.length ? handleAddSceneItem : undefined}>
                    {sceneItems.length === 0 && (
                        <p className="px-3 py-2 text-xs font-bold text-black/30">暂无场景元素</p>
                    )}
                    {sceneItems.map((item) => (
                        <NavItem
                            key={item.id}
                            label={'name' in item && item.name ? item.name : item.kind === 'bar3d' ? '3D 柱状图' : '标签'}
                            sub={item.kind}
                            active={focusKind === 'sceneItem' && focusId === item.id}
                            onClick={() => focusSceneItem(item.id as SceneItemId)}
                        />
                    ))}
                </Section>

                {/* 右侧面板开关 */}
                <div className="mx-2 my-1 border-t border-black/5" />
                <div className="flex items-center justify-between px-3 py-3">
                    <span className="text-xs font-bold text-black/50">显示详情面板</span>
                    <button
                        role="switch"
                        aria-checked={detailPanelVisible}
                        onClick={toggleDetailPanelVisible}
                        className={cn(
                            'relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-inner transition-colors duration-200 focus-visible:outline-none',
                            detailPanelVisible ? 'bg-indigo-500' : 'bg-black/10',
                        )}
                    >
                        <span
                            className={cn(
                                'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md',
                                'transition-transform duration-200',
                                detailPanelVisible ? 'translate-x-5' : 'translate-x-0',
                            )}
                        />
                    </button>
                </div>
            </div>
        </nav>
    );
}
