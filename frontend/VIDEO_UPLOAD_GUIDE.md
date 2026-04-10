# 🎬 Hướng dẫn Upload Videos cho AI Interview

## 📁 Cách 1: Sử dụng Public Folder (Đơn giản nhất - Khuyến nghị)

### Bước 1: Tạo folder videos trong public
1. Tạo folder `/public/videos/` trong project của bạn
2. Nếu chưa có folder `/public`, tạo nó ở root level của project

### Bước 2: Copy 2 video files vào
```
/public/videos/ai-male-intro.mp4      ← Video HR Nam (David)
/public/videos/ai-female-intro.mp4    ← Video HR Nữ (Sarah)
```

### Bước 3: Đảm bảo tên file chính xác
- ✅ `ai-male-intro.mp4` 
- ✅ `ai-female-intro.mp4`
- ❌ Không dùng tên khác (hoặc phải sửa lại trong code)

### Cấu trúc folder cuối cùng:
```
your-project/
├── public/
│   └── videos/
│       ├── ai-male-intro.mp4
│       └── ai-female-intro.mp4
├── src/
│   └── app/
│       └── pages/
│           └── AIGenderSelection.tsx
└── package.json
```

## ☁️ Cách 2: Sử dụng Cloud Storage (Professional)

### Cloudinary (Miễn phí cho video nhỏ):
1. Đăng ký tài khoản: https://cloudinary.com/
2. Upload 2 videos lên Cloudinary
3. Copy Public URL của mỗi video
4. Sửa file `/src/app/pages/AIGenderSelection.tsx` line 22-23:

```typescript
const VIDEO_URLS = {
  male: "https://res.cloudinary.com/your-account/video/upload/v123456/ai-male-intro.mp4",
  female: "https://res.cloudinary.com/your-account/video/upload/v123456/ai-female-intro.mp4",
};
```

### AWS S3 / Google Cloud Storage:
- Upload videos lên bucket
- Đặt permission thành `public-read`
- Copy URL và paste vào `VIDEO_URLS`

## 📝 Yêu cầu Video

### Format khuyến nghị:
- **Format**: MP4 (H.264 codec)
- **Resolution**: 1280x720 (720p) hoặc 1920x1080 (1080p)
- **Aspect Ratio**: 16:9
- **Bitrate**: 2-5 Mbps
- **Duration**: 15-30 giây (đủ để giới thiệu)
- **File size**: < 10MB mỗi video

### Nội dung gợi ý:
**HR Nam (David):**
```
"Xin chào! Tôi là David, HR AI của ProInterview. 
Hôm nay tôi sẽ đồng hành cùng bạn trong buổi phỏng vấn này. 
Hãy thư giãn và trả lời tự nhiên nhất có thể nhé!"
```

**HR Nữ (Sarah):**
```
"Chào bạn! Mình là Sarah, AI Interviewer của ProInterview. 
Mình rất vui được gặp bạn hôm nay. 
Đừng lo lắng, chúng ta sẽ có một cuộc trò chuyện thú vị!"
```

## 🔍 Test & Verify

### Sau khi upload:
1. Mở app và navigate đến: `/interview`
2. Chọn một nguồn thông tin (Option A hoặc B)
3. Click "Bắt đầu AI Interview"
4. Bạn sẽ thấy màn hình chọn giới tính HR
5. Chọn HR Nam hoặc Nữ
6. Video sẽ tự động load và có thể play

### Kiểm tra console nếu video không load:
- F12 → Console tab
- Tìm error message về video
- Đảm bảo đường dẫn video đúng
- Check CORS nếu dùng cloud storage

## 🐛 Troubleshooting

### Video không hiển thị?
✅ Kiểm tra đường dẫn file: `/public/videos/ai-male-intro.mp4`
✅ Kiểm tra tên file chính xác (case-sensitive)
✅ Kiểm tra format video (phải là MP4)
✅ Clear browser cache (Ctrl+Shift+R)

### Video bị lỗi CORS?
- Nếu dùng cloud storage, enable CORS trong settings
- Cloudinary: CORS được enable mặc định
- AWS S3: Thêm CORS policy vào bucket

### Video load chậm?
- Nén video xuống dưới 5MB
- Dùng H.264 codec với bitrate thấp hơn
- Host trên CDN (Cloudinary auto-optimize)

## 📌 Lưu ý quan trọng

1. **Không commit videos vào Git nếu > 5MB**
   - Thêm vào `.gitignore`: `public/videos/*.mp4`
   - Dùng Git LFS nếu cần version control

2. **Production deployment:**
   - Upload videos lên CDN (Cloudinary/CloudFront)
   - Update `VIDEO_URLS` trong code
   - Test trên production environment

3. **Fallback placeholder:**
   - Nếu video chưa có, app vẫn hoạt động
   - User sẽ thấy placeholder "Chọn HR AI"
   - Có thể skip video và vào phòng trực tiếp

---

## ✅ Checklist

- [ ] Đã tạo folder `/public/videos/`
- [ ] Đã copy 2 video files vào
- [ ] Tên file chính xác: `ai-male-intro.mp4` và `ai-female-intro.mp4`
- [ ] Đã test video player trong browser
- [ ] Video format là MP4, duration 15-30s
- [ ] File size < 10MB mỗi video

**Sau khi hoàn tất, flow sẽ là:**
```
[Interview Setup] → [Choose Gender + Watch Video] → [Interview Room]
```

Need help? Check console logs hoặc liên hệ team! 🚀
