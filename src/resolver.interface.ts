import type { Observable } from 'rxjs';
import type { Resolver } from './resolver.js';

// Resolver
export type ResolverType<TResult = object, TId extends string = string, TTaskResult = unknown> = Resolver<
  TResult & {
    [K in TId]: TaskResult<RxjsAwaited<TTaskResult>>;
  }
>;

export type ResolverResult<TResult> = Observable<TResult & { _hasErrors?: boolean }>;

export type ResolverResultWithLoadingState<TResult> = Observable<
  (TResult | { _loading: true }) & { _hasErrors?: boolean }
>;

// Task
export interface Task<TId extends string, TArgs = unknown, TResult = unknown> {
  readonly id: TId;
  fn: (args: TArgs) => TResult | Promise<TResult> | Observable<TResult>;
}

export interface TaskInfo<TId extends string, TArgs = unknown, TResult = unknown> extends Task<TId, TArgs, TResult> {
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
