import { useCallback, useEffect, useState } from 'react';
import { useSpaceStore } from '@/data/spaceStore';
import { useDoc } from '@/data/DocContext';
import { spacesApi, type SnapshotMeta } from '@/api/spaces';
import { Plate, Btn, Label } from '../space/primitives';
import { StatusBar, type StatusKind, type StatusMsg } from '../space/StatusBar';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 4;
const ROW_H = 0.062;
const ROW_GAP = 0.007;
const CREATE_BTN_H = 0.048;
const STATUS_BAR_H = 0.044;
const PAGE_BTN_H = 0.040;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${h}:${min}`;
}

function generateSnapshotName(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `快照 ${m}月${day}日 ${h}:${min}`;
}

// ─── SnapshotRow ──────────────────────────────────────────────────────────────

function SnapshotRow({
  snapshot,
  width,
  isOwner,
  isRestoring,
  onDelete,
  onRestore,
}: {
  snapshot: SnapshotMeta;
  width: number;
  isOwner: boolean;
  isRestoring: boolean;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const DEL_BTN_W = 0.052;
  const RESTORE_BTN_W = 0.068;
  const BTN_GAP = 0.006;

  // Right-to-left: restore btn → gap → delete btn → gap → name
  const restoreCX = isOwner ? width / 2 - 0.010 - RESTORE_BTN_W / 2 : 0;
  const delCX = restoreCX - RESTORE_BTN_W / 2 - BTN_GAP - DEL_BTN_W / 2;
  const nameRX = isOwner ? delCX - DEL_BTN_W / 2 - 0.008 : width / 2 - 0.014;
  const nameLX = -width / 2 + 0.014;
  const nameMaxW = nameRX - nameLX;

  return (
    <group>
      <Plate width={width} height={ROW_H} radius={0.010} color="rgba(0,0,0,0.04)" />

      <group position={[0, 0, 0.001]}>
        {/* Snapshot name */}
        <Label
          x={nameLX}
          y={ROW_H * 0.15}
          text={snapshot.name}
          fontSize={0.020}
          color="#000"
          anchorX="left"
          maxWidth={nameMaxW}
        />

        {/* Creation date */}
        <Label
          x={nameLX}
          y={-ROW_H * 0.22}
          text={formatDate(snapshot.createdAt)}
          fontSize={0.014}
          color="#444"
          anchorX="left"
        />

        {/* Owner actions */}
        {isOwner && (
          <>
            <Btn
              x={delCX}
              width={DEL_BTN_W}
              height={0.036}
              radius={0.008}
              label="删除"
              fontSize={0.013}
              variant="danger"
              onPress={onDelete}
            />
            <Btn
              x={restoreCX}
              width={RESTORE_BTN_W}
              height={0.036}
              radius={0.008}
              label="恢复"
              fontSize={0.013}
              variant="ghost"
              disabled={isRestoring}
              onPress={onRestore}
            />
          </>
        )}
      </group>
    </group>
  );
}

// ─── SnapshotTab ──────────────────────────────────────────────────────────────

interface SnapshotTabProps {
  width: number;
  height: number;
}

export function SnapshotTab({ width, height }: SnapshotTabProps) {
  const activeSpace = useSpaceStore((s) => s.activeSpace);
  const { getDocAsBase64, restoreFromSnapshot } = useDoc();

  const isOwner = (activeSpace?.myRole ?? 0) === 2;

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<SnapshotMeta | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMsg | null>(null);

  const pushStatus = useCallback((kind: StatusKind, text: string) => {
    setStatus({ kind, text, nonce: performance.now() });
  }, []);
  const clearStatus = useCallback(() => setStatus(null), []);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeSpace) return;
    setLoading(true);
    setPage(0);
    spacesApi
      .listSnapshots(activeSpace.id)
      .then(({ snapshots: list }) => setSnapshots(list))
      .catch(() => pushStatus('error', '加载快照列表失败'))
      .finally(() => setLoading(false));
  }, [activeSpace, pushStatus]);

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!activeSpace || creating) return;
    const base64 = getDocAsBase64();
    if (!base64) {
      pushStatus('error', '无法读取当前文档状态');
      return;
    }
    const name = generateSnapshotName();
    setCreating(true);
    try {
      const { snapshot } = await spacesApi.createSnapshot(activeSpace.id, name, base64);
      setSnapshots((prev) => [...prev, snapshot]);
      pushStatus('success', '快照已创建');
    } catch {
      pushStatus('error', '创建快照失败');
    } finally {
      setCreating(false);
    }
  }, [activeSpace, creating, getDocAsBase64, pushStatus]);

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (snapshotId: string) => {
    if (!activeSpace) return;
    try {
      await spacesApi.deleteSnapshot(activeSpace.id, snapshotId);
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      setConfirmDeleteId(null);
      pushStatus('success', '快照已删除');
    } catch {
      pushStatus('error', '删除快照失败');
      setConfirmDeleteId(null);
    }
  }, [activeSpace, pushStatus]);

  // ── Restore ───────────────────────────────────────────────────────────────

  const handleRestore = useCallback(async (snapshot: SnapshotMeta) => {
    if (!activeSpace) return;
    setRestoringId(snapshot.id);
    try {
      const { yjsDocument } = await spacesApi.restoreSnapshot(activeSpace.id, snapshot.id);
      restoreFromSnapshot(yjsDocument);
      setConfirmRestore(null);
      pushStatus('success', `「${snapshot.name}」已恢复`);
    } catch {
      pushStatus('error', '恢复快照失败');
    } finally {
      setRestoringId(null);
      setConfirmRestore(null);
    }
  }, [activeSpace, restoreFromSnapshot, pushStatus]);

  // ── Layout constants ──────────────────────────────────────────────────────

  const statusBarY = height / 2 - STATUS_BAR_H / 2;
  const titleY = height / 2 - 0.022;
  const afterTitleBottom = titleY - 0.014;

  // Create button sits below the title row (owner only)
  const createBtnY = afterTitleBottom - CREATE_BTN_H / 2 - 0.006;
  const afterCreateBottom = isOwner
    ? createBtnY - CREATE_BTN_H / 2 - 0.010
    : afterTitleBottom - 0.006;

  const totalPages = Math.max(1, Math.ceil(snapshots.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = snapshots.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const hasPagination = totalPages > 1;

  // Pagination bar at the bottom
  const pageBarY = -height / 2 + PAGE_BTN_H / 2 + 0.008;
  const listBodyBottom = hasPagination ? pageBarY + PAGE_BTN_H / 2 + 0.008 : -height / 2;

  // List body fills remaining space
  const listBodyTop = afterCreateBottom;
  const listBodyH = listBodyTop - listBodyBottom;
  const listBodyCY = (listBodyTop + listBodyBottom) / 2;

  // ── Confirm Delete Overlay ────────────────────────────────────────────────

  if (confirmDeleteId) {
    const target = snapshots.find((s) => s.id === confirmDeleteId);
    const overlayW = width * 0.90;
    const overlayH = height * 0.44;
    return (
      <group>
        <Plate x={0} y={0} width={overlayW} height={overlayH} radius={0.018} color="rgba(255,255,255,0.98)">
          <Label
            y={overlayH * 0.26}
            text="确认删除快照"
            fontSize={0.026}
            color="#000"
          />
          <Label
            y={overlayH * 0.06}
            text={`「${target?.name ?? ''}」？`}
            fontSize={0.024}
            color="#111"
            maxWidth={overlayW * 0.85}
          />
          <Label
            y={-overlayH * 0.10}
            text="此操作不可撤销。"
            fontSize={0.018}
            color="#444"
          />
          <group position={[0, -overlayH * 0.30, 0.001]}>
            <Btn
              x={-overlayW * 0.24}
              width={overlayW * 0.40}
              height={0.052}
              label="取消"
              variant="ghost"
              onPress={() => setConfirmDeleteId(null)}
            />
            <Btn
              x={overlayW * 0.24}
              width={overlayW * 0.40}
              height={0.052}
              label="确认删除"
              variant="danger"
              onPress={() => handleDelete(confirmDeleteId)}
            />
          </group>
        </Plate>
        <StatusBar status={status} onClear={clearStatus} width={width} y={statusBarY} />
      </group>
    );
  }

  // ── Confirm Restore Overlay ───────────────────────────────────────────────

  if (confirmRestore) {
    const overlayW = width * 0.90;
    const overlayH = height * 0.52;
    return (
      <group>
        <Plate x={0} y={0} width={overlayW} height={overlayH} radius={0.018} color="rgba(255,255,255,0.98)">
          <Label
            y={overlayH * 0.30}
            text="确认恢复快照"
            fontSize={0.026}
            color="#000"
          />
          <Label
            y={overlayH * 0.12}
            text={`「${confirmRestore.name}」？`}
            fontSize={0.024}
            color="#111"
            maxWidth={overlayW * 0.85}
          />
          <Label
            y={-overlayH * 0.05}
            text="当前未保存的变更将会丢失，"
            fontSize={0.018}
            color="#444"
          />
          <Label
            y={-overlayH * 0.14}
            text="此操作不可撤销。"
            fontSize={0.018}
            color="#444"
          />
          <group position={[0, -overlayH * 0.33, 0.001]}>
            <Btn
              x={-overlayW * 0.24}
              width={overlayW * 0.40}
              height={0.052}
              label="取消"
              variant="ghost"
              disabled={restoringId === confirmRestore.id}
              onPress={() => setConfirmRestore(null)}
            />
            <Btn
              x={overlayW * 0.24}
              width={overlayW * 0.40}
              height={0.052}
              label={restoringId === confirmRestore.id ? '恢复中…' : '确认恢复'}
              variant="primary"
              disabled={restoringId === confirmRestore.id}
              onPress={() => handleRestore(confirmRestore)}
            />
          </group>
        </Plate>
        <StatusBar status={status} onClear={clearStatus} width={width} y={statusBarY} />
      </group>
    );
  }

  // ── Main View ─────────────────────────────────────────────────────────────

  return (
    <group>
      {/* Title */}
      <Label
        x={-width / 2 + 0.016}
        y={titleY}
        text="快照管理"
        fontSize={0.028}
        anchorX="left"
        color="#000"
      />
      {snapshots.length > 0 && (
        <Label
          x={width / 2 - 0.016}
          y={titleY}
          text={`共 ${snapshots.length} 个`}
          fontSize={0.018}
          anchorX="right"
          color="#333"
        />
      )}

      {/* Create button (owner only) */}
      {isOwner && (
        <Btn
          x={0}
          y={createBtnY}
          width={width}
          height={CREATE_BTN_H}
          radius={0.010}
          label={creating ? '创建中…' : '快照当前状态'}
          fontSize={0.022}
          variant="ghost"
          disabled={creating}
          onPress={handleCreate}
        />
      )}

      {/* List body */}
      {loading ? (
        <Label
          y={listBodyCY}
          text="加载中…"
          fontSize={0.022}
          color="#444"
        />
      ) : pageItems.length === 0 ? (
        <Label
          y={listBodyCY}
          text="暂无快照"
          fontSize={0.022}
          color="#555"
        />
      ) : (
        <group position={[0, listBodyCY, 0]}>
          {pageItems.map((snapshot, i) => {
            const startY = listBodyH / 2 - ROW_H / 2;
            return (
              <group key={snapshot.id} position={[0, startY - i * (ROW_H + ROW_GAP), 0]}>
                <SnapshotRow
                  snapshot={snapshot}
                  width={width}
                  isOwner={isOwner}
                  isRestoring={restoringId === snapshot.id}
                  onDelete={() => setConfirmDeleteId(snapshot.id)}
                  onRestore={() => setConfirmRestore(snapshot)}
                />
              </group>
            );
          })}
        </group>
      )}

      {/* Pagination */}
      {hasPagination && (
        <group position={[0, pageBarY, 0]}>
          <Btn
            x={-width * 0.28}
            width={width * 0.28}
            height={PAGE_BTN_H}
            radius={0.010}
            label="上一页"
            fontSize={0.016}
            variant="ghost"
            disabled={safePage === 0}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          />
          <Label
            text={`${safePage + 1} / ${totalPages}`}
            fontSize={0.018}
            color="#222"
          />
          <Btn
            x={width * 0.28}
            width={width * 0.28}
            height={PAGE_BTN_H}
            radius={0.010}
            label="下一页"
            fontSize={0.016}
            variant="ghost"
            disabled={safePage >= totalPages - 1}
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </group>
      )}

      {/* Status bar */}
      <StatusBar status={status} onClear={clearStatus} width={width} y={statusBarY} />
    </group>
  );
}
