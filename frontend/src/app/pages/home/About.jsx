import React, { useState, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import { ArrowRight, ArrowDown, ChevronDown, PlayCircle, Bot, LineChart, Users } from "lucide-react";
import heroBg from "../../../assets/images/interview-success-hero.png";
import aboutIntroImg from "../../../assets/images/about-intro.png";
import { BrandLogo } from "../../components/brand/BrandLogo";

// --- Components ---

function Reveal({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// --- Data Placeholders ---

const CORE_VALUES = [
  { icon: <Bot size={32} />, title: "Công Nghệ Tiên Phong", desc: "Ứng dụng AI đột phá giúp phân tích CV và phỏng vấn giả lập sát với thực tế nhất." },
  { icon: <LineChart size={32} />, title: "Phát Triển Toàn Diện", desc: "Không chỉ dừng ở đánh giá, chúng tôi cung cấp lộ trình cải thiện năng lực toàn diện." },
  { icon: <Users size={32} />, title: "Kết Nối Chuyên Gia", desc: "Xây dựng cộng đồng Mentor giàu kinh nghiệm, sẵn sàng định hướng và đồng hành cùng bạn." },
];

const TIMELINE = [
  { year: "12/2025", event: "Nhen nhóm ý tưởng và bắt đầu nghiên cứu giải pháp hỗ trợ ứng viên." },
  { year: "01/2026", event: "Chính thức bắt tay vào xây dựng và phát triển các tính năng cốt lõi." },
  { year: "06/2026", event: "Hoàn thiện sản phẩm và chính thức ra mắt nền tảng ProInterview." },
];

const BOARD_MEMBERS = [
  { name: "Đào Triệu Minh", role: "Team Leader / Marketing Manager", image: "/team/trieu-minh.png" },
  { name: "Nguyễn Thị Hồng Cẩm", role: "Team Member / Project Manager", image: "/team/hong-cam.png" },
  { name: "Nguyễn Hữu Hoàng Anh", role: "Team Member / Finance Analyst", image: "/team/hoang-anh.jpg" },
  { name: "Nguyễn Mai Tường Vy", role: "Team Member / Technical Leadership", image: "/team/tuong-vy.jpg" },
  { name: "Trịnh Bích Trầm", role: "Team Member / Full-stack Developer", image: "/team/bich-tram.png" },
  { name: "Võ Yến Nhi", role: "Team Member / Frontend Developer", image: "/team/yen-nhi.png" },
];

const STRUCTURE_DATA = [
  { 
    title: "Phòng Phỏng Vấn Ảo (AI Interview)", 
    content: "Trải nghiệm môi trường phỏng vấn giả lập chân thực nhất với trợ lý AI thông minh được huấn luyện chuyên biệt. Hệ thống cung cấp hàng nghìn bộ câu hỏi từ đa dạng ngành nghề, giả lập áp lực thời gian thực và tự động phân tích biểu cảm, ngữ điệu. Ngay sau khi kết thúc, bạn sẽ nhận được báo cáo đánh giá chi tiết về điểm mạnh, điểm yếu cùng các gợi ý cải thiện cấu trúc câu trả lời để hoàn toàn tự tin khi đối diện với nhà tuyển dụng thật." 
  },
  { 
    title: "Phân Tích CV Chuyên Sâu", 
    content: "Nâng cấp hồ sơ xin việc của bạn lên một tầm cao mới với công nghệ quét và chấm điểm CV tự động dựa trên tiêu chuẩn ATS (Applicant Tracking System). Thuật toán AI sẽ tiến hành đối chiếu CV của bạn với bản mô tả công việc (JD) thực tế trên thị trường, chỉ ra những từ khóa còn thiếu và các kỹ năng cần bổ sung. Từ đó, hệ thống sẽ gợi ý cách viết lại từng dòng mô tả sao cho chuyên nghiệp, sắc bén và tối ưu hóa tỷ lệ lọt vào vòng phỏng vấn." 
  },
  { 
    title: "Mạng Lưới Mentor & Chuyên Gia", 
    content: "Vượt qua những rào cản nghề nghiệp bằng cách kết nối trực tiếp 1-1 với đội ngũ Mentor là các chuyên gia cấp cao, quản lý đến từ các doanh nghiệp lớn. Bạn sẽ được lắng nghe những góc nhìn thực chiến, nhận lời khuyên định hướng lộ trình thăng tiến cá nhân hóa và được tháo gỡ mọi khúc mắc trong quá trình xin việc. Đây là cơ hội vàng để mở rộng mạng lưới quan hệ và trang bị tư duy của người dẫn đầu." 
  },
  { 
    title: "Hệ Sinh Thái Khóa Học", 
    content: "Truy cập vào kho tàng tri thức khổng lồ với hàng loạt khóa học kỹ năng thực chiến được biên soạn độc quyền bởi các chuyên gia trong ngành. Từ bí quyết chinh phục câu hỏi hành vi theo mô hình STAR, nghệ thuật đàm phán lương thưởng, cho đến các khóa huấn luyện chuyên sâu về tư duy giải quyết vấn đề. Tất cả tài liệu đều được hệ thống hóa bài bản, trực quan và bám sát vào những yêu cầu khắt khe nhất của thị trường việc làm." 
  },
];

export function About() {
  const [activeLeadTab, setActiveLeadTab] = useState(0);
  const [openAccordion, setOpenAccordion] = useState(null);

  const horizontalScrollRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: horizontalScrollRef,
  });
  
  // Transform scroll progress to x translation
  const xTransform = useTransform(scrollYProgress, [0, 1], ["0%", "-60%"]);

  return (
    <div className="bg-[#F9F6F0] text-slate-900 font-sans w-screen ml-[calc(-50vw+50%)] -mt-[3.75rem] sm:-mt-[4.25rem] md:-mt-[4.75rem]">
      
      {/* 1. HERO */}
      <section className="relative min-h-[calc(60vh+22rem)] flex flex-col justify-center px-6 lg:px-20 pt-[calc(8rem+4.75rem)] pb-24 overflow-hidden w-full">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBg} 
            alt="ProInterview Success" 
            className="w-full h-full object-cover object-[center_calc(15%+3.5rem)]"
          />
          <div className="absolute inset-0 bg-black/60" /> {/* Dark overlay to make text pop */}
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto h-full flex flex-col justify-center text-center items-center">
          <Reveal className="max-w-4xl flex flex-col items-center mt-28">
            <div className="flex flex-row flex-wrap items-center justify-center gap-3 md:gap-6 mb-4 w-full">
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white tracking-tight sm:whitespace-nowrap shrink-0 sm:shrink">
                Chúng tôi là
              </h1>
              <div className="relative translate-y-[0.44rem]">
                <div className="absolute inset-0 bg-white/30 blur-xl rounded-full scale-150 z-0"></div>
                <BrandLogo className="relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] [&>div]:!h-[64px] md:[&>div]:!h-[5.4rem]" size="default" />
              </div>
            </div>
            
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mt-[16rem] text-white opacity-90"
            >
              <ArrowDown size={48} strokeWidth={3} />
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* 1.5 TABLE OF CONTENTS */}
      <section className="px-6 lg:px-20 py-24 md:py-32 bg-[#F9F6F0] flex flex-col items-center">
        <Reveal>
          <h2 className="text-4xl md:text-6xl font-black text-[#6d2fd6] text-center tracking-tight mb-20 leading-tight">
            Tự tin. Chuẩn bị.<br/>
            Sẵn sàng bứt phá.
          </h2>
        </Reveal>
        
        <div className="w-full max-w-4xl flex flex-col">
          {[
            { num: "01", title: "Về ProInterview", id: "about-us" },
            { num: "02", title: "Giá trị cốt lõi", id: "core-values" },
            { num: "03", title: "Hành trình phát triển", id: "timeline" },
            { num: "04", title: "Đội ngũ sáng lập", id: "leadership" },
            { num: "05", title: "Hệ sinh thái", id: "ecosystem" },
          ].map((item, idx) => (
            <Reveal key={idx} delay={idx * 0.1}>
              <a 
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center border-b border-[#6d2fd6]/30 py-6 md:py-8 group hover:border-[#6d2fd6] transition-colors cursor-pointer"
              >
                <span className="text-[#6d2fd6] font-bold text-lg md:text-xl w-16 md:w-24 shrink-0">
                  {item.num}
                </span>
                <span className="text-[#6d2fd6] font-semibold text-xl md:text-2xl group-hover:translate-x-4 transition-transform duration-300">
                  {item.title}
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 2. ABOUT US */}
      <section id="about-us" className="px-6 lg:px-20 py-24 md:py-28 bg-white overflow-hidden">
        <Reveal>
          <p className="text-lg md:text-xl font-bold tracking-widest text-[#6d2fd6] mb-4">01 / VỀ PROINTERVIEW</p>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
            <div className="max-w-3xl">
              <h2 className="text-3xl md:text-5xl font-black text-[#6d2fd6] mb-4 leading-tight">
                Sứ mệnh của chúng tôi là xóa bỏ khoảng cách giữa <span className="text-[#93f72b] bg-[#6d2fd6] px-2">năng lực thực sự</span> và kỹ năng thể hiện.
              </h2>
              <div className="text-lg md:text-xl text-slate-600 leading-relaxed space-y-3">
                <p>
                  ProInterview được sinh ra từ một trăn trở rất thực tế: Tại sao có rất nhiều ứng viên tài năng, chuyên môn xuất sắc nhưng lại liên tục thất bại trong các vòng phỏng vấn chỉ vì thiếu kỹ năng giao tiếp và cách trình bày vấn đề?
                </p>
                <p>
                  Chúng tôi tin rằng, phỏng vấn không phải là một bài kiểm tra đánh đố, mà là một kỹ năng hoàn toàn có thể học hỏi và rèn luyện. Với sức mạnh của Trí tuệ nhân tạo (AI) kết hợp cùng kiến thức từ hàng trăm chuyên gia nhân sự hàng đầu, ProInterview mang đến một không gian luyện tập giả lập chân thực nhất.
                </p>
                <p>
                  Không chỉ là một công cụ công nghệ, chúng tôi là người bạn đồng hành, giúp bạn khai phá sự tự tin, làm chủ câu chuyện của chính mình và chinh phục mọi nhà tuyển dụng khó tính nhất.
                </p>
              </div>
            </div>
            
            <div className="w-full relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#6d2fd6]/40 to-[#93f72b]/40 blur-3xl rounded-full scale-105 z-0 transition-transform duration-700 group-hover:scale-110"></div>
              <img 
                src={aboutIntroImg} 
                alt="About ProInterview Concept" 
                className="relative z-10 w-full h-auto object-cover rounded-3xl shadow-2xl border border-slate-100 transition-transform duration-700 group-hover:-translate-y-2"
              />
            </div>
          </div>
        </Reveal>
      </section>

      {/* 3. CORE VALUES */}
      <section id="core-values" className="px-6 lg:px-20 py-24 md:py-28 bg-[#F9F6F0]">
        <Reveal>
          <p className="text-lg md:text-xl font-bold tracking-widest text-[#6d2fd6] mb-12">02 / GIÁ TRỊ CỐT LÕI</p>
        </Reveal>
        
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {CORE_VALUES.map((val, idx) => (
            <Reveal key={idx} delay={idx * 0.15}>
              <div className="flex flex-col border-t-2 border-[#6d2fd6] pt-8">
                <div className="text-[#6d2fd6] mb-6">{val.icon}</div>
                <h3 className="text-2xl font-black text-[#6d2fd6] mb-4 uppercase">{val.title}</h3>
                <p className="text-base text-slate-600 leading-relaxed">{val.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 4. TIMELINE (NATIVE HORIZONTAL SCROLL) */}
      <section id="timeline" className="relative bg-gradient-to-br from-[#6d2fd6] to-[#3f1190] py-20">
        <div className="px-6 lg:px-20 mb-10">
          <Reveal>
            <p className="text-lg md:text-xl font-bold tracking-widest text-[#93f72b]">03 / HÀNH TRÌNH PHÁT TRIỂN</p>
          </Reveal>
        </div>
        
        {/* Scroll Container */}
        <div className="flex gap-6 md:gap-10 px-6 lg:px-20 pb-8 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {TIMELINE.map((item, idx) => (
            <div key={idx} className="shrink-0 w-[260px] md:w-[320px] flex flex-col snap-start">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#F9F6F0] leading-none mb-4">
                {item.year}
              </h2>
              <div className="w-full h-px bg-[#F9F6F0]/30 mb-4" />
              <p className="text-base md:text-lg text-[#F9F6F0]/90 leading-relaxed">
                {item.event}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. LEADERSHIP */}
      <section id="leadership" className="px-6 lg:px-20 py-24 md:py-28 bg-white">
        <Reveal>
          <p className="text-lg md:text-xl font-bold tracking-widest text-[#6d2fd6] mb-12">04 / ĐỘI NGŨ SÁNG LẬP</p>
        </Reveal>

        {/* Content */}
        <div className="flex gap-6 md:gap-8 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-8 -mx-6 px-6 lg:-mx-20 lg:px-20">
          {BOARD_MEMBERS.map((member, i) => (
            <Reveal key={i} delay={i * 0.1} className="shrink-0 w-[220px] md:w-[280px] snap-start">
              <div className="aspect-[3/4] bg-slate-200 mb-6 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={member.image}
                  alt={member.name}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <h4 className="text-lg md:text-xl font-bold text-[#6d2fd6] mb-1">{member.name}</h4>
              <p className="text-sm md:text-base text-slate-600 font-medium">{member.role}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 5. STRUCTURE (ACCORDION) */}
      <section id="ecosystem" className="px-6 lg:px-20 py-24 md:py-28 bg-white">
        <Reveal>
          <p className="text-lg md:text-xl font-bold tracking-widest text-[#6d2fd6] mb-12">04 / HỆ SINH THÁI PROINTERVIEW</p>
        </Reveal>

        <div className="max-w-5xl mx-auto border-t-2 border-[#6d2fd6]">
          {STRUCTURE_DATA.map((item, idx) => {
            const isOpen = openAccordion === idx;
            return (
              <div key={idx} className="border-b-2 border-[#6d2fd6]">
                <button
                  onClick={() => setOpenAccordion(isOpen ? null : idx)}
                  className="w-full py-6 flex items-center justify-between text-left group"
                >
                  <h3 className="text-2xl md:text-3xl font-black uppercase text-[#6d2fd6] group-hover:opacity-80 transition-opacity">
                    {item.title}
                  </h3>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-[#6d2fd6]"
                  >
                    <ChevronDown size={32} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-6 text-base text-slate-600 leading-relaxed max-w-3xl">
                        {item.content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
