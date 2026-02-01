import fs from 'fs/promises';
import path from 'path';
import { configStore } from './config-store.js';

export type ApprovalReply = 'once' | 'always' | 'deny';

type PersistedApprovalPolicyStateV1 = {
  version: 1;
  workflowOptIns: Record<string, boolean>;
};

const DEFAULT_STATE: PersistedApprovalPolicyStateV1 = {
  version: 1,
  workflowOptIns: {},
};

const ensureRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

class ApprovalPolicyStore {
  private readonly sessionAlwaysApprove = new Set<string>();
  private readonly requestIdToSessionId = new Map<string, string>();

  private state: PersistedApprovalPolicyStateV1 = DEFAULT_STATE;
  private loaded = false;

  trackRequest(requestId: string, sessionId: string): void {
    if (!requestId || !sessionId) return;
    this.requestIdToSessionId.set(requestId, sessionId);
  }

  getSessionIdForRequest(requestId: string): string | undefined {
    return this.requestIdToSessionId.get(requestId);
  }

  setSessionAlwaysApprove(sessionId: string, enabled: boolean): void {
    if (!sessionId) return;
    if (enabled) {
      this.sessionAlwaysApprove.add(sessionId);
    } else {
      this.sessionAlwaysApprove.delete(sessionId);
    }
  }

  isSessionAlwaysApprove(sessionId: string): boolean {
    return this.sessionAlwaysApprove.has(sessionId);
  }

  private getStatePath(): string {
    const dataDir = configStore.getDataDir();
    return path.join(dataDir, 'approval-policies.json');
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    const filePath = this.getStatePath();
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!ensureRecord(parsed)) {
        this.state = DEFAULT_STATE;
        return;
      }

      const version = parsed.version;
      if (version !== 1) {
        this.state = DEFAULT_STATE;
        return;
      }

      const workflowOptIns = ensureRecord(parsed.workflowOptIns) ? parsed.workflowOptIns : {};
      this.state = {
        version: 1,
        workflowOptIns: Object.fromEntries(
          Object.entries(workflowOptIns).map(([key, value]) => [key, Boolean(value)])
        ),
      };
    } catch {
      this.state = DEFAULT_STATE;
    }
  }

  private async save(): Promise<void> {
    const filePath = this.getStatePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    await fs.rename(tmp, filePath);
  }

  async getWorkflowOptIn(workflowId: string): Promise<boolean> {
    await this.load();
    return Boolean(this.state.workflowOptIns[workflowId]);
  }

  async setWorkflowOptIn(workflowId: string, optedIn: boolean): Promise<void> {
    await this.load();
    this.state.workflowOptIns[workflowId] = optedIn;
    await this.save();
  }
}

export const approvalPolicyStore = new ApprovalPolicyStore();
