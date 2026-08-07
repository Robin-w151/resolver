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
/**
 * A single unit of work that can be registered with a resolver.
 *
 * Every task produces exactly one result. How that result is obtained depends on what `fn`
 * returns, but the outcome is always a single `TaskResult`, either `{ data }` or `{ error }`.
 */
export interface Task<TId extends string, TArgs = unknown, TGlobalArgs = unknown, TResult = unknown> {
  /**
   * Unique identifier of the task within a resolver.
   */
  readonly id: TId;

  /**
   * The function that performs the work of the task.
   *
   * It receives the results of the task's dependencies as its first argument and the resolver's
   * global arguments as its second argument, and may return a plain value, a `Promise` or an
   * `Observable`.
   *
   * For an `Observable` the **first emitted value** becomes the task's result and the subscription
   * is then closed, so later emissions never occur and the source is cancelled. A source that
   * completes without emitting resolves the task with an `EmptyTaskError`.
   *
   * Pipe the source when a different value is needed, for example `last()` to wait for the final
   * value of a completing source, or `toArray()` to collect every value:
   *
   * ```typescript
   * fn: () => of(1, 2, 3); // { data: 1 }
   * fn: () => of(1, 2, 3).pipe(last()); // { data: 3 }
   * fn: () => of(1, 2, 3).pipe(toArray()); // { data: [1, 2, 3] }
   * ```
   *
   * Note that `last()` never emits for a source that does not complete, which leaves the task,
   * and therefore the whole resolution, pending indefinitely.
   */
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

// Rxjs
export type RxjsAwaited<T> = T extends Observable<infer U> ? U : T;
