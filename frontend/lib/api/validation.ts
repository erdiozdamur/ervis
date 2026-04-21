export function getSearchParamsObject(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export async function getJsonBody(request: Request) {
  return request.json().catch(() => null);
}
