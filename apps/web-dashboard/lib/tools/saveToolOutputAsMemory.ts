import { createMemory } from '../api';

export type SaveToolOutputAsMemoryParams = {
  projectKey: string;
  workspaceKey?: string | null;
  title: string;
  body: string;
  sourceTool: 'ask_clarifier' | 'reply_coach' | 'learning' | 'web_search';
  learningEnrollmentId?: string;
  learningStepId?: string;
};

export async function saveToolOutputAsMemory(params: SaveToolOutputAsMemoryParams): Promise<void> {
  const projectKey = params.projectKey.trim();
  if (!projectKey) {
    throw new Error('Select a project to save to memory.');
  }
  const title = params.title.trim().slice(0, 500);
  const body = params.body.trim().slice(0, 12000);
  if (!body) {
    throw new Error('Nothing to save.');
  }
  await createMemory({
    project_key: projectKey,
    ...(params.workspaceKey?.trim() ? { workspace_key: params.workspaceKey.trim() } : {}),
    title: title || 'Tool output',
    body,
    memory_type: 'note',
    metadata: {
      source_tool: params.sourceTool,
      generated_at: new Date().toISOString(),
      ...(params.learningEnrollmentId
        ? { learning_enrollment_id: params.learningEnrollmentId }
        : {}),
      ...(params.learningStepId ? { learning_step_id: params.learningStepId } : {}),
    },
  });
}
