# 3D Avatar Interviewer with Lip Sync

## Overview

ProInterview MVP hiện có tính năng **Avatar AI Interviewer** với khả năng **lip sync real-time** - một AI interviewer có thể nói chuyện và đồng bộ môi miệng theo lời nói.

## Components

### 1. `AvatarInterviewerSimple.tsx` (Production Component)
Component 2D/SVG avatar với CSS-based animation - không cần WebGL/Three.js.

**Features:**
- ✅ SVG-based character với đầu, mắt, miệng, tóc, vai áo
- ✅ Lip sync animation dựa trên audio level (0-1)
- ✅ Eye blinking tự động với random timing
- ✅ Head bob animation khi đang nói
- ✅ Speaking indicator
- ✅ Text subtitle overlay
- ✅ Responsive & lightweight
- ✅ Hoạt động trên mọi browser (không cần WebGL)

**Props:**
```tsx
interface AvatarInterviewerSimpleProps {
  isSpeaking: boolean;      // Có đang nói không
  audioLevel?: number;       // 0-1, cường độ âm thanh
  currentText?: string;      // Text đang nói (hiện subtitle)
}
```

**Usage:**
```tsx
import { AvatarInterviewerSimple } from './components/AvatarInterviewerSimple';

<AvatarInterviewerSimple 
  isSpeaking={true}
  audioLevel={0.7}
  currentText="Xin chào bạn!"
/>
```

### 2. `AvatarInterviewerAdvanced.tsx` (Advanced Component)
Component nâng cao với tích hợp **Web Speech API** để text-to-speech thực tế.

**Features:**
- ✅ Text-to-Speech tự động với Vietnamese voice
- ✅ Auto lip sync với audio thực
- ✅ Audio level analysis (nếu hỗ trợ Web Audio API)
- ✅ Callback khi nói xong
- ✅ Auto-play hoặc manual control

**Props:**
```tsx
interface AvatarInterviewerAdvancedProps {
  text?: string;           // Text cần nói
  autoSpeak?: boolean;     // Auto-start khi text thay đổi
  onSpeakEnd?: () => void; // Callback khi nói xong
}
```

**Usage:**
```tsx
import { AvatarInterviewerAdvanced } from './components/AvatarInterviewerAdvanced';

<AvatarInterviewerAdvanced 
  text="Xin chào! Tôi là AI interviewer."
  autoSpeak={true}
  onSpeakEnd={() => console.log('Finished speaking!')}
/>
```

### 3. Custom Hook: `useAvatarAudio()`
Hook để kết nối avatar với custom audio source (audio element).

**Usage:**
```tsx
import { useAvatarAudio } from './components/AvatarInterviewerAdvanced';

const { isSpeaking, audioLevel, connectAudioElement } = useAvatarAudio();

// Kết nối với audio element
const audioRef = useRef<HTMLAudioElement>(null);
useEffect(() => {
  if (audioRef.current) {
    connectAudioElement(audioRef.current);
  }
}, []);

return (
  <>
    <audio ref={audioRef} src="/interview-audio.mp3" />
    <AvatarInterviewer 
      isSpeaking={isSpeaking}
      audioLevel={audioLevel}
    />
  </>
);
```

## Demo Page

Truy cập `/avatar-demo` để xem demo đầy đủ với:
- 5 câu hỏi mẫu
- Text-to-Speech tự động
- Lip sync real-time
- Interactive controls
- Beautiful gradient background

**Route:** `/#/avatar-demo`

## Technical Details

### Dependencies
```json
{
  // Không cần external dependencies!
  // Pure React + CSS/SVG
}
```

### Browser Compatibility

**SVG Animation (AvatarInterviewerSimple):**
- ✅ Tất cả modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Không cần WebGL
- ✅ Lightweight & fast

**Web Speech API (Text-to-Speech - AvatarInterviewerAdvanced):**
- ✅ Chrome/Edge (tốt nhất, có Vietnamese voice)
- ✅ Safari (hỗ trợ tốt)
- ⚠️ Firefox (giới hạn, không có Vietnamese voice)
- ⚠️ Mobile browsers (hỗ trợ giới hạn)

