import type { Entry, Session } from './types';

/** The Malindang 9/2/2026 example, exactly as posted in the group. */
export const SAMPLE_SESSION: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> = {
  date: '2026-09-02',
  court: 'Malindang',
  lightsCost: 600,
  lightsSplit: 'perGame',
  visitorFee: 100,
  rounding: 'exact',
  otherCosts: [],
  status: 'open',
};

export type SampleLine = Pick<Entry, 'label' | 'games' | 'isVisitor' | 'paid'> & { player?: string };

export const SAMPLE_LINES: SampleLine[] = [
  { label: 'Mc', games: 2, isVisitor: false, paid: true },
  { label: 'Mark', games: 2, isVisitor: true, paid: true },
  { label: 'Daryll', games: 1, isVisitor: false, paid: false },
  { label: 'Daryll (visitor)', player: 'Daryll', games: 1, isVisitor: true, paid: false },
  { label: 'John', games: 1, isVisitor: false, paid: false },
  { label: 'Rose', games: 2, isVisitor: false, paid: false },
  { label: 'Mikko', games: 1, isVisitor: false, paid: true },
  { label: 'Jovs', games: 1, isVisitor: false, paid: true },
  { label: 'Gail', games: 2, isVisitor: false, paid: true },
  { label: 'Richmond', games: 1, isVisitor: false, paid: true },
  { label: 'Leah', games: 2, isVisitor: false, paid: true },
  { label: 'Dyson', games: 1, isVisitor: false, paid: false },
  { label: 'John Goodman', games: 1, isVisitor: false, paid: false },
  { label: 'Ej Cabanalan', games: 2, isVisitor: false, paid: false },
  { label: 'Abude', games: 2, isVisitor: false, paid: false },
  { label: 'Allen', games: 1, isVisitor: true, paid: true },
  { label: 'Chin', games: 1, isVisitor: true, paid: true },
];
