import { catchError, concat, forkJoin, from, map, type Observable, of, switchMap, throwError } from 'rxjs';
import type {
  ResolverResult,
  ResolverResultWithLoadingState,
  ResolverType,
  Task,
  TaskDependencies,
  TaskInfo,
  TaskResult,
  TaskId,
  RxjsAwaited,
} from './resolver.interface.js';

export const RESOLVER_MAX_ITERATIONS = 100;

/**
 * A dependency resolver that manages and executes tasks with dependencies.
 *
 * The Resolver class provides a way to register tasks with dependencies and execute them
 * in the correct order. It supports both synchronous and asynchronous tasks (Promises and Observables)
 * and provides loading states and error handling.
 *
 * @template TResult - The shape of the final resolved result object
 *
 * @example
 * ```typescript
 * import { Resolver, isSuccess, isError } from 'resolver';
 *
 * const resolver = new Resolver<{ user: User; posts: Post[] }>();
 *
 * resolver
 *   .register({ id: 'user', fn: () => fetchUser() })
 *   .register({
 *     id: 'posts',
 *     fn: ({ user }) => {
 *       if (isError(user)) {
 *         throw user.error;
 *       }
 *       return fetchPosts(user.data.id);
 *     }
 *   }, ['user']);
 *
 * const result$ = resolver.resolve();
 * ```
 */
export class Resolver<TResult = object> {
  private readonly tasks = new Map<string, TaskInfo<string>>();
  private readonly resolvedTasks = new Set<string>();

