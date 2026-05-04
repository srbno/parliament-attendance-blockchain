import { haversineDistanceMeters } from '../../../shared/geo/haversine.js';
import { isIpInRanges } from '../../../shared/network/cidr.js';
import type { CheckResult, PolicyV1Input, PolicyV1Result } from '../validation-engine.js';

function valid(extra: Omit<CheckResult, 'status'> = {}): CheckResult {
  return { status: 'valid', ...extra };
}

function invalid(reason: string, extra: Omit<CheckResult, 'status' | 'reason'> = {}): CheckResult {
  return { status: 'invalid', reason, ...extra };
}

export function runPolicyV1(input: PolicyV1Input): PolicyV1Result {
  const checks: PolicyV1Result['checks'] = {
    authenticatedUser: valid(),
    userIsDeputy: valid(),
    sessionExists: valid(),
    sessionOpen: valid(),
    timestampWithinWindow: valid(),
    noDuplicateAttendance: valid(),
    authorizedIp: valid({ method: 'cidr_match' }),
    gpsWithinRadius: valid(),
    gpsAccuracyAcceptable: valid(),
    replayProtection: valid()
  };

  let errorCode: string | undefined;
  const fail = (code: string) => {
    errorCode ??= code;
  };

  if (!input.user || !input.user.isActive) {
    checks.authenticatedUser = invalid('User must be authenticated and active');
    fail('UNAUTHORIZED');
  }

  if (!input.user?.deputyId || !input.deputy) {
    checks.userIsDeputy = invalid('User must be linked to an active deputy');
    fail('USER_NOT_LINKED_TO_DEPUTY');
  } else if (!input.deputy.active) {
    checks.userIsDeputy = invalid('Deputy must be active');
    fail('DEPUTY_INACTIVE');
  }

  if (!input.session) {
    checks.sessionExists = invalid('Session must exist');
    fail('SESSION_NOT_FOUND');
  } else {
    if (input.session.status !== 'OPEN') {
      checks.sessionOpen = invalid('Session must be open');
      fail('SESSION_NOT_OPEN');
    }

    if (input.now < input.session.checkinStart || input.now > input.session.checkinEnd) {
      checks.timestampWithinWindow = invalid('Check-in window is closed');
      fail('CHECKIN_WINDOW_CLOSED');
    }
  }

  if (input.duplicateAttendanceExists && !input.session?.allowMultipleCheckins) {
    checks.noDuplicateAttendance = invalid('Deputy already has attendance for this session');
    fail('DUPLICATE_ATTENDANCE');
  }

  if (input.clientRequestIdAlreadyUsed) {
    checks.replayProtection = invalid('clientRequestId was already used');
    fail('CLIENT_REQUEST_ID_ALREADY_USED');
  }

  if (!input.location?.active || !isIpInRanges(input.clientIp, input.location.allowedIpRanges)) {
    checks.authorizedIp = invalid('Client IP is not in an authorized CIDR range', { method: 'cidr_match' });
    fail('IP_NOT_AUTHORIZED');
  }

  if (input.location) {
    const distanceMeters = Number(
      haversineDistanceMeters(input.gps, {
        latitude: input.location.latitude,
        longitude: input.location.longitude
      }).toFixed(1)
    );
    checks.gpsWithinRadius =
      distanceMeters <= input.location.radiusMeters
        ? valid({ distanceMeters, allowedRadiusMeters: input.location.radiusMeters })
        : invalid('GPS coordinates are outside the authorized radius', {
            distanceMeters,
            allowedRadiusMeters: input.location.radiusMeters
          });
    if (checks.gpsWithinRadius.status === 'invalid') {
      fail('GPS_OUT_OF_RANGE');
    }
  } else {
    checks.gpsWithinRadius = invalid('Authorized location is required');
    fail('GPS_OUT_OF_RANGE');
  }

  checks.gpsAccuracyAcceptable =
    input.gps.accuracyMeters <= input.maxGpsAccuracyMeters
      ? valid({ accuracyMeters: input.gps.accuracyMeters, maxAccuracyMeters: input.maxGpsAccuracyMeters })
      : invalid('GPS accuracy is above the accepted threshold', {
          accuracyMeters: input.gps.accuracyMeters,
          maxAccuracyMeters: input.maxGpsAccuracyMeters
        });
  if (checks.gpsAccuracyAcceptable.status === 'invalid') {
    fail('GPS_ACCURACY_TOO_LOW');
  }

  return {
    policy: 'POLICY_V1',
    policyVersion: 1,
    result: errorCode ? 'INVALID' : 'VALID',
    checkedAt: input.now.toISOString(),
    checks,
    ...(errorCode ? { errorCode } : {})
  };
}
