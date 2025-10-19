import { delay, finalize, lastValueFrom, of, throwError } from 'rxjs';
import { hasNoErrors, isSuccess, Resolver } from '../src/resolver';

const logTask = (message: string) => {
  console.log(`${new Date().toISOString()}: ${message}`);
};

const logResult = (result: unknown) => {
  console.log('\n#################################\n\nResult:', result);
};

const resolver = new Resolver({ base: 0 } as const)
  .register({
    id: 'A',
    fn: (_, { base }) => {
      logTask('A start');
      return of(base + 1).pipe(finalize(() => logTask('A done')));
    },
  })
  .register({
    id: 'B',
    fn: (_, { base }) => {
      logTask('B start');
      return of(base + 2).pipe(finalize(() => logTask('B done')));
    },
  })
  .register(
    {
      id: 'C',
      fn: (args) => {
        logTask('C start');
        if (hasNoErrors(args)) {
          const { A, B } = args;
          return of(A.data + B.data).pipe(finalize(() => logTask('C done')));
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
        logTask('D start');
        if (isSuccess(A) && isSuccess(C)) {
          return of(A.data + C.data).pipe(
            delay(3000),
            finalize(() => logTask('D done')),
          );
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
        logTask('E start');
        return of(5).pipe(
          delay(1000),
          finalize(() => logTask('E done')),
        );
      },
    },
    [],
  )
  .register(
    {
      id: 'F',
      fn: () => {
        logTask('F start');
        return of(6).pipe(
          delay(1000),
          finalize(() => logTask('F done')),
        );
      },
    },
    ['E'],
  );

const result = await lastValueFrom(resolver.resolve());
logResult(result);
