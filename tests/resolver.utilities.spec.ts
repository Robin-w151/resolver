import { describe, expect, test } from 'vitest';
import type { TaskResult } from '../src/resolver.interface';
import { hasNoErrors, isError, isSuccess } from '../src/resolver';

describe('Resolver utilities', () => {
  test.each([
    { value: { data: 1 }, expected: true },
    { value: { error: new Error('Error') }, expected: false },
  ])('isSuccess $value = $expected', ({ value, expected }) => {
    expect(isSuccess(value)).toBe(expected);
  });

  test.each([
    { value: { data: 1 }, expected: false },
    { value: { error: new Error('Error') }, expected: true },
  ])('isError $value = $expected', ({ value, expected }) => {
    expect(isError(value)).toBe(expected);
  });

  test.each([
    { tasks: { A: { data: 1 } }, expected: true },
    { tasks: { A: { error: new Error('Error') } }, expected: false },
    { tasks: { A: { data: 1 }, B: { data: 2 } }, expected: true },
    { tasks: { A: { data: 1 }, B: { error: new Error('Error') } }, expected: false },
  ])('hasNoErrors $tasks = $expected', ({ tasks, expected }) => {
    expect(hasNoErrors(tasks as Record<string, TaskResult<unknown>>)).toBe(expected);
  });
});
