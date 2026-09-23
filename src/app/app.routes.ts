import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { capabilityGuard } from './core/auth/capability.guard';
import { labContextGuard } from './core/auth/lab-context.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () => import('./features/calendar/calendar/calendar').then((m) => m.Calendar),
  },
  {
    path: 'announcements',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/announcements/announcement-list/announcement-list').then(
        (m) => m.AnnouncementList,
      ),
  },
  { path: 'announcements/:announcementId', redirectTo: 'announcements' },
  {
    path: 'activities',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/activities/activity-list/activity-list').then((m) => m.ActivityList),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-list/project-list').then((m) => m.ProjectList),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/inventory/inventory-list/inventory-list').then((m) => m.InventoryList),
  },
  {
    path: 'labs',
    canActivate: [authGuard],
    loadComponent: () => import('./features/laboratories/lab-list/lab-list').then((m) => m.LabList),
  },
  {
    path: 'labs/:labId',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'lab.view' },
    loadComponent: () =>
      import('./features/laboratories/lab-detail/lab-detail').then((m) => m.LabDetail),
  },
  {
    path: 'labs/:labId/attendance',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'attendance.view' },
    loadComponent: () =>
      import('./features/attendance/attendance-dashboard').then((m) => m.AttendanceDashboard),
  },
  {
    path: 'labs/:labId/org-chart',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'members.view' },
    loadComponent: () =>
      import('./features/laboratories/org-chart/org-chart').then((m) => m.OrgChart),
  },
  {
    path: 'labs/:labId/occupancy',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'analytics.view' },
    loadComponent: () =>
      import('./features/analytics/occupancy/occupancy').then((m) => m.Occupancy),
  },
  {
    path: 'labs/:labId/audit',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'audit.view' },
    loadComponent: () =>
      import('./features/audit/audit-log/audit-log').then((m) => m.AuditLog),
  },
  {
    path: 'labs/:labId/spaces',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'spaces.view' },
    loadComponent: () => import('./features/spaces/floor-plan/floor-plan').then((m) => m.FloorPlan),
  },
  {
    path: 'labs/:labId/projects/:projectId',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'projects.view' },
    loadComponent: () =>
      import('./features/projects/project-detail/project-detail').then((m) => m.ProjectDetail),
  },
  {
    path: 'labs/:labId/activities/:activityId',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'activities.view' },
    loadComponent: () =>
      import('./features/activities/activity-detail/activity-detail').then((m) => m.ActivityDetail),
  },
  {
    path: 'labs/:labId/research/:researchId',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'research.view' },
    loadComponent: () =>
      import('./features/research/research-detail/research-detail').then((m) => m.ResearchDetail),
  },
  {
    path: 'labs/:labId/documents',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'documents.view' },
    loadComponent: () =>
      import('./features/documents/document-list/document-list').then((m) => m.DocumentList),
  },
  {
    path: 'labs/:labId/documents/:docId',
    canActivate: [authGuard, labContextGuard, capabilityGuard],
    data: { capability: 'documents.view' },
    loadComponent: () =>
      import('./features/documents/document-editor/document-editor').then((m) => m.DocumentEditor),
  },
  { path: 'labs/:labId/articles', redirectTo: 'labs/:labId/documents', pathMatch: 'full' },
  { path: 'labs/:labId/articles/new', redirectTo: 'labs/:labId/documents', pathMatch: 'full' },
  { path: 'labs/:labId/articles/:articleId', redirectTo: 'labs/:labId/documents/:articleId' },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/members/member-profile/member-profile').then((m) => m.MemberProfile),
  },
  {
    path: 'admin/pending',
    canActivate: [authGuard, capabilityGuard],
    data: { capability: 'members.approve' },
    loadComponent: () =>
      import('./features/admin/pending-members/pending-members').then((m) => m.PendingMembers),
  },
  {
    path: 'admin/roles',
    canActivate: [authGuard, capabilityGuard],
    data: { globalCapability: 'admin.roles' },
    loadComponent: () => import('./features/admin/roles/roles-admin').then((m) => m.RolesAdmin),
  },
  { path: '**', redirectTo: '/labs' },
];
