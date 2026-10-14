export function parseBearerToken(authorization: string | undefined): string | undefined {
  return /^Bearer ([A-Za-z0-9_-]+)$/i.exec(authorization ?? '')?.[1];
}
