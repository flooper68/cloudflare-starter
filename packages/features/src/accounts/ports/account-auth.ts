/** Better Auth operations whose credentials stay on the server. */
export interface AccountAuthGateway {
  revokeSession(token: string): Promise<void>;
}
