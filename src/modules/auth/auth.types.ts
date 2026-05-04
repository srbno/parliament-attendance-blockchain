export type JwtUser = {
  sub: string;
  role: 'ADMIN' | 'DEPUTY' | 'AUDITOR';
  deputyId: string | null;
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}
