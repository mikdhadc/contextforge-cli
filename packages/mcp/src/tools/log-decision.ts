import { DecisionStore } from '../decision-store.js';

export function handleLogDecision(
  projectRoot: string,
  topic: string,
  decision: string,
  rationale: string,
): string {
  const store = new DecisionStore(projectRoot);
  store.append({ topic, decision, rationale });
  return `Decision logged.\n\nTopic: ${topic}\nDecision: ${decision}\nRationale: ${rationale}\nTimestamp: ${new Date().toISOString()}`;
}
