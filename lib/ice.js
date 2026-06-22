// ICE server config for RTCPeerConnection. STUN lets two browsers discover each
// other through home NATs; TURN relays media when that fails on strict/corporate
// networks. Defaults to Google's public STUN so the call works with zero config;
// real TURN credentials are wired here but optional until Phase 9.
//
// Client-safe: only reads NEXT_PUBLIC_* vars (inlined into the browser bundle).
export function getIceServers() {
  const stunUrls = (process.env.NEXT_PUBLIC_STUN_URLS || "stun:stun.l.google.com:19302")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  const servers = [{ urls: stunUrls }];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USER,
      credential: process.env.NEXT_PUBLIC_TURN_CRED,
    });
  }

  return servers;
}

export default getIceServers;
