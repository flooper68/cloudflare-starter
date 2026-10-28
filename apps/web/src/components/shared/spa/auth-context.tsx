import { createContext, type ReactNode, useContext, useState } from "react";

export interface AuthUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
}

export interface AuthContextValue {
  readonly user: AuthUser | null;
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

  return (
    <AuthContext.Provider value={{ user: data.user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
