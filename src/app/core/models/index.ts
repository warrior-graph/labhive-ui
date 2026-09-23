// ─── Enums ───────────────────────────────────────────────────────────────────

export enum LabRole {
  LAB_COORDINATOR = 'lab_coordinator',
  ENGINEERING_MANAGER = 'engineering_manager',
  PROJECT_MANAGER = 'project_manager',
  CHIEF_SCIENTIST = 'chief_scientist',
  TECH_LEAD = 'tech_lead',
  ENGINEER = 'engineer',
  RESEARCHER = 'researcher',
  RESEARCH_FELLOW = 'research_fellow',
  STAFF = 'staff',
}

export enum CompensationType {
  PROJECT_SALARY = 'project_salary',
  RESEARCH_GRANT = 'research_grant',
  VOLUNTEER = 'volunteer',
}

export enum ProjectStatus {
  PLANNED = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}


export enum ItemCondition {
  NEW = 'new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  BROKEN = 'broken',
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export const MANAGER_ROLES: LabRole[] = [
  LabRole.LAB_COORDINATOR,
  LabRole.ENGINEERING_MANAGER,
  LabRole.PROJECT_MANAGER,
  LabRole.CHIEF_SCIENTIST,
];

export const TECH_LEAD_AND_ABOVE: LabRole[] = [...MANAGER_ROLES, LabRole.TECH_LEAD];

export const RESEARCHER_AND_ABOVE: LabRole[] = [
  ...TECH_LEAD_AND_ABOVE,
  LabRole.ENGINEER,
  LabRole.RESEARCHER,
  LabRole.RESEARCH_FELLOW,
];

export const LAB_ROLE_LABELS: Record<LabRole, string> = {
  [LabRole.LAB_COORDINATOR]: 'Coordenador(a) do Laboratório',
  [LabRole.ENGINEERING_MANAGER]: 'Gerente de Engenharia',
  [LabRole.PROJECT_MANAGER]: 'Gerente de Projetos',
  [LabRole.CHIEF_SCIENTIST]: 'Cientista Chefe',
  [LabRole.TECH_LEAD]: 'Líder Técnico',
  [LabRole.ENGINEER]: 'Engenheiro(a)',
  [LabRole.RESEARCHER]: 'Pesquisador(a)',
  [LabRole.RESEARCH_FELLOW]: 'Pesquisador(a) Júnior',
  [LabRole.STAFF]: 'Equipe de Apoio',
};

export const ROLE_LEVEL: Record<LabRole, number> = {
  [LabRole.LAB_COORDINATOR]: 0,
  [LabRole.ENGINEERING_MANAGER]: 1,
  [LabRole.PROJECT_MANAGER]: 1,
  [LabRole.CHIEF_SCIENTIST]: 1,
  [LabRole.TECH_LEAD]: 2,
  [LabRole.ENGINEER]: 3,
  [LabRole.RESEARCHER]: 3,
  [LabRole.RESEARCH_FELLOW]: 3,
  [LabRole.STAFF]: 4,
};


export const ITEM_CONDITION_LABELS: Record<ItemCondition, string> = {
  [ItemCondition.NEW]: 'Novo',
  [ItemCondition.GOOD]: 'Bom',
  [ItemCondition.FAIR]: 'Regular',
  [ItemCondition.POOR]: 'Ruim',
  [ItemCondition.BROKEN]: 'Quebrado',
};

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface RoleDefinition {
  id: number;
  key: string;
  name: string;
  level: number;
  is_system: boolean;
}

export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  cpf?: string | null;
  lattes_url?: string | null;
  orcid?: string | null;
  github_url?: string | null;
  is_super_admin: boolean;
  is_professor: boolean;
  is_approved: boolean;
  is_active: boolean;
  email_notifications?: boolean;
  desired_lab_id?: number | null;
  created_at: string;
  lab_memberships?: LabMembership[];
}

export interface Laboratory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface LabMembership {
  member_id: number;
  lab_id: number;
  roles: LabRole[];
  specialization?: string | null;
  joined_at: string;
  left_at?: string | null;
  compensation_type: CompensationType | null;
  compensation_value: number | null;
  reports_to_id?: number | null;
  resolved_reports_to_id?: number | null;
  member?: Member;
  laboratory?: Laboratory;
}

/** Histórico de um membro em um laboratório (GET /members/{id}/history). */
export interface MembershipHistory {
  lab_id: number;
  lab_name: string;
  roles: string[];
  joined_at: string;
  left_at: string | null;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  lab_id: number;
  research_id: number | null;
  tech_lead_id?: number | null;
  created_at: string;
  tech_lead?: Member;
  members?: Member[];
  laboratory?: Laboratory;
}

export interface Research {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  lab_id: number;
  manager_id?: number | null;
  created_at: string;
  manager?: Member;
  members?: Member[];
  projects?: Project[];
  laboratory?: Laboratory;
}


