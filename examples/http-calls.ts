import { tap } from 'rxjs';
import { isError, isLoading, Resolver } from '../src/resolver.js';

interface TestObject {
  id: string;
  name: string;
  data: unknown;
}

const resolver = new Resolver()
  .register({
    id: 'fetchObjects',
    fn: async () => {
      const response = await fetch('https://api.restful-api.dev/objects');
      if (!response.ok) {
        throw new Error('Failed to fetch objects');
      }
      return response.json() as Promise<TestObject[]>;
    },
  })
  .register(
    {
      id: 'fetchFirstObjectById',
      fn: async ({ fetchObjects }) => {
        if (isError(fetchObjects)) {
          throw fetchObjects.error;
        }

        const firstObject = fetchObjects.data[0];
        if (!firstObject) {
          throw new Error('No objects found');
        }

        const response = await fetch(`https://api.restful-api.dev/objects?id=${firstObject.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch first object');
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('Invalid response');
        }

        return data[0] as TestObject;
      },
    },
    ['fetchObjects'],
  );

const result = resolver.resolve({ withLoadingState: true });

result
  .pipe(
    tap((result) => {
      if (isLoading(result)) {
        console.log('Loading...');
      } else if (isError(result.tasks.fetchFirstObjectById)) {
        console.log('Error:', result);
      } else {
        console.log('Result:', JSON.stringify(result.tasks.fetchFirstObjectById.data, undefined, 2));
      }
    }),
  )
  .subscribe();
