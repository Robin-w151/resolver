# @robinw151/resolver

## 0.5.0

### Minor Changes

- fb3d682: Require the constructor's global arguments whenever `TGlobalArgs` cannot be `undefined`. Task
  functions and the resolve result declare the global arguments as `TGlobalArgs`, but the constructor
  accepted no value at all, so `new Resolver<{ apiKey: string }>()` type checked while every task was
  handed `undefined`.

  This is a type level change only, the runtime behaviour is unchanged. `new Resolver()` and
  `new Resolver(globalArgs)` keep working as before. If the global arguments are only supplied later
  through `setGlobalArgs()` or `resolve({ globalArgs })`, include `undefined` in the type, for example
  `new Resolver<{ apiKey: string } | undefined>()`.

## 0.4.1

### Patch Changes

- c2958f2: Fix resolution hanging forever when a task's Observable completes without emitting a value. Such
  tasks now resolve with an `EmptyTaskError` instead of leaving the whole task graph pending.
- 6cfa059: Fix tasks not being cancelled when a resolution using `withLoadingState` is unsubscribed while the
  loading state is emitted. Consuming only the loading state (for example via `take(1)` or
  `firstValueFrom`) left the running tasks without a teardown, so they kept executing, dependent tasks
  still started, and never completing tasks stayed subscribed indefinitely.

## 0.4.0

### Minor Changes

- f9192d2: Migrate to typescript 6 and tsdown

### Patch Changes

- f9192d2: Update packages
- f9192d2: update typescript to release version
- f9192d2: update package export paths

## 0.4.0-next.3

### Patch Changes

- 23bd6c1: Update packages

## 0.4.0-next.2

### Patch Changes

- 329d1bc: update typescript to release version

## 0.4.0-next.1

### Patch Changes

- 8dafdaf: update package export paths

## 0.4.0-next.0

### Minor Changes

- 40d036e: Migrate to typescript 6 and tsdown

## 0.3.1

### Patch Changes

- 3818092: improve advanced usage example in the README

## 0.3.0

### Minor Changes

- 0cefd6c: improve task resolution algorithm

## 0.2.1

### Patch Changes

- 1caf0eb: adjust tsup configuration

## 0.2.0

### Minor Changes

BREAKING:

- 70e200a: provide hasNoErrors utility function and remove hasErrors status flag

## 0.1.3

### Patch Changes

- 62c910f: use for-of instead of forEach for iterating over tasks

## 0.1.2

### Patch Changes

- 1c40063: setup tsup to support esm and cjs

## 0.1.1

### Patch Changes

- 989ba61: update README and docs to use correct package name (including scope)

## 0.1.0

### Minor Changes

- Initial release
