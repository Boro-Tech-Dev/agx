import { validateLearningStep } from '../api';

/** After saving tool output during a learning mission, attempt server validation. */
export async function validateLearningAfterSave(
  enrollmentId?: string | null,
  stepId?: string | null,
): Promise<string | null> {
  if (!enrollmentId || !stepId) return null;
  try {
    await validateLearningStep(enrollmentId, stepId);
    return 'Saved to project memory and learning step validated.';
  } catch {
    return 'Saved to project memory. Validation pending — use Check completion on the mission.';
  }
}
