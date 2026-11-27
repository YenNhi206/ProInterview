import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  VideoOff,
  LogOut,
  Clock,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  PenLine,
} from "lucide-react";
import { motion } from "motion/react";
import { getUser, hasAuthCredentials } from "../../utils/auth/auth.js";
import {
  fetchBookingById,
  fetchMentorBookingById,
  completeMentorBooking,
  startBookingMeeting,
} from "../../api/bookingsApi.js";
import { MeetingEndSessionPanel } from "../../components/mentor/MeetingEndSessionPanel";
import { MentorMeetingCheckIn } from "../../components/mentor/MentorMeetingCheckIn";
import { MeetingLiveCapturePanel } from "../../components/mentor/MeetingLiveCapturePanel";
import { useMeetingLiveCapture } from "../../hooks/useMeetingLiveCapture.js";
import {
  buildProInterviewMeetUrl,
  canEnterMeetingRoom,
  canMentorCompleteBooking,
  mentorCompleteBlockMessage,
  formatUntilStart,
  getMinutesUntilBookingStart,
  isBookingInLiveWindow,
  isBookingPastScheduledEnd,
} from "../../utils/shared/meetingLinks.js";
import { mountJaasMeeting } from "../../utils/shared/jaasMeeting.js";
import { BrandLogo } from "../../components/brand/BrandLogo.jsx";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { sessionTypeLabel } from "../../utils/booking/sessionTypeLabels.js";
import { clearLiveCaptureStorage } from "../../utils/meeting/liveCapture.js";
import { BRAND_CTA_LIME_STYLE } from "../../constants/brandColors.js";

