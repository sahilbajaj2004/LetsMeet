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

// Per-peer outbound camera-video cap. ~500 kbps × 3 peers ≈ 1.5 Mbps up at 4.
export const MAX_VIDEO_BITRATE = 500_000;

// Screen share is the focus when active and carries text/code, so it gets a
// higher cap than the camera. Only one person shares at a time (one extra
// uplink), so this doesn't stack with the camera caps across the mesh.
export const SCREEN_CAPTURE_CONSTRAINTS = {
  video: {
    frameRate: { ideal: 10, max: 15 }, // slides/code don't need motion fps
  },
  audio: false,
};

export const SCREEN_MAX_BITRATE = 1_500_000;
