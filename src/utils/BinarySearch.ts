// Both helpers assume `arr` is sorted ascending. They power the virtualization
// lookups, so they take number arrays directly rather than a generic comparator.

/** First index where `arr[index] >= target`, or `arr.length` if none. */
export function lowerBound(arr: number[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index where `arr[index] > target`, or `arr.length` if none. */
export function upperBound(arr: number[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
