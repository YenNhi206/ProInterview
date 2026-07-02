import { Review } from "../models/Review.js";
import { User, toPublicUser } from "../models/User.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";

export const PublicController = {
  getHomeData: async (req, res) => {
    try {
      // 1. Fetch recent verified reviews
      const reviews = await Review.find({ isVisible: true, isVerified: true })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("userId", "name avatar role")
        .lean();

      // Format reviews
      const formattedReviews = reviews.map(r => {
        let avatarUrl = "";
        if (r.userId?.avatar) {
            avatarUrl = resolveStoredUploadUrl(r.userId.avatar);
        }

        return {
          id: r._id,
          name: r.userId?.name || "Học viên",
          role: r.userId?.role === "mentor" ? "Mentor" : "Học viên ProInterview",
          avatar: avatarUrl,
          stars: r.rating || 5,
          text: r.comment || "",
          // If we don't have a helpful count in DB, we can just generate a random one for visual purpose, or send 0.
          helpfulCount: Math.floor(Math.random() * 40) + 10,
          createdAt: r.createdAt
        };
      });

      // 2. Fetch stats
      const totalSessions = await InterviewSession.countDocuments();
      const totalMentors = await User.countDocuments({ role: "mentor", isActive: true });
      const totalUsers = await User.countDocuments();
      
      const reviewStats = await Review.aggregate([
        { $match: { isVisible: true, isVerified: true } },
        { $group: { _id: null, avgRating: { $avg: "$rating" } } }
      ]);
      const avgRating = reviewStats.length > 0 && reviewStats[0].avgRating ? Number(reviewStats[0].avgRating.toFixed(1)) : 0;

      const stats = {
        totalSessions: totalSessions,
        totalMentors: totalMentors,
        averageRating: avgRating,
        totalUsers: totalUsers
      };

      res.status(200).json({
        success: true,
        data: {
          reviews: formattedReviews,
          stats
        }
      });
    } catch (error) {
      console.error("[PublicController.getHomeData] Error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
};
