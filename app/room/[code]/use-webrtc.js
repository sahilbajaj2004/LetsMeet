"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIceServers } from "@/lib/ice";
import { MAX_VIDEO_BITRATE, SCREEN_MAX_BITRATE } from "@/lib/media";

// Owns the WebRTC peer mesh for a room. At 2 participants there's a single
// remote peer, but everything here is keyed by socketId so the 4-way mesh works
// without a rewrite.
//
// Initiator rule (set by the signaling server's events, not decided here): the
// peer already in the call sends the offer to a newcomer. So `peer:joined`
// (someone arrived after us) → we initiate; the peers handed to us in
// `room:admitted` (already present when we arrived) → we wait for their offers.
//
// Screen share (Phase 7): the presenter keeps sending their camera AND adds the
// screen as a SECOND video track, then renegotiates. So a presenting peer sends
// two video streams; the receiver tells them apart by MediaStream.id (the screen
// id is relayed over the socket as `share:active`), rendering screen-big +
// camera-in-a-circle. Only the presenter ever re-offers, so there's no glare.
export function useWebRTC({ socket, localStream }) {
  // socketId -> RTCPeerConnection
  const pcsRef = useRef(new Map());
  // socketId -> RTCIceCandidateInit[] buffered until remoteDescription is set
  const pendingIceRef = useRef(new Map());
  // Keep the latest localStream reachable from event handlers without rebinding.
  const localStreamRef = useRef(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Our own outgoing screen-share MediaStream while presenting (null otherwise).
  // Held in a ref so a peer that connects mid-share is handed the screen track.
  const screenStreamRef = useRef(null);

  // Per-peer received streams, keyed by stream id, before we've classified them
  // as camera vs screen.  socketId -> Map<streamId, MediaStream>
  const peerStreamsRef = useRef(new Map());
  // socketId -> streamId that is this peer's screen share (from `share:active`).
  const screenIdsRef = useRef(new Map());

  // socketId -> MediaStream camera feed (drives the main remote tile)
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  // socketId -> MediaStream screen feed (drives the screen-share tile + PiP)
  const [remoteScreens, setRemoteScreens] = useState(new Map());
  // socketId -> { identity, role } (drives tile labels / participant list)
  const [peers, setPeers] = useState(new Map());
  // socketId -> RTCPeerConnection.connectionState (drives per-tile "Connecting…")
  const [peerStates, setPeerStates] = useState(new Map());

  const upsertMap = (setter, key, value) =>
    setter((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });

  const deleteFromMap = (setter, key) =>
    setter((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

  // Re-derive a peer's camera/screen tiles from its received streams + the known
  // screen id. Stable (only touches refs and stable setters) so it can be a dep
  // of ensurePeer. Runs whenever a track arrives or the screen id changes, which
  // makes it safe to either ordering of `ontrack` vs the `share:active` socket.
  const resolvePeerStreams = useCallback((remoteId) => {
    const byId = peerStreamsRef.current.get(remoteId);
    const screenId = screenIdsRef.current.get(remoteId) ?? null;
    let camera = null;
    let screen = null;
    if (byId) {
      for (const [id, stream] of byId) {
        if (screenId && id === screenId) screen = stream;
        else camera = stream;
      }
    }
    const apply = (setter, value) =>
      setter((prev) => {
        if (prev.get(remoteId) === value) return prev;
        const next = new Map(prev);
        if (value) next.set(remoteId, value);
        else next.delete(remoteId);
        return next;
      });
    apply(setRemoteStreams, camera);
    apply(setRemoteScreens, screen);
  }, []);

  const closePeer = useCallback((remoteId) => {
    const pc = pcsRef.current.get(remoteId);
    if (pc) {
      pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
      pc.close();
      pcsRef.current.delete(remoteId);
    }
    pendingIceRef.current.delete(remoteId);
    peerStreamsRef.current.delete(remoteId);
    screenIdsRef.current.delete(remoteId);
    deleteFromMap(setRemoteStreams, remoteId);
    deleteFromMap(setRemoteScreens, remoteId);
    deleteFromMap(setPeers, remoteId);
    deleteFromMap(setPeerStates, remoteId);
  }, []);

  // Build (or fetch) the RTCPeerConnection for a remote socket. Idempotent so a
  // late offer and an early peer:joined can't create two connections.
  const ensurePeer = useCallback(
    (remoteId) => {
      const existing = pcsRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(remoteId, pc);
      upsertMap(setPeerStates, remoteId, pc.connectionState);

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
        // Cap outbound camera video so a 4-way mesh (3 uplinks) fits a home
        // connection. At this point the only video sender is the camera.
        capBitrate(
          pc.getSenders().find((s) => s.track?.kind === "video"),
          MAX_VIDEO_BITRATE,
        );
      }
      // Joined mid-share → also send our screen track to this new peer, so its
      // initial offer already carries both videos (no extra renegotiation).
      const screen = screenStreamRef.current;
      const screenTrack = screen?.getVideoTracks()[0];
      if (screenTrack) {
        const sender = pc.addTrack(screenTrack, screen);
        capBitrate(sender, SCREEN_MAX_BITRATE);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("webrtc:ice", { to: remoteId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        const incoming = e.streams[0];
        if (!incoming) return;
        let byId = peerStreamsRef.current.get(remoteId);
        if (!byId) {
          byId = new Map();
          peerStreamsRef.current.set(remoteId, byId);
        }
        byId.set(incoming.id, incoming);
        resolvePeerStreams(remoteId);
      };

      pc.onconnectionstatechange = () => {
        upsertMap(setPeerStates, remoteId, pc.connectionState);
        if (["failed", "closed"].includes(pc.connectionState)) {
          // peer:left handles intentional removal; this catches hard drops.
          closePeer(remoteId);
        }
      };

      return pc;
    },
    [socket, closePeer, resolvePeerStreams],
  );

  // Flush ICE candidates that arrived before we had a remoteDescription.
  const flushIce = useCallback(async (remoteId, pc) => {
    const queued = pendingIceRef.current.get(remoteId);
    if (!queued?.length) return;
    pendingIceRef.current.delete(remoteId);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch (err) {
        console.error("[webrtc] addIceCandidate (flush) failed:", err.message);
      }
    }
  }, []);

  // Send a fresh offer on an already-connected pc — used to renegotiate when the
  // screen track is added or removed. Safe from glare because only the presenter
  // calls this and the original handshake is long settled (stable state).
  const renegotiate = useCallback(
    async (remoteId, pc) => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { to: remoteId, sdp: pc.localDescription });
      } catch (err) {
        console.error("[webrtc] renegotiate failed:", err.message);
      }
    },
    [socket],
  );

  // Called by room-client when we're admitted: open (non-initiator) connections
  // to everyone already in the call and wait for their offers.
  const connectToInitialPeers = useCallback(
    (peerList = []) => {
      for (const p of peerList) {
        upsertMap(setPeers, p.socketId, {
          identity: p.identity,
          role: p.role,
          media: p.media ?? { mic: true, cam: true },
        });
        ensurePeer(p.socketId);
      }
    },
    [ensurePeer],
  );

  useEffect(() => {
    if (!socket) return;

    // Someone arrived after us → we are the initiator.
    const onPeerJoined = async ({ socketId, identity, role, media }) => {
      upsertMap(setPeers, socketId, {
        identity,
        role,
        media: media ?? { mic: true, cam: true },
      });
      const pc = ensurePeer(socketId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { to: socketId, sdp: pc.localDescription });
      } catch (err) {
        console.error("[webrtc] offer failed:", err.message);
      }
    };

    // Handles both the first offer and later renegotiations (screen add/remove):
    // ensurePeer returns the existing pc, and applying the offer in `stable`
    // state just updates the senders/receivers.
    const onOffer = async ({ from, sdp }) => {
      const pc = ensurePeer(from);
      try {
        await pc.setRemoteDescription(sdp);
        await flushIce(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { to: from, sdp: pc.localDescription });
      } catch (err) {
        console.error("[webrtc] answer failed:", err.message);
      }
    };

    const onAnswer = async ({ from, sdp }) => {
      const pc = pcsRef.current.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(sdp);
        await flushIce(from, pc);
      } catch (err) {
        console.error("[webrtc] setRemoteDescription(answer) failed:", err.message);
      }
    };

    const onIce = async ({ from, candidate }) => {
      const pc = pcsRef.current.get(from);
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error("[webrtc] addIceCandidate failed:", err.message);
        }
      } else {
        // Remote description not set yet — buffer and flush after it lands.
        const q = pendingIceRef.current.get(from) ?? [];
        q.push(candidate);
        pendingIceRef.current.set(from, q);
      }
    };

    const onPeerLeft = ({ socketId }) => closePeer(socketId);

    // A peer toggled their mic/cam — merge the new flags into their entry so the
    // tile re-renders (avatar when cam off, mic-off badge when muted).
    const onPeerMedia = ({ socketId, media }) =>
      setPeers((prev) => {
        const cur = prev.get(socketId);
        if (!cur) return prev;
        const next = new Map(prev);
        next.set(socketId, { ...cur, media: { ...cur.media, ...media } });
        return next;
      });

    socket.on("peer:joined", onPeerJoined);
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice", onIce);
    socket.on("peer:left", onPeerLeft);
    socket.on("peer:media", onPeerMedia);

    return () => {
      socket.off("peer:joined", onPeerJoined);
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice", onIce);
      socket.off("peer:left", onPeerLeft);
      socket.off("peer:media", onPeerMedia);
    };
  }, [socket, ensurePeer, closePeer, flushIce]);

  // --- screen share: add / remove our screen as a second outbound track -------

  // Start presenting: add the display track to every open pc and renegotiate.
  // The camera keeps flowing untouched, so peers can still show our face circle.
  const addScreenShare = useCallback(
    (stream) => {
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      // Hint the encoder to favour sharpness over framerate — this is code/text.
      try {
        track.contentHint = "detail";
      } catch {
        /* contentHint unsupported — non-fatal */
      }
      for (const [remoteId, pc] of pcsRef.current) {
        const sender = pc.addTrack(track, stream);
        capBitrate(sender, SCREEN_MAX_BITRATE);
        renegotiate(remoteId, pc);
      }
    },
    [renegotiate],
  );

  // Stop presenting: drop the screen sender from every pc and renegotiate back.
  const removeScreenShare = useCallback(() => {
    const stream = screenStreamRef.current;
    screenStreamRef.current = null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    for (const [remoteId, pc] of pcsRef.current) {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) {
        pc.removeTrack(sender);
        renegotiate(remoteId, pc);
      }
    }
  }, [renegotiate]);

  // Receiver side: record which incoming stream id is a peer's screen (or clear
  // it when they stop), then re-resolve that peer's tiles. Driven by the
  // `share:active` / `share:inactive` socket events, never by SDP guesswork.
  const setPeerScreen = useCallback(
    (remoteId, streamId) => {
      if (streamId) {
        screenIdsRef.current.set(remoteId, streamId);
      } else {
        // Drop the now-defunct screen stream so it isn't re-read as the camera.
        const oldId = screenIdsRef.current.get(remoteId);
        screenIdsRef.current.delete(remoteId);
        if (oldId) peerStreamsRef.current.get(remoteId)?.delete(oldId);
      }
      resolvePeerStreams(remoteId);
    },
    [resolvePeerStreams],
  );

  // Tear the whole mesh down (leave / host ended / unmount).
  const closeAll = useCallback(() => {
    for (const id of [...pcsRef.current.keys()]) closePeer(id);
  }, [closePeer]);

  return {
    remoteStreams,
    remoteScreens,
    peers,
    peerStates,
    connectToInitialPeers,
    addScreenShare,
    removeScreenShare,
    setPeerScreen,
    closeAll,
  };
}

// Pin a sender's outbound bitrate so the mesh fits a home uplink. Unsupported
// params (older browsers) are swallowed — it's a best-effort cap.
function capBitrate(sender, maxBitrate) {
  if (!sender) return;
  const params = sender.getParameters();
  if (!params.encodings?.length) params.encodings = [{}];
  params.encodings[0].maxBitrate = maxBitrate;
  sender.setParameters(params).catch(() => {});
}

export default useWebRTC;
