import { Observable } from 'rxjs';
import type { ResolverType, RxjsAwaited, TaskDependencies, TaskResult } from '../src/resolver.interface';
import { Resolver } from '../src/resolver';
import type { Equal, Expect } from './type-test-util';

// ResolverType
type resolverTypeTests = [
  Expect<Equal<ResolverType<string, {}, 'A', number>, Resolver<string, { A: TaskResult<number> }>>>,
  Expect<
    Equal<
      ResolverType<symbol, { A: TaskResult<number> }, 'B', string>,
      Resolver<symbol, { A: TaskResult<number> } & { B: TaskResult<string> }>
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
