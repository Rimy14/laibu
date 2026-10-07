export const ROLES = ['author', 'publisher', 'buyer', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];

/** Which front door a session belongs to. Admin sessions only exist on the admin host. */
export type Audience = 'web' | 'admin';

/** Identity attached to the request once the access token is verified. */
export interface AuthUser {
  id: string;
  role: Role;
  aud: Audience;
  /** Refresh-token family: identifies the session for logout. */
  sid: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    requestId?: string;
  }
}
