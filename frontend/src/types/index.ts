export interface User {
  id: string;
  email: string;
  createdAt: string;
  lastSeen: string;
  settings: {
    displayName?: string;
    picture?: string;
  };
}

export enum RambleStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  DELETED = 'deleted',
}

export interface Ramble {
  id: string;
  title: string | null;
  status: RambleStatus;
  durationSeconds: number | null;
  language: string | null;
  createdAt: string;
  expiresAt: string | null;
  excerpt?: string | null;
}

export interface RambleDetail extends Ramble {
  transcript: {
    id: string;
    rawText: string;
    confidence: string | null;
    segments: any;
    createdAt: string;
  } | null;
  polishedNote: {
    id: string;
    content: string;
    formattingType: string | null;
    generatedAt: string;
    modelMeta: any;
  } | null;
  audioBlob: {
    contentType: string;
    sizeBytes: bigint;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}
