export type JwtUser = {
  sub: string;
  role: 'ADMIN' | 'DEPUTY' | 'AUDITOR';
  deputyId: string | null;
};
