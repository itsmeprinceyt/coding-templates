import { FIFTEEN_MINUTES } from "../TTL.util";

const SESSION_KEY_PREFIX = "craft_nagma:session";
const EXPIRY_KEY_PREFIX = "crafti_nagma:sessionexp";
const HEARTBEAT_SESSION_TTL = FIFTEEN_MINUTES * 2;

export interface HeartbeatSessionKeys {
  sessionKey: string;
  expiryKey: string;
  ttl: number;
}

export function getHeartbeatSessionKeys(): HeartbeatSessionKeys {
  return {
    sessionKey: `${SESSION_KEY_PREFIX}`,
    expiryKey: `${EXPIRY_KEY_PREFIX}`,
    ttl: HEARTBEAT_SESSION_TTL,
  };
}
