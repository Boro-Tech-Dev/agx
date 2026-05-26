import { createMemory } from '../api';

export async function saveLearningMemory(params: {
  projectKey: string;
  workspaceKey?: string | null;
  title: string;
  body: string;
  enrollmentId: string;
  stepId: string;
}): Promise<void> {
  const projectKey = params.projectKey.trim();
  if (!projectKey) throw new Error('Sandbox project required.');
  const body = params.body.trim();
  if (!body) throw new Error('Nothing to save.');
  await createMemory({
    project_key: projectKey,
    ...(params.workspaceKey?.trim() ? { workspace_key: params.workspaceKey.trim() } : {}),
    title: params.title.trim().slice(0, 500) || 'Learning note',
    body: body.slice(0, 12000),
    memory_type: 'note',
    metadata: {
      source_tool: 'learning',
      learning_enrollment_id: params.enrollmentId,
      learning_step_id: params.stepId,
      generated_at: new Date().toISOString(),
    },
  });
}
