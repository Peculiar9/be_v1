export enum LedgerDirection {
  DEBIT = "debit",
  CREDIT = "credit",
}

export enum LedgerAccountType {
  ASSET = "asset",
  LIABILITY = "liability",
  EQUITY = "equity",
  REVENUE = "revenue",
  EXPENSE = "expense",
}

export enum JournalStatus {
  PENDING = "pending",
  POSTED = "posted",
  VOIDED = "voided",
}

export enum JournalType {
  FUNDING = "funding",
  PAYOUT = "payout",
  REFUND = "refund",
  ADJUSTMENT = "adjustment",
}

export interface LedgerAccount {
  id?: string;
  ownerId?: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerPosting {
  accountCode: string;
  direction: LedgerDirection;
  amountMinor: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface JournalEntry {
  id?: string;
  reference: string;
  type: JournalType;
  status: JournalStatus;
  postings: LedgerPosting[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  postedAt?: string;
}
