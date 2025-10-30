
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export interface Turn {
  user: string;
  model: string;
  userAudio: Blob | null;
  modelAudio: Blob | null;
}
