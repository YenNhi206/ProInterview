import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { AvatarInterviewerSimple } from '../components/AvatarInterviewerSimple';
import { 
  Play, 
  Pause, 
  ArrowLeft, 
  Mic as Microphone, 
  Video as VideoCamera, 
  Brain, 
  Sparkles as Sparkle,
  Zap as Lightning,
  CheckCircle,
  ArrowRight,
  BarChart3 as ChartBar,
  Timer,
  Target,
  BadgeCheck as SealCheck
} from 'lucide-react';

const DEMO_SCENARIOS = [
  {
    id: 1,
    category: "Giới thiệu",
    question: "Xin chào Tôi là AI Interviewer của ProInterview. Rất vui được gặp bạn hôm nay. Bạn có thể giới thiệu về bản thân trong vài phút được không?",
    tips: "Tập trung vào kinh nghiệm liên quan đến vị trí"
  },
  {
    id: 2,
    category: "Kinh nghiệm",
    question: "Tuyệt vời Hãy kể cho tôi nghe về một dự án mà bạn tự hào nhất. Bạn đã làm gì và đạt được kết quả như thế nào?",
    tips: "Sử dụng phương pháp STAR để trả lời"
  },
  {
    id: 3,
    category: "Kỹ năng mềm",
    question: "Bạn có thể chia sẻ về một lần bạn phải làm việc với một đồng nghiệp khó tính? Bạn đã xử lý tình huống đó như thế nào?",
    tips: "Nhấn mạnh kỹ năng giao tiếp và giải quyết xung đột"
  },
  {
    id: 4,
    category: "Thử thách",
    question: "Hãy kể về một thử thách lớn nhất bạn từng đối mặt trong công việc. Bạn đã vượt qua nó ra sao?",
    tips: "Thể hiện khả năng problem-solving"
  },
  {
    id: 5,
    category: "Kết thúc",
    question: "Cảm ơn bạn đã chia sẻ. Bạn có câu hỏi nào dành cho tôi về công ty hay vị trí này không?",
    tips: "Chuẩn bị 2-3 câu hỏi thông minh"
  },
];

