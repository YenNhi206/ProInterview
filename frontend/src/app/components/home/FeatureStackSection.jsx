import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const FEATURES = [
  {
    num: "01",
    category: "AI Resume",
    name: "Độ phù hợp CV",
    btn: "Thử ngay",
    img1: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055344_5eff02e0-87a5-41ce-b64f-eb08da8f33db.png&w=1280&q=85",
    img2: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055431_11d841fd-8b41-46a5-82e4-b04f2407a7d8.png&w=1280&q=85",
    img3: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055451_e317bf2d-28d4-48cc-86b0-6f72f25b6327.png&w=1280&q=85"
  },
  {
    num: "02",
    category: "Real-time AI",
    name: "Phỏng vấn AI",
    btn: "Thử ngay",
    img1: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055654_911201c5-36d9-4bc6-bac7-331adfce159f.png&w=1280&q=85",
    img2: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055723_5ceda0b8-d9c2-4665-b2e3-83ba19ba76d1.png&w=1280&q=85",
    img3: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055753_adc5dcbd-a8e6-49c0-b43a-9b030d835cea.png&w=1280&q=85"
  },
  {
    num: "03",
    category: "1:1 Network",
    name: "Lịch hẹn Mentor",
    btn: "Tìm Mentor",
    img1: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055759_963cfb0b-4bd1-4b0f-9d0a-09bd6cf95b2f.png&w=1280&q=85",
    img2: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_060108_438f781a-9846-4dcc-89ab-c4e6cb830f5b.png&w=1280&q=85",
    img3: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055818_9d062121-ad7e-46b9-999a-1a6a692ef1ee.png&w=1280&q=85"
  },
  {
    num: "04",
    category: "Learning",
    name: "Khóa học",
    btn: "Học ngay",
    img1: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055344_5eff02e0-87a5-41ce-b64f-eb08da8f33db.png&w=1280&q=85",
    img2: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055431_11d841fd-8b41-46a5-82e4-b04f2407a7d8.png&w=1280&q=85",
    img3: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055451_e317bf2d-28d4-48cc-86b0-6f72f25b6327.png&w=1280&q=85"
  }
];

const StackedCard = ({ index, total, feature, progress }) => {
  const start = index / total;
  const targetScale = 1 - (total - 1 - index) * 0.03;
  const scale = useTransform(progress, [start, 1], [1, targetScale]);
  const opacity = useTransform(progress, [start, 1], [1, 1 - (total - 1 - index) * 0.1]);

  return (
    <div 
      className="sticky w-full max-w-[1200px] h-screen sm:h-[85vh] flex items-center justify-center mx-auto" 
      style={{ top: `calc(4rem + ${index * 28}px)`, zIndex: index }}
    >
      <motion.div 
        style={{ scale, opacity }} 
        className="w-full bg-[#0C0C0C] border-2 border-[#D7E2EA] rounded-[40px] sm:rounded-[50px] md:rounded-[60px] p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6 shadow-2xl origin-top"
      >
        {/* Top row */}
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="text-4xl sm:text-6xl md:text-7xl font-black text-white">{feature.num}</span>
            <div className="flex flex-col">
              <span className="text-[#D7E2EA] text-xs sm:text-sm md:text-base font-light uppercase tracking-widest">{feature.category}</span>
              <span className="text-white text-lg sm:text-2xl md:text-3xl font-medium uppercase tracking-tight">{feature.name}</span>
            </div>
          </div>
          <button className="hidden sm:block rounded-full border-2 border-[#D7E2EA] text-[#D7E2EA] font-medium uppercase tracking-widest px-6 py-2.5 sm:px-10 sm:py-3.5 hover:bg-[#D7E2EA]/10 transition-colors">
            {feature.btn}
          </button>
        </div>

        {/* Bottom row (images) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full">
          <div className="hidden md:flex flex-col gap-4 col-span-2">
            <img src={feature.img1} alt="" className="w-full h-[clamp(130px,16vw,230px)] object-cover rounded-[30px] sm:rounded-[40px]" />
            <img src={feature.img2} alt="" className="w-full h-[clamp(160px,22vw,340px)] object-cover rounded-[30px] sm:rounded-[40px]" />
          </div>
          <div className="col-span-1 md:col-span-3">
            <img src={feature.img3} alt="" className="w-full h-[300px] sm:h-full min-h-[300px] object-cover rounded-[30px] sm:rounded-[40px]" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const FeatureStackSection = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <section 
      ref={containerRef} 
      className="bg-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] relative pt-20 pb-[20vh] px-5 sm:px-8 md:px-10 font-['Inter'] mt-20"
      style={{ height: '300vh' }} // Provide scrollable height for the effect
    >
      <h2 
        className="text-center font-black uppercase tracking-tight text-[clamp(2.5rem,8vw,120px)] mb-10 sm:mb-20 bg-clip-text text-transparent bg-gradient-to-b from-[#646973] to-[#BBCCD7]"
      >
        TÍNH NĂNG
      </h2>
      <div className="relative w-full h-full">
        {FEATURES.map((feat, i) => (
          <StackedCard 
            key={i} 
            index={i} 
            total={FEATURES.length} 
            feature={feat} 
            progress={scrollYProgress} 
          />
        ))}
      </div>
    </section>
  );
};
