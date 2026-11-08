import { hostedConfiguration } from '../v2/hosted-config';

/** Explicit opt-in only. A flag cannot bypass V2's provider and durable quota gates. */
export function trustOrTrapEnabled() {
  return process.env.V3_TRUST_OR_TRAP_ENABLED === 'true';
}

export function liveTrustOrTrapMode(): 'live' | null {
  return trustOrTrapEnabled() && hostedConfiguration() ? 'live' : null;
}
