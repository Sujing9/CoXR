/**
 * Voice signaling message types (client ↔ server over WebSocket).
 * All messages are JSON. Client→Server requests carry a `requestId`;
 * server responds with the same `requestId`.
 * Server push events have no `requestId`.
 */

// ─── Client → Server ──────────────────────────────────────────────────────────

export interface GetRouterRtpCapabilitiesRequest {
  type: 'getRouterRtpCapabilities';
  requestId: string;
}

export interface CreateTransportRequest {
  type: 'createTransport';
  requestId: string;
  direction: 'send' | 'recv';
}

export interface ConnectTransportRequest {
  type: 'connectTransport';
  requestId: string;
  transportId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dtlsParameters: any;
}

export interface ProduceRequest {
  type: 'produce';
  requestId: string;
  transportId: string;
  kind: 'audio';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtpParameters: any;
}

export interface CloseProducerRequest {
  type: 'closeProducer';
  requestId: string;
  producerId: string;
}

export interface GetParticipantsRequest {
  type: 'getParticipants';
  requestId: string;
}

export interface ConsumeRequest {
  type: 'consume';
  requestId: string;
  producerId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtpCapabilities: any;
}

export interface ResumeConsumerRequest {
  type: 'resumeConsumer';
  requestId: string;
  consumerId: string;
}

export type ClientRequest =
  | GetRouterRtpCapabilitiesRequest
  | CreateTransportRequest
  | ConnectTransportRequest
  | ProduceRequest
  | CloseProducerRequest
  | GetParticipantsRequest
  | ConsumeRequest
  | ResumeConsumerRequest;

// ─── Server → Client (responses) ─────────────────────────────────────────────

export interface OkResponse {
  type: 'ok';
  requestId: string;
}

export interface ErrorResponse {
  type: 'error';
  requestId: string;
  message: string;
}

export interface RouterRtpCapabilitiesResponse {
  type: 'routerRtpCapabilities';
  requestId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtpCapabilities: any;
}

export interface TransportCreatedResponse {
  type: 'transportCreated';
  requestId: string;
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  iceParameters: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  iceCandidates: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dtlsParameters: any;
}

export interface ProducedResponse {
  type: 'produced';
  requestId: string;
  id: string;
}

export interface ConsumedResponse {
  type: 'consumed';
  requestId: string;
  id: string;
  producerId: string;
  kind: 'audio';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtpParameters: any;
}

export interface ParticipantsResponse {
  type: 'participants';
  requestId: string;
  participants: ParticipantInfo[];
}

// ─── Server → Client (push events) ───────────────────────────────────────────

export interface ParticipantInfo {
  userId: string;
  nickname: string;
  producerId: string | null;
}

export interface ParticipantJoinedEvent {
  type: 'participantJoined';
  participant: ParticipantInfo;
}

export interface ParticipantLeftEvent {
  type: 'participantLeft';
  userId: string;
}

export interface ProducerClosedEvent {
  type: 'producerClosed';
  producerId: string;
  userId: string;
}
