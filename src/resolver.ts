import {
  catchError,
  concat,
  finalize,
  firstValueFrom,
  forkJoin,
  from,
  map,
  type Observable,
  of,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import type {
  ResolverResult,
  ResolverResultWithLoadingState,
  ResolverType,
  RxjsAwaited,
  Task,
  TaskDependencies,
  TaskId,
  TaskInfo,
  TaskResult,
} from './resolver.interface.js';

export const RESOLVER_MAX_ITERATIONS = 100;

/**
 * A dependency-aware task resolver that executes tasks in the correct order based on their dependencies.
 *
 * The Resolver class manages a collection of tasks with optional dependencies and executes them
 * in batches, ensuring that dependent tasks only run after their dependencies have been resolved.
 * It supports both synchronous and asynchronous tasks (Promises and Observables) and provides
 * comprehensive error handling and loading state management.
 *
 * Key features:
 * - Dependency resolution: Tasks are executed in dependency order
 * - Mixed sync/async support: Handles Promises, Observables, and synchronous values
 * - Error isolation: Failed tasks don't prevent other independent tasks from running
 * - Loading states: Optional loading state emission before final results
 * - Type safety: Full TypeScript support with generic type parameters
 * - Method chaining: Fluent API for registering multiple tasks
 *
 * @template TGlobalArgs - The type of global arguments passed to all tasks
 * @template TResult - The shape of the final resolved result object
 *
 * @example
 * ```typescript
 * import { Resolver, isSuccess, isError } from 'resolver';
 *
 * // Create a resolver for user and posts data
 * const resolver = new Resolver();
 *
 * // Register tasks with dependencies
 * resolver
 *   .register({ id: 'user', fn: () => fetchUser() })
 *   .register({
 *     id: 'posts',
 *     fn: ({ user }) => {
 *       if (isError(user)) throw user.error;
 *       return fetchPosts(user.data.id);
 *     }
 *   }, ['user']);
 *
 * // Resolve all tasks
 * resolver.resolve().subscribe(result => {
 *   if ('loading' in result) {
 *     console.log('Loading...');
 *   } else {
 *     console.log('Final result:', result);
 *   }
 * });
 * ```
 */
export class Resolver<TGlobalArgs = unknown, TResult = object> {
  private readonly tasks = new Map<string, TaskInfo<string>>();

  /**
   * Creates a new Resolver instance with optional global arguments.
   *
   * The constructor initializes a new Resolver that can manage and execute tasks with
   * dependency resolution. Global arguments are shared across all tasks and provide
   * a way to pass common configuration, authentication tokens, API endpoints, or other
   * contextual data that multiple tasks might need.
   *
   * @param globalArgs - Optional global arguments object that will be passed to all
   *   task functions during execution. These arguments are provided as the second
   *   parameter to each task function, alongside the resolved dependencies. If not
   *   provided, tasks will receive `undefined` as their global arguments.
   *
   * @example
   * ```typescript
   * // Create resolver without global args
   * const resolver = new Resolver();
   *
   * // Create resolver with typed global args
   * const resolverWithArgs = new Resolver<{ apiKey: string; baseUrl: string }>({
   *   apiKey: 'your-api-key',
   *   baseUrl: 'https://api.example.com'
   * });
   *
   * // Register tasks that use global args
   * resolverWithArgs.register({
   *   id: 'user',
   *   fn: (deps, { apiKey, baseUrl }) => {
   *     return fetch(`${baseUrl}/user`, {
   *       headers: { 'Authorization': `Bearer ${apiKey}` }
   *     });
   *   }
   * });
   * ```
   */
  constructor(private globalArgs?: TGlobalArgs) {}

  /**
   * Registers a new task with the resolver, optionally specifying its dependencies.
   *
   * This method adds a task to the resolver's task collection and establishes dependency relationships
   * between tasks. Tasks with dependencies will only execute after their dependencies have been
   * successfully resolved. The method supports method chaining, allowing multiple tasks to be
   * registered in sequence.
   *
   * @template TId - The unique identifier type for the task
   * @template TTaskResult - The return type of the task function
   * @template TTaskDependencies - The array of dependency task IDs this task depends on
   *
   * @param task - The task configuration object containing:
   *   - `id`: Unique identifier for the task
   *   - `fn`: Function that executes the task, receiving resolved dependencies and global args
   * @param dependencies - Optional array of task IDs that this task depends on. These tasks
   *   must be registered before this task and will be resolved before this task executes.
   *
   * @returns The resolver instance for method chaining
   *
   * @throws {Error} If a task with the same ID has already been registered
   *
   * @example
   * ```typescript
   * const resolver = new Resolver();
   *
   * // Register a task without dependencies
   * resolver.register({
   *   id: 'user',
   *   fn: () => fetchUser()
   * });
   *
   * // Register a task with dependencies
   * resolver.register({
   *   id: 'posts',
   *   fn: ({ user }) => {
   *     if (isError(user)) throw user.error;
   *     return fetchPosts(user.data.id);
   *   }
   * }, ['user']);
   *
   * // Method chaining
   * resolver
   *   .register({ id: 'config', fn: () => loadConfig() })
   *   .register({ id: 'settings', fn: ({ config }) => loadSettings(config.data) }, ['config']);
   * ```
   */
  register<TId extends string, TTaskResult, TTaskDependencies extends Array<keyof TResult> | undefined = undefined>(
    this: Resolver<TGlobalArgs, TResult>,
    task: Task<TaskId<TResult, TId>, TaskDependencies<TTaskDependencies, TResult>, TGlobalArgs, TTaskResult>,
    dependencies?: TTaskDependencies,
  ): ResolverType<TResult, TId, TGlobalArgs, TTaskResult> {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with id '${task.id}' has already been registered`);
    }

    if (dependencies?.some((dependency) => !this.tasks.has(dependency as string))) {
      throw new Error(`Task with id '${task.id}' has dependencies that have not been registered`);
    }

    this.tasks.set(task.id, { ...task, producers: dependencies ?? [], consumers: [] } as TaskInfo<string>);

    for (const dependency of dependencies ?? []) {
      const dependencyTask = this.tasks.get(dependency as string);
      if (dependencyTask) {
        dependencyTask.consumers.push(task.id);
      }
    }

    return this as ResolverType<TResult, TId, TGlobalArgs, TTaskResult>;
  }

  /**
   * Executes all registered tasks in dependency order and returns the results as an Observable.
   *
   * This method orchestrates the execution of all registered tasks, ensuring that tasks with
   * dependencies are only executed after their dependencies have been successfully resolved.
   *
   * The method supports both synchronous and asynchronous tasks (Promises and Observables)
   * and provides comprehensive error handling. Failed tasks don't prevent other independent
   * tasks from executing, ensuring maximum resilience.
   *
   * @template TWithLoadingState - Controls whether loading state is emitted before final results
   *
   * @param options - Configuration options for the resolution process:
   *   - `withLoadingState`: Whether to emit a loading state before final results (default: false)
   *   - `maxIterations`: Maximum number of resolution iterations to prevent infinite loops (default: 100)
   *
   * @returns An Observable that emits:
   *   - If `withLoadingState` is true: First emits `{ loading: true }`, then the final result
   *   - If `withLoadingState` is false: Only emits the final result
   *
   *   The final result contains:
   *   - `globalArgs`: The global arguments passed to all tasks
   *   - `tasks`: An object mapping task IDs to their results (success or error)
   *   - `hasErrors`: Boolean indicating if any tasks failed (only present if true)
   *
   * @throws {Error} If max iterations are reached (indicates circular dependencies)
   *
   * @example
   * ```typescript
   * const resolver = new Resolver();
   *
   * resolver
   *   .register({ id: 'user', fn: () => fetchUser() })
   *   .register({ id: 'posts', fn: ({ user }) => fetchPosts(user.data.id) }, ['user']);
   *
   * // With loading state (default)
   * resolver.resolve().subscribe(result => {
   *   if ('loading' in result) {
   *     console.log('Loading...');
   *   } else {
   *     console.log('Final result:', result);
   *     console.log('Has errors:', result.hasErrors);
   *   }
   * });
   *
   * // Without loading state
   * resolver.resolve({ withLoadingState: false }).subscribe(result => {
   *   console.log('Final result:', result);
   * });
   *
   * // Custom max iterations
   * resolver.resolve({ maxIterations: 50 }).subscribe(result => {
   *   // Handle result
   * });
   * ```
   */
  resolve<TWithLoadingState extends boolean = false>(options?: {
    withLoadingState?: TWithLoadingState;
    maxIterations?: number;
  }): TWithLoadingState extends true
    ? ResolverResultWithLoadingState<TGlobalArgs, TResult>
    : ResolverResult<TGlobalArgs, TResult> {
    const { withLoadingState = false, maxIterations = RESOLVER_MAX_ITERATIONS } = options ?? {};
    const resolvedTasks = new Map<string, Promise<[string, TaskResult<unknown>]>>();
    const destroy = new Subject<void>();

    if (this.tasks.size === 0) {
      return of({ globalArgs: this.globalArgs, tasks: {} as TResult, hasErrors: undefined }) as never;
    }

    let count = 1;
    while (resolvedTasks.size < this.tasks.size) {
      if (count++ > maxIterations) {
        return throwError(() => new Error('Max iterations reached'));
      }

      const tasks = this.findTasks(resolvedTasks);
      tasks.forEach((task) => {
        if (task.producers.length === 0) {
          const result = this.executeTask(task, {}, this.globalArgs, destroy);
          resolvedTasks.set(task.id, result);
        } else {
          const result = firstValueFrom(
            forkJoin(
              task.producers.map((producer) => resolvedTasks.get(producer) as Promise<[string, TaskResult<unknown>]>),
            ).pipe(
              map((args) => args.reduce((acc, [id, result]) => ({ ...acc, [id]: result }), {})),
              switchMap((args) => this.executeTask(task, args, this.globalArgs, destroy)),
            ),
          );
          resolvedTasks.set(task.id, result);
        }
      });
    }

    const resultWithState = forkJoin(Array.from(resolvedTasks.values())).pipe(
      map((data) => ({
        globalArgs: this.globalArgs,
        tasks: data.reduce(
          (acc, [id, result]) => ({ ...acc, [id]: result }),
          {} as Record<string, TaskResult<unknown>>,
        ),
      })),
      map((result) => ({
        ...result,
        hasErrors:
          Object.entries(result.tasks).some(([, value]) => !!value && typeof value === 'object' && isError(value)) ||
          undefined,
      })),
      finalize(() => {
        destroy.next();
        destroy.complete();
      }),
    ) as ResolverResult<TGlobalArgs, TResult>;

    return (withLoadingState ? concat(of({ loading: true } as const), resultWithState) : resultWithState) as never;
  }

  /**
   * Updates the global arguments that will be passed to all task functions during execution.
   *
   * Global arguments are shared across all tasks and provide a way to pass common configuration,
   * authentication tokens, API endpoints, or other contextual data that multiple tasks might need.
   * These arguments are passed as the second parameter to each task function, alongside the
   * resolved dependencies.
   *
   * This method allows you to update the global arguments after the resolver has been created,
   * which is useful for scenarios where the arguments are determined dynamically or need to
   * be refreshed during the application lifecycle.
   *
   * @param globalArgs - The new global arguments object to be passed to all tasks
   *
   * @example
   * ```typescript
   * const resolver = new Resolver<{ apiKey: string; baseUrl: string }>();
   *
   * resolver
   *   .register({
   *     id: 'user',
   *     fn: (deps, { apiKey, baseUrl }) => fetchUser(`${baseUrl}/user`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
   *   })
   *   .register({
   *     id: 'posts',
   *     fn: ({ user }, { apiKey, baseUrl }) => fetchPosts(`${baseUrl}/posts`, { userId: user.data.id, headers: { 'Authorization': `Bearer ${apiKey}` } })
   *   }, ['user']);
   *
   * // Set initial global args
   * resolver.setGlobalArgs({
   *   apiKey: 'initial-token',
   *   baseUrl: 'https://api.example.com'
   * });
   *
   * // Update global args (e.g., after token refresh)
   * resolver.setGlobalArgs({
   *   apiKey: 'refreshed-token',
   *   baseUrl: 'https://api.example.com'
   * });
   *
   * resolver.resolve().subscribe(result => {
   *   console.log('Tasks executed with updated global args');
   * });
   * ```
   */
  setGlobalArgs(globalArgs: TGlobalArgs): void {
    this.globalArgs = globalArgs;
  }

  /**
   * Finds tasks that are ready to execute (all dependencies resolved).
   *
   * @param resolvedTasks - Map of already resolved task IDs
   * @returns Array of tasks ready for execution
   */
  private findTasks(resolvedTasks: Map<string, Promise<[string, TaskResult<unknown>]>>): Array<TaskInfo<string>> {
    return Array.from(this.tasks.values()).filter((task) => {
      return !resolvedTasks.has(task.id) && task.producers.every((producer) => resolvedTasks.has(producer));
    });
  }

  /**
   * Executes a single task and returns its result wrapped in a Promise.
   *
   * @param task - The task to execute
   * @param args - Resolved dependencies for the task
   * @param globalArgs - Global arguments to pass to the task
   * @returns Promise resolving to [taskId, result]
   */
  private executeTask<TGlobalArgs = unknown>(
    task: TaskInfo<string>,
    args: Record<string, TaskResult<unknown>>,
    globalArgs: TGlobalArgs,
    destroy: Subject<void>,
  ): Promise<[string, TaskResult<unknown>]> {
    return new Promise((resolve) => {
      try {
        const taskResult = task.fn(args, globalArgs);
        from(this.isPromiseOrObservable(taskResult) ? taskResult : of(taskResult))
          .pipe(
            map((data) => ({ data })),
            catchError((error) => of({ error })),
            take(1),
            tap((data) => resolve([task.id, data])),
            takeUntil(destroy),
          )
          .subscribe();
      } catch (error) {
        resolve([task.id, { error }] as const);
      }
    });
  }

  /**
   * Type guard to check if a value is a Promise or Observable.
   *
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
  value: RxjsAwaited<ResolverResultWithLoadingState<unknown, unknown>>,
): value is { loading: true; hasErrors?: boolean } {
  return 'loading' in value && !!value.loading;
}
