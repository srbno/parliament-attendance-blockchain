export type ValidationStatus = 'valid' | 'invalid';
export type ValidationResultStatus = 'VALID' | 'INVALID';

export type CheckResult = {
  status: ValidationStatus;
  reason?: string;
  method?: string;
  distanceMeters?: number;
  allowedRadiusMeters?: number;
  accuracyMeters?: number;
  maxAccuracyMeters?: number;
};

export type PolicyV1Result = {
  policy: 'POLICY_V1';
  policyVersion: 1;
  result: ValidationResultStatus;
  checkedAt: string;
  checks: {
    authenticatedUser: CheckResult;
    userIsDeputy: CheckResult;
    sessionExists: CheckResult;
    sessionOpen: CheckResult;
    timestampWithinWindow: CheckResult;
    noDuplicateAttendance: CheckResult;
    authorizedIp: CheckResult;
    gpsWithinRadius: CheckResult;
    gpsAccuracyAcceptable: CheckResult;
    replayProtection: CheckResult;
  };
  errorCode?: string;
};

export type PolicyV1Input = {
  user: { id: string; isActive: boolean; role: 'ADMIN' | 'DEPUTY' | 'AUDITOR'; deputyId: string | null } | null;
  deputy: { id: string; active: boolean } | null;
  session: {
    id: string;
    status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
    checkinStart: Date;
    checkinEnd: Date;
    allowMultipleCheckins: boolean;
  } | null;
  location: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    allowedIpRanges: string[];
    active: boolean;
  } | null;
  gps: { latitude: number; longitude: number; accuracyMeters: number };
  clientIp: string;
  clientRequestId: string;
  now: Date;
  maxGpsAccuracyMeters: number;
  duplicateAttendanceExists: boolean;
  clientRequestIdAlreadyUsed: boolean;
};
