import type { FieldId, RecordId, UserId } from './ids.js';
import type { Vec3 } from './scene.js';

/**
 * Awareness (L4) 临场态：在线广播，不持久化，不进入快照。
 */

export interface PresenceUser {
  id: UserId;
  name: string;
  color: string;
}

export interface PointerRay {
  origin: Vec3;
  direction: Vec3;
}

export interface HeadsetPose {
  position: Vec3;
  rotation: Vec3;
}

export interface EditingCursor {
  recordId: RecordId;
  fieldId: FieldId;
}

export interface PresenceState {
  user: PresenceUser;
  selectedRecordIds: RecordId[];
  pointer?: PointerRay;
  headset?: HeadsetPose;
  editing?: EditingCursor;
}
