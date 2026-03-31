export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface AuditCheck {
  /** Stable machine-readable identifier */
  id: string;
  description: string;
  status: CheckStatus;
  detail: string;
  /** Whether `--fix` can resolve this automatically */
  fixable: boolean;
}

export interface AuditReport {
  projectRoot: string;
  timestamp: string;
  checks: AuditCheck[];
  passed: number;
  warned: number;
  failed: number;
}
