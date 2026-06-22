// Shared media tuning for the 4-way mesh. At full capacity each participant
// uploads 3 video streams and downloads 3, so we cap both capture resolution
// and per-peer send bitrate to keep a typical home uplink from saturating.
// Phase 7 (screen share) reuses these too.

// getUserMedia constraints — capture at a modest size/framerate rather than the
// browser default (often 720p), which is wasteful when it's sent to 3 peers.
export const CAPTURE_CONSTRAINTS = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24 },
  },
  audio: true,
};

// Per-peer outbound video cap. ~500 kbps × 3 peers ≈ 1.5 Mbps up at 4 people.
export const MAX_VIDEO_BITRATE = 500_000;
