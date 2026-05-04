import { describe, expect, it } from 'vitest';
import { runPolicyV1 } from '../../src/modules/validation/policies/policy-v1.js';
import type { PolicyV1Input } from '../../src/modules/validation/validation-engine.js';

const now = new Date('2026-05-03T13:20:00.000Z');

function validInput(overrides: Partial<PolicyV1Input> = {}): PolicyV1Input {
  return {
    user: { id: '1', isActive: true, role: 'DEPUTY', deputyId: '25' },
    deputy: { id: '25', active: true },
    session: {
      id: '431',
      status: 'OPEN',
      checkinStart: new Date('2026-05-03T13:00:00.000Z'),
      checkinEnd: new Date('2026-05-03T14:00:00.000Z'),
      allowMultipleCheckins: false
    },
    location: {
      latitude: 38.7139,
      longitude: -9.1521,
      radiusMeters: 100,
      allowedIpRanges: ['127.0.0.1/32', '193.0.0.0/24'],
      active: true
    },
    gps: { latitude: 38.714, longitude: -9.152, accuracyMeters: 20 },
    clientIp: '127.0.0.1',
    clientRequestId: '550e8400-e29b-41d4-a716-446655440000',
    now,
    maxGpsAccuracyMeters: 100,
    duplicateAttendanceExists: false,
    clientRequestIdAlreadyUsed: false,
    ...overrides
  };
}

describe('POLICY_V1 validation', () => {
  it('accepts a valid attendance context', () => {
    const result = runPolicyV1(validInput());

    expect(result.result).toBe('VALID');
    expect(result.checkedAt).toBe('2026-05-03T13:20:00.000Z');
    expect(result.checks.authorizedIp.status).toBe('valid');
    expect(result.checks.gpsWithinRadius.status).toBe('valid');
  });

  it.each([
    ['inactive user', { user: { id: '1', isActive: false, role: 'DEPUTY', deputyId: '25' } }, 'UNAUTHORIZED'],
    ['inactive deputy', { deputy: { id: '25', active: false } }, 'DEPUTY_INACTIVE'],
    ['missing session', { session: null }, 'SESSION_NOT_FOUND'],
    ['closed session', { session: { ...validInput().session!, status: 'CLOSED' as const } }, 'SESSION_NOT_OPEN'],
    ['outside check-in window', { now: new Date('2026-05-03T15:00:00.000Z') }, 'CHECKIN_WINDOW_CLOSED'],
    ['duplicate attendance', { duplicateAttendanceExists: true }, 'DUPLICATE_ATTENDANCE'],
    ['reused request id', { clientRequestIdAlreadyUsed: true }, 'CLIENT_REQUEST_ID_ALREADY_USED'],
    ['invalid ip', { clientIp: '10.10.10.10' }, 'IP_NOT_AUTHORIZED'],
    ['gps out of range', { gps: { latitude: 38.72, longitude: -9.16, accuracyMeters: 20 } }, 'GPS_OUT_OF_RANGE'],
    ['gps accuracy too low', { gps: { latitude: 38.714, longitude: -9.152, accuracyMeters: 120 } }, 'GPS_ACCURACY_TOO_LOW']
  ])('rejects %s', (_name, override, code) => {
    const result = runPolicyV1(validInput(override as Partial<PolicyV1Input>));

    expect(result.result).toBe('INVALID');
    expect(result.errorCode).toBe(code);
  });
});
