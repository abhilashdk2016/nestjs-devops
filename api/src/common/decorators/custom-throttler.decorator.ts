import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { seconds } from '@nestjs/throttler';

export { SkipThrottle };

/**
 * Auth endpoints — prevents brute-force attacks on login/register.
 * 5 requests per 60 seconds.
 */
export const ThrottleAuth = () =>
    Throttle({ default: { limit: 5, ttl: seconds(60) } });

/**
 * Strict endpoints — one-time or sensitive operations (e.g. password reset, OTP).
 * 3 requests per 60 seconds.
 */
export const ThrottleStrict = () =>
    Throttle({ default: { limit: 3, ttl: seconds(60) } });

/**
 * Default endpoints — matches the global ThrottlerModule configuration.
 * 10 requests per 60 seconds.
 */
export const ThrottleModerate = () =>
    Throttle({ default: { limit: 5, ttl: seconds(1000) } });

/**
 * Lenient endpoints — public read-heavy routes (e.g. product listings).
 * 60 requests per 60 seconds.
 */
export const ThrottleLenient = () =>
    Throttle({ default: { limit: 20, ttl: seconds(1000) } });
