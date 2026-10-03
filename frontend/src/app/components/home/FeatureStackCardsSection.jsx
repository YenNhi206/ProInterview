import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const CARDS = [
  {
    id: 'cv',
    content: (
      <div className="liquid-glass bg-white/5 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 w-full h-full shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#c7f36b] text-sm font-bold uppercase tracking-wider">Độ phù hợp CV</span>
          <span className="text-xs text-slate-400 font-medium">This month</span>
        </div>
        <div className="flex items-end gap-3 mt-1">
          <span className="text-5xl sm:text-6xl font-black text-white tracking-tighter">92%</span>
          <span className="text-xs font-bold text-slate-900 bg-[#c7f36b] rounded-full px-2.5 py-1 mb-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            Tốt
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-2">Vị trí: Frontend Developer</p>
        <div className="w-full bg-white/10 rounded-full h-2 mt-4">
          <div className="bg-gradient-to-r from-[#8b5cf6] to-[#c7f36b] h-2 rounded-full" style={{ width: '92%' }}></div>
        </div>
        <div className="pt-4 mt-auto border-t border-white/5">
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Quét và đối chiếu CV với JD, đưa ra điểm số phù hợp và gợi ý tối ưu chi tiết.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'interview',
    content: (
      <div className="liquid-glass bg-white/5 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 w-full h-full shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#a78bfa] text-sm font-bold uppercase tracking-wider">Phỏng vấn AI</span>
          <span className="text-xs text-slate-400 font-medium">Real-time</span>
        </div>
        <div className="flex flex-col gap-3 mt-4">
          <div className="w-[90%] h-10 bg-white/5 rounded-xl border border-white/10 flex items-center px-4 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#a78bfa]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] mr-3 animate-pulse"></div>
            <span className="text-xs sm:text-sm text-white/90 font-medium truncate">"Giải thích React Hooks?"</span>
          </div>
          <div className="w-[90%] self-end h-10 bg-[#8b5cf6]/20 rounded-xl border border-[#8b5cf6]/30 flex items-center px-4 justify-end shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#c7f36b]"></div>
            <span className="text-xs sm:text-sm text-white/90 font-medium truncate">"Hooks giúp quản lý state..."</span>
          </div>
        </div>
        <div className="pt-4 mt-auto border-t border-white/5">
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Thực chiến phỏng vấn với AI theo thời gian thực và nhận feedback ngay lập tức.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'mentor',
    content: (
      <div className="liquid-glass bg-white/5 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 w-full h-full shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#38bdf8] text-sm font-bold uppercase tracking-wider">Lịch hẹn Mentor</span>
          <span className="text-xs text-slate-400 font-medium">Sắp tới</span>
        </div>
        <div className="flex items-center gap-4 mt-4 flex-1">
          <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 overflow-hidden shrink-0 shadow-inner flex items-center justify-center">
             <img src="/mascot-mentor-avatar-cv.png?v=2" alt="Mentor" className="w-[90%] h-[90%] object-contain object-bottom" onError={(e) => { e.currentTarget.style.display='none' }} />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-base font-bold text-white tracking-tight">Anh Nguyễn Văn A</span>
            <span className="text-xs sm:text-sm text-slate-400 leading-tight mt-1">Senior Software Engineer</span>
            <span className="text-xs text-[#38bdf8] font-bold mt-2 bg-[#38bdf8]/10 inline-block px-2 py-1 rounded-md w-fit">14:00, Tự 6, 25/10</span>
          </div>
        </div>
        <div className="pt-4 mt-auto border-t border-white/5">
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Kết nối 1:1 với các chuyên gia trong ngành để nhận lời khuyên và định hướng.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'course',
    content: (
      <div className="liquid-glass bg-white/5 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 w-full h-full shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#fb923c] text-sm font-bold uppercase tracking-wider">Khóa học</span>
          <span className="text-xs text-slate-400 font-medium">Tiến độ</span>
        </div>
        <div className="flex items-end gap-3 mt-1">
          <span className="text-5xl sm:text-6xl font-black text-white tracking-tighter">45%</span>
          <span className="text-xs font-bold text-slate-900 bg-[#fb923c] rounded-full px-2.5 py-1 mb-2 flex items-center gap-1">
            Đang học
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-2">React Masterclass</p>
        <div className="w-full bg-white/10 rounded-full h-2 mt-4">
          <div className="bg-gradient-to-r from-[#f43f5e] to-[#fb923c] h-2 rounded-full" style={{ width: '45%' }}></div>
        </div>
        <div className="pt-4 mt-auto border-t border-white/5">
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Nâng cấp kỹ năng với lộ trình bài bản, thực hành sát yêu cầu thực tế doanh nghiệp.
          </p>
        </div>
      </div>
    )
  }
];

const StackedCard = ({ index, total, content, progress }) => {
  const start = index / total;
  // Make cards scale down exactly like the 3D Creator prompt: 1 - (total - 1 - index) * 0.03
  const targetScale = 1 - (total - 1 - index) * 0.03;
  
  const scale = useTransform(progress, [start, 1], [1, targetScale]);
  
  // Also offset them slightly on the Y axis as they stack so it looks like a physical deck
  const yOffset = (total - 1 - index) * 20;
  const y = useTransform(progress, [start, 1], [0, -yOffset]);

  return (
    <div 
      className="sticky w-full max-w-[600px] flex items-center justify-center mx-auto" 
      style={{ 
        top: `calc(20vh + ${index * 24}px)`, 
        zIndex: index,
        height: 'auto'
      }}
    >
      <motion.div 
        style={{ scale, y }} 
        className="w-full h-full origin-top"
      >
        {content}
      </motion.div>
    </div>
  );
};

export const FeatureStackCardsSection = () => {
  const containerRef = useRef(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <section 
      ref={containerRef} 
      className="relative w-full px-4 sm:px-6 z-20 py-20"
      // Give enough height for scrolling 4 cards comfortably (e.g. 250vh)
      style={{ height: '250vh' }} 
    >
      <div className="relative w-full h-full">
        {CARDS.map((card, i) => (
          <StackedCard 
            key={card.id} 
            index={i} 
            total={CARDS.length} 
            content={card.content} 
            progress={scrollYProgress} 
          />
        ))}
      </div>
    </section>
  );
};
