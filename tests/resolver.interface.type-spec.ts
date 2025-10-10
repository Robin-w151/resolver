import { Observable } from 'rxjs';
import type { ResolverType, RxjsAwaited, TaskDependencies, TaskResult } from '../src/resolver.interface.js';
import { Resolver } from '../src/resolver.js';
import type { Equal, Expect } from './type-test-util.js';

// ResolverType
type resolverTypeTests = [
  Expect<Equal<ResolverType<{}, 'A', number>, Resolver<{ A: TaskResult<number> }>>>,
  Expect<
    Equal<
      ResolverType<{ A: TaskResult<number> }, 'B', string>,
      Resolver<{ A: TaskResult<number> } & { B: TaskResult<string> }>
    >
  >,
];

// TaskDependencies
type taskDependenciesTests = [
  Expect<Equal<TaskDependencies<undefined, {}>, object>>,
  Expect<Equal<TaskDependencies<['A'], { A: TaskResult<number> }>, { A: TaskResult<number> }>>,
  Expect<Equal<TaskDependencies<['A'], { A: TaskResult<number>; B: TaskResult<string> }>, { A: TaskResult<number> }>>,
];

// RxjsAwaited
type rxjsAwaitedTests = [
  Expect<Equal<RxjsAwaited<number>, number>>,
  Expect<Equal<RxjsAwaited<Observable<number>>, number>>,
];
