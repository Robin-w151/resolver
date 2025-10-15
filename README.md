# Resolver

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/Robin-w151/resolver/ci.yaml?branch=main&style=for-the-badge&label=CI)
![GitHub License](https://img.shields.io/github/license/Robin-w151/resolver?style=for-the-badge&color=blue)

A dependency-aware task resolver using RxJS observables for asynchronous execution. This library allows you to define tasks with dependencies and automatically resolves them in the correct order.

## Features

- **Dependency Resolution**: Automatically determines the execution order based on task dependencies
- **RxJS Integration**: Built on RxJS observables for powerful async handling
- **Type Safety**: Full TypeScript support with type inference
- **Error Handling**: Built-in error handling with graceful failure modes

## Installation

```bash
npm install @robinw151/resolver
# or
pnpm add @robinw151/resolver
# or
yarn add @robinw151/resolver
```

## Usage

### Basic Example

```typescript
import { lastValueFrom } from 'rxjs';
import { Resolver, isSuccess } from '@robinw151/resolver';

// Create a resolver instance
const resolver = new Resolver()
  // Register task A with no dependencies
  .register({
    id: 'A',
    fn: () => 'Hello',
  })
  // Register task B with no dependencies
  .register({
    id: 'B',
    fn: () => 'World',
  })
  // Register task C that depends on A and B
  .register(
    {
      id: 'C',
      fn: ({ A, B }) => {
        if (isSuccess(A) && isSuccess(B)) {
          return `${A.data} ${B.data}!`;
        }
        throw new Error('Missing dependencies');
      },
    },
    ['A', 'B'],
  );

// Resolve all tasks
const result = await lastValueFrom(resolver.resolve());
console.log(result); // { tasks: { A: { data: 'Hello' }, B: { data: 'World' }, C: { data: 'Hello World!' } } }
```

### Advanced Example with Error Handling

```typescript
import { lastValueFrom } from 'rxjs';
import { Resolver, isSuccess, isError } from '@robinw151/resolver';

const resolver = new Resolver()
  .register({
    id: 'fetchUser',
    fn: () => ({ id: 1, name: 'John' }),
  })
  .register(
    {
      id: 'fetchPosts',
      fn: ({ fetchUser }) => {
        if (isSuccess(fetchUser)) {
          return [
            { id: 1, title: 'Post 1' },
            { id: 2, title: 'Post 2' },
          ];
        }
        throw new Error('User not found');
      },
    },
    ['fetchUser'],
  )
  .register(
    {
      id: 'generateReport',
      fn: ({ fetchUser, fetchPosts }) => {
        if (isSuccess(fetchUser) && isSuccess(fetchPosts)) {
          return {
            user: fetchUser.data,
            postCount: fetchPosts.data.length,
            timestamp: new Date().toISOString(),
          };
        }
        throw new Error('Missing data for report');
      },
    },
    ['fetchUser', 'fetchPosts'],
  );

try {
  const result = await lastValueFrom(resolver.resolve());

  // Check for errors using utility functions
  console.log('Some tasks failed during resolution');

  if (isError(result.tasks.fetchUser)) {
    console.error('User fetch failed:', result.tasks.fetchUser.error);
  }
  if (isError(result.tasks.fetchPosts)) {
    console.error('Posts fetch failed:', result.tasks.fetchPosts.error);
  }
} catch (error) {
  console.error('Resolution failed:', error);
}
```

## Type Safety

The resolver provides full TypeScript support with type inference:

```typescript
import { isSuccess, isError } from '@robinw151/resolver';

const resolver = new Resolver<{
  user: { id: number; name: string };
  posts: Array<{ id: number; title: string }>;
}>()
  .register({
    id: 'user',
    fn: () => ({ id: 1, name: 'John' }),
  })
  .register(
    {
      id: 'posts',
      fn: ({ user }) => {
        // user is typed as { data: { id: number; name: string } } | { error: unknown }
        if (isSuccess(user)) {
          console.log('User loaded:', user.data.name);
          return [{ id: 1, title: 'Post 1' }];
        } else {
          console.error('User failed to load:', user.error);
          return [];
        }
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

- **`loading`**: Emitted as the first value (`{ loading: true }`) in the observable stream, indicating that resolution is in progress
- **`hasErrors`**: Included in the final result as either `true` (if any task failed) or `undefined` (if all tasks succeeded)

```typescript
import { lastValueFrom, of } from 'rxjs';
import { Resolver, isLoading } from '@robinw151/resolver';

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
  if (isLoading(result)) {
    console.log('Resolution in progress...');
  } else {
    if (result.hasErrors) {
      console.log('Some tasks failed');
    } else {
      console.log('All tasks completed successfully');
    }
    console.log('Final result:', result);
  }
});
```

## Global Arguments

The resolver supports global arguments that are passed to all task functions during execution. This is useful for sharing configuration, API keys, or other context across all tasks.

### Constructor Global Arguments

You can provide global arguments when creating a resolver instance:

```typescript
import { lastValueFrom } from 'rxjs';
import { Resolver } from '@robinw151/resolver';

