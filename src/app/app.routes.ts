import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then(m => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register').then(m => m.Register),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard/dashboard').then(m => m.Dashboard),
  },
  {
    path: 'labs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/laboratories/lab-list/lab-list').then(m => m.LabList),
  },
  {
    path: 'labs/:labId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/laboratories/lab-detail/lab-detail').then(m => m.LabDetail),
  },
  {
    path: 'labs/:labId/org-chart',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/laboratories/org-chart/org-chart').then(m => m.OrgChart),
  },
  {
    path: 'labs/:labId/projects/:projectId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-detail/project-detail').then(m => m.ProjectDetail),
  },
  {
    path: 'labs/:labId/research/:researchId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/research/research-detail/research-detail').then(m => m.ResearchDetail),
  },
  {
    path: 'labs/:labId/articles',
    loadComponent: () =>
      import('./features/articles/articles-public/articles-public').then(m => m.ArticlesPublic),
  },
  {
    path: 'labs/:labId/articles/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/article-form/article-form').then(m => m.ArticleForm),
  },
  {
    path: 'labs/:labId/articles/:articleId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/article-detail/article-detail').then(m => m.ArticleDetail),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/members/member-profile/member-profile').then(m => m.MemberProfile),
  },
  {
    path: 'admin/pending',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/pending-members/pending-members').then(m => m.PendingMembers),
  },
  {
    path: 'admin/roles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/roles/roles-admin').then(m => m.RolesAdmin),
  },
  { path: '**', redirectTo: '/labs' },
];
