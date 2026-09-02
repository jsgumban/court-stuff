/** How a shared cost is divided among the people in a session. */
export type SplitMode = 'perGame' | 'equal';

/** How the computed per-game (or per-head) rate is rounded before billing. */
export type Rounding = 'exact' | 'peso' | 'five';

export type SessionStatus = 'open' | 'closed';

/** The four synced collections. */
export type Collection = 'players' | 'sessions' | 'entries' | 'settings';

/** Fields every synced row carries. `dirty` = 1 means "changed locally, not yet uploaded". */
export interface Synced {
  updatedAt: number;
  dirty?: number;
}

export interface Player extends Synced {
  id: string;
  name: string;
  /** Regulars are not charged the visitor fee by default. */
  isRegular: boolean;
  active: boolean;
  notes?: string;
  createdAt: number;
}

export interface SharedCost {
  id: string;
  label: string;
  amount: number;
  split: SplitMode;
}

export interface Session extends Synced {
  id: string;
  /** ISO date, YYYY-MM-DD (local). */
  date: string;
  court: string;
  lightsCost: number;
  lightsSplit: SplitMode;
  visitorFee: number;
  rounding: Rounding;
  otherCosts: SharedCost[];
  notes?: string;
  status: SessionStatus;
  createdAt: number;
}

/** One billed line in a session. Usually one per player, but a player may have several (e.g. "Daryll" and "Daryll (visitor)"). */
export interface Entry extends Synced {
  id: string;
  sessionId: string;
  playerId?: string;
  /** Display name used on the bill. Defaults to the player's name. */
  label: string;
  games: number;
  isVisitor: boolean;
  /** Extra charge (positive) or credit (negative) applied to this line only. */
  extra: number;
  extraNote?: string;
  paid: boolean;
  paidAt?: number;
  order: number;
}

/** Where people should send the money. Shown in the app and on a shared bill. */
export interface PaymentInfo {
  /** e.g. GCash, Maya, BPI */
  channel?: string;
  accountName?: string;
  accountNumber?: string;
  /** The QR image as a data URL, resized before it is stored. */
  qrImage?: string;
  note?: string;
}

export interface Settings extends Partial<Synced> {
  key: 'app';
  currency: string;
  defaultCourt: string;
  defaultLightsCost: number;
  defaultVisitorFee: number;
  visitorFeeLabel: string;
  defaultRounding: Rounding;
  defaultLightsSplit: SplitMode;
  /** Used for the "24 game slots = 6 doubles matches" sanity hint. 4 = doubles, 2 = singles. */
  playersPerGame: number;
  payment?: PaymentInfo;
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  currency: '₱',
  defaultCourt: 'Malindang',
  defaultLightsCost: 600,
  defaultVisitorFee: 100,
  visitorFeeLabel: 'Visitor fee',
  defaultRounding: 'exact',
  defaultLightsSplit: 'perGame',
  playersPerGame: 4,
};

/** A local deletion that still has to be uploaded. */
export interface Tombstone {
  collection: Collection;
  id: string;
  deletedAt: number;
}

export interface SyncStateRow {
  key: 'state';
  userId?: string;
  /**
   * Set when the signed-in account was found to no longer exist on the server.
   * The next sign-in is then treated as the same person recreating their account,
   * so local bills are uploaded instead of wiped.
   */
  previousUserDeleted?: boolean;
  /** synced_at of the last remote row applied (ISO timestamp). */
  cursor?: string;
  lastSyncAt?: number;
}

/** A full copy of this device's data, kept before anything destructive. */
export interface Snapshot {
  key: string;
  createdAt: number;
  reason: string;
  backup: BackupFile;
}

/** Shape of an exported backup file. */
export interface BackupFile {
  app: 'court-bills';
  version: 1;
  exportedAt: string;
  settings: Settings;
  players: Player[];
  sessions: Session[];
  entries: Entry[];
}