**Web Audio API (Audio Analysis):**
- ✅ Tất cả modern browsers
- ⚠️ Fallback: Nếu không có, sẽ simulate audio level

### Performance

**Optimization:**
- Pure SVG rendering (không cần GPU)
- CSS transitions cho smooth animation
- Minimal JavaScript calculations
- No external 3D libraries
- Lightweight bundle size

**Recommended:**
- Desktop: Smooth trên tất cả browsers
- Mobile: Hoạt động tốt trên mọi thiết bị (kể cả low-end)

## Integration với InterviewRoom

Để tích hợp vào InterviewRoom:

```tsx
import { AvatarInterviewerAdvanced } from '../components/AvatarInterviewerAdvanced';

function InterviewRoom() {
  const [currentQuestion, setCurrentQuestion] = useState('');
  
  return (
    <div className="interview-layout">
      {/* Avatar Section */}
      <div className="avatar-container">
        <AvatarInterviewerAdvanced 
          text={currentQuestion}
          autoSpeak={true}
          onSpeakEnd={() => {
            // Khi AI nói xong, bật mic cho user
            startUserRecording();
          }}
        />
      </div>
      
      {/* User Camera Section */}
      <div className="user-camera">
        {/* BehavioralCamera component */}
      </div>
    </div>
  );
}
```

## Customization

### 1. Thay đổi avatar appearance (SVG)

Edit trong `AvatarInterviewerSimple.tsx`:

```tsx
// Màu da
fill="#f0d5b8"

// Màu tóc
fill="#2d1810"

// Màu áo (shoulder gradient)
<linearGradient id="shoulderGradient">
  <stop offset="0%" stopColor="#6E35E8" />
  <stop offset="100%" stopColor="#9B6DFF" />
</linearGradient>
```

### 2. Điều chỉnh animation

```tsx
// Tốc độ head bob
const headBob = isSpeaking ? Math.sin(Date.now() / 200) * 2 : 0;
// 200 = tốc độ, 2 = amplitude

// Độ mở miệng
const mouthOpen = isSpeaking ? 10 + (localAudioLevel * 20) : 2;
// 10 = base open, 20 = max additional open
```

### 3. Thay đổi voice settings (Advanced component)

```tsx
utterance.rate = 0.95;  // Tốc độ nói (0.1-10)
utterance.pitch = 1.0;  // Độ cao giọng (0-2)
utterance.volume = 1.0; // Âm lượng (0-1)
```

## Future Enhancements

### Planned Features:
- [ ] Multiple avatar styles (male/female, different looks)
- [ ] Facial expressions based on emotion (happy, serious, thinking)
- [ ] Hand gestures animation
- [ ] Ready Player Me integration (custom avatars)
- [ ] Viseme-based lip sync (more accurate)
- [ ] Background customization
- [ ] AR mode (overlay on real background)

### Advanced Integration:
- [ ] Connect với ElevenLabs API (better voice quality)
- [ ] Azure Speech Service integration
- [ ] Emotion detection from user's face → avatar reacts
- [ ] Real-time translation (speak in English, user hears Vietnamese)

## Troubleshooting

### Avatar không hiện?
- Check console errors
- Clear cache và reload page
- Đảm bảo component được import đúng

### Không có giọng nói? (Advanced component)
- Kiểm tra Web Speech API: `'speechSynthesis' in window`
- Browser cần quyền audio
- Thử browser khác (Chrome/Edge tốt nhất)

### Lip sync không smooth?
- Giảm `audioLevel` update rate (thay đổi interval time)
- Kiểm tra performance (CPU usage)
- Thử tắt các animation khác

### Mobile performance kém?
- Component SVG đã được optimize cho mobile
- Nếu vẫn lag, thử giảm animation frequency

## Credits

**Built with:**
- Pure React (no external 3D libraries)
- SVG (scalable vector graphics)
- CSS Animations (smooth transitions)
- Web Speech API (Text-to-Speech)
- Web Audio API (Audio analysis)

**Design:**
- Inspired by modern AI assistants
- ProInterview brand colors (#6E35E8, #B4F500)
- Minimalist & clean aesthetic

---

**Last updated:** February 28, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready (SVG-based, no WebGL dependency)