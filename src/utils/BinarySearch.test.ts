import { describe, it, expect } from 'vitest';
import { lowerBound, upperBound } from './BinarySearch';

describe('lowerBound', () => {
  it('finds the first index >= target', () => {
    const a = [0, 10, 20, 30, 40];
    expect(lowerBound(a, 0)).toBe(0);
    expect(lowerBound(a, 15)).toBe(2);
    expect(lowerBound(a, 20)).toBe(2);
    expect(lowerBound(a, 41)).toBe(5);
  });

  it('handles empty arrays', () => {
    expect(lowerBound([], 5)).toBe(0);
  });
});

describe('upperBound', () => {
  it('finds the first index > target', () => {
    const a = [0, 10, 20, 30, 40];
    expect(upperBound(a, 0)).toBe(1);
    expect(upperBound(a, 15)).toBe(2);
    expect(upperBound(a, 20)).toBe(3);
    expect(upperBound(a, 40)).toBe(5);
  });
});
