import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Video as VideoIcon,
  Phone,
  Mic,
  MicOff,
  VideoOff,
  MessageCircle as ChatCircle,
  LogOut,
  CheckCircle,
  Clock,
  User,
  ShieldCheck,
  Zap,
  Target,
  Users,
  Layout,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getUser } from "../utils/auth";
import { getMeetingBySession, joinMeeting, completeMeeting } from "../utils/meetings";

export function MeetingRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const [meeting, setMeeting] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!user || !sessionId) {
      navigate("/");
      return;
    }

    const m = getMeetingBySession(sessionId);
    if (m) {
      setMeeting(m);
      if ((user.role === "mentor" && m.mentorJoined) || (user.role === "customer" && m.customerJoined)) {
        setJoined(true);
      }
    }
  }, [sessionId, user, navigate]);

  useEffect(() => {
    if (joined && meeting?.status === "active") {
      const timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [joined, meeting?.status]);

  const handleJoin = () => {
    if (!user || !sessionId) return;
    const role = user.role === "mentor" ? "mentor" : "customer";
    const result = joinMeeting(sessionId, joinCode, user.email, role);

    if (result.success && result.meeting) {
      setMeeting(result.meeting);
      setJoined(true);
      setError("");
    } else {
      setError(result.error || "Mã tham gia không chính xác");
    }
  };

  const handleEndCall = () => {
    if (!sessionId || !meeting) return;
    if (meeting.mentorJoined && meeting.customerJoined) {
      completeMeeting(sessionId);
    }
    navigate(user?.role === "mentor" ? "/mentor/dashboard" : "/dashboard");
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!meeting) {
    return (
      <div className="min-h-screen bg-[#07060E] flex items-center justify-center text-white">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
             <Sparkles size={48} className="text-primary-fixed mb-6 opacity-20" />
          </motion.div>
          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Phòng họp không tồn tại</p>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────
     Portal View: Join Screen
  ────────────────────────────────────────────────────────── */
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white font-sans"
           style={{ background: "linear-gradient(145deg, #0E0922 0%, #07060E 100%)" }}>
        
        <style>{`
          .glass-card { background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(40px); border-radius: 40px; border: 1px solid rgba(255, 255, 255, 0.08); transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
          .input-neon { background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.08); border-radius: 20px; transition: all 0.3s; text-align: center; }
          .input-neon:focus { border-color: #c4ff47; background: rgba(255,255,255,0.06); outline: none; box-shadow: 0 0 20px rgba(196, 255, 71,0.2); }
        `}</style>

        <div className="fixed top-0 right-0 w-[1000px] h-[1000px] bg-secondary/10 blur-[250px] rounded-full pointer-events-none -z-0"></div>
        <div className="fixed bottom-0 left-0 w-[800px] h-[800px] bg-primary-fixed/5 blur-[200px] rounded-full pointer-events-none -z-0"></div>

        <motion.div 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="glass-card w-full max-w-lg p-12 relative z-10"
        >
          <div className="w-20 h-20 rounded-3xl bg-primary-fixed flex items-center justify-center mx-auto mb-10 shadow-[0_0_40px_rgba(196, 255, 71,0.3)]">
            <VideoIcon size={32} className="text-black" />
          </div>

          <h1 className="text-4xl font-black text-center mb-4 tracking-tighter uppercase leading-none">
             Vào phòng <span className="text-secondary tracking-tighter">Mentor</span>
          </h1>
          <p className="text-center text-zinc-500 text-sm font-medium mb-10">Vui lòng nhập mã tham gia để bắt đầu phiên học</p>

          <div className="space-y-8">
            <div className="relative">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-4 text-center">Mã tham gia 6 chữ số</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000 000"
                className="input-neon w-full py-6 text-4xl font-black tracking-[0.5em] text-white"
              />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase text-center tracking-widest leading-relaxed">
                {error}
              </motion.div>
            )}

            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 6}
              className="w-full py-5 rounded-3xl bg-white text-black text-xs font-black uppercase tracking-[0.2em] transition-all disabled:opacity-20 disabled:grayscale hover:scale-[1.02] shadow-2xl"
            >
              Tham gia ngay ϟ
            </button>

            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
               <div className="flex items-center gap-3 text-zinc-500">
                  <ShieldCheck size={14} className="text-primary-fixed" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Phiên làm việc được bảo mật và ghi âm</p>
               </div>
               <div className="flex items-center gap-3 text-zinc-500">
                  <Zap size={14} className="text-secondary" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Đảm bảo kết nối internet ổn định</p>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────
     Meeting View: Active Session
  ────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#07060E] flex flex-col relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-20">
         <div className="absolute top-0 w-full h-[600px] bg-gradient-to-b from-primary-fixed/20 to-transparent blur-[100px]" />
      </div>

      <style>{`
        .ctrl-btn { width: 64px; height: 64px; border-radius: 24px; display: flex; items-center: center; justify-content: center; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
        .ctrl-btn:hover { background: rgba(255,255,255,0.1); color: #fff; transform: translateY(-2px); }
        .ctrl-btn.active { background: #E11D48; border-color: #FB7185/20; color: #fff; box-shadow: 0 0 20px rgba(225,29,72,0.3); }
        .ctrl-btn.danger { background: #E11D48; color: #fff; border: none; }
        .video-label { background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); border-radius: 12px; padding: 6px 16px; border: 1px solid rgba(255,255,255,0.1); }
      `}</style>

      {/* Main View Area */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-10">
        
        {/* Remote Participant (Main Frame) */}
        <div className="w-full h-full max-w-6xl rounded-[60px] bg-white/[0.02] border border-white/5 flex items-center justify-center relative overflow-hidden group shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
           <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
           <div className="relative text-center z-10">
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }} 
                transition={{ duration: 4, repeat: Infinity }}
                className="w-40 h-40 rounded-full mx-auto mb-8 bg-gradient-to-br from-primary-fixed/20 to-secondary/20 flex items-center justify-center ring-4 ring-white/5"
              >
                 <User size={64} className="text-white/20" />
              </motion.div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                 {user?.role === "mentor" ? "HỌC VIÊN ĐANG CHỜ..." : "MENTOR ĐANG ĐẾN..."}
              </h2>
              <p className="text-zinc-600 font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-primary-fixed animate-ping" /> KẾT NỐI MẠNG AN TOÀN
              </p>
           </div>

           {/* Video Labels */}
           <div className="absolute bottom-10 left-10 flex items-center gap-4">
              <div className="video-label flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    {user?.role === "mentor" ? "Participant" : session.mentorName}
                 </span>
              </div>
           </div>
        </div>

        {/* Local Self-View (Small Floating) */}
        <motion.div 
           drag
           dragConstraints={{ left: -400, right: 400, top: -200, bottom: 200 }}
           className="absolute top-10 right-10 w-64 h-48 rounded-[40px] bg-black/40 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden cursor-move ring-4 ring-white/5"
        >
           {isVideoOff ? (
             <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <VideoOff size={32} className="text-zinc-700" />
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">CAMERA TẮT</p>
             </div>
           ) : (
             <div className="w-full h-full bg-gradient-to-tr from-primary-fixed/5 to-secondary/5 flex items-center justify-center">
                <User size={40} className="text-white/10" />
             </div>
           )}
           <div className="absolute bottom-4 left-4 video-label py-1.5 px-3">
              <span className="text-[9px] font-black text-white uppercase tracking-widest">YOU</span>
           </div>
        </motion.div>

        {/* Top Info Bar */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 flex gap-4">
           <div className="flex items-center gap-4 px-8 py-3 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-xl">
              <div className="flex items-center gap-3 px-3 py-1 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                 <span className="text-[9px] font-black uppercase tracking-widest">LIVE REC</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex items-center gap-3 text-white">
                 <Clock size={14} className="text-primary-fixed" />
                 <span className="text-sm font-black font-mono tracking-tighter">{formatTime(elapsedTime)}</span>
              </div>
           </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="relative z-20 pb-12 px-10">
         <div className="max-w-2xl mx-auto flex items-center justify-between gap-10 bg-white/[0.03] border border-white/10 backdrop-blur-3xl p-4 rounded-[36px] shadow-2xl">
            <div className="flex items-center gap-3 ml-4">
               <div className="w-10 h-10 rounded-xl bg-primary-fixed/20 flex items-center justify-center text-primary-fixed">
                  <Target size={20} />
               </div>
               <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Room ID</p>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">#{meeting.joinCode}</p>
               </div>
            </div>

            <div className="flex items-center gap-4">
               <button onClick={() => setIsMuted(!isMuted)} className={`ctrl-btn ${isMuted ? 'active' : ''}`}>
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
               </button>
               <button onClick={() => setIsVideoOff(!isVideoOff)} className={`ctrl-btn ${isVideoOff ? 'active' : ''}`}>
                  {isVideoOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
               </button>
               <button className="ctrl-btn">
                  <ChatCircle size={22} />
               </button>
               <div className="w-[1px] h-10 bg-white/10 mx-2" />
               <button onClick={handleEndCall} className="ctrl-btn danger bg-rose-600 hover:bg-rose-500 hover:scale-110 active:scale-95 transition-all">
                  <Phone size={24} className="rotate-[135deg]" />
               </button>
            </div>

            <div className="mr-4">
               <button onClick={handleEndCall} className="flex items-center gap-2 group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:bg-white/5 transition-all">
                     <LogOut size={20} />
                  </div>
               </button>
            </div>
         </div>
      </div>

      {/* Atmospheric Particles Overlay */}
      <div className="fixed inset-0 pointer-events-none -z-0">
         <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary-fixed/20 blur-sm rounded-full animate-pulse" />
         <div className="absolute bottom-1/4 right-1/3 w-3 h-3 bg-secondary/10 blur-sm rounded-full animate-pulse delay-700" />
      </div>
    </div>
  );
}
