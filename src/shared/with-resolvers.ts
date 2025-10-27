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
