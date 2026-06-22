"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIceServers } from "@/lib/ice";

// Owns the WebRTC peer mesh for a room. At 2 participants there's a single
// remote peer, but everything here is keyed by socketId so Phase 5 can scale it
// to a 4-way mesh without a rewrite.
//
// Initiator rule (set by the signaling server's events, not decided here): the
// peer already in the call sends the offer to a newcomer. So `peer:joined`
// (someone arrived after us) → we initiate; the peers handed to us in
// `room:admitted` (already present when we arrived) → we wait for their offers.
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

  // socketId -> MediaStream (drives the remote tiles)
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  // socketId -> { identity, role } (drives tile labels / participant list)
  const [peers, setPeers] = useState(new Map());

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

  const closePeer = useCallback((remoteId) => {
    const pc = pcsRef.current.get(remoteId);
    if (pc) {
      pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
      pc.close();
      pcsRef.current.delete(remoteId);
    }
    pendingIceRef.current.delete(remoteId);
    deleteFromMap(setRemoteStreams, remoteId);
    deleteFromMap(setPeers, remoteId);
  }, []);

  // Build (or fetch) the RTCPeerConnection for a remote socket. Idempotent so a
  // late offer and an early peer:joined can't create two connections.
  const ensurePeer = useCallback(
    (remoteId) => {
      const existing = pcsRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(remoteId, pc);

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("webrtc:ice", { to: remoteId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        upsertMap(setRemoteStreams, remoteId, e.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed"].includes(pc.connectionState)) {
          // peer:left handles intentional removal; this catches hard drops.
          closePeer(remoteId);
        }
      };

      return pc;
    },
    [socket, closePeer],
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

  // Called by room-client when we're admitted: open (non-initiator) connections
  // to everyone already in the call and wait for their offers.
  const connectToInitialPeers = useCallback(
    (peerList = []) => {
      for (const p of peerList) {
        upsertMap(setPeers, p.socketId, { identity: p.identity, role: p.role });
        ensurePeer(p.socketId);
      }
    },
    [ensurePeer],
  );

  useEffect(() => {
    if (!socket) return;

    // Someone arrived after us → we are the initiator.
    const onPeerJoined = async ({ socketId, identity, role }) => {
      upsertMap(setPeers, socketId, { identity, role });
      const pc = ensurePeer(socketId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { to: socketId, sdp: pc.localDescription });
      } catch (err) {
        console.error("[webrtc] offer failed:", err.message);
      }
    };

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

    socket.on("peer:joined", onPeerJoined);
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice", onIce);
    socket.on("peer:left", onPeerLeft);

    return () => {
      socket.off("peer:joined", onPeerJoined);
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice", onIce);
      socket.off("peer:left", onPeerLeft);
    };
  }, [socket, ensurePeer, closePeer, flushIce]);

  // Tear the whole mesh down (leave / host ended / unmount).
  const closeAll = useCallback(() => {
    for (const id of [...pcsRef.current.keys()]) closePeer(id);
  }, [closePeer]);

  return { remoteStreams, peers, connectToInitialPeers, closeAll };
}

export default useWebRTC;