export function AvatarDemo() {
  const navigate = useNavigate();
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const currentScenario = DEMO_SCENARIOS[currentScenarioIndex];

  const handleStartSpeaking = () => {
    setIsSpeaking(true);
    
    // Simulate audio level changes
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 0.8 + 0.2);
    }, 80);

    // Stop after 6 seconds
    setTimeout(() => {
      setIsSpeaking(false);
      clearInterval(interval);
      setAudioLevel(0);
    }, 6000);
  };

  const handleNextQuestion = () => {
    setCurrentScenarioIndex((prev) => (prev + 1) % DEMO_SCENARIOS.length);
  };

  const handleStartRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ 
        background: "rgba(255,255,255,0.92)", 
        borderBottom: "1px solid rgba(0,0,0,0.06)" 
      }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/interview')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all hover:brightness-95"
              style={{ 
                background: "rgba(110, 53, 232,0.08)", 
                color: "#6E35E8",
                border: "1px solid rgba(110, 53, 232,0.15)"
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Quay lại</span>
            </button>
            
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl" style={{
              background: "linear-gradient(135deg, rgba(110, 53, 232,0.06), rgba(139, 77, 255,0.03))",
              border: "1px solid rgba(110, 53, 232,0.12)"
            }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#B4F000" }} />
              <span className="text-sm font-bold" style={{ color: "#6E35E8" }}>
                Demo Phỏng vấn AI
              </span>
            </div>

            <button
              onClick={() => navigate('/interview')}
              className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-105"
              style={{ 
                background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", 
                color: "#fff",
                boxShadow: "0 4px 12px rgba(110, 53, 232,0.25)"
              }}
            >
              Bắt đầu thực chiến
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
              Câu hỏi {currentScenarioIndex + 1}/{DEMO_SCENARIOS.length}
            </span>
            <span className="text-xs font-bold" style={{ color: "#6E35E8" }}>
              {Math.round(((currentScenarioIndex + 1) / DEMO_SCENARIOS.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "#E9EAEC" }}>
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${((currentScenarioIndex + 1) / DEMO_SCENARIOS.length) * 100}%`,
                background: "linear-gradient(90deg, #6E35E8, #8B4DFF)"
              }}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Video + Controls */}
          <div className="space-y-5">
            {/* Avatar Container */}
            <div 
              className="relative w-full rounded-3xl overflow-hidden"
              style={{ 
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                aspectRatio: "16/10"
              }}
            >
              <AvatarInterviewerSimple 
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
                currentText={isSpeaking ? currentScenario.question : ""}
              />

              {/* Status overlay */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                {/* AI Status */}
                <div 
                  className="flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-xl"
                  style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <Brain className="w-4 h-4" style={{ color: "#6E35E8" }} />
                  <span className="text-xs font-bold" style={{ color: "#6E35E8" }}>
                    {isSpeaking ? "Đang phỏng vấn..." : "Chờ câu trả lời"}
                  </span>
                </div>

                {/* Timer */}
                {isRecording && (
                  <div 
                    className="flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-xl animate-pulse"
                    style={{ background: "rgba(180,240,0,0.15)", border: "1px solid rgba(180,240,0,0.3)" }}
                  >
                    <Timer className="w-4 h-4" style={{ color: "#4A7A00" }} />
                    <span className="text-xs font-bold" style={{ color: "#4A7A00" }}>
                      00:23
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Question Display */}
            <div 
              className="rounded-2xl p-5"
              style={{ 
                background: "linear-gradient(135deg, rgba(110, 53, 232,0.04), rgba(139, 77, 255,0.02))",
                border: "1px solid rgba(110, 53, 232,0.12)"
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}
                >
                  <Sparkle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: "#6E35E8" }}>
                    {currentScenario.category}
                  </p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>Câu hỏi phỏng vấn</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "#1F1F1F" }}>
                {currentScenario.question}
              </p>
              <div 
                className="flex items-start gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(180,240,0,0.08)", border: "1px solid rgba(180,240,0,0.2)" }}
              >
                <Lightning className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#4A7A00" }} />
                <p className="text-xs" style={{ color: "#4A7A00" }}>
                  <span className="font-bold">Gợi ý: </span>{currentScenario.tips}
                </p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleStartSpeaking}
                disabled={isSpeaking}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isSpeaking ? "#9CA3AF" : "linear-gradient(135deg, #6E35E8, #8B4DFF)",
                  color: "#fff",
                  boxShadow: isSpeaking ? "none" : "0 6px 20px rgba(110, 53, 232,0.3)"
                }}
              >
                {isSpeaking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Đang nói...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Phát câu hỏi
                  </>
                )}
              </button>

              <button
                onClick={handleStartRecording}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-95"
                style={{
                  background: isRecording ? "linear-gradient(135deg, #FF4444, #CC0000)" : "#FFFFFF",
                  color: isRecording ? "#fff" : "#1F1F1F",
                  border: isRecording ? "none" : "1.5px solid #E5E7EB",
                  boxShadow: isRecording ? "0 0 0 4px rgba(255,68,68,0.15)" : "0 1px 3px rgba(0,0,0,0.04)"
                }}
              >
                {isRecording ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Đang ghi
                  </>
                ) : (
                  <>
                    <Microphone className="w-5 h-5" />
                    Trả lời
                  </>
                )}
              </button>

              <button
                onClick={handleNextQuestion}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-bold text-sm transition-all"
                style={{
                  background: "rgba(180,240,0,0.12)",
                  color: "#4A7A00",
                  border: "1.5px solid rgba(180,240,0,0.25)"
                }}
              >
                Câu tiếp
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Info Sidebar */}
          <div className="space-y-4">
            {/* Features */}
            <div 
              className="rounded-2xl p-5"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: "#1F1F1F" }}>
                <Sparkle className="w-4 h-4" style={{ color: "#6E35E8" }} />
                Tính năng AI
              </h3>
              <div className="space-y-3">
                {[
                  { 
                    icon: VideoCamera, 
                    label: "3D Lip Sync", 
                    desc: "Đồng bộ môi realtime",
                    color: "#6E35E8" 
                  },
                  { 
                    icon: Brain, 
                    label: "AI Thông minh", 
                    desc: "Phân tích câu trả lời",
                    color: "#8B4DFF" 
                  },
                  { 
                    icon: Microphone, 
                    label: "Speech-to-Text", 
                    desc: "Chuyển đổi giọng nói",
                    color: "#B4F000" 
                  },
                  { 
                    icon: ChartBar, 
                    label: "Phân tích chi tiết", 
                    desc: "Đánh giá tức thì",
                    color: "#FFD600" 
                  },
                ].map((feature) => (
                  <div 
                    key={feature.label}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:brightness-95"
                    style={{ background: "rgba(110, 53, 232,0.03)", border: "1px solid rgba(110, 53, 232,0.08)" }}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${feature.color}15` }}
                    >
                      <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: "#1F1F1F" }}>
                        {feature.label}
                      </p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>
                        {feature.desc}
                      </p>
                    </div>
                    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#B4F000" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Overview */}
            <div 
              className="rounded-2xl p-5"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: "#1F1F1F" }}>
                <Target className="w-4 h-4" style={{ color: "#6E35E8" }} />
                Tiến độ Demo
              </h3>
              <div className="space-y-2">
                {DEMO_SCENARIOS.map((scenario, idx) => (
                  <div 
                    key={scenario.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer"
                    style={{ 
                      background: idx === currentScenarioIndex 
                        ? "rgba(110, 53, 232,0.08)" 
                        : idx < currentScenarioIndex 
                        ? "rgba(180,240,0,0.05)" 
                        : "transparent",
                      border: idx === currentScenarioIndex 
                        ? "1px solid rgba(110, 53, 232,0.15)" 
                        : "1px solid transparent"
                    }}
                    onClick={() => setCurrentScenarioIndex(idx)}
                  >
                    <div 
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ 
                        background: idx < currentScenarioIndex 
                          ? "#B4F000" 
                          : idx === currentScenarioIndex 
                          ? "linear-gradient(135deg, #6E35E8, #8B4DFF)"
                          : "#E9EAEC",
                        color: idx <= currentScenarioIndex ? "#fff" : "#9CA3AF"
                      }}
                    >
                      {idx < currentScenarioIndex ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p 
                        className="text-xs font-semibold truncate"
                        style={{ color: idx === currentScenarioIndex ? "#6E35E8" : "#1F1F1F" }}
                      >
                        {scenario.category}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Banner */}
            <div 
              className="rounded-2xl p-5 cursor-pointer transition-all hover:brightness-95"
              style={{ 
                background: "linear-gradient(135deg, #1a0a3e 0%, #2d1060 100%)",
                border: "1px solid rgba(255,255,255,0.1)"
              }}
              onClick={() => navigate('/interview')}
            >
              <div className="flex items-center gap-2 mb-2">
                <SealCheck className="w-4 h-4 text-[#B4F000]" />
                <span className="text-xs font-bold text-[#B4F000]">SẴN SÀNG PHỎNG VẤN?</span>
              </div>
              <h4 className="text-base font-bold text-white mb-2">
                Bắt đầu phỏng vấn thực chiến
              </h4>
              <p className="text-xs text-white/65 mb-3">
                Upload CV, chọn vị trí ứng tuyển và bắt đầu phỏng vấn với AI ngay hôm nay
              </p>
              <div 
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{ background: "#B4F000", color: "#1F1F1F" }}
              >
                Bắt đầu ngay
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}