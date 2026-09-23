import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthService } from './auth.service';

export const labContextGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const check = () => {
    const labId = Number(route.paramMap.get('labId'));
    if (!Number.isInteger(labId) || labId <= 0) {
      return router.createUrlTree(['/dashboard'], { queryParams: { invalidLab: '1' } });
    }
    if (!auth.memberships().some(membership => membership.lab_id === labId)) {
      return router.createUrlTree(['/dashboard'], { queryParams: { denied: '1' } });
    }
    auth.selectLab(labId);
    return true;
  };
  if (auth.isInitialized()) return check();
  return toObservable(auth.isInitialized).pipe(filter(Boolean), take(1), map(check));
};
