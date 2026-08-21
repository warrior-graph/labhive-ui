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

export enum ArticleStatus {
  IN_PROGRESS = 'in_progress',
  UNDER_REVIEW = 'under_review',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  PUBLISHED = 'published',
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

export const TECH_LEAD_AND_ABOVE: LabRole[] = [
  ...MANAGER_ROLES,
  LabRole.TECH_LEAD,
];

export const RESEARCHER_AND_ABOVE: LabRole[] = [
  ...TECH_LEAD_AND_ABOVE,
  LabRole.ENGINEER,
  LabRole.RESEARCHER,
  LabRole.RESEARCH_FELLOW,
];

export const LAB_ROLE_LABELS: Record<LabRole, string> = {
  [LabRole.LAB_COORDINATOR]: 'Lab Coordinator',
  [LabRole.ENGINEERING_MANAGER]: 'Engineering Manager',
  [LabRole.PROJECT_MANAGER]: 'Project Manager',
  [LabRole.CHIEF_SCIENTIST]: 'Chief Scientist',
  [LabRole.TECH_LEAD]: 'Tech Lead',
  [LabRole.ENGINEER]: 'Engineer',
  [LabRole.RESEARCHER]: 'Researcher',
  [LabRole.RESEARCH_FELLOW]: 'Research Fellow',
  [LabRole.STAFF]: 'Staff',
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

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  [ArticleStatus.IN_PROGRESS]: 'In Progress',
  [ArticleStatus.UNDER_REVIEW]: 'Under Review',
  [ArticleStatus.SUBMITTED]: 'Submitted',
  [ArticleStatus.ACCEPTED]: 'Accepted',
  [ArticleStatus.REJECTED]: 'Rejected',
  [ArticleStatus.WITHDRAWN]: 'Withdrawn',
  [ArticleStatus.PUBLISHED]: 'Published',
};

export const ITEM_CONDITION_LABELS: Record<ItemCondition, string> = {
  [ItemCondition.NEW]: 'New',
  [ItemCondition.GOOD]: 'Good',
  [ItemCondition.FAIR]: 'Fair',
  [ItemCondition.POOR]: 'Poor',
  [ItemCondition.BROKEN]: 'Broken',
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
  is_super_admin: boolean;
  is_professor: boolean;
  is_approved: boolean;
  is_active: boolean;
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
  compensation_type: CompensationType | null;
  compensation_value: number | null;
  reports_to_id?: number | null;
  member?: Member;
  laboratory?: Laboratory;
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

export interface Article {
  id: number;
  title: string;
  abstract: string | null;
  conference: string | null;
  doi: string | null;
  status: ArticleStatus;
  submission_deadline: string | null;
  published_at: string | null;
  authors: string[];
  in_charge: string[];
  is_active: boolean;
  lab_id: number;
  created_at: string;
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
  member: Member;
  access_token?: string;
  refresh_token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  cpf?: string;
  password: string;
  is_professor?: boolean;
  desired_lab_id?: number;
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

export type CalendarEventType = 'activity' | 'project';

export interface CalendarEvent {
  type: CalendarEventType;
  id: number;
  title: string;
  lab_id: number;
  lab_name: string | null;
  status: string;
  date: string;
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

