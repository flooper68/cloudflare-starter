// Patterns: app-level components (shell, issue list, board, filters, comments, settings).
// Re-exported from ../index.ts. StatusIcon, PriorityIcon, IssueStatus and IssuePriority come from
// the data group (components/issue-icons); the patterns use identical private copies for now.

export {
  AcceptInvitationCard,
  type AcceptInvitationCardProps,
  type AcceptInvitationState,
} from "../components/patterns/accept-invitation-card";
export {
  AdminAuditFilterBar,
  type AdminAuditFilterBarProps,
  type AdminAuditFilters,
  type AdminAuditRow,
  AdminAuditTable,
  type AdminAuditTableProps,
} from "../components/patterns/admin-audit-table";
export {
  type AdminAssignPlanInput,
  type AdminBillingCatalog,
  type AdminBillingData,
  type AdminBillingOverride,
  AdminBillingPanel,
  type AdminBillingPanelProps,
  AdminBillingPanelSkeleton,
  type AdminSetOverrideInput,
} from "../components/patterns/admin-billing-panel";
export {
  type AdminFlag,
  AdminFlagCard,
  type AdminFlagCardProps,
} from "../components/patterns/admin-flag-card";
export {
  AdminHealth,
  type AdminHealthCheck,
  type AdminHealthData,
  type AdminHealthProps,
  AdminHealthSkeleton,
  type AdminHealthStatus,
} from "../components/patterns/admin-health";
export {
  type AdminDailyCount,
  AdminOverview,
  type AdminOverviewData,
  type AdminOverviewProps,
  AdminOverviewSkeleton,
} from "../components/patterns/admin-overview";
export {
  AdminReauthDialog,
  type AdminReauthDialogProps,
} from "../components/patterns/admin-reauth-dialog";
export {
  AdminSettings,
  type AdminSettingsData,
  type AdminSettingsProps,
} from "../components/patterns/admin-settings";
export {
  type AdminBanInput,
  type AdminConnectedAgentRow,
  type AdminSessionRow,
  type AdminUserActions,
  AdminUserDetail,
  type AdminUserDetailData,
  type AdminUserDetailProps,
  AdminUserDetailSkeleton,
} from "../components/patterns/admin-user-detail";
export {
  AdminUserFilterBar,
  type AdminUserFilterBarProps,
  type AdminUserFilters,
  type AdminUserRow,
  AdminUsersTable,
  type AdminUsersTableProps,
} from "../components/patterns/admin-users-table";
export {
  AdminWorkspaceDetail,
  type AdminWorkspaceDetailData,
  type AdminWorkspaceDetailProps,
  AdminWorkspaceDetailSkeleton,
  type AdminWorkspaceRow,
  AdminWorkspacesTable,
  type AdminWorkspacesTableProps,
} from "../components/patterns/admin-workspaces";
export {
  AppCommandPalette,
  type AppCommandPaletteProps,
  filterPaletteCommands,
  type PaletteCommand,
  type PaletteCommandGroup,
  type PaletteGroup,
  type PaletteSearchGroup,
} from "../components/patterns/app-command-palette";
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
  BackupCodes,
  type BackupCodesProps,
} from "../components/patterns/backup-codes";
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
  type ConnectedAgentItem,
  ConnectedAgents,
  type ConnectedAgentsProps,
  ConnectedAgentsSkeleton,
} from "../components/patterns/connected-agents";
export {
  type DataExportItem,
  DataExportList,
  type DataExportListProps,
} from "../components/patterns/data-export-list";
export {
  DemoBanner,
  type DemoBannerProps,
} from "../components/patterns/demo-banner";
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
  type ChecklistStep,
  GettingStartedChecklist,
  type GettingStartedChecklistProps,
  GettingStartedChecklistSkeleton,
} from "../components/patterns/getting-started-checklist";
export {
  ImpersonationBanner,
  type ImpersonationBannerProps,
} from "../components/patterns/impersonation-banner";
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
  type NoteDraft,
  NoteEditor,
  type NoteEditorProps,
} from "../components/patterns/note-editor";
export {
  NoteList,
  type NoteListItem,
  type NoteListProps,
  NoteListSkeleton,
} from "../components/patterns/note-list";
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
  OAuthConsentCard,
  type OAuthConsentCardProps,
} from "../components/patterns/oauth-consent-card";
export {
  PasskeyList,
  type PasskeyListProps,
} from "../components/patterns/passkey-list";
export {
  PlaceholderNotice,
  type PlaceholderNoticeProps,
} from "../components/patterns/placeholder-notice";
export {
  PlanCard,
  type PlanCardProps,
  PlanCardSkeleton,
  type PlanLimit,
  type PlanStatus,
} from "../components/patterns/plan-card";
export {
  ProfileMenu,
  type ProfileMenuProps,
} from "../components/patterns/profile-menu";
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
  TaskBoard,
  type TaskBoardProps,
} from "../components/patterns/task-board";
export {
  TotpSetup,
  type TotpSetupProps,
} from "../components/patterns/totp-setup";
export {
  TrashList,
  type TrashListItem,
  type TrashListProps,
  TrashListSkeleton,
} from "../components/patterns/trash-list";
export {
  UnsubscribeCard,
  type UnsubscribeCardProps,
  type UnsubscribeState,
} from "../components/patterns/unsubscribe-card";
export {
  CheckInboxCard,
  type CheckInboxCardProps,
  EmailVerifiedCard,
  type EmailVerifiedCardProps,
  type EmailVerifiedState,
  type ResendResult,
} from "../components/patterns/verify-email-card";
export {
  type WorkspaceOption,
  WorkspaceSwitcher,
  type WorkspaceSwitcherProps,
} from "../components/patterns/workspace-switcher";
