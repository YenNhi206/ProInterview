import React from "react";
import { Link } from "react-router";
import { ArrowRight, CheckCircle2, GraduationCap } from "lucide-react";
import InterviewPreview from "./InterviewPreview";
import { Button } from "../ui/button";

export function HomeHero() {
  return (
    <section id="home-hero-section" className="home-hero-section home-product-hero">
      <div className="home-product-hero-copy">
        <div className="home-product-hero-badge liquid-glass-strong">
          <GraduationCap size={17} aria-hidden="true" />
          Nền tảng dành cho sinh viên IT
        </div>
        <h1>
          <span>Chuẩn bị vững vàng<em className="home-product-hero-highlight">.</em></span>
          <span><em className="home-product-hero-highlight">Tự tin</em> bước vào phỏng vấn.</span>
        </h1>
        <p>Từ CV đến buổi phỏng vấn đầu tiên, luyện tập cùng AI, nhận góp ý từ mentor và biết rõ điều bạn cần cải thiện.</p>
        <div className="home-product-hero-actions">
          <Button asChild variant="outline" size="lg" data-button-surface="none" className="home-product-hero-primary">
            <Link to="/interview">Bắt đầu luyện tập <ArrowRight size={18} aria-hidden="true" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="home-product-hero-secondary">
            <a href="#features">Khám phá tính năng</a>
          </Button>
        </div>
        <ul className="home-product-hero-benefits">
          {["Lộ trình rõ ràng", "Nội dung sát thực tế", "Đồng hành cùng mentor"].map(text => (
            <li key={text}><CheckCircle2 size={16} aria-hidden="true" />{text}</li>
          ))}
        </ul>
      </div>
      <InterviewPreview />
    </section>
  );
}
