/**
 * ttsService.js
 * Text-to-Speech provider: ElevenLabs (giọng clone, chất lượng cao).
 * Khi ELEVENLABS_API_KEY không set → avatar D-ID tự dùng Azure TTS (không cần service này).
 *
 * Env vars:
 *   ELEVENLABS_API_KEY=sk_...
 *   ELEVENLABS_VOICE_ID=...         (voice clone ID hoặc voice library ID)
 *   ELEVENLABS_MODEL_ID=eleven_flash_v2_5   (optional, default shown)
 *   TTS_PROVIDER=did | elevenlabs   (mặc định: did nếu không có key)
 *
 * Note: ElevenLabs trả về audio binary (mp3). Backend endpoint /api/ai/tts trả response binary
 * cho frontend — frontend tạo blob URL để play hoặc gửi URL cho D-ID speakWithAudio().
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

function cfg() {
  return {
    apiKey:        process.env.ELEVENLABS_API_KEY         ?? "",
    voiceId:       process.env.ELEVENLABS_VOICE_ID        ?? "", // default (female fallback)
    voiceIdMale:   process.env.ELEVENLABS_VOICE_ID_MALE   ?? "", // David — giọng nam HR
    voiceIdFemale: process.env.ELEVENLABS_VOICE_ID_FEMALE ?? "", // Sarah — giọng nữ HR
    modelId:       process.env.ELEVENLABS_MODEL_ID        ?? "eleven_flash_v2_5",
  };
}

/**
 * Kiểm tra voice ID có phải giá trị thật không.
 * Loại bỏ placeholder dạng <...> (ví dụ: <voice ID vừa clone>) — những giá trị này
 * khiến isElevenLabsEnabled() trả về true nhưng API call sẽ fail 404.
 */
function isRealVoiceId(id) {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  // Placeholder pattern: bắt đầu < kết thúc > (e.g. "<voice ID vừa clone>")
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return false;
  return true;
}

export function isElevenLabsEnabled() {
  const { apiKey, voiceId, voiceIdMale, voiceIdFemale } = cfg();
  // Enabled nếu có key VÀ ít nhất một voice ID thực sự hợp lệ (không phải placeholder)
  return Boolean(apiKey && (isRealVoiceId(voiceId) || isRealVoiceId(voiceIdMale) || isRealVoiceId(voiceIdFemale)));
}

/**
 * Trả về ElevenLabs voice ID tương ứng với giới tính HR.
 * Priority: gender-specific → default ELEVENLABS_VOICE_ID → empty string
 * @param {"male"|"female"} [gender="female"]
 */
export function getElevenLabsVoiceId(gender = "female") {
  const { voiceId, voiceIdMale, voiceIdFemale } = cfg();
  if (gender === "male"   && isRealVoiceId(voiceIdMale))   return voiceIdMale;
  if (gender === "female" && isRealVoiceId(voiceIdFemale)) return voiceIdFemale;
  return isRealVoiceId(voiceId) ? voiceId : ""; // trả "" nếu default cũng là placeholder
}

/**
 * Trả về TTS provider đang active.
 * @returns {"elevenlabs"|"did"}
 */
export function getTTSProvider() {
  const explicit = process.env.TTS_PROVIDER?.toLowerCase();
  if (explicit === "elevenlabs" && isElevenLabsEnabled()) return "elevenlabs";
  if (explicit === "did") return "did";
  return isElevenLabsEnabled() ? "elevenlabs" : "did";
}

/**
 * Lấy danh sách voices trong thư viện ElevenLabs của account.
 * @returns {Promise<object[]>} voices array
 */
export async function listVoices() {
  if (!isElevenLabsEnabled()) return [];
  const { apiKey } = cfg();
  const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
    signal:  AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.voices ?? [];
}

/**
 * Synthesize text → audio buffer (mp3).
 * @param {string} text - Text tiếng Việt cần đọc
 * @param {object} [opts]
 * @param {string} [opts.voiceId] - override ELEVENLABS_VOICE_ID
 * @param {string} [opts.modelId] - override ELEVENLABS_MODEL_ID
 * @param {number} [opts.stability=0.5]
 * @param {number} [opts.similarityBoost=0.75]
 * @param {number} [opts.style=0.3]
 * @param {string} [opts.outputFormat="mp3_44100_128"]
 * @returns {Promise<{buffer: Buffer, contentType: string}|null>} null nếu ElevenLabs không enabled
 */
export async function synthesizeSpeech(text, opts = {}) {
  // QA-01: Chế độ mock ElevenLabs bằng biến môi trường để test tải không tốn tiền
  if (process.env.MOCK_AI_SERVICES === "true" || process.env.MOCK_AI === "true") {
    return {
      buffer: Buffer.from("MOCK_ELEVENLABS_TTS_AUDIO_BUFFER"),
      contentType: "audio/mpeg",
    };
  }

  if (!isElevenLabsEnabled()) return null;

  const { apiKey, voiceId: defaultVoiceId, modelId: defaultModelId } = cfg();
  const {
    voiceId        = defaultVoiceId,
    modelId        = defaultModelId,
    stability      = 0.5,
    similarityBoost = 0.75,
    style          = 0.3,
    outputFormat   = "mp3_44100_128",
  } = opts;

  const res = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
    {
      method:  "POST",
      headers: {
        "xi-api-key":   apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer:      Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "audio/mpeg",
  };
}

/**
 * Trả về thông tin usage / subscription của account ElevenLabs.
 * Dùng để check quota còn lại trước khi TTS.
 */
export async function getElevenLabsUsage() {
  if (!isElevenLabsEnabled()) return null;
  const { apiKey } = cfg();
  const res = await fetch(`${ELEVENLABS_BASE}/user/subscription`, {
    headers: { "xi-api-key": apiKey },
    signal:  AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return res.json();
}
