/**
 * useDIDStream — D-ID Streaming API (WebRTC) via backend proxy
 * ─────────────────────────────────────────────────────────
 * Luồng:
 *  1. POST /api/ai/did/streams       → tạo stream (BE proxy → D-ID, key server-side)
 *  2. RTCPeerConnection setup   → addTransceiver video/audio recvonly
 *  3. POST /api/ai/did/streams/{id}/sdp → gửi SDP answer
 *  4. POST /api/ai/did/streams/{id}/ice → forward ICE candidates
 *  5. ontrack → attach video stream lên <video> element
 *  6. POST /api/ai/did/streams/{id} → gửi script (audio_url hoặc text) để avatar nói
 *  7. DELETE /api/ai/did/streams/{id} → dọn stream khi xong
 *
 * D-ID API key được giữ hoàn toàn server-side — FE không cần và không được biết key này.
 */

import { useRef, useState, useCallback } from "react";
import { synthesizeSpeech, createAudioBlobUrl } from "../api/interviewsApi.js";
import { apiUrl } from "../api/http.js";
import { getAccessToken } from "../utils/auth/auth.js";

/** Fallback nếu caller không truyền sourceImageUrl */
const FALLBACK_AVATAR =
  "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-female_gxbcf1.png";

// Kept for backward compatibility — no longer used for auth
export function useDIDStream({ sourceImageUrl } = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError]   = useState("");

  const pcRef              = useRef(null);
  const streamIdRef        = useRef("");
  const sessionIdRef       = useRef("");
  const videoElRef         = useRef(null);
  const endTimerRef        = useRef();
  const connectTimerRef    = useRef();
  const sourceImageUrlRef  = useRef(sourceImageUrl || FALLBACK_AVATAR);

  // D-ID proxy is always reachable — backend returns 503 if D_ID_API_KEY is missing server-side
  const isConfigured = true;

  // ── Build auth headers (Bearer JWT — calls our proxy, not D-ID directly) ─────
  const getHeaders = useCallback(() => {
    const token = getAccessToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    };
  }, []);

  // ── Attach video element ──────────────────────────────────
  const attachVideo = useCallback((el) => {
    videoElRef.current = el;
  }, []);

  // ── Connect ───────────────────────────────────────────────
  const connect = useCallback(async (sourceUrl = sourceImageUrlRef.current) => {
    if (!isConfigured) {
      setStatus("error");
      setError("D-ID API key chưa được cấu hình");
      return;
    }
    if (status === "connecting" || status === "connected") return;

    setStatus("connecting");
    setError("");

    try {
      // Dọn stream cũ còn sót từ session trước (page refresh / unexpected unmount).
      // Phải AWAIT DELETE trước khi tạo stream mới — không fire-and-forget,
      // vì nếu DELETE và POST chạy song song D-ID đếm 2 sessions → "Max user sessions".
      const prevId  = sessionStorage.getItem("did_stream_id");
      const prevSid = sessionStorage.getItem("did_session_id");
      if (prevId && prevSid) {
        // Xóa storage trước — dù DELETE có timeout hay fail vẫn không retry lần sau
        sessionStorage.removeItem("did_stream_id");
        sessionStorage.removeItem("did_session_id");
        await fetch(apiUrl(`/api/ai/did/streams/${prevId}`), {
          method:  "DELETE",
          headers: getHeaders(),
          body:    JSON.stringify({ session_id: prevSid }),
        }).catch(() => {}); // ignore: stream có thể đã hết hạn
      }

      // 1. Tạo D-ID stream (qua BE proxy — key ở server)
      const res = await fetch(apiUrl("/api/ai/did/streams"), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ source_url: sourceUrl }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.description || e.message || `HTTP ${res.status}`);
      }

      const { id, session_id, offer, ice_servers } = await res.json();
      streamIdRef.current  = id;
      sessionIdRef.current = session_id;

      // Lưu vào sessionStorage để cleanup khi trang unload bất ngờ
      sessionStorage.setItem("did_stream_id",  id);
      sessionStorage.setItem("did_session_id", session_id);

      // 2. RTCPeerConnection
      const pc = new RTCPeerConnection({ iceServers: ice_servers });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      // 3. Video/audio track → attach lên <video> + gọi play() để bypass autoplay policy
      pc.ontrack = (event) => {
        if (videoElRef.current && event.streams[0]) {
          videoElRef.current.srcObject = event.streams[0];
          videoElRef.current.play().catch(() => {});
        }
      };

      // 4. ICE candidates → forward tới D-ID (qua BE proxy)
      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate || !streamIdRef.current) return;
        try {
          await fetch(apiUrl(`/api/ai/did/streams/${streamIdRef.current}/ice`), {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
              candidate:     candidate.candidate,
              sdpMid:        candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex,
              session_id:    sessionIdRef.current,
            }),
          });
        } catch {
          // ICE lỗi lẻ là bình thường
        }
      };

      // 5. Theo dõi connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          clearTimeout(connectTimerRef.current);
          // D-ID stream needs ~1s after WebRTC "connected" to be fully ready
          // for speak requests. Firing speakWithText immediately causes 400.
          setTimeout(() => setStatus("connected"), 1000);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected"
        ) {
          clearTimeout(connectTimerRef.current);
          setStatus("error");
          setError("WebRTC kết nối thất bại");
        }
      };

      // 6. SDP exchange
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const sdpRes = await fetch(apiUrl(`/api/ai/did/streams/${id}/sdp`), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ answer, session_id }),
      });

      if (!sdpRes.ok) {
        throw new Error(`SDP exchange thất bại: ${sdpRes.status}`);
      }

      // Timeout 8s: nếu WebRTC không vào "connected" → error → TTS fallback kích hoạt ngay.
      // 8s đủ cho ICE exchange trên mạng bình thường; giảm từ 15s để tránh user chờ im 15 giây.
      connectTimerRef.current = setTimeout(() => {
        if (pcRef.current && pcRef.current.connectionState !== "connected") {
          console.warn("[D-ID] connection timeout → fallback");
          setStatus("error");
          setError("Kết nối D-ID timeout");
        }
      }, 8000);
    } catch (err) {
      console.error("[D-ID] connect():", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Kết nối thất bại");
    }
  }, [isConfigured, status, getHeaders]);

  // ── Nói với audio URL (FPT TTS) ──────────────────────────
  const speakWithAudio = useCallback(async (
    audioUrl,
    text,
    onEnd,
  ) => {
    if (!streamIdRef.current || !sessionIdRef.current) {
      onEnd?.();
      return;
    }

    clearTimeout(endTimerRef.current);
    setStatus("speaking");

    // Azure TTS vi-VN HoaiMy ≈ 80ms/ký tự; +2000ms overhead D-ID
    const estimatedMs = Math.max(4000, text.length * 80 + 2000);

    try {
      await fetch(apiUrl(`/api/ai/did/streams/${streamIdRef.current}`), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          script: {
            type:      "audio",
            audio_url: audioUrl,
          },
          config: {
            fluent:               true,
            pad_audio:            0.5,
            align_driver:         true,
            align_expand_factor:  0,
            stitch:               true,
          },
          session_id: sessionIdRef.current,
        }),
      });

      // D-ID không có callback khi nói xong → dùng timer
      endTimerRef.current = setTimeout(() => {
        setStatus("connected");
        onEnd?.();
      }, estimatedMs);
    } catch (err) {
      console.warn("[D-ID] speakWithAudio():", err);
      setStatus("connected");
      onEnd?.();
    }
  }, [getHeaders]);

  // ── Nói với text (Azure TTS vi-VN) ───────────────────────
  const speakWithText = useCallback(async (
    text,
    onEnd,
    voiceId = "vi-VN-HoaiMyNeural",
  ) => {
    if (!streamIdRef.current || !sessionIdRef.current) {
      onEnd?.();
      return;
    }

    clearTimeout(endTimerRef.current);
    setStatus("speaking");

    const estimatedMs = Math.max(4000, text.length * 80 + 2000);

    try {
      const res = await fetch(apiUrl(`/api/ai/did/streams/${streamIdRef.current}`), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          script: {
            type:  "text",
            input: text,
            provider: {
              type:     "microsoft",
              voice_id: voiceId,
            },
          },
          config: {
            fluent:    true,
            pad_audio: 0.5,
            stitch:    true,
          },
          session_id: sessionIdRef.current,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`[D-ID] speakWithText ${res.status}:`, JSON.stringify(body));

        if (res.status === 400) {
          // 400 on a fresh stream = stream not fully ready yet.
          // Retry once after 1.5s before giving up.
          await new Promise(r => setTimeout(r, 1500));
          const retry = await fetch(apiUrl(`/api/ai/did/streams/${streamIdRef.current}`), {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
              script: { type: "text", input: text, provider: { type: "microsoft", voice_id: voiceId } },
              config: { fluent: true, pad_audio: 0.5, stitch: true },
              session_id: sessionIdRef.current,
            }),
          }).catch(() => null);

          if (retry?.ok) {
            endTimerRef.current = setTimeout(() => { setStatus("connected"); onEnd?.(); }, estimatedMs);
            return;
          }
          const retryBody = await retry?.json().catch(() => ({}));
          console.error(`[D-ID] speakWithText retry ${retry?.status}:`, JSON.stringify(retryBody));
        }

        // Expired session (400 after retry) or other error → reconnect for next Q
        setStatus("error");
        onEnd?.();
        return;
      }

      endTimerRef.current = setTimeout(() => {
        setStatus("connected");
        onEnd?.();
      }, estimatedMs);
    } catch (err) {
      console.warn("[D-ID] speakWithText():", err);
      setStatus("connected");
      onEnd?.();
    }
  }, [getHeaders]);

  // ── Nói với ElevenLabs audio (nếu TTS_PROVIDER=elevenlabs) ──
  /**
   * Gọi ElevenLabs TTS backend → tạo blob URL → feed vào D-ID speakWithAudio().
   * Fallback về speakWithText() nếu ElevenLabs call thất bại.
   *
   * Dùng khi muốn giọng clone chất lượng cao thay vì Azure TTS của D-ID.
   * Chỉ hoạt động khi D-ID stream đang connected (status === "connected").
   *
   * @param {string} text - Text tiếng Việt cần đọc
   * @param {Function} [onEnd] - Callback khi audio kết thúc
   * @param {object} [ttsOpts] - Options cho ElevenLabs (voiceId, stability, ...)
   */
  const speakWithElevenLabs = useCallback(async (text, onEnd, ttsOpts = {}) => {
    if (!streamIdRef.current || !sessionIdRef.current) {
      onEnd?.();
      return;
    }

    let blobUrl = null;
    try {
      const result = await synthesizeSpeech(text, ttsOpts);
      if (result.success && result.audioBuffer) {
        blobUrl = createAudioBlobUrl(result.audioBuffer, result.contentType);
      }
    } catch {
      // Fallback ngay nếu ElevenLabs call throw
    }

    if (blobUrl) {
      // Blob URL chỉ accessible trong browser, D-ID server không fetch được.
      // → Luôn fallback về speakWithText (D-ID Azure TTS) khi dùng live WebRTC.
      // ElevenLabs audio chỉ được dùng trong pipeline pregen (upload Cloudinary trước).
      URL.revokeObjectURL(blobUrl);
      await speakWithText(text, onEnd);
    } else {
      // ElevenLabs unavailable → fallback về D-ID Azure TTS
      await speakWithText(text, onEnd);
    }
  }, [speakWithAudio, speakWithText]);

  // ── Disconnect & cleanup ──────────────────────────────────
  const disconnect = useCallback(async () => {
    clearTimeout(endTimerRef.current);
    clearTimeout(connectTimerRef.current);

    const streamId  = streamIdRef.current;
    const sessionId = sessionIdRef.current;

    // Xóa sessionStorage TRƯỚC await — đảm bảo remove chạy ngay cả khi page unload
    // trước khi DELETE hoàn thành (keepalive chỉ giữ request sống, không giữ JS)
    sessionStorage.removeItem("did_stream_id");
    sessionStorage.removeItem("did_session_id");

    if (streamId && sessionId) {
      try {
        // keepalive: true → request survive ngay cả khi trang đang unload
        await fetch(apiUrl(`/api/ai/did/streams/${streamId}`), {
          method:    "DELETE",
          headers:   getHeaders(),
          body:      JSON.stringify({ session_id: sessionId }),
          keepalive: true,
        });
      } catch {
        // ignore
      }
    }

    pcRef.current?.close();
    pcRef.current        = null;
    streamIdRef.current  = "";
    sessionIdRef.current = "";
    setStatus("idle");
  }, [getHeaders]);

  return { status, error, connect, disconnect, speakWithAudio, speakWithText, speakWithElevenLabs, attachVideo };
}
