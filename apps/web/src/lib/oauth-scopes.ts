/**
 * The OAuth scopes an MCP client may ask for (server/auth.ts `scopes`), in plain words for
 * the consent page. Unknown scopes are shown as they are, so nothing asked is hidden.
 */
const SCOPE_WORDS: Readonly<Record<string, string>> = {
  openid: "Use the app's tools as you, in your workspaces",
  profile: "See your name and profile picture",
  email: "See your email address",
  offline_access: "Stay connected until you revoke it",
};

/** One line per requested scope, in a stable order, duplicates removed. */
export function describeScopes(scope: string): string[] {
  const requested = [...new Set(scope.split(/\s+/).filter(Boolean))];
  const known = Object.keys(SCOPE_WORDS).filter((key) =>
    requested.includes(key)
  );
  const unknown = requested.filter((key) => !(key in SCOPE_WORDS));
  const lines = [
    ...known.map((key) => SCOPE_WORDS[key] as string),
    ...unknown.map((key) => `Scope "${key}"`),
  ];
  return lines.length > 0 ? lines : [SCOPE_WORDS.openid as string];
}

/** Where the consent page tells the user they can take the access back. */
export const REVOKE_HINT =
  "Revoke it any time: sign out the browser session you allow it from in Settings › Security › Active sessions.";
