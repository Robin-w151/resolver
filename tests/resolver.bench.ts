import { lastValueFrom } from 'rxjs';
import { bench, describe, expect } from 'vitest';
import { hasNoErrors, isSuccess, Resolver } from '../src/resolver';
import type { TaskResult } from '../src/resolver.interface';

describe('Resolver benchmark', () => {
  bench(
    'resolver with 1000 tasks partially depending on another',
    async () => {
      const TASK_COUNT = 1000;
      const MAX_DEPENDENCY_DEPTH = 5;

      const resolver = new Resolver<number>();

      // Create 1000 tasks with partial dependencies
      for (let i = 0; i < TASK_COUNT; i++) {
        const taskId = `task_${i}`;

        // Each task depends on the previous MAX_DEPENDENCY_DEPTH tasks (when available)
        const dependencies: Array<string> = [];
        for (let j = Math.max(0, i - MAX_DEPENDENCY_DEPTH); j < i; j++) {
          dependencies.push(`task_${j}`);
        }

        if (dependencies.length === 0) {
          // Root tasks return their index
          resolver.register({
            id: taskId,
            fn: () => i,
          });
        } else {
          // Dependent tasks sum their dependencies and add their own index
          resolver.register(
            {
              id: taskId,
              fn: (deps, globalArgs) => {
                const sum = Object.values(deps).reduce((acc, result) => {
                  return acc + (isSuccess(result) ? result.data : 0);
                }, 0);
                return sum + i + globalArgs;
              },
            },
            // @ts-expect-error - Type mismatch expected for dynamic dependency arrays
            dependencies,
          );
        }
      }

      const result = await lastValueFrom(resolver.resolve({ globalArgs: 10 }));
      expect(hasNoErrors(result.tasks as Record<string, TaskResult<number>>)).toBe(true);
    },
    { iterations: 100 },
  );
});
