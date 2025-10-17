import { delay, finalize, of, tap } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { RxjsAwaited } from '../src/resolver.interface.js';
import { Resolver } from '../src/resolver.js';

describe('Resolver timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should emit loading state before final result', async () => {
    let taskAStatus = 'pending';
    let taskBStatus = 'pending';
    let taskCStatus = 'pending';
    let taskDStatus = 'pending';
    let taskEStatus = 'pending';

    const resolver = new Resolver()
      .register({
        id: 'A',
        fn: () =>
          of(1).pipe(
            delay(1000),
            finalize(() => {
              taskAStatus = 'resolved';
            }),
          ),
      })
      .register(
        {
          id: 'B',
          fn: () =>
            of(2).pipe(
              delay(1000),
              finalize(() => {
                taskBStatus = 'resolved';
              }),
            ),
        },
        ['A'],
      )
      .register({
        id: 'C',
        fn: () =>
          of(3).pipe(
            delay(1000),
            finalize(() => {
              taskCStatus = 'resolved';
            }),
          ),
      })
      .register(
        {
          id: 'D',
          fn: () =>
            of(4).pipe(
              delay(2000),
              finalize(() => {
                taskDStatus = 'resolved';
              }),
            ),
        },
        ['C'],
      )
      .register({
        id: 'E',
        fn: () =>
          of(5).pipe(
            delay(3000),
            finalize(() => {
              taskEStatus = 'resolved';
            }),
          ),
      });

    let result: RxjsAwaited<ReturnType<typeof resolver.resolve<true>>> | undefined;
    resolver
      .resolve({ withLoadingState: true })
      .pipe(
        tap((value) => {
          result = value;
        }),
      )
      .subscribe();

    await vi.advanceTimersByTimeAsync(1);

    expect(taskAStatus).toBe('pending');
    expect(taskBStatus).toBe('pending');
    expect(taskCStatus).toBe('pending');
    expect(taskDStatus).toBe('pending');
    expect(taskEStatus).toBe('pending');
    expect(result).toEqual({ loading: true });

    await vi.advanceTimersByTimeAsync(1998);

    expect(taskAStatus).toBe('resolved');
    expect(taskBStatus).toBe('pending');
    expect(taskCStatus).toBe('resolved');
    expect(taskDStatus).toBe('pending');
    expect(taskEStatus).toBe('pending');
    expect(result).toEqual({ loading: true });

    await vi.advanceTimersByTimeAsync(1000);

    expect(taskAStatus).toBe('resolved');
    expect(taskBStatus).toBe('resolved');
    expect(taskCStatus).toBe('resolved');
    expect(taskDStatus).toBe('pending');
    expect(taskEStatus).toBe('pending');
    expect(result).toEqual({ loading: true });

    await vi.advanceTimersByTimeAsync(1);

    expect(taskAStatus).toBe('resolved');
    expect(taskBStatus).toBe('resolved');
    expect(taskCStatus).toBe('resolved');
    expect(taskDStatus).toBe('resolved');
    expect(taskEStatus).toBe('resolved');
    expect(result).toEqual({
      tasks: { A: { data: 1 }, B: { data: 2 }, C: { data: 3 }, D: { data: 4 }, E: { data: 5 } },
    });
  });
});
