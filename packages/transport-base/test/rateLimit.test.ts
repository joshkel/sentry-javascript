import { disabledUntil, isRateLimited, parseRetryAfterHeader, RateLimits, updateRateLimits } from '../src/rateLimit';

describe('parseRetryAfterHeader()', () => {
  test('should fallback to 60s when incorrect header provided', () => {
    expect(parseRetryAfterHeader('x')).toEqual(60 * 1000);
  });

  test('should correctly parse delay-based header', () => {
    expect(parseRetryAfterHeader('1337')).toEqual(1337 * 1000);
  });

  test('should correctly parse date-based header', () => {
    expect(
      parseRetryAfterHeader('Wed, 21 Oct 2015 07:28:13 GMT', new Date('Wed, 21 Oct 2015 07:28:00 GMT').getTime()),
    ).toEqual(13 * 1000);
  });
});

describe('disabledUntil()', () => {
  test('should return 0 when no match', () => {
    expect(disabledUntil({}, 'error')).toEqual(0);
  });

  test('should return matched value', () => {
    expect(disabledUntil({ error: 42 }, 'error')).toEqual(42);
  });

  test('should fallback to `all` category', () => {
    expect(disabledUntil({ all: 42 }, 'error')).toEqual(42);
  });
});

describe('isRateLimited()', () => {
  test('should return false when no match', () => {
    expect(isRateLimited({}, 'error')).toEqual(false);
  });

  test('should return false when matched value is in the past', () => {
    expect(isRateLimited({ error: 10 }, 'error', 42)).toEqual(false);
  });

  test('should return true when matched value is in the future', () => {
    expect(isRateLimited({ error: 50 }, 'error', 42)).toEqual(true);
  });

  test('should fallback to the `all` category when given one is not matched', () => {
    expect(isRateLimited({ all: 10 }, 'error', 42)).toEqual(false);
    expect(isRateLimited({ all: 50 }, 'error', 42)).toEqual(true);
  });
});

describe('updateRateLimits()', () => {
  test('should return same limits when no headers provided', () => {
    const rateLimits: RateLimits = {
      error: 42,
      transaction: 1337,
    };
    const headers = {};
    const updatedRateLimits = updateRateLimits(rateLimits, headers);
    expect(rateLimits).toStrictEqual(updatedRateLimits);
  });

  test('should update the `all` category based on `retry-after` header ', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'retry-after': '42',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.all).toEqual(42000);
  });

  test('should update a single category based on `x-sentry-rate-limits` header', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'x-sentry-rate-limits': '13:error',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.error).toEqual(13000);
  });

  test('should update a multiple categories based on `x-sentry-rate-limits` header', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'x-sentry-rate-limits': '13:error;transaction',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.error).toEqual(13000);
    expect(updatedRateLimits.transaction).toEqual(13000);
  });

  test('should update limits based on multi `x-sentry-rate-limits` header', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'x-sentry-rate-limits': '13:error,15:transaction',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.error).toEqual(13000);
    expect(updatedRateLimits.transaction).toEqual(15000);
  });

  test('should use last entry from multi `x-sentry-rate-limits` header for a given category', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'x-sentry-rate-limits': '13:error,15:transaction;error',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.error).toEqual(15000);
    expect(updatedRateLimits.transaction).toEqual(15000);
  });

  test('should fallback to `all` if `x-sentry-rate-limits` header is missing a category', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'x-sentry-rate-limits': '13',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.all).toEqual(13000);
  });

  test('should use 60s default if delay in `x-sentry-rate-limits` header is malformed', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'x-sentry-rate-limits': 'x',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.all).toEqual(60000);
  });

  test('should preserve previous limits', () => {
    const rateLimits: RateLimits = {
      error: 1337,
    };
    const headers = {
      'x-sentry-rate-limits': '13:transaction',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.error).toEqual(1337);
    expect(updatedRateLimits.transaction).toEqual(13000);
  });

  test('should give priority to `x-sentry-rate-limits` over `retry-after` header if both provided', () => {
    const rateLimits: RateLimits = {};
    const headers = {
      'retry-after': '42',
      'x-sentry-rate-limits': '13:error',
    };
    const updatedRateLimits = updateRateLimits(rateLimits, headers, 0);
    expect(updatedRateLimits.error).toEqual(13000);
    expect(updatedRateLimits.all).toBeUndefined();
  });
});
