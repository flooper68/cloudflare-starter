import { createContext, type ReactNode, useContext, useState } from "react";

export interface AuthUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
}

/** The page's bootstrap JSON (`__APP_AUTH__` in pages/app/[...path].astro). */
export interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly methods: { readonly emailPassword: boolean };
  /** WORKSPACE_MODE: which workspace UI the app shows (switcher, members). */
  readonly workspace: { readonly mode: "personal" | "single" | "multi" };
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readAuthScript(): AuthContextValue {
  const element = document.getElementById("__APP_AUTH__");
  if (!element?.textContent) {
    throw new Error("Missing __APP_AUTH__ script tag");
  }

  return JSON.parse(element.textContent) as AuthContextValue;
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [data] = useState(readAuthScript);

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
