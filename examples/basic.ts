import { delay, lastValueFrom, of, throwError } from 'rxjs';
import { isSuccess, Resolver } from '../src/resolver.js';

const resolver = new Resolver()
  .register({
    id: 'A',
    fn: () => {
      console.log('A');
      return 1;
    },
  })
  .register({
    id: 'B',
    fn: () => {
      console.log('B');
      return 2;
    },
  })
  .register(
    {
      id: 'C',
      fn: ({ A, B }) => {
        console.log('C');
        if (isSuccess(A) && isSuccess(B)) {
          return A.data + B.data;
        }

        return throwError(() => new Error('Error in A or B'));
      },
    },
    ['A', 'B'],
  )
  .register(
    {
      id: 'D',
      fn: ({ A, C }) => {
        console.log('D');
        if (isSuccess(A) && isSuccess(C)) {
          return of(A.data + C.data).pipe(delay(2000));
        }
        return throwError(() => new Error('Error in A or C'));
      },
    },
    ['A', 'C'],
  )
  .register(
    {
      id: 'E',
      fn: () => {
        console.log('E');
        return of(5).pipe(delay(1000));
      },
    },
    [],
  );

const result = await lastValueFrom(resolver.resolve());

/* eslint-disable no-undef */
console.log(result);
