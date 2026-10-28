interface AttemptRecord {
  count: number;
  failures: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

const ipAttempts = new Map<string, AttemptRecord>();
const accountAttempts = new Map<string, AttemptRecord>();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_ATTEMPTS_PER_MINUTE = 5;
const MAX_FAILURES_BEFORE_LOCKOUT = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

function checkRecord(record: AttemptRecord | undefined): { throttled: boolean; retryAfterSeconds: number } {
  if (!record) {
    return { throttled: false, retryAfterSeconds: 0 };
  }

  const now = Date.now();

  // Check if actively locked out
  if (record.lockedUntil > now) {
    return {
      throttled: true,
      retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }

  // Check window rate limit (5 per minute)
  if (now - record.firstAttemptAt < WINDOW_MS && record.count >= MAX_ATTEMPTS_PER_MINUTE) {
    const retryAfter = Math.ceil((record.firstAttemptAt + WINDOW_MS - now) / 1000);
    return { throttled: true, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  return { throttled: false, retryAfterSeconds: 0 };
}

export function isLoginThrottled(params: {
  ip: string;
  email: string;
}): { throttled: boolean; retryAfterSeconds: number } {
  const ipCheck = checkRecord(ipAttempts.get(params.ip));
  if (ipCheck.throttled) {
    return ipCheck;
  }

  const accountKey = params.email.toLowerCase().trim();
  const accountCheck = checkRecord(accountAttempts.get(accountKey));
  if (accountCheck.throttled) {
    return accountCheck;
  }

  return { throttled: false, retryAfterSeconds: 0 };
}

export function recordLoginAttempt(params: {
  ip: string;
  email: string;
  success: boolean;
}): void {
  const now = Date.now();
  const keys = [
    { map: ipAttempts, key: params.ip },
    { map: accountAttempts, key: params.email.toLowerCase().trim() },
  ];

  for (const { map, key } of keys) {
    if (!key) continue;
    let rec = map.get(key);

    if (params.success) {
      // Clear failure counters on successful login
      map.delete(key);
      continue;
    }

    if (!rec || now - rec.firstAttemptAt > WINDOW_MS) {
      rec = {
        count: 1,
        failures: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
      };
    } else {
      rec.count += 1;
      rec.failures += 1;
    }

    if (rec.failures >= MAX_FAILURES_BEFORE_LOCKOUT) {
      rec.lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    map.set(key, rec);
  }
}
