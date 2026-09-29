export type EventStatus = 'candidate' | 'scheduled' | 'completed' | 'dismissed';
export type EventType = 'reset' | 'card';

export interface RadarEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  title: string;
  summary: string | null;
  audience: string | null;
  text: string;
  translation: string | null;
  resetAt: string | null;
  suggestedResetAt: string | null;
  sourceUrl: string;
  publishedAt: string;
  detectedAt: string;
  reviewedAt: string | null;
  occurrenceId?: string;
}

export interface RadarData {
  version: 1;
  account: { username: string; name: string; userId: string };
  sync: {
    status: 'unconfigured' | 'ok' | 'error';
    intervalMinutes: number;
    lastAttemptAt: string;
    lastSuccessAt: string;
    latestPostAt?: string;
    [key: string]: unknown;
  };
  events: RadarEvent[];
}

export interface WhenresetSettings {
  dataUrl: string;
  refreshMinutes: number;
  notify: boolean;
}

export const DEFAULT_SETTINGS: WhenresetSettings = {
  dataUrl: 'https://whenreset.uk/api/radar.json',
  refreshMinutes: 15,
  notify: true,
};
