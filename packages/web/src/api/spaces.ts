import { request } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpaceInfo {
  id: string;
  accessCode: string;
  creatorUserId: string;
  ownerUserId: string;
  status: number;
  createdAt: string;
  myRole?: number;
  /** 当前用户在该空间中的成员状态：2=ACTIVE（在线），1=APPROVED_PENDING_JOIN（离线成员或新批准），0=PENDING（申请中） */
  memberStatus?: number;
  /** 最后建立 Yjs 连接的时间；为 null 表示已批准但还未连接过 */
  lastJoinedAt?: string | null;
}

export interface SnapshotMeta {
  id: string;
  spaceId: string;
  name: string;
  createdByUserId: string;
  createdAt: string;
}

export interface SpaceMember {
  memberId: string;
  userId: string;
  memberRole: number;
  memberStatus: number;
  lastJoinedAt: string | null;
  lastLeftAt: string | null;
  nickname: string;
  username: string;
}

export interface SpaceApplication {
  memberId: string;
  userId: string;
  memberRole: number;
  memberStatus: number;
  createdAt: string;
  nickname: string;
  username: string;
}

export interface RemovedMember {
  memberId: string;
  userId: string;
  memberRole: number;
  memberStatus: number;
  updatedAt: string;
  nickname: string;
  username: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const spacesApi = {
  create(): Promise<{ space: SpaceInfo }> {
    return request('/api/spaces', { method: 'POST', body: {} });
  },

  mine(): Promise<{ spaces: SpaceInfo[] }> {
    return request('/api/spaces/mine');
  },

  get(spaceId: string): Promise<{ space: SpaceInfo }> {
    return request(`/api/spaces/${spaceId}`);
  },

  join(accessCode: string): Promise<{ space: SpaceInfo; joined: boolean; pending: boolean; alreadyMember?: boolean }> {
    return request('/api/spaces/join', { method: 'POST', body: { accessCode } });
  },

  createSnapshot(spaceId: string, name: string, yjsDocumentBase64: string): Promise<{ snapshot: SnapshotMeta }> {
    return request(`/api/spaces/${spaceId}/snapshots`, {
      method: 'POST',
      body: { name, yjsDocument: yjsDocumentBase64 },
    });
  },

  listSnapshots(spaceId: string): Promise<{ snapshots: SnapshotMeta[] }> {
    return request(`/api/spaces/${spaceId}/snapshots`);
  },

  deleteSnapshot(spaceId: string, snapshotId: string): Promise<{ message: string }> {
    return request(`/api/spaces/${spaceId}/snapshots/${snapshotId}`, { method: 'DELETE' });
  },

  restoreSnapshot(spaceId: string, snapshotId: string): Promise<{ yjsDocument: string }> {
    return request(`/api/spaces/${spaceId}/snapshots/${snapshotId}/restore`, { method: 'POST' });
  },

  delete(spaceId: string): Promise<{ message: string }> {
    return request(`/api/spaces/${spaceId}`, { method: 'DELETE' });
  },

  getMembers(spaceId: string): Promise<{ members: SpaceMember[]; myRole: number }> {
    return request(`/api/spaces/${spaceId}/members`);
  },

  getApplications(spaceId: string): Promise<{ applications: SpaceApplication[] }> {
    return request(`/api/spaces/${spaceId}/applications`);
  },

  getRemovedMembers(spaceId: string): Promise<{ removed: RemovedMember[] }> {
    return request(`/api/spaces/${spaceId}/removed-members`);
  },

  kickMember(spaceId: string, targetUserId: string): Promise<{ message: string }> {
    return request(`/api/spaces/${spaceId}/members/${targetUserId}/kick`, { method: 'POST' });
  },

  unkickMember(spaceId: string, targetUserId: string): Promise<{ message: string }> {
    return request(`/api/spaces/${spaceId}/members/${targetUserId}/unkick`, { method: 'POST' });
  },

  approveApplication(spaceId: string, targetUserId: string): Promise<{ message: string }> {
    return request(`/api/spaces/${spaceId}/applications/${targetUserId}/approve`, { method: 'POST' });
  },

  rejectApplication(spaceId: string, targetUserId: string): Promise<{ message: string }> {
    return request(`/api/spaces/${spaceId}/applications/${targetUserId}/reject`, { method: 'POST' });
  },

  updateSpaceStatus(spaceId: string, status: number): Promise<{ status: number }> {
    return request(`/api/spaces/${spaceId}/status`, { method: 'PATCH', body: { status } });
  },
};