export function MeetingRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const isMentorUser = user?.role === "mentor";

  const [phase, setPhase] = useState("loading");
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [jitsiUrl, setJitsiUrl] = useState("");
  const [meetingLaunch, setMeetingLaunch] = useState(null);
  const [earlyNotice, setEarlyNotice] = useState("");
  const [showEndSessionPanel, setShowEndSessionPanel] = useState(false);
  const [completingSession, setCompletingSession] = useState(false);
  const [initialSessionCapture, setInitialSessionCapture] = useState(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [bookingMeta, setBookingMeta] = useState({ role: "", field: "" });
  const [bookingSchedule, setBookingSchedule] = useState(null);
  const [checkInContext, setCheckInContext] = useState(null);
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  const liveCapture = useMeetingLiveCapture(sessionId, {
    enabled: phase === "live" && isMentorUser,
    initialCapture: initialSessionCapture,
  });

  const enterLiveRoom = useCallback(
    async (booking) => {
      const u = getUser();
      const asMentor = u?.role === "mentor";
      const startRes = await startBookingMeeting(sessionId, { asMentor });
      if (!startRes.success) {
        const msg = startRes.error || "Không thể vào phòng họp.";
        setError(msg);
        setPhase("error");
        toastApiError(msg);
        return;
      }

      const b = booking || startRes.booking;
      if (!isBookingInLiveWindow(b)) {
        const mins = getMinutesUntilBookingStart(b);
        setEarlyNotice(
          mins > 0
            ? `Buổi hẹn bắt đầu sau ${formatUntilStart(mins)}. Bạn có thể vào thử phòng trước — lịch vẫn được giữ.`
            : "Bạn vào phòng trước giờ hẹn. Lịch vẫn hiển thị cho đến khi buổi diễn ra.",
        );
      } else {
        setEarlyNotice("");
      }

      setMeeting({
        sessionId: b.id || b._id || sessionId,
        mentorName: b.mentorName || b.mentor?.name || "Mentor",
        customerName: b.customerName || b.user?.name || b.customer?.name || "Học viên",
        status: b.status || startRes.booking?.status || "",
      });
      setBookingSchedule({
        date: b.date,
        timeSlot: b.timeSlot || b.time,
        durationMinutes: b.durationMinutes || 60,
      });
      setBookingMeta({
        role: sessionTypeLabel(b.sessionType, ""),
        field: "",
      });

      const launch = startRes.meeting;
      if (launch?.provider === "jaas" && launch.jwt) {
        setMeetingLaunch(launch);
        setJitsiUrl("");
      } else {
        setMeetingLaunch(null);
        setJitsiUrl(buildProInterviewMeetUrl(sessionId, u?.name || u?.email || "User"));
      }
      setPhase("live");
    },
    [sessionId],
  );

  useEffect(() => {
    const u = getUser();
    if (!hasAuthCredentials() || !u || !sessionId) {
      navigate(`/login?redirect=${encodeURIComponent(`/meeting/${sessionId || ""}`)}`, { replace: true });
      return;
    }

    let active = true;

    async function loadMeeting() {
      try {
        const asMentor = u.role === "mentor";
        const fetchFn = asMentor ? fetchMentorBookingById : fetchBookingById;
        const res = await fetchFn(sessionId);

        if (!active) return;

        if (!res.success || !res.booking) {
          const msg = res.error || "Phòng họp không tồn tại hoặc bạn không có quyền truy cập.";
          setError(msg);
          setPhase("error");
          toastApiError(msg);
          return;
        }

        const b = res.booking;
        const entry = canEnterMeetingRoom(b, { asMentor });
        if (!entry.ok) {
          setError(entry.message);
          setPhase("error");
          toastApiError(entry.message);
          return;
        }

        if (asMentor && !b.mentorCheckInAt) {
          setCheckInContext({
            mentorName: b.mentorName || u.name || "Mentor",
            mentorAvatar: b.mentorAvatar || "",
            customerName: b.customerName || "",
            booking: b,
          });
          setPhase("checkin");
          return;
        }

        if (asMentor && b.mentorSessionCapture) {
          setInitialSessionCapture(b.mentorSessionCapture);
        }

        await enterLiveRoom(b);
      } catch {
        if (!active) return;
        const msg = "Lỗi kết nối khi mở phòng họp.";
        setError(msg);
        setPhase("error");
        toastApiError(msg);
      }
    }

    loadMeeting();
    return () => {
      active = false;
    };
  }, [sessionId, navigate, enterLiveRoom]);

  useEffect(() => {
    if (phase !== "live") return;
    const timer = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live" || meetingLaunch?.provider !== "jaas" || !jitsiContainerRef.current) {
      return undefined;
    }

    let active = true;
    const u = getUser();

    mountJaasMeeting(jitsiContainerRef.current, meetingLaunch, {
      displayName: u?.name || u?.email || "User",
    })
      .then((api) => {
        if (!active) {
          api.dispose();
          return;
        }
        jitsiApiRef.current = api;
      })
      .catch((err) => {
        if (!active) return;
        const msg = err?.message || "Không thể tải phòng JaaS.";
        setError(msg);
        setPhase("error");
        toastApiError(msg);
      });

    return () => {
      active = false;
      jitsiApiRef.current?.dispose();
      jitsiApiRef.current = null;
    };
  }, [phase, meetingLaunch]);

  const handleLeaveRoom = () => {
    navigate(user?.role === "mentor" ? "/mentor/dashboard" : "/");
  };

  const handleOpenEndSessionPanel = () => {
    if (bookingSchedule && !canMentorCompleteBooking(bookingSchedule)) {
      toastApiError(mentorCompleteBlockMessage(bookingSchedule));
      return;
    }
    setShowEndSessionPanel(true);
  };

  const handleConfirmCompleteSession = async () => {
    setCompletingSession(true);
    try {
      await liveCapture.flushSave();
      const res = await completeMentorBooking(sessionId);
      if (res.success) {
        setShowEndSessionPanel(false);
        clearLiveCaptureStorage(sessionId);
        toastApiSuccess(
          liveCapture.hasContent
            ? "Đã kết thúc buổi. Ghi chú trong buổi đã được lưu cho AI."
            : "Đã kết thúc buổi học.",
        );
        navigate("/mentor/dashboard");
      } else {
        toastApiError(res.error, "Không thể kết thúc buổi học.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi kết thúc buổi học.");
    } finally {
      setCompletingSession(false);
    }
  };

  const handleCheckInComplete = async (booking) => {
    setCheckInContext(null);
    setPhase("loading");
    if (booking?.mentorSessionCapture) {
      setInitialSessionCapture(booking.mentorSessionCapture);
    }
    await enterLiveRoom(booking);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isMentor = isMentorUser;
  const counterpartName = isMentor ? meeting?.customerName : meeting?.mentorName;
  const counterpartLabel = isMentor ? "Học viên" : "Mentor";
  const showCompleteReminder =
    isMentor &&
    bookingSchedule &&
    ["confirmed", "in_progress"].includes(String(meeting?.status || "")) &&
    isBookingPastScheduledEnd(bookingSchedule);
  const canCompleteSession = !bookingSchedule || canMentorCompleteBooking(bookingSchedule);

  if (phase === "checkin" && checkInContext) {
    return (
      <MentorMeetingCheckIn
        bookingId={sessionId}
        mentorName={checkInContext.mentorName}
        mentorAvatar={checkInContext.mentorAvatar}
        customerName={checkInContext.customerName}
        onComplete={handleCheckInComplete}
        onCancel={() => navigate("/mentor/schedule")}
      />
    );
  }

  if (phase === "error" || error) {
    return (
      <motion.div className="min-h-svh bg-[#f8f9fc] flex items-center justify-center p-6">
        <div className="text-center max-w-md rounded-2xl border border-violet-200 bg-white px-8 py-10 shadow-[0_16px_48px_rgba(128,55,244,0.12)]">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500 border border-red-200">
            <VideoOff size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">Không vào được phòng</h2>
          <p className="text-slate-600 mb-8 whitespace-pre-line">{error}</p>
          <button
            type="button"
            onClick={() =>
              navigate(isMentor ? "/mentor/schedule" : `/session/${sessionId}`)
            }
            style={BRAND_CTA_LIME_STYLE}
            className="px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
          >
            {isMentor ? "Lịch mentor" : "Chi tiết buổi hẹn"}
          </button>
        </div>
      </motion.div>
    );
  }

  if (phase !== "live" || !meeting) {
    return (
      <div className="min-h-svh bg-[#f8f9fc] flex items-center justify-center">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <Sparkles size={48} className="text-[#8037f4] mb-6 opacity-70 mx-auto" />
          </motion.div>
          <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">
            Đang chuẩn bị phòng phỏng vấn ProInterview…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mentor-role-shell h-dvh min-h-0 bg-[#f8f9fc] flex flex-col relative overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-[120%] -translate-x-1/2 rounded-full bg-[#8037f4]/8 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#93f72b]/10 blur-3xl" />
      </div>

      <MeetingEndSessionPanel
        open={showEndSessionPanel}
        onClose={() => setShowEndSessionPanel(false)}
        onConfirm={handleConfirmCompleteSession}
        confirming={completingSession}
        elapsedLabel={formatTime(elapsedTime)}
        counterpartName={counterpartName}
        counterpartLabel={counterpartLabel}
        sessionLabel={bookingMeta.role}
        hasLiveNotes={liveCapture.hasContent}
        canConfirm={canCompleteSession}
        blockReason={canCompleteSession || !bookingSchedule ? "" : mentorCompleteBlockMessage(bookingSchedule)}
      />

      <header className="relative z-20 shrink-0 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="overflow-hidden rounded-[40px_10px_40px_10px] border-2 border-[rgba(186,165,255,0.55)] bg-white/95 shadow-[0_0_0_1px_rgba(255,255,255,0.9)_inset,0_4px_28px_rgba(128,55,244,0.12),0_2px_10px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#8037f4]/20 bg-[#faf8ff] text-[#8037f4] transition hover:border-[#8037f4]/40 hover:bg-[#8037f4]/5"
                title="Thoát phòng"
              >
                <ArrowLeft size={17} strokeWidth={2.25} />
              </button>
              <BrandLogo size="navbar" className="hidden shrink-0 sm:flex" />
              <div className="min-w-0 border-l border-[#8037f4]/15 pl-2 sm:pl-3">
                <p className="truncate text-sm font-bold text-slate-900 sm:text-base">
                  Phòng họp
                  {bookingMeta.role ? (
                    <span className="font-semibold text-[#8037f4]"> · {bookingMeta.role}</span>
                  ) : null}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  #{String(sessionId).slice(-8).toUpperCase()}
                  {bookingSchedule?.date ? (
                    <span className="hidden md:inline">
                      {" "}
                      · {bookingSchedule.date}
                      {bookingSchedule.timeSlot ? ` · ${bookingSchedule.timeSlot}` : ""}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {counterpartName ? (
                <div className="flex items-center gap-2 rounded-full border border-[#8037f4]/15 bg-[#faf8ff]/80 px-2.5 py-1.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8037f4]/12 ring-1 ring-[#8037f4]/20">
                    <span className="text-[10px] font-bold text-[#8037f4]">
                      {counterpartName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                      {counterpartLabel}
                    </p>
                    <p className="max-w-[120px] truncate text-xs font-semibold text-slate-800 leading-tight">
                      {counterpartName}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="inline-flex items-center gap-2 rounded-full border border-[#93f72b]/35 bg-[#93f72b]/10 px-2.5 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#93f72b] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#93f72b] shadow-[0_0_8px_#93f72b]" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#630ed4]">Live</span>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#8037f4]/15 bg-white px-2.5 py-1.5 font-mono text-sm font-semibold text-[#8037f4]">
                <Clock size={14} strokeWidth={2.25} />
                {formatTime(elapsedTime)}
              </div>
            </div>

            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              {isMentor ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowNotesPanel((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                      showNotesPanel
                        ? "border border-[#8037f4] bg-[#8037f4] text-white shadow-[0_4px_16px_rgba(128,55,244,0.28)]"
                        : "border border-[#8037f4]/25 bg-[#faf8ff] text-[#8037f4] hover:bg-[#8037f4]/8"
                    }`}
                  >
                    <PenLine size={14} strokeWidth={2.25} /> Ghi chú
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:border-[#8037f4]/25 hover:text-[#8037f4]"
                  >
                    Rời phòng
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenEndSessionPanel}
                    disabled={!canCompleteSession}
                    style={canCompleteSession ? BRAND_CTA_LIME_STYLE : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                      canCompleteSession
                        ? "shadow-[0_6px_20px_rgba(147,247,43,0.35)] hover:brightness-105"
                        : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                    title={
                      canCompleteSession
                        ? "Kết thúc buổi học"
                        : mentorCompleteBlockMessage(bookingSchedule)
                    }
                  >
                    <ShieldCheck size={15} strokeWidth={2.25} /> Kết thúc buổi
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#8037f4]/25 bg-[#faf8ff] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#8037f4] transition hover:bg-[#8037f4]/8"
                >
                  <LogOut size={15} strokeWidth={2.25} /> Rời phòng
                </button>
              )}
            </div>
          </div>

          {earlyNotice ? (
            <div className="border-t border-[#8037f4]/10 bg-[#faf8ff]/90 px-4 py-2 text-center text-xs leading-relaxed text-[#630ed4] sm:px-5">
              {earlyNotice}
            </div>
          ) : null}

          {showCompleteReminder ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#93f72b]/30 bg-[#93f72b]/10 px-4 py-2.5 sm:px-5">
              <p className="text-xs leading-relaxed text-slate-800">
                Buổi đã qua giờ kết thúc. Nhấn <strong className="font-bold text-[#630ed4]">Kết thúc buổi</strong>{" "}
                để học viên đánh giá và thu nhập được ghi nhận.
              </p>
              <button
                type="button"
                onClick={handleOpenEndSessionPanel}
                style={BRAND_CTA_LIME_STYLE}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider"
              >
                Kết thúc ngay
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 min-h-0 flex-col lg:flex-row gap-3 p-2 sm:p-3">
        <div
          className={`relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-violet-200/80 bg-slate-900 shadow-[0_16px_48px_rgba(128,55,244,0.1)] transition-opacity duration-200 ${
            showEndSessionPanel ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {meetingLaunch?.provider === "jaas" ? (
            <div ref={jitsiContainerRef} className="absolute inset-0 h-full w-full" />
          ) : jitsiUrl ? (
            <iframe
              allow="camera; microphone; display-capture; autoplay; clipboard-write"
              src={jitsiUrl}
              className="absolute inset-0 h-full w-full border-0"
              title="Phòng phỏng vấn ProInterview"
            />
          ) : null}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md border border-violet-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-[#93f72b] shadow-[0_0_8px_#93f72b]" />
              <span className="text-[9px] font-black text-[#8037f4] uppercase tracking-widest">
                {isMentor ? "Mentor" : "Học viên"}
              </span>
            </div>
          </div>
        </div>

        {isMentor && showNotesPanel ? (
          <MeetingLiveCapturePanel
            capture={liveCapture.capture}
            interimTranscript={liveCapture.interimTranscript}
            isListening={liveCapture.isListening}
            sttSupported={liveCapture.sttSupported}
            sttError={liveCapture.sttError}
            saveState={liveCapture.saveState}
            dictationNoteType={liveCapture.dictationNoteType}
            onDictationNoteTypeChange={liveCapture.setDictationNoteType}
            onToggleListening={liveCapture.toggleListening}
            onFinishDictation={liveCapture.finishDictationLine}
            onAddTagged={liveCapture.addTaggedNote}
            onRemoveTagged={liveCapture.removeTaggedNote}
            onDismiss={() => setShowNotesPanel(false)}
            className={`shrink-0 lg:h-full lg:max-h-none ${showEndSessionPanel ? "opacity-0 pointer-events-none" : ""}`}
          />
        ) : null}
      </main>
    </div>
  );
}
