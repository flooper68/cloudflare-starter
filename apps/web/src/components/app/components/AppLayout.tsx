import { Outlet } from "@tanstack/react-router";

import { AppHeaderNavSpa } from "./AppHeaderNavSpa";

export function AppLayout() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-10">
      <AppHeaderNavSpa />
      <Outlet />
    </main>
  );
}
