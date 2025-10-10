# Resolver

A dependency-aware task resolver using RxJS observables for asynchronous execution. This library allows you to define tasks with dependencies and automatically resolves them in the correct order.

## Features

- **Dependency Resolution**: Automatically determines the execution order based on task dependencies
- **RxJS Integration**: Built on RxJS observables for powerful async handling
- **Type Safety**: Full TypeScript support with type inference
- **Error Handling**: Built-in error handling with graceful failure modes

## Installation

```bash
npm install resolver
# or
pnpm add resolver
# or
yarn add resolver
```

## Usage

### Basic Example

```typescript
import { lastValueFrom, of } from 'rxjs';
import { Resolver, isSuccess } from 'resolver';

// Create a resolver instance
const resolver = new Resolver()
  // Register task A with no dependencies
  .register({
    id: 'A',
    fn: () => of('Hello'),
  })
  // Register task B with no dependencies
  .register({
    id: 'B',
    fn: () => of('World'),
  })
  // Register task C that depends on A and B
  .register(
    {
      id: 'C',
      fn: ({ A, B }) => {
        if (isSuccess(A) && isSuccess(B)) {
          return of(`${A.data} ${B.data}!`);
        }
        throw new Error('Missing dependencies');
      },
    },
    ['A', 'B'],
  );

// Resolve all tasks
const result = await lastValueFrom(resolver.resolve());
console.log(result); // { A: { data: 'Hello' }, B: { data: 'World' }, C: { data: 'Hello World!' } }
```

### Advanced Example with Error Handling

```typescript
import { lastValueFrom, of, throwError } from 'rxjs';
import { Resolver, isSuccess } from 'resolver';

const resolver = new Resolver()
  .register({
    id: 'fetchUser',
    fn: () => of({ id: 1, name: 'John' }),
  })
  .register(
    {
      id: 'fetchPosts',
      fn: ({ fetchUser }) => {
        if (isSuccess(fetchUser)) {
          return of([
            { id: 1, title: 'Post 1' },
            { id: 2, title: 'Post 2' },
          ]);
        }
        return throwError(() => new Error('User not found'));
      },
    },
    ['fetchUser'],
  )
  .register(
    {
      id: 'generateReport',
      fn: ({ fetchUser, fetchPosts }) => {
        if (isSuccess(fetchUser) && isSuccess(fetchPosts)) {
          return of({
            user: fetchUser.data,
            postCount: fetchPosts.data.length,
            timestamp: new Date().toISOString(),
          });
        }
        return throwError(() => new Error('Missing data for report'));
      },
    },
    ['fetchUser', 'fetchPosts'],
  );

try {
  const result = await lastValueFrom(resolver.resolve());
  console.log(result);
} catch (error) {
  console.error('Resolution failed:', error);
}
```

## Type Safety

The resolver provides full TypeScript support with type inference:

```typescript
const resolver = new Resolver<{
  user: { id: number; name: string };
  posts: Array<{ id: number; title: string }>;
}>()
  .register({
    id: 'user',
    fn: () => of({ id: 1, name: 'John' }),
  })
  .register(
    {
      id: 'posts',
      fn: ({ user }) => {
        // user is typed as { data: { id: number; name: string } } | { error: unknown }
        return of([{ id: 1, title: 'Post 1' }]);
      },
    },
    ['user'],
  );
```

## Error Handling

Tasks can return either successful data or errors. The resolver handles both cases gracefully:

- Successful tasks return `{ data: TResult }`
- Failed tasks return `{ error: unknown }`

## Status Attributes

The resolver provides status attributes to help track resolution progress and detect errors:

- **`_loading`**: Emitted as the first value (`{ _loading: true }`) in the observable stream, indicating that resolution is in progress
- **`_hasErrors`**: Included in the final result as either `true` (if any task failed) or `undefined` (if all tasks succeeded)

```typescript
import { lastValueFrom, of } from 'rxjs';
import { Resolver, isSuccess } from 'resolver';

const resolver = new Resolver()
  .register({
    id: 'task1',
    fn: () => of('Hello'),
  })
  .register({
    id: 'task2',
    fn: () => of('World'),
  });

// Subscribe to track loading state and errors
resolver.resolve().subscribe((result) => {
  if ('_loading' in result) {
    console.log('Resolution in progress...');
  } else {
    if (result._hasErrors) {
      console.log('Some tasks failed');
    } else {
      console.log('All tasks completed successfully');
    }
    console.log('Final result:', result);
  }
});
```

## Resolve Options

The `resolve()` method accepts an optional options parameter to control its behavior:

```typescript
interface ResolveOptions {
  withLoadingState?: boolean;
  maxIterations?: number;
}
```

### `withLoadingState` (default: `true`)

Controls whether the resolver emits a loading state as the first value in the observable stream.

- **`true`** (default): Emits `{ _loading: true }` as the first value, followed by the final result
- **`false`**: Only emits the final result without the loading state

```typescript
// With loading state (default behavior)
resolver.resolve().subscribe((result) => {
  if ('_loading' in result) {
    console.log('Resolution in progress...');
  } else {
    console.log('Final result:', result);
  }
});

// Without loading state
resolver.resolve({ withLoadingState: false }).subscribe((result) => {
  console.log('Final result:', result);
});
```

### `maxIterations` (default: `100`)

Controls the maximum number of resolution iterations before throwing an error. This prevents infinite loops in case of resolution issues.

- **Default**: `100` iterations
- **Purpose**: Safety mechanism to prevent infinite resolution loops
- **Error**: Throws an error if the limit is exceeded

```typescript
// Custom max iterations
resolver.resolve({ maxIterations: 50 }).subscribe({
  next: (result) => console.log('Result:', result),
  error: (error) => console.error('Resolution failed:', error.message),
});

// Combined options
resolver
  .resolve({
    withLoadingState: false,
    maxIterations: 200,
  })
  .subscribe((result) => {
    console.log('Final result:', result);
  });
```

## License

[MIT](./LICENSE)
