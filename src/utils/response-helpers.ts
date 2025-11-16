/**
 * Response Helper Utilities
 */

export function successResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function errorResponse(message: string, status = 400, details?: any): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    details
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function authErrorResponse(message = "Authentication required", status = 401): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function forbiddenResponse(message = "Forbidden", status = 403): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function notFoundResponse(message = "Not found", status = 404): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function serverErrorResponse(message = "Internal server error", status = 500): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function validationErrorResponse(message: string, errors?: any[], status = 422): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    errors
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function createdResponse(data: any, status = 201): Response {
  return new Response(JSON.stringify({
    success: true,
    ...data
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function paginatedResponse(data: any, pagination: any, status = 200): Response {
  return new Response(JSON.stringify({
    success: true,
    ...data,
    pagination
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}