// Create resolver with global arguments
const resolver = new Resolver({ apiKey: 'your-api-key', baseUrl: 'https://api.example.com' })
  .register({
    id: 'fetchUser',
    fn: (_args, globalArgs) => {
      // globalArgs is typed as { apiKey: string; baseUrl: string }
      return fetch(`${globalArgs.baseUrl}/user`, {
        headers: { Authorization: `Bearer ${globalArgs.apiKey}` },
      });
    },
  })
  .register({
    id: 'fetchPosts',
    fn: (_args, globalArgs) => {
      return fetch(`${globalArgs.baseUrl}/posts`, {
        headers: { Authorization: `Bearer ${globalArgs.apiKey}` },
      });
    },
  });

const result = await lastValueFrom(resolver.resolve());
console.log(result.globalArgs); // { apiKey: 'your-api-key', baseUrl: 'https://api.example.com' }
```

### Dynamic Global Arguments

You can update global arguments after creating the resolver using `setGlobalArgs()`:

```typescript
const resolver = new Resolver({ version: 'v1' }).register({
  id: 'getVersion',
  fn: (_args, globalArgs) => globalArgs.version,
});

// First resolution
const result1 = await lastValueFrom(resolver.resolve());
console.log(result1.globalArgs.version); // 'v1'

// Update global arguments
resolver.setGlobalArgs({ version: 'v2' });

// Second resolution with updated arguments
const result2 = await lastValueFrom(resolver.resolve());
console.log(result2.globalArgs.version); // 'v2'
```

## Resolve Options

The `resolve()` method accepts an optional options parameter to control its behavior:

```typescript
interface ResolveOptions {
  globalArgs?: TGlobalArgs;
  withLoadingState?: boolean;
  maxIterations?: number;
}
```

### `globalArgs` (optional)

Provides a **temporary override** for global arguments passed to all tasks during this specific resolution. This does not mutate the instance's globalArgs and only affects this resolution call.

- **Purpose**: Allows different global arguments for specific resolutions without changing the resolver instance
- **Behavior**: Overrides the instance's globalArgs for this resolution only
- **Type**: Same type as the resolver's global arguments (`TGlobalArgs`)

```typescript
const resolver = new Resolver({ apiKey: 'default-key', baseUrl: 'https://api.example.com' }).register({
  id: 'fetchData',
  fn: (_args, globalArgs) => {
    return fetch(`${globalArgs.baseUrl}/data`, {
      headers: { Authorization: `Bearer ${globalArgs.apiKey}` },
    });
  },
});

// Use temporary global args for this resolution
const result = await lastValueFrom(
  resolver.resolve({
    globalArgs: { apiKey: 'temp-key', baseUrl: 'https://temp.api.com' },
  }),
);

console.log(result.globalArgs); // { apiKey: 'temp-key', baseUrl: 'https://temp.api.com' }

// Next resolution uses the original instance globalArgs
const result2 = await lastValueFrom(resolver.resolve());
console.log(result2.globalArgs); // { apiKey: 'default-key', baseUrl: 'https://api.example.com' }
```

### `withLoadingState` (default: `false`)

Controls whether the resolver emits a loading state as the first value in the observable stream.

- **`false`** (default): Only emits the final result without the loading state
- **`true`**: Emits `{ loading: true }` as the first value, followed by the final result

```typescript
import { isLoading } from '@robinw151/resolver';

// Without loading state (default behavior)
resolver.resolve().subscribe((result) => {
  console.log('Final result:', result);
});

// With loading state
resolver.resolve({ withLoadingState: true }).subscribe((result) => {
  if (isLoading(result)) {
    console.log('Resolution in progress...');
  } else {
    console.log('Final result:', result);
  }
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
```

## Utility Functions

The resolver provides several utility functions to help you work with task results and resolver states:

### `isSuccess(value)`

Type guard that checks if a task result contains successful data.

```typescript
import { isSuccess } from '@robinw151/resolver';

if (isSuccess(taskResult)) {
  // taskResult is typed as { data: TValue }
  console.log(taskResult.data);
}
```

### `isError(value)`

Type guard that checks if a task result contains an error.

```typescript
import { isError } from '@robinw151/resolver';

if (isError(taskResult)) {
  // taskResult is typed as { error: unknown }
  console.error(taskResult.error);
}
```

### `isLoading(value)`

Type guard that checks if a resolver result is in a loading state.

```typescript
import { isLoading } from '@robinw151/resolver';

if (isLoading(resolverResult)) {
  console.log('Resolution is still in progress...');
}
```

## License

[MIT](./LICENSE)
