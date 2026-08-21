import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extracts a human-readable message from LabHive API error responses.
 *
 * The API can return:
 *   { message: "..." }         — abort() errors
 *   { error: "..." }           — single-field errors
 *   { errors: { field: [...] } } — validation errors (Marshmallow 422)
 *   { msg: "..." }             — Flask-JWT-Extended errors
 */
export function extractApiError(
  err: HttpErrorResponse,
  fallback = 'An unexpected error occurred.',
): string {
  const body = err.error;
  if (!body) return fallback;
  if (typeof body === 'string') return body;
  if (body.message) return body.message;
  if (body.error) return body.error;
  if (body.msg) return body.msg;
  if (body.errors) {
    const msgs = Object.values(body.errors as Record<string, string[]>)
      .flat()
      .join(' ');
    return msgs || fallback;
  }
  return fallback;
}
