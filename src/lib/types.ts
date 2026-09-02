/** How a shared cost is divided among the people in a session. */
export type SplitMode = 'perGame' | 'equal';

/** How the computed per-game (or per-head) rate is rounded before billing. */
export type Rounding = 'exact' | 'peso' | 'five';

export type SessionStatus = 'open' | 'closed';

export interface Player {
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

export interface Session {
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
  updatedAt: number;
}

/** One billed line in a session. Usually one per player, but a player may have several (e.g. "Daryll" and "Daryll (visitor)"). */
export interface Entry {
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

export interface Settings {
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