export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  description: string | null;
  serial_number: string | null;
  quantity: number;
  condition: ItemCondition;
  lab_id: number;
  assigned_to_id: number | null;
  created_at: string;
  assigned_to?: Member | null;
}

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export interface AuthResponse {
  member?: Member;
  access_token?: string;
  refresh_token?: string;
  mfa_required?: boolean;
  mfa_token?: string;
  mfa_enrollment_required?: boolean;
  enrollment_token?: string;
}

export type LabCapability =
  | 'lab.view' | 'members.view' | 'members.manage' | 'members.approve'
  | 'attendance.view' | 'attendance.manage'
  | 'projects.view' | 'projects.manage'
  | 'research.view' | 'research.manage'
  | 'activities.view' | 'activities.manage' | 'activities.review'
  | 'inventory.view' | 'inventory.manage'
  | 'announcements.view' | 'announcements.manage'
  | 'spaces.view' | 'spaces.reserve' | 'spaces.manage'
  | 'reservations.review'
  | 'analytics.view' | 'audit.view'
  | 'documents.view' | 'documents.manage';

export type AttendanceGranularity = 'week' | 'month';

export interface AttendancePoint {
  starts_on: string;
  ends_on: string;
  actual_minutes: number;
  expected_minutes: number | null;
  expected_to_date_minutes: number | null;
  achievement_percent: number | null;
  is_complete: boolean;
  below_expected?: boolean;
}

export interface AttendanceMember {
  member_id: number;
  name: string;
  email: string;
  roles: LabRole[];
  weekly_target_minutes: number | null;
  current: AttendancePoint;
  series: AttendancePoint[];
}

export interface AttendanceDashboardData {
  granularity: AttendanceGranularity;
  generated_at: string;
  summary: {
    active_members: number;
    configured_members: number;
    below_expected_members: number;
    average_achievement_percent: number | null;
    average_actual_minutes: number;
  };
  lab_series: AttendancePoint[];
  members: AttendanceMember[];
}

export interface WorkspaceMembership extends LabMembership {
  capabilities: LabCapability[];
  laboratory: Laboratory;
}

export interface AppContext {
  member: Member;
  memberships: WorkspaceMembership[];
  suggested_lab_id: number | null;
  global_capabilities: string[];
}

// ─── Collaborative documents ─────────────────────────────────────────────────

export type DocumentRole = 'owner' | 'editor' | 'viewer';

