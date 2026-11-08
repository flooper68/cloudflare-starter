import {
  Bell,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  ListTodo,
  Mail,
  NotebookPen,
  ShieldCheck,
  SquareKanban,
  Trash2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import type { NavIcon } from "./navigation";

/** The icon of each navigation entry (navigation.ts names them, so it stays pure). */
export const navIcons: Readonly<Record<NavIcon, ReactNode>> = {
  dashboard: <LayoutDashboard />,
  members: <Users />,
  billing: <CreditCard />,
  trash: <Trash2 />,
  settings: <UserRound />,
  notes: <NotebookPen />,
  tasks: <SquareKanban />,
  notifications: <Bell />,
  admin: <ShieldCheck />,
  demos: <FlaskConical />,
  upload: <Upload />,
  queue: <ListTodo />,
  email: <Mail />,
};