  /**
   * Registers a new task with optional dependencies.
   *
   * This method adds a task to the resolver's task registry. The task can have dependencies
   * on other tasks that must be resolved before this task can execute. Tasks are executed
   * in dependency order during resolution.
   *
   * @template TId - The unique identifier for this task
   * @template TTaskResult - The return type of the task function
   * @template TTaskDependencies - Array of task IDs this task depends on
   *
   * @param task - The task object containing an id and function to execute
   * @param dependencies - Optional array of task IDs that must be resolved before this task
   *
   * @returns The resolver instance for method chaining
   *
   * @example
   * ```typescript
   * import { isSuccess, isError } from 'resolver';
   *
   * resolver
   *   .register({ id: 'user', fn: () => fetchUser() })
   *   .register({
   *     id: 'posts',
   *     fn: ({ user }) => {
   *       if (isError(user)) {
   *         throw user.error;
   *       }
   *       return fetchPosts(user.data.id);
   *     }
   *   }, ['user'])
   *   .register({
   *     id: 'comments',
   *     fn: ({ posts }) => {
   *       if (isError(posts)) {
   *         throw posts.error;
   *       }
   *       return fetchComments(posts.data[0].id);
   *     }
   *   }, ['posts']);
   * ```
   */
  register<TId extends string, TTaskResult, TTaskDependencies extends Array<keyof TResult> | undefined = undefined>(
    this: Resolver<TResult>,
    task: Task<TaskId<TResult, TId>, TaskDependencies<TTaskDependencies, TResult>, TTaskResult>,
    dependencies?: TTaskDependencies,
  ): ResolverType<TResult, TId, TTaskResult> {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with id '${task.id}' has already been registered`);
    }

    this.tasks.set(task.id, { ...task, producers: dependencies ?? [], consumers: [] } as TaskInfo<string>);

    for (const dependency of dependencies ?? []) {
      const dependencyTask = this.tasks.get(dependency as string);
      if (dependencyTask) {
        dependencyTask.consumers.push(task.id);
      }
    }

    return this as ResolverType<TResult, TId, TTaskResult>;
  }

  /**
   * Resolves all registered tasks in dependency order.
   *
   * This method executes all registered tasks, respecting their dependencies. Tasks are
   * executed in batches where each batch contains tasks whose dependencies have been resolved.
   * The method supports both synchronous and asynchronous tasks (Promises and Observables).
   *
   * The resolver will throw an error if it exceeds the maximum iteration limit (100 by default).
   *
   * @template TWithLoadingState - Whether to include loading state in the result
   *
   * @param options - Configuration options for resolution
   * @param options.withLoadingState - Whether to emit a loading state before the final result (default: true)
   * @param options.maxIterations - Maximum number of iterations before throwing an error (default: 100)
   *
   * @returns An Observable that emits the resolved results. If withLoadingState is true,
   *          it first emits `{ _loading: true }`, then the final result with `_hasErrors` flag
   *
   * @throws Error if max iterations are exceeded
   *
   * @example
   * ```typescript
   * import { isSuccess, isError } from 'resolver';
   *
   * // With loading state (default)
   * const result$ = resolver.resolve();
   * result$.subscribe(result => {
   *   if ('_loading' in result) {
   *     console.log('Loading...');
   *   } else {
   *     console.log('Final result:', result);
   *     if (result._hasErrors) {
   *       console.log('Some tasks failed');
   *       // Check individual task results
   *       if (isError(result.user)) {
   *         console.error('User task failed:', result.user.error);
   *       }
   *       if (isSuccess(result.posts)) {
   *         console.log('Posts loaded:', result.posts.data.length);
   *       }
   *     }
   *   }
   * });
   *
   * // Without loading state
   * const result$ = resolver.resolve({ withLoadingState: false });
   *
   * // With custom max iterations
   * const result$ = resolver.resolve({ maxIterations: 50 });
   * ```
   */
  resolve<TWithLoadingState extends boolean = true>(options?: {
    withLoadingState?: TWithLoadingState;
    maxIterations?: number;
  }): TWithLoadingState extends true ? ResolverResultWithLoadingState<TResult> : ResolverResult<TResult> {
    const { withLoadingState = true, maxIterations = RESOLVER_MAX_ITERATIONS } = options ?? {};

    let count = 1;
    let result = of<Record<string, TaskResult<unknown>>>({});
    while (this.resolvedTasks.size < this.tasks.size) {
      if (count++ > maxIterations) {
        return throwError(() => new Error('Max iterations reached'));
      }

      const tasks = this.findTasks(this.resolvedTasks);
      result = result.pipe(
        switchMap((data) => {
          const tasksObservables = tasks.map((task) => {
            try {
              const taskResult = task.fn({ ...data });
              const taskObservable = from(this.isPromiseOrObservable(taskResult) ? taskResult : of(taskResult)).pipe(
                map((data) => ({ data })),
                catchError((error) => of({ error })),
              );
              return forkJoin([of(task.id), taskObservable]);
            } catch (error) {
              return of([task.id, { error }] as const);
            }
          });
          return forkJoin(tasksObservables).pipe(
            map((results) => {
              return results.reduce((acc, [id, result]) => ({ ...acc, [id]: result }), data);
            }),
          );
        }),
      );
      tasks.forEach((task) => this.resolvedTasks.add(task.id));
    }

    const resultWithState = from(result).pipe(
      map((result) => ({
        ...result,
        _hasErrors:
          Object.entries(result).some(([, value]) => !!value && typeof value === 'object' && isError(value)) ||
          undefined,
      })),
    ) as ResolverResult<TResult>;

    return (
      withLoadingState === undefined || withLoadingState === true
        ? concat(of({ _loading: true } as const), resultWithState)
        : resultWithState
    ) as never;
  }

  /**
   * Finds tasks that are ready to execute (all dependencies resolved).
   * @param resolvedTasks - Set of task IDs that have been resolved
   * @returns Array of tasks ready for execution
   */
  private findTasks(resolvedTasks: Set<string>): Array<TaskInfo<string>> {
    return Array.from(this.tasks.values()).filter((task) => {
      return !this.resolvedTasks.has(task.id) && task.producers.every((producer) => resolvedTasks.has(producer));
    });
  }

  /**
   * Type guard that checks if a value is a Promise or Observable.
   * @param value - The value to check
   * @returns True if the value is a Promise or Observable
   */
  private isPromiseOrObservable<TValue>(
    value: TValue | Promise<TValue> | Observable<TValue>,
  ): value is Promise<TValue> | Observable<TValue> {
    return typeof value === 'object' && value !== null && ('then' in value || 'subscribe' in value);
  }
}

/**
 * Type guard that checks if a task result contains successful data.
 *
 * @param value - The task result to check
 * @returns True if the result contains data, false if it contains an error
 *
 * @example
 * ```typescript
 * if (isSuccess(result)) {
 *   console.log('Data:', result.data);
 * }
 * ```
 */
export function isSuccess<TValue>(value: TaskResult<TValue>): value is { data: TValue } {
  return 'data' in value;
}

/**
 * Type guard that checks if a task result contains an error.
 *
 * @param value - The task result to check
 * @returns True if the result contains an error, false if it contains data
 *
 * @example
 * ```typescript
 * if (isError(result)) {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export function isError<TValue>(value: TaskResult<TValue>): value is { error: unknown } {
  return 'error' in value;
}

/**
 * Type guard that checks if a resolver result is in a loading state.
 *
 * @param value - The resolver result to check
 * @returns True if the result indicates loading is in progress
 *
 * @example
 * ```typescript
 * if (isLoading(result)) {
 *   console.log('Still loading...');
 * }
 * ```
 */
export function isLoading(
  value: RxjsAwaited<ResolverResultWithLoadingState<unknown>>,
): value is { _loading: true; _hasErrors?: boolean } {
  return '_loading' in value && !!value._loading;
}
