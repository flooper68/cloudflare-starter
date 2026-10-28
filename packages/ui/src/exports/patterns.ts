// Patterns: app-level components (shell, issue list, board, filters, comments, settings).
// Re-exported from ../index.ts. StatusIcon, PriorityIcon, IssueStatus and IssuePriority come from
// the data group (components/issue-icons); the patterns use identical private copies for now.

export {
  AcceptInvitationCard,
  type AcceptInvitationCardProps,
  type AcceptInvitationState,
} from "../components/patterns/accept-invitation-card";
export {
  AppBreadcrumb,
  AppShell,
  type AppShellProps,
  AppTopBar,
  type AppTopBarProps,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  type SidebarItemProps,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarMenuSeparator,
  SidebarSection,
  type SidebarSectionProps,
  SidebarTeam,
  type SidebarTeamProps,
  SidebarTrigger,
  SidebarWorkspaceSwitcher,
  type SidebarWorkspaceSwitcherProps,
  TeamIcon,
  useAppShell,
  ViewSwitch,
  type ViewSwitchOption,
  type ViewSwitchProps,
} from "../components/patterns/app-shell";
export {
  CommentComposer,
  type CommentComposerProps,
  type CommentData,
  CommentItem,
  type CommentItemProps,
  type CommentReaction,
  CommentThread,
  type CommentThreadProps,
} from "../components/patterns/comment-thread";
export {
  type Filter,
  FilterBar,
  type FilterBarProps,
  type FilterOperator,
  type FilterOption,
  type FilterProperty,
  matchesFilters,
} from "../components/patterns/filter-bar";
export {
  InviteDialog,
  type InviteDialogProps,
} from "../components/patterns/invite-dialog";
export {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type Issue,
  type IssueLabel,
  type IssueLabelColor,
  type IssuePerson,
  type IssuePriorityMeta,
  type IssueStatusMeta,
  priorityLabel,
  statusLabel,
} from "../components/patterns/issue-glyphs";
export {
  ISSUE_STATUS_ORDER,
  IssueGroupHeader,
  type IssueGroupHeaderProps,
  IssueList,
  type IssueListProps,
  type IssuePatch,
  IssueRow,
  type IssueRowProps,
} from "../components/patterns/issue-list";
export {
  AssigneePicker,
  type AssigneePickerProps,
  GlyphButton,
  PriorityPicker,
  type PriorityPickerProps,
  StatusPicker,
  type StatusPickerProps,
} from "../components/patterns/issue-pickers";
export {
  KanbanBoard,
  type KanbanBoardProps,
  KanbanCard,
  type KanbanCardProps,
  type KanbanColumn,
  type KanbanMove,
  moveKanbanItem,
} from "../components/patterns/kanban-board";
export {
  type InvitationRow,
  type MemberRow,
  MembersTable,
  type MembersTableProps,
  MembersTableSkeleton,
  type RoleOption,
} from "../components/patterns/members-table";
export {
  NotificationBell,
  type NotificationBellProps,
} from "../components/patterns/notification-bell";
export {
  NotificationInbox,
  type NotificationInboxProps,
  type NotificationView,
} from "../components/patterns/notification-inbox";
export {
  type NotificationItem,
  NotificationList,
  type NotificationListProps,
  NotificationListSkeleton,
  relativeTime,
} from "../components/patterns/notification-list";
export {
  type EmailCadenceOption,
  type NotificationChannelName,
  type NotificationPreferenceRow,
  NotificationPreferences,
  type NotificationPreferencesData,
  type NotificationPreferencesProps,
} from "../components/patterns/notification-preferences";
export {
  SettingsHeader,
  SettingsLayout,
  type SettingsLayoutProps,
  SettingsNav,
  SettingsNavBack,
  SettingsNavGroup,
  SettingsNavItem,
  type SettingsNavItemProps,
  type SettingsNavProps,
  SettingsRow,
  type SettingsRowProps,
  SettingsSection,
  type SettingsSectionProps,
} from "../components/patterns/settings-page";
export {
  UnsubscribeCard,
  type UnsubscribeCardProps,
  type UnsubscribeState,
} from "../components/patterns/unsubscribe-card";
export {
  type WorkspaceOption,
  WorkspaceSwitcher,
  type WorkspaceSwitcherProps,
} from "../components/patterns/workspace-switcher";
