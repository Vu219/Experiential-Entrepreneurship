import sys
import datetime

# Configure UTF-8 encoding for console output (especially on Windows)
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for environments where stdout cannot be reconfigured
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from src import (
    BrandPersona,
    BrandPersonaManager,
    ContentGenerator,
    PolicyChecker,
    PlatformFormatter,
    PostScheduler,
    TrendResearcher,
    AnalyticsSystem,
    StrategyOptimizer
)

def run_workflow_demo():
    print("======================================================================")
    print("🎬 MÔ PHỎNG LUỒNG VẬN HÀNH CONTENT TỰ ĐỘNG (AI CONTENT AUTOMATION)")
    print("======================================================================")

    # 1. Khởi tạo cấu hình hồ sơ thương hiệu (Brand Persona Setup)
    print("\n--- [Bước 1 & 2] Thiết lập nhân vật & Chiến lược thương hiệu ---")
    persona_manager = BrandPersonaManager()
    my_brand = BrandPersona(
        industry="Mỹ phẩm thuần chay",
        tone="Trẻ trung, thân thiện, chia sẻ kiến thức",
        target_audience="Gen Z & Millennial quan tâm môi trường",
        goals=["Tăng nhận diện thương hiệu", "Kéo traffic về Shopee/Website"],
        platforms=["TikTok", "Instagram", "Facebook"],
        posting_frequency="1 bài/ngày",
        preferred_hours=["12:00", "20:00"]
    )
    persona_manager.setup_persona(user_id="user_admin_01", persona=my_brand)
    print("✅ Cấu hình hồ sơ thương hiệu thành công!")
    print(f"   Ngành hàng: {my_brand.industry} | Giọng văn: {my_brand.tone}")

    # 2. Tạo nội dung (Content Generation)
    print("\n--- [Bước 3 & 4] Tạo nội dung bản nháp (Content Generation) ---")
    generator = ContentGenerator()
    idea = "Lý do vì sao nên chọn son môi không chì thuần chay"
    draft = generator.generate_content(persona=my_brand, idea=idea)
    print(f"📝 Bản nháp được tạo (ID: {draft.id}):")
    print(f"   Caption: {draft.caption}")
    print(f"   Visual Prompt: {draft.media_prompt}")

    # 3. Kiểm tra chính sách (Policy Check)
    print("\n--- [Chính sách] Kiểm duyệt nội dung nội bộ ---")
    policy_checker = PolicyChecker()
    is_valid = policy_checker.verify_content(draft)
    if is_valid:
        draft.status = "Approved"
        print("✅ Kiểm tra chính sách: Đạt tiêu chuẩn! Chuyển trạng thái -> Approved.")
    else:
        print("❌ Kiểm tra chính sách: Vi phạm! Chuyển trạng thái -> Need Review.")

    # 4. Định dạng bài đăng theo nền tảng (Platform Formatting)
    print("\n--- [Bước 5 & 6] Định dạng theo từng nền tảng kết nối ---")
    formatter = PlatformFormatter()
    formatted_posts = []
    for platform in my_brand.platforms:
        post = formatter.format_post(draft, platform)
        formatted_posts.append(post)
        print(f"   -> Format cho {platform}: Aspect Ratio = {post.media_spec} | Hashtags = {post.hashtags}")

    # 5. Lên lịch và đăng bài (Schedule & Auto Posting)
    print("\n--- [Bước 7 & 8] Lên lịch & Đăng bài tự động ---")
    # Chúng ta giả lập có token kết nối cho TikTok và Instagram, nhưng Facebook bị thiếu/hết hạn
    platform_tokens = {
        "TikTok": "tiktok_valid_oauth_token_xyz123",
        "Instagram": "instagram_valid_graph_token_abc789",
        # Facebook bị bỏ trống để minh họa Luồng ngoại lệ 1
    }
    
    scheduler = PostScheduler(platform_tokens=platform_tokens)
    
    # Lên lịch đăng bài vào 12h00 trưa hôm nay
    scheduled_time = datetime.datetime.now()
    scheduler.schedule_post(draft, formatted_posts, scheduled_time)
    
    # Thực thi hàng đợi đăng bài (giả sử thời gian đăng đã đến)
    print("\n⏳ [Đăng bài] Bắt đầu thực thi hàng đợi đăng bài...")
    posted_results = scheduler.execute_posting(scheduled_time)

    # 6. Nghiên cứu xu hướng (Trend Research - luồng đã được chuyển xuống sau theo docs mới)
    print("\n--- [Bước 9] Nghiên cứu xu hướng (Trend Research) ---")
    researcher = TrendResearcher()
    current_trends = researcher.research_trends(my_brand)
    print("📈 Các xu hướng mới tìm thấy:")
    for trend in current_trends:
        print(f"   🔥 Từ khóa: '{trend.keyword}' | Nền tảng: {trend.platform} | Ý tưởng đề xuất: {trend.idea_concept}")

    # 7. Phân tích hiệu quả & Tối ưu hóa (Analytics & Strategy Optimization)
    print("\n--- [Bước 10 & 11 & 12] Phân tích hiệu quả & Tối ưu hóa chiến lược ---")
    analytics = AnalyticsSystem()
    optimizer = StrategyOptimizer()
    
    metrics_data = {}
    for post in posted_results:
        metrics = analytics.collect_metrics(post["post_id"], post["platform"])
        metrics_data[post["platform"]] = metrics
        print(f"   📊 Chỉ số từ {post['platform']}: Views: {metrics.views} | Likes: {metrics.likes} | CTR: {metrics.ctr*100:.2f}%")
        
    optimizer.optimize_strategy(metrics_data)

    # 8. Minh họa ngoại lệ 2: Phát hiện vi phạm chính sách sau khi đăng bởi nền tảng bên ngoài
    print("\n--- [Ngoại lệ 2] Minh họa nền tảng gửi thông báo vi phạm chính sách ---")
    if posted_results:
        target_post = posted_results[0]
        # Giả lập webhook của TikTok gửi thông báo vi phạm
        policy_checker.handle_platform_violation(
            post_id=target_post["post_id"],
            platform=target_post["platform"],
            message="Nội dung nhắc tới từ khóa nhạy cảm trong hình ảnh được quét bởi AI kiểm duyệt."
        )

    print("\n======================================================================")
    print("🎉 KẾT THÚC LUỒNG MÔ PHỎNG THÀNH CÔNG")
    print("======================================================================")

if __name__ == "__main__":
    run_workflow_demo()
