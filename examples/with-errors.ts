import { lastValueFrom, throwError } from 'rxjs';
import { isSuccess, Resolver } from '../src/resolver.js';

const resolver = new Resolver()
  .register({ id: 'A', fn: () => 1 })
  .register({ id: 'B', fn: () => throwError(() => 'Error in B') })
  .register(
    {
      id: 'C',
      fn: ({ A, B }) => {
        if (isSuccess(A) && isSuccess(B)) {
          return A.data + B.data;
        }

        throw 'Error in A or B';
      },
    },
    ['A', 'B'],
  );

const result = await lastValueFrom(resolver.resolve());

console.log(result);
