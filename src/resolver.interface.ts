import type { Observable } from 'rxjs';
import type { Resolver } from './resolver';

// Resolver
export type ResolverType<
  TGlobalArgs = unknown,
  TResult = object,
  TId extends string = string,
  TTaskResult = unknown,
> = Resolver<
  TGlobalArgs,
  TResult & {
    [K in TId]: TaskResult<TTaskResult>;
  }
>;

export type ResolverResult<TGlobalArgs, TResult> = Observable<{
  globalArgs: TGlobalArgs;
  tasks: TResult;
}>;

export type ResolverResultWithLoadingState<TGlobalArgs, TResult> = Observable<
  { globalArgs: TGlobalArgs; tasks: TResult } | { loading: true }
>;

// Task
export interface Task<TId extends string, TArgs = unknown, TGlobalArgs = unknown, TResult = unknown> {
  readonly id: TId;
  fn: (args: TArgs, globalArgs: TGlobalArgs) => TResult | Promise<TResult> | Observable<TResult>;
}

export interface TaskInfo<TId extends string, TArgs = unknown, TGlobalArgs = unknown, TResult = unknown> extends Task<
  TId,
  TArgs,
  TGlobalArgs,
  TResult
> {
  consumers: Array<string>;
  producers: Array<string>;
}

export type TaskId<TResult, TId extends string> = TId extends keyof TResult
  ? `Error: Task ID '${TId}' already exists. Use a different ID.`
  : TId;

export type TaskDependencies<TTaskDependencies, TResult> = TTaskDependencies extends undefined
  ? object
  : Pick<TResult, TTaskDependencies extends Array<keyof TResult> ? TTaskDependencies[number] : never>;

export type TaskResult<TResult> = { data: TResult } | { error: unknown };

// Error

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

// Rxjs
export type RxjsAwaited<T> = T extends Observable<infer U> ? U : T;
