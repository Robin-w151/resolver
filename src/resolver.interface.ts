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

export interface TaskInfo<TId extends string, TArgs = unknown, TGlobalArgs = unknown, TResult = unknown>
  extends Task<TId, TArgs, TGlobalArgs, TResult> {
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

// Promises
export interface WithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}
