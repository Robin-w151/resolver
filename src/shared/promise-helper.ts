import type { Observable } from 'rxjs';

export interface WithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Creates a promise with its resolve and reject functions exposed.
 *
 * @returns An object containing the promise, resolve, and reject functions
 */
export function withResolvers<T>(): WithResolvers<T> {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Type guard to check if a value is a Promise.
 *
 * @param value - The value to check
 * @returns True if the value is a Promise
 */
export function isPromise<TValue>(value: TValue | Promise<TValue> | Observable<TValue>): value is Promise<TValue> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}
