import { useRef, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

// --- Types and Interfaces ---
interface UseWebRTCProps {
  socket: Socket | null;
  roomId: string;
  userId: string;
}

export type CallState = 'idle' | 'requesting' | 'receiving' | 'connected' | 'rejected';

interface IncomingCall {
  from: string;
  to: string;
  offer: RTCSessionDescriptionInit;
}

// --- The Hook ---
export const useWebRTC = ({ socket, roomId, userId }: UseWebRTCProps) => {
  // --- State Declarations ---
  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  
  // ICE候选者缓存，用于在远程描述设置前暂存候选者
  const iceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // --- Utility Functions ---
  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      console.log('[WebRTC] Using existing local stream');
      return localStreamRef.current;
    }
    try {
      console.log('[WebRTC] Requesting media permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      console.log('[WebRTC] Local stream obtained:', stream);
      console.log('[WebRTC] Video tracks:', stream.getVideoTracks().length);
      console.log('[WebRTC] Audio tracks:', stream.getAudioTracks().length);
      return stream;
    } catch (error) {
      console.error('[WebRTC] Failed to get local stream', error);
      return null;
    }
  }, []);

  const closeStreams = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    // 清空ICE候选者缓存
    iceCandidatesRef.current = [];
  }, []);

  const hangup = useCallback(() => {
    if (!socket) return;
    console.log('[WebRTC] Hanging up.');
    closeStreams();
    setCallState('idle');
  }, [socket, closeStreams]);

  // 处理缓存的ICE候选者
  const processCachedCandidates = useCallback(async () => {
    if (peerConnectionRef.current && iceCandidatesRef.current.length > 0) {
      console.log(`[WebRTC] Processing ${iceCandidatesRef.current.length} cached ICE candidates`);
      for (const candidate of iceCandidatesRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('[WebRTC] Error adding cached ICE candidate:', error);
        }
      }
      iceCandidatesRef.current = []; // 清空缓存
    }
  }, []);

  const createPeerConnection = useCallback((remoteId: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close(); // Close existing connection if any
      peerConnectionRef.current = null;
    }
    const pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('RTC:CANDIDATE', { from: userId, to: remoteId, candidate: event.candidate, roomId });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event);
      console.log('[WebRTC] Remote stream:', event.streams[0]);
      console.log('[WebRTC] Remote stream tracks:', event.streams[0].getTracks().length);
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state changed:', pc.connectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        hangup();
      } else if (pc.connectionState === 'connected') {
        console.log('[WebRTC] Peer connection established successfully');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [userId, roomId, socket, hangup, setRemoteStream]);
  const call = useCallback(async (remoteUserId: string) => {
    if (!socket) return console.error('[WebRTC] Cannot call: socket not available.');
    console.log(`[WebRTC] Initiating direct call to user ${remoteUserId}`);

    const pc = createPeerConnection(remoteUserId);
    if (!pc) return;

    try {
      const stream = await getLocalStream();
      if (stream) {
        console.log('[WebRTC] Adding local stream tracks to peer connection');
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
          console.log('[WebRTC] Added track:', track.kind);
        }
      } else {
        console.error('[WebRTC] No local stream available for call');
        setCallState('idle');
        return;
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('CALL:REQUEST', { from: userId, to: remoteUserId, roomId, offer: pc.localDescription });
      setCallState('requesting');
    } catch (error) {
      console.error('[WebRTC] Error initiating call:', error);
      setCallState('idle');
    }
  }, [socket, userId, roomId, getLocalStream, createPeerConnection]);

  const answer = useCallback(async () => {
    if (!socket || !incomingCall) return;
    console.log('[WebRTC] Answering call');

    const pc = createPeerConnection(incomingCall.from);
    if (!pc) return;

    try {
      const stream = await getLocalStream();
      if (stream) {
        console.log('[WebRTC] Adding local stream tracks for answer');
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
          console.log('[WebRTC] Added track for answer:', track.kind);
        }
      } else {
        console.error('[WebRTC] No local stream available for answer');
        setCallState('idle');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      console.log('[WebRTC] Remote description set for incoming call');
      
      // 处理缓存的ICE候选者
      await processCachedCandidates();
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('RTC:ANSWER', { from: userId, to: incomingCall.from, roomId, answer: pc.localDescription });
      setCallState('connected');
      setIncomingCall(null);
    } catch (error) {
      console.error('[WebRTC] Error answering call:', error);
      setCallState('idle');
    }
  }, [socket, userId, roomId, incomingCall, getLocalStream, createPeerConnection, processCachedCandidates]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  }, []);

  // --- Socket Event Handlers ---
  const handleCallRequest = useCallback((data: { from: string; to: string; offer: RTCSessionDescriptionInit }) => {
    console.log('[WebRTC] Received call request from', data.from, 'to', data.to, 'current user:', userId);
    
    // 只处理发给当前用户的通话请求
    if (data.to === userId) {
      console.log('[WebRTC] Call request is for current user, setting incoming call');
      setIncomingCall(data);
      setCallState('receiving');
    } else {
      console.log('[WebRTC] Call request is not for current user, ignoring');
    }
  }, [userId]);

  const handleOffer = useCallback(async (data: { from: string; to: string; offer: RTCSessionDescriptionInit }) => {
    console.log('[WebRTC] Received offer from', data.from, 'to', data.to, 'current user:', userId);
    
    // 只处理发给当前用户的offer
    if (data.to !== userId) {
      console.log('[WebRTC] Offer is not for current user, ignoring');
      return;
    }
    
    const pc = createPeerConnection(data.from);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log('[WebRTC] Remote description set for offer');
      
      // 处理缓存的ICE候选者
      await processCachedCandidates();
      
      const stream = await getLocalStream();
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('RTC:ANSWER', { from: userId, to: data.from, roomId, answer: pc.localDescription });
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
    }
  }, [socket, userId, roomId, createPeerConnection, getLocalStream, processCachedCandidates]);

  const handleAnswer = useCallback(async (data: { from: string; to: string; answer: RTCSessionDescriptionInit }) => {
    console.log('[WebRTC] Received answer from', data.from, 'to', data.to, 'current user:', userId);
    
    // 只处理发给当前用户的answer
    if (data.to !== userId) {
      console.log('[WebRTC] Answer is not for current user, ignoring');
      return;
    }
    
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('[WebRTC] Remote description set successfully');
        
        // 处理缓存的ICE候选者
        await processCachedCandidates();
        
        setCallState('connected');
      } catch (error) {
        console.error('[WebRTC] Error handling answer:', error);
      }
    }
  }, [processCachedCandidates, userId]);

  const handleCandidate = useCallback(async (data: { from: string; to: string; candidate: RTCIceCandidateInit }) => {
    console.log('[WebRTC] Received ICE candidate from', data.from, 'to', data.to, 'current user:', userId);
    
    // 只处理发给当前用户的ICE候选者
    if (data.to !== userId) {
      console.log('[WebRTC] ICE candidate is not for current user, ignoring');
      return;
    }
    
    if (peerConnectionRef.current) {
      try {
        // 检查远程描述是否已设置
        if (peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('[WebRTC] ICE candidate added successfully');
        } else {
          // 远程描述未设置时，缓存ICE候选者
          console.log('[WebRTC] Caching ICE candidate until remote description is set');
          iceCandidatesRef.current.push(data.candidate);
        }
      } catch (error) {
        console.error('[WebRTC] Error adding ICE candidate:', error);
      }
    }
  }, [userId]);

  // --- Main useEffect for Signaling ---
  useEffect(() => {
    if (!socket) {
      console.log('[WebRTC] No socket available for user', userId);
      return;
    }

    console.log('[WebRTC] Setting up event listeners for user', userId, 'in room', roomId);
    console.log('[WebRTC] Socket connected:', socket.connected);

    socket.on('CALL:REQUEST', handleCallRequest);
    socket.on('RTC:OFFER', handleOffer);
    socket.on('RTC:ANSWER', handleAnswer);
    socket.on('RTC:CANDIDATE', handleCandidate);

    return () => {
      socket.off('CALL:REQUEST');
      socket.off('RTC:OFFER');
      socket.off('RTC:ANSWER');
      socket.off('RTC:CANDIDATE');
    };
  }, [socket, roomId, userId, handleCallRequest, handleOffer, handleAnswer, handleCandidate]);

  return {
    callState,
    incomingCall,
    localStream: localStreamRef.current,
    remoteStream,
    call,
    answer,
    hangup,
    toggleAudio,
    toggleVideo,
    isAudioMuted,
    isVideoMuted,
  };
};