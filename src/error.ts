/**
 * Error used as a task's result when the task's Observable completes without emitting a value.
 *
 * A task must produce exactly one value to satisfy its consumers. An Observable that completes
 * empty (for example after `filter()` removes every value, or when returning `EMPTY`) cannot
 * satisfy that contract, so the task is resolved with this error instead. Consumers observe it
 * like any other task failure via `isError()`.
 */
export class EmptyTaskError extends Error {
  constructor(readonly taskId: string) {
    super(`Task with id '${taskId}' completed without emitting a value`);
    this.name = 'EmptyTaskError';
  }
}
