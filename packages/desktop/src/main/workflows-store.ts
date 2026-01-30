import type { WorkflowDefinition, WorkflowRun } from '../renderer/types/electron';

type WorkflowTemplateRecord = {
  id: string;
  template: string;
};

class WorkflowsStore {
  private definitions = new Map<string, WorkflowDefinition>();
  private templates = new Map<string, WorkflowTemplateRecord>();
  private runs = new Map<string, WorkflowRun>();

  setDefinitions(definitions: WorkflowDefinition[]): void {
    this.definitions = new Map(definitions.map((d) => [d.id, d]));
  }

  upsertTemplate(record: WorkflowTemplateRecord): void {
    this.templates.set(record.id, record);
  }

  listDefinitions(): WorkflowDefinition[] {
    return Array.from(this.definitions.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  hasTemplate(workflowId: string): boolean {
    return this.templates.has(workflowId);
  }

  getTemplate(workflowId: string): string | null {
    return this.templates.get(workflowId)?.template ?? null;
  }

  createRun(run: WorkflowRun): void {
    this.runs.set(run.id, run);
  }

  updateRun(runId: string, patch: Partial<WorkflowRun>): WorkflowRun | null {
    const current = this.runs.get(runId);
    if (!current) {
      return null;
    }

    const next: WorkflowRun = { ...current, ...patch };
    this.runs.set(runId, next);
    return next;
  }

  getRun(runId: string): WorkflowRun | null {
    return this.runs.get(runId) ?? null;
  }
}

export const workflowsStore = new WorkflowsStore();
