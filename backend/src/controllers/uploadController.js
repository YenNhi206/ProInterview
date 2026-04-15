export const UploadController = {
  /** Upload ảnh đại diện */
  uploadAvatar: async (req, res) => {
    try {
      // Giả lập upload lên S3/Cloudinary
      // Trong thực tế sẽ dùng multer + s3 client
      const mockUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.userId}_${Date.now()}`;
      
      res.json({ 
        success: true, 
        url: mockUrl,
        message: "Upload ảnh đại diện thành công (Mock)" 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Upload CV */
  uploadCV: async (req, res) => {
    try {
      const mockUrl = `https://prointerview.vn/storage/cv/${req.userId}_resume.pdf`;
      res.json({ 
        success: true, 
        url: mockUrl,
        fileName: "resume_updated.pdf",
        message: "Upload CV thành công (Mock)" 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Upload thumbnail khóa học */
  uploadCourseThumbnail: async (req, res) => {
    try {
      const mockUrl = `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80`;
      res.json({ 
        success: true, 
        url: mockUrl,
        message: "Upload ảnh bìa khóa học thành công (Mock)" 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
