import type { Socket } from 'socket.io';

const MAX_USER_AGENT_LEN = 180;

/**
 * Single-line JSON logs for platforms like Railway (easy to grep / parse).
 */
export function logSocketEvent(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...fields,
    }),
  );
}

export function clientIpFromSocket(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const addr = socket.handshake.address;
  return typeof addr === 'string' && addr.length > 0 ? addr : 'unknown';
}

export function shortUserAgent(socket: Socket): string | undefined {
  const ua = socket.handshake.headers['user-agent'];
  if (typeof ua !== 'string') return undefined;
  if (ua.length <= MAX_USER_AGENT_LEN) return ua;
  return `${ua.slice(0, MAX_USER_AGENT_LEN)}…`;
}
