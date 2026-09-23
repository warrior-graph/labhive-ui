import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { LabCapability } from '../models';

export const capabilityGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const check = () => {
    const capability = route.data?.['capability'] as LabCapability | undefined;
    const globalCapability = route.data?.['globalCapability'] as string | undefined;
    const routeLabId = Number(route.paramMap.get('labId'));
    const routeMembership = Number.isInteger(routeLabId)
      ? auth.memberships().find(item => item.lab_id === routeLabId)
      : null;
    const allowed = capability
      ? (routeMembership?.capabilities.includes(capability) ?? auth.hasCapability(capability))
      : globalCapability ? auth.hasGlobalCapability(globalCapability) : true;
    return allowed
      ? true
      : router.createUrlTree(['/dashboard'], { queryParams: { denied: '1' } });
  };
  if (auth.isInitialized()) return check();
  return toObservable(auth.isInitialized).pipe(filter(Boolean), take(1), map(check));
};
