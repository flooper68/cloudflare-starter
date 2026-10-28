/**
 * The platform admin a use case acts for, resolved by `adminProcedure` (role admin, portal
 * on). Admin use cases take it as their second parameter; their audit events name it with
 * actor kind `admin`.
 */
export interface AdminActor {
  readonly userId: string;
}