export interface LabDocument {
  id: number;
  lab_id: number;
  project_id: number | null;
  name: string;
  owner_id: number;
  owner?: { id: number; first_name: string; last_name: string };
  main_file_id: number | null;
  my_role: DocumentRole;
  member_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentMemberEntry {
  member_id: number;
  role: DocumentRole;
  added_at: string;
  member: { id: number; first_name: string; last_name: string; email: string };
}

export interface DocumentFileNode {
  id: number;
  parent_id: number | null;
  name: string;
  kind: 'folder' | 'file';
  is_binary: boolean;
  size_bytes: number;
  updated_at: string;
  children?: DocumentFileNode[];
}

export interface CompileError {
  file: string;
  line: number;
  message: string;
}

export interface CompileJob {
  id: number;
  status: 'queued' | 'running' | 'success' | 'error' | 'timeout';
  log: string;
  errors_json: CompileError[] | null;
  has_pdf: boolean;
  queued_at: string;
  finished_at: string | null;
}

export interface PeerPresence {
  memberId: number;
  name: string;
  color: string;
  fileId: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ─── Spaces and reservations ────────────────────────────────────────────────

export type SpaceType = 'room' | 'desk' | 'workstation' | 'bench' | 'shared_area';
export type SessionMode = 'normal' | 'quiet' | 'meeting' | 'presentation' | 'recording' | 'exam';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'rejected' | 'completed';

export interface LabLocation {
  id: number;
  name: string;
  address: string | null;
  timezone: string;
}

export interface Floor {
  id: number;
  location_id: number;
  name: string;
  level: number | null;
  layout_width: number;
  layout_height: number;
  layout_version: number;
  layout_image_url?: string | null;
}

export interface Space {
  id: number;
  floor_id: number;
  parent_space_id: number | null;
  name: string;
  type: SpaceType;
  capacity: number;
  is_active: boolean;
  is_locked: boolean;
  requires_approval: boolean;
  layout: { x: number; y: number; width: number; height: number; rotation: number };
  amenities: string[];
  quiet_neighbor_ids: number[];
  available: boolean | null;
  preallocation: {
    reservation_id: number;
    member_id: number;
    member_name: string;
    starts_at: string;
    ends_at: string;
  } | null;
}

export interface FloorSpacesResponse {
  floor: Floor;
  spaces: Space[];
}

export interface Reservation {
  id: number;
  space_id: number;
  organizer_id?: number;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  purpose?: string | null;
  session_mode: SessionMode;
  checked_in_at: string | null;
  checked_out_at: string | null;
  is_assignment: boolean;
  organizer_name?: string | null;
  check_in_opens_at: string;
  check_in_closes_at: string;
  attendance_status: 'scheduled' | 'present' | 'completed' | 'no_show';
  warnings?: Array<{
    code: 'space_preallocated';
    message: string;
    assigned_member_id: number;
    assigned_member_name: string;
  }>;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  cpf?: string;
  password: string;
  is_professor?: boolean;
  desired_lab_id?: number;
  invite_token?: string;
}

// ─── Invites DTOs (POST /labs/{labId}/invites, GET /invites/{token}) ─────────

export interface InviteResponse {
  token: string;
  expires_at: string;
  url: string;
}

export interface InviteInfo {
  lab_id: number;
  lab_name: string;
  expires_at: string;
}

// ─── Dashboard DTOs (GET /dashboard/summary) ─────────────────────────────────

export type DashboardDeadlineType = 'activity' | 'project';

export interface DashboardCounts {
  active_members: number;
  pending_members: number;
  activities_in_progress: number;
  activities_under_review: number;
  activities_completed: number;
  projects_active: number;
  inventory_items: number;
}

export interface DashboardPendingMember {
  member_id: number;
  first_name: string;
  last_name: string;
  email: string;
  desired_lab_id: number;
  lab_name: string;
  created_at: string;
}

export interface DashboardDeadline {
  type: DashboardDeadlineType;
  id: number;
  title: string;
  lab_id: number;
  lab_name: string;
  status: string;
  due_on: string;
  days_left: number | null;
  overdue: boolean;
}

export interface DashboardRecentActivity {
  id: number;
  title: string;
  status: string;
  lab_id: number;
  lab_name: string;
  created_at: string;
}

export interface DashboardMyActivity {
  id: number;
  title: string;
  status: string;
  lab_id: number;
  lab_name: string;
  deadline: string | null;
  days_left: number | null;
}

export interface DashboardMyProject {
  id: number;
  name: string;
  status: string;
  lab_id: number;
  lab_name: string;
  end_date: string | null;
}

export interface DashboardSummary {
  is_manager: boolean;
  counts: DashboardCounts;
  pending_members: DashboardPendingMember[];
  upcoming_deadlines: DashboardDeadline[];
  recent_activities: DashboardRecentActivity[];
  my_activities: DashboardMyActivity[];
  my_projects: DashboardMyProject[];
  my_deadlines: DashboardDeadline[];
}

export interface DashboardActivityItem {
  id: number;
  title: string;
  status: string;
  activity_type: string | null;
  deadline: string | null;
  lab_id: number;
  lab_name: string | null;
  created_at: string;
}

export interface DashboardProjectItem {
  id: number;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  lab_id: number;
  lab_name: string | null;
}

export interface DashboardInventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  condition: string;
  lab_id: number;
  lab_name: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
}

// ─── Calendar DTOs (GET /calendar) ────────────────────────────────────────────

export type CalendarEventType = 'activity' | 'project' | 'event';

export interface CalendarEvent {
  type: CalendarEventType;
  id: number;
  title: string;
  lab_id: number;
  lab_name: string | null;
  status: string;
  date: string;
}

// ─── Announcements & Notifications DTOs (GET /announcements, /notifications) ─

export interface Announcement {
  id: number;
  title: string;
  body: string | null;
  lab_id: number;
  lab_name: string | null;
  audience: string[];
  kind: 'notice' | 'event';
  starts_at: string | null;
  ends_at: string | null;
  session_mode: SessionMode | null;
  is_pinned: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  author_id: number | null;
  author_name: string | null;
}

export type AppNotificationType =
  | 'member_pending'
  | 'member_approved'
  | 'announcement'
  | 'activity_deadline'
  | 'document_shared';

export interface AppNotification {
  id: number;
  type: AppNotificationType;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── Activity DTOs (GET /labs/{labId}/activities/{activityId}) ───────────────

export interface ActivityPerson {
  id: number;
  first_name: string;
  last_name: string;
}

export interface ActivityDetail {
  id: number;
  title: string;
  activity_type: string | null;
  description: string | null;
  venue: string | null;
  reference_link: string | null;
  status: string;
  deadline: string | null;
  completed_at: string | null;
  is_active: boolean;
  lab_id: number;
  created_at: string;
  participants: ActivityPerson[];
  in_charge: ActivityPerson[];
}

// ─── Activity write DTOs (POST/PUT /labs/{labId}/activities) ─────────────────

export type ActivityStatus =
  | 'planned'
  | 'in_progress'
  | 'on_hold'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export const ACTIVITY_STATUSES: string[] = [
  'planned',
  'in_progress',
  'on_hold',
  'under_review',
  'accepted',
  'rejected',
  'completed',
  'cancelled',
];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: 'Planejada',
  in_progress: 'Em andamento',
  on_hold: 'Em espera',
  under_review: 'Em revisão',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

/** Papéis que podem criar/editar atividades. */
export const ACTIVITY_EDIT_ROLES: LabRole[] = [
  LabRole.LAB_COORDINATOR,
  LabRole.CHIEF_SCIENTIST,
  LabRole.RESEARCHER,
  LabRole.RESEARCH_FELLOW,
];

/** Papéis que podem excluir atividades. */
export const ACTIVITY_DELETE_ROLES: LabRole[] = [LabRole.LAB_COORDINATOR, LabRole.CHIEF_SCIENTIST];

export interface CreateActivityPayload {
  title: string;
  activity_type?: string | null;
  description?: string | null;
  venue?: string | null;
  reference_link?: string | null;
  status?: string;
  deadline?: string | null;
  in_charge?: number[];
  participants?: number[];
}

export type UpdateActivityPayload = Partial<CreateActivityPayload>;

// ─── Personal usage history (GET /members/{id}/usage) ─────────────────────────

export type UsageAttendanceStatus = 'completed' | 'present' | 'no_show' | 'scheduled';

export interface UsageReservation {
  id: number;
  space_id: number;
  space_name: string | null;
  lab_id: number | null;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  session_mode: SessionMode;
  purpose: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  attendance_status: UsageAttendanceStatus;
}

export interface MemberUsage {
  member_id: number;
  range: { since: string | null; until: string | null };
  totals: {
    reservations: number;
    completed: number;
    attended: number;
    no_shows: number;
    attended_minutes: number;
    attended_hours: number;
    attendance_rate: number;
  };
  reservations: UsageReservation[];
  activities: {
    participating: ActivityDetail[];
    in_charge: ActivityDetail[];
  };
  projects: { id: number; name: string; lab_id: number; status: ProjectStatus }[];
}

// ─── Occupancy analytics (GET /labs/{id}/analytics/occupancy) ─────────────────

export interface OccupancySpace {
  space_id: number;
  name: string;
  type: SpaceType;
  capacity: number;
  effective_slots: number;
  floor_id: number;
  booked_minutes: number;
  booked_hours: number;
  capacity_minutes: number;
  preallocated_minutes: number;
  occupancy_rate: number;
  sessions: number;
  attended: number;
  no_shows: number;
  attended_minutes: number;
}

export interface OccupancyReport {
  lab_id: number;
  lab_name?: string;
  range: { since: string; until: string; days: number };
  totals: {
    spaces: number;
    sessions: number;
    attended: number;
    no_shows: number;
    booked_minutes: number;
    booked_hours: number;
    capacity_minutes: number;
    occupancy_rate: number;
  };
  spaces: OccupancySpace[];
  days: { date: string; booked_minutes: number; booked_hours: number }[];
}

// ─── Bulk member import (POST /labs/{id}/members/import) ──────────────────────

export interface ImportPreviewRow {
  line: number;
  email: string;
  name: string;
  roles: string[];
  existing_member: boolean;
  reactivates: boolean;
}

export interface ImportRowError {
  line: number;
  email: string;
  errors: string[];
}

export interface ImportReport {
  dry_run: boolean;
  lab_id: number;
  total_rows: number;
  valid: number;
  invalid: number;
  created_members: number;
  added_to_lab: number;
  reactivated: number;
  errors: ImportRowError[];
  preview: ImportPreviewRow[];
  temporary_credentials: { email: string; name: string; temporary_password: string }[];
}

// ─── Audit trail (GET /labs/{id}/audit, GET /audit) ───────────────────────────

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_name: string | null;
  lab_id: number | null;
  action: string;
  description: string;
  target_type: string | null;
  target_id: number | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface AuditPage {
  total: number;
  entries: AuditEntry[];
  actions: string[];
  scope?: number[];
}

// ─── Space waitlist (/labs/{id}/waitlist) ─────────────────────────────────────

export type WaitlistStatus = 'waiting' | 'offered' | 'fulfilled' | 'expired' | 'cancelled';

export interface WaitlistEntry {
  id: number;
  space_id: number;
  space_name: string | null;
  member_id: number;
  member_name: string | null;
  desired_starts_at: string;
  desired_ends_at: string;
  session_mode: SessionMode;
  purpose: string | null;
  status: WaitlistStatus;
  created_at: string | null;
  offered_at: string | null;
  offer_expires_at: string | null;
  position: number | null;
}

// ─── Personal calendar feed (/calendar/feed) ──────────────────────────────────

export interface CalendarFeedInfo {
  token: string;
  feed_url: string;
  webcal_url: string;
}
