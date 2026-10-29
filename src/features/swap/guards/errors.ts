export class GuardError extends Error {
  constructor(readonly rule: string) {
    super(`quote check failed: ${rule}`);
    this.name = 'GuardError';
  }
}
export const must = (ok: boolean, rule: string): void => {
  if (!ok) throw new GuardError(rule);
};
export const GUARD_MESSAGE = 'This quote could not be checked. Get a new quote and try again.';
