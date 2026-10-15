import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { Users, Star, BadgeCheck } from "lucide-react";
import { SparkleGlyph } from "../decor/SparkleGlyph.jsx";
import { HOME_SECTION_INNER } from "../layout/customerShellLayout";
import { MENTOR_SHOWCASE_COPY } from "../../constants/brandVoice";
import { homeSectionClasses as ty } from "../../constants/homeTypography";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { fetchMentors } from "../../api/mentorApi";
import { HOME_DEMO_MENTORS } from "../../data/homeLandingDemo";

const COLORS = [
  "124, 58, 237",   // purple #7c3aed
  "99, 102, 241",   // indigo #6366f1
  "139, 92, 246",   // violet #8b5cf6
  "59, 130, 246",   // blue #3b82f6
  "109, 40, 217",   // deep purple #6d28d9
  "79, 70, 229",    // indigo dark #4f46e5
  "168, 85, 247",   // light violet #a855f7
];

function formatPrice(price) {
  if (!price) return null;
  if (price >= 1000) return `${Math.round(price / 1000)}k/h`;
  return `${price} VND/h`;
}

function MentorAvatar({ src, name }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className="mrk-avatar">
      {src && !failed ? (
        <img src={src} alt={name} className="mrk-avatar-img" onError={() => setFailed(true)} />
      ) : (
        <span className="mrk-avatar-initials">{initials}</span>
      )}
    </span>
  );
}

export function MentorFeatureShowcase() {
  const [mentors, setMentors] = useState([]);

  useEffect(() => {
    fetchMentors().then(({ success, mentors: list }) => {
      if (!success || !list?.length) return;
      const sorted = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      setMentors(sorted.slice(0, 10));
    });
  }, []);

  const displayMentors = mentors.length ? mentors : HOME_DEMO_MENTORS;

  return (
    <section id="find-mentor" className={ty.section}>
      <div className={HOME_SECTION_INNER}>
        <HomeSectionHeader
          icon={Users}
          badge={MENTOR_SHOWCASE_COPY.badge}
          lines={[
            { text: MENTOR_SHOWCASE_COPY.titleLine1, tone: "dark" },
            { text: MENTOR_SHOWCASE_COPY.titleLine2, tone: "accent" },
          ]}
          className="mb-8 sm:mb-10"
        />

        <div className="mentor-ring-stage">
        <div className="mentor-ring-wrapper">
          <div className="mentor-ring-inner" style={{ "--quantity": displayMentors.length }}>
            {displayMentors.map((mentor, index) => {
              const mentorId = mentor.publicId || mentor._id || mentor.id;
              const price = formatPrice(mentor.price ?? mentor.pricePerHour);
              const tags = (mentor.tags ?? mentor.specialties ?? []).slice(0, 2);
              const rating = mentor.rating ? mentor.rating.toFixed(1) : null;
              const reviewCount = mentor.reviews ?? mentor.reviewCount ?? 0;
              const hasAllInfo = Boolean(mentor.name && mentor.title && mentor.company && mentor.avatar);

              return (
                <Link
                  key={mentorId ?? index}
                  to={mentorId ? `/mentors/${mentorId}` : "/mentors"}
                  className="mentor-ring-card"
                  aria-label={`Xem Mentor ${mentor.name}`}
                  style={{ "--index": index, "--color-card": COLORS[index % COLORS.length] }}
                >
                  <div className="mentor-ring-img">
                    {/* Badge ĐỀ XUẤT */}
                    <div className="mrk-badge">
                      <SparkleGlyph className="mrk-badge-icon" tone="lime" />
                      ĐỀ XUẤT
                    </div>

                    {/* Avatar + tên */}
                    <div className="mrk-top">
                      <MentorAvatar src={mentor.avatar} name={mentor.name} />
                      <div className="mrk-identity">
                        <p className="mrk-name">
                          <span className="mrk-name-text">{mentor.name}</span>
                          {hasAllInfo && <BadgeCheck className="mrk-check" />}
                        </p>
                        {mentor.title && <p className="mrk-title">{mentor.title}</p>}
                        {mentor.company && <p className="mrk-company">{mentor.company}</p>}
                      </div>
                    </div>

                    {/* Rating + price */}
                    <div className="mrk-footer">
                      <span className="mrk-rating">
                        <Star className={`mrk-star ${rating ? "mrk-star--rated" : ""}`} />
                        <span>{rating ?? "—"}</span>
                        <span className="mrk-count">({reviewCount})</span>
                      </span>
                      {price && <span className="mrk-price">{price}</span>}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="mrk-tags">
                        {tags.map((tag) => (
                          <span key={tag} className="mrk-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        </div>
      </div>
    </section>
  );
}
