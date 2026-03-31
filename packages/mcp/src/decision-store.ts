import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DecisionRecord {
  topic: string;
  decision: string;
  rationale: string;
  timestamp: string; // ISO 8601
}

export class DecisionStore {
  private readonly filePath: string;

  constructor(projectRoot: string) {
    this.filePath = path.join(projectRoot, '.contextforge', 'decisions.jsonl');
  }

  /** Append a decision to the JSONL file. Creates directories as needed. */
  append(record: Omit<DecisionRecord, 'timestamp'>): void {
    const full: DecisionRecord = { ...record, timestamp: new Date().toISOString() };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, JSON.stringify(full) + '\n', 'utf8');
  }

  /** Read all decisions. Returns [] if file doesn't exist. */
  readAll(): DecisionRecord[] {
    try {
      return fs.readFileSync(this.filePath, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => JSON.parse(l) as DecisionRecord);
    } catch {
      return [];
    }
  }

  /** Return decisions whose topic, decision, or rationale contains any keyword (case-insensitive). */
  query(keywords: string[]): DecisionRecord[] {
    if (keywords.length === 0) return [];
    const lower = keywords.map(k => k.toLowerCase());
    return this.readAll().filter(d => {
      const text = `${d.topic} ${d.decision} ${d.rationale}`.toLowerCase();
      return lower.some(k => text.includes(k));
    });
  }
}
