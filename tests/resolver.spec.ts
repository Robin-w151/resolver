import { delay, finalize, firstValueFrom, lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';
import type { TaskResult } from '../src/resolver.interface.js';
import { isError, isLoading, isSuccess, Resolver, RESOLVER_MAX_ITERATIONS } from '../src/resolver.js';

describe('Resolver', () => {
  test('empty task graph', async () => {
    const resolver = new Resolver();

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({ globalArgs: undefined, tasks: {}, hasErrors: undefined });
  });

  test('single task graph', async () => {
    const resolver = new Resolver().register({ id: 'A', fn: () => 1 });

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({ tasks: { A: { data: 1 } } });
  });

  test('every task is called once', async () => {
    const taskA = vi.fn(() => 1);
    const taskB = vi.fn(() => 2);
    const taskC = vi.fn(({ A, B }: { A: TaskResult<number>; B: TaskResult<number> }) => {
      if (isSuccess(A) && isSuccess(B)) {
        return A.data + B.data;
      }

      throw new Error('Error in A or B');
    });
    const taskD = vi.fn(({ A, C }: { A: TaskResult<number>; C: TaskResult<number> }) => {
      if (isSuccess(A) && isSuccess(C)) {
        return A.data + C.data;
      }
      throw new Error('Error in A or C');
    });

    const resolver = new Resolver()
      .register({ id: 'A', fn: taskA })
      .register({ id: 'B', fn: taskB })
      .register(
        {
          id: 'C',
          fn: taskC,
        },
        ['A', 'B'],
      )
      .register(
        {
          id: 'D',
          fn: taskD,
        },
        ['A', 'C'],
      );

    expect(taskA).not.toHaveBeenCalled();
    expect(taskB).not.toHaveBeenCalled();
    expect(taskC).not.toHaveBeenCalled();
    expect(taskD).not.toHaveBeenCalled();

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({ tasks: { A: { data: 1 }, B: { data: 2 }, C: { data: 3 }, D: { data: 4 } } });
    expect(taskA).toHaveBeenCalledOnce();
    expect(taskB).toHaveBeenCalledOnce();
    expect(taskC).toHaveBeenCalledOnce();
    expect(taskD).toHaveBeenCalledOnce();
  });

  test('task with error recovery', async () => {
    const resolver = new Resolver()
      .register({ id: 'A', fn: () => throwError(() => new Error('Error in A')) })
      .register({ id: 'B', fn: () => 2 })
      .register(
        {
          id: 'C',
          fn: ({ A, B }) => {
            if (isSuccess(A)) {
              return A.data;
            }

            if (isSuccess(B)) {
              return B.data;
            }

            throw new Error('Error in A and B');
          },
        },
        ['A', 'B'],
      )
      .register(
        {
          id: 'D',
          fn: ({ A, C }) => {
            if (isSuccess(A)) {
              return A.data;
            }

            if (isSuccess(C)) {
              return C.data;
            }

            return throwError(() => new Error('Error in A and C'));
          },
        },
        ['A', 'C'],
      );

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({
      hasErrors: true,
      tasks: {
        A: { error: new Error('Error in A') },
        B: { data: 2 },
        C: { data: 2 },
        D: { data: 2 },
      },
    });
  });

  test('task graph with synchronous error', async () => {
    const resolver = new Resolver()
      .register({
        id: 'A',
        fn: () => {
          throw new Error('Error in A');
        },
      })
      .register({ id: 'B', fn: () => 2 });

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({
      hasErrors: true,
      tasks: {
        A: { error: new Error('Error in A') },
        B: { data: 2 },
      },
    });
  });

  test('complex task graph', async () => {
    const resolver = new Resolver()
      .register({ id: 'A', fn: () => 1 })
      .register({ id: 'B', fn: () => 2 })
      .register({ id: 'D', fn: () => 4 })
      .register(
        {
          id: 'C',
          fn: ({ A, B }) => {
            if (isError(A) || isError(B)) {
              return throwError(() => new Error('Error in A or B'));
            }

            return 3 + A.data + B.data;
          },
        },
        ['A', 'B'],
      )
      .register(
        {
          id: 'E',
          fn: ({ C, D }) => {
            if (isError(C) || isError(D)) {
              return throwError(() => new Error('Error in C or D'));
            }

            return 5 + C.data + D.data;
          },
        },
        ['C', 'D'],
      )
      .register(
        {
          id: 'F',
          fn: ({ C, E }) => {
            if (isError(C) || isError(E)) {
              return throwError(() => new Error('Error in C or E'));
            }

            return 6 + C.data + E.data;
          },
        },
        ['C', 'E'],
      );

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({
      tasks: {
        A: { data: 1 },
        B: { data: 2 },
        C: { data: 6 },
        D: { data: 4 },
        E: { data: 15 },
        F: { data: 27 },
      },
    });
  });

  test('complex task graph with errors', async () => {
    const resolver = new Resolver()
      .register({ id: 'A', fn: () => 1 })
      .register({ id: 'B', fn: () => 2 })
      .register({ id: 'D', fn: () => Promise.reject(new Error('Error in D')) })
      .register(
        {
          id: 'C',
          fn: ({ A, B }) => {
            if (isError(A) || isError(B)) {
              return throwError(() => new Error('Error in A or B'));
            }

            return 3 + A.data + B.data;
          },
        },
        ['A', 'B'],
      )
      .register(
        {
          id: 'E',
          fn: ({ C, D }) => {
            if (isError(C) || isError(D)) {
              return throwError(() => new Error('Error in C or D'));
            }

            return 5 + C.data + D.data;
          },
        },
        ['C', 'D'],
      )
      .register(
        {
          id: 'F',
          fn: ({ C, E }) => {
            if (isError(C) || isError(E)) {
              return throwError(() => new Error('Error in C or E'));
            }

            return 6 + C.data + E.data;
          },
        },
        ['C', 'E'],
      );

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({
      hasErrors: true,
      tasks: {
        A: { data: 1 },
        B: { data: 2 },
        C: { data: 6 },
        D: { error: new Error('Error in D') },
        E: { error: new Error('Error in C or D') },
        F: { error: new Error('Error in C or E') },
      },
    });
  });

  test('with global args', async () => {
    const resolver = new Resolver('Hello').register({ id: 'A', fn: (_args, globalArgs) => `${globalArgs}, World!` });

    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({ globalArgs: 'Hello', tasks: { A: { data: 'Hello, World!' } } });

    resolver.setGlobalArgs('Goodbye');

    const result2 = await lastValueFrom(resolver.resolve());

    expect(result2).toEqual({ globalArgs: 'Goodbye', tasks: { A: { data: 'Goodbye, World!' } } });
  });

  test('with temporary global args', async () => {
    const resolver = new Resolver('Hello').register({ id: 'A', fn: (_args, globalArgs) => `${globalArgs}, World!` });

    const result = await lastValueFrom(resolver.resolve({ globalArgs: 'Goodbye' }));

    expect(result).toEqual({ globalArgs: 'Goodbye', tasks: { A: { data: 'Goodbye, World!' } } });

    const result2 = await lastValueFrom(resolver.resolve({ globalArgs: 'Nighty Night' }));

    expect(result2).toEqual({ globalArgs: 'Nighty Night', tasks: { A: { data: 'Nighty Night, World!' } } });
  });

  test('with temporary global args does not mutate instance', async () => {
    const resolver = new Resolver('Hello').register({ id: 'A', fn: (_args, globalArgs) => `${globalArgs}, World!` });

    await lastValueFrom(resolver.resolve({ globalArgs: 'Goodbye' }));
    const result = await lastValueFrom(resolver.resolve());

    expect(result).toEqual({ globalArgs: 'Hello', tasks: { A: { data: 'Hello, World!' } } });
  });

  test('with temporary global args = undefined does override', async () => {
    const resolver = new Resolver<string | undefined>('Hello').register({
      id: 'A',
      fn: (_args, globalArgs) => `${globalArgs}, World!`,
    });

    const result = await lastValueFrom(resolver.resolve({ globalArgs: undefined }));

    expect(result).toEqual({ globalArgs: undefined, tasks: { A: { data: 'undefined, World!' } } });
  });

  test('resolve with too many iterations', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolver: any = new Resolver();
    for (let i = 0; i < RESOLVER_MAX_ITERATIONS + 1; i++) {
      resolver = resolver.register({ id: `${i}`, fn: () => i }, i > 0 ? [`${i - 1}`] : []);
    }

    await expect(lastValueFrom(resolver.resolve())).rejects.toThrowError('Max iterations reached');
  });

  test('resolve with explicit loading state', async () => {
    const resolver = new Resolver().register({ id: 'A', fn: () => 1 }).register({ id: 'B', fn: () => 2 });

    const result = await firstValueFrom(resolver.resolve({ withLoadingState: true }));

    expect(isLoading(result)).toBe(true);
    expect(result).toEqual({ loading: true });
  });

  test('resolve with default behavior (no loading state)', async () => {
    const resolver = new Resolver().register({ id: 'A', fn: () => 1 }).register({ id: 'B', fn: () => 2 });

    const result = await firstValueFrom(resolver.resolve());

    expect(result).toEqual({ tasks: { A: { data: 1 }, B: { data: 2 } } });
  });

  test('task graph with duplicate task id', () => {
    const resolver = new Resolver().register({ id: 'A', fn: () => 1 });

    expect(() => {
      // @ts-expect-error - Duplicate task id
      resolver.register({ id: 'A', fn: () => 2 });
    }).toThrowError("Task with id 'A' has already been registered");
  });

  test('task graph with missing dependency', () => {
    const resolver = new Resolver().register({ id: 'A', fn: () => 1 });

    expect(() => {
      // @ts-expect-error - Missing dependency
      resolver.register({ id: 'B', fn: () => 2 }, ['C']);
    }).toThrowError("Task with id 'B' has dependencies that have not been registered");
  });

  test('task graph with long running task and cancellation', async () => {
    const started = vi.fn();
    const finalizer = vi.fn();
    const resolver = new Resolver().register({
      id: 'A',
      fn: () => {
        started();
        return of(1).pipe(delay(1000), finalize(finalizer));
      },
    });

    const result = resolver.resolve();
    const subscription = result.subscribe();

    subscription.unsubscribe();

    expect(started).toHaveBeenCalledOnce();
    expect(finalizer).toHaveBeenCalledOnce();
  });
});
