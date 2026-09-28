// Nội dung 3 trang pháp lý công khai (/privacy, /terms, /data-deletion) — song ngữ vi/en.
// Văn bản dài nên đặt riêng ở đây thay vì i18n.ts (i18n chỉ giữ chuỗi giao diện ngắn).
// ⚠️ Mô tả phải khớp HÀNH VI THẬT của code (Meta OAuth, mã hoá token, xoá tài khoản 30 ngày,
// callback xoá dữ liệu của Meta). Đổi hành vi backend → cập nhật văn bản này cùng lúc.

import type { Lang } from '../types';

export const LEGAL_CONTACT_EMAIL = 'aimarketing.startup@gmail.com';
export const LEGAL_UPDATED_AT = '28/09/2026';

export type LegalDocKey = 'privacy' | 'terms' | 'dataDeletion';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const privacyVi: LegalDoc = {
  title: 'Chính sách bảo mật',
  intro:
    'AIMA – AI Marketing Assistant ("AIMA", "chúng tôi") giúp bạn tạo nội dung marketing bằng AI và đăng bài theo lịch lên Trang Facebook, tài khoản Instagram Business và Threads mà bạn liên kết. Chính sách này mô tả dữ liệu chúng tôi thu thập, lý do sử dụng, cách bảo vệ và quyền của bạn.',
  sections: [
    {
      heading: '1. Dữ liệu bạn cung cấp trực tiếp',
      bullets: [
        'Thông tin tài khoản: email, họ tên, số điện thoại, ngày sinh, ảnh đại diện và mật khẩu (chỉ lưu dạng băm BCrypt, không lưu mật khẩu gốc). Nếu đăng nhập bằng Google, chúng tôi nhận email, tên và ảnh đại diện từ Google.',
        'Hồ sơ thương hiệu, chiến lược nội dung và nội dung bạn tạo hoặc chỉnh sửa trong AIMA.',
        'Thông tin gói dịch vụ và lịch sử thanh toán (thanh toán được xử lý qua cổng payOS; AIMA không lưu thông tin thẻ/tài khoản ngân hàng).',
      ],
    },
    {
      heading: '2. Dữ liệu nhận từ Meta khi bạn liên kết tài khoản',
      paragraphs: ['Chỉ khi bạn chủ động bấm liên kết và đồng ý trong hộp thoại của Meta, chúng tôi nhận:'],
      bullets: [
        'Tài khoản Facebook: ID tài khoản (theo ứng dụng), tên hiển thị và ảnh đại diện.',
        'Danh sách Trang Facebook bạn quản lý và cấp quyền: ID Trang, tên Trang và access token của Trang.',
        'Tài khoản Instagram Business gắn với Trang (nếu có): ID, tên người dùng, tên và ảnh đại diện.',
        'Tài khoản Threads (nếu liên kết): ID, tên người dùng, tên và ảnh đại diện.',
        'Access token của người dùng, thời điểm cấp/hết hạn và danh sách quyền bạn thực sự đã cấp.',
        'Với bài viết do AIMA đăng: ID bài trên nền tảng và số liệu tương tác (lượt thích, bình luận, chia sẻ, lượt xem/hiển thị nếu được cấp quyền), cùng thông báo khi bài bị nền tảng gỡ.',
      ],
    },
    {
      heading: '3. Mục đích sử dụng',
      bullets: [
        'Tạo nội dung bằng AI dựa trên hồ sơ thương hiệu và chiến lược của bạn.',
        'Đăng bài theo lịch lên đúng Trang/tài khoản mà bạn chọn khi lên lịch. AIMA không đăng lên trang cá nhân và không đăng khi bạn chưa lên lịch.',
        'Thu thập số liệu của các bài AIMA đã đăng để hiển thị báo cáo và gợi ý tối ưu chiến lược.',
        'Gửi thông báo trong ứng dụng/email về kết quả đăng bài, token hết hạn, bảo mật tài khoản.',
      ],
      paragraphs: ['Chúng tôi không dùng dữ liệu Meta cho quảng cáo, không lập hồ sơ người dùng khác và không đọc tin nhắn.'],
    },
    {
      heading: '4. Bảo vệ dữ liệu',
      bullets: [
        'Access token của Meta được mã hoá AES-256-GCM trước khi lưu vào cơ sở dữ liệu và chỉ được giải mã phía máy chủ khi gọi API của Meta.',
        'Token không bao giờ được gửi về trình duyệt và được che (mask) trong nhật ký hệ thống.',
        'Kết nối tới Meta dùng HTTPS; phiên đăng nhập AIMA dùng cookie HttpOnly.',
      ],
    },
    {
      heading: '5. Chia sẻ dữ liệu',
      paragraphs: [
        'Chúng tôi không bán, cho thuê hay chia sẻ dữ liệu cá nhân của bạn cho bên thứ ba vì mục đích thương mại. Dữ liệu chỉ được xử lý bởi các nhà cung cấp hạ tầng cần thiết để vận hành dịch vụ:',
      ],
      bullets: [
        'Lưu trữ máy chủ, cơ sở dữ liệu và tệp: Render, Vercel, Supabase, dịch vụ Redis đám mây.',
        'Mô hình AI tạo nội dung: Anthropic và Google — nhận hồ sơ thương hiệu, chiến lược, nội dung và số liệu tổng hợp của bài đăng để tạo/tối ưu nội dung. Access token Meta không bao giờ được gửi tới nhà cung cấp AI.',
        'Gửi email: Brevo. Thanh toán: payOS.',
        'Meta: nội dung bài được gửi tới Meta khi đăng theo lịch bạn đã đặt.',
      ],
    },
    {
      heading: '6. Thời gian lưu trữ',
      bullets: [
        'Dữ liệu kết nối Meta được giữ trong thời gian tài khoản còn liên kết.',
        'Khi bạn ngắt kết nối: AIMA thu hồi quyền phía Meta (với kết nối Facebook gốc), xoá access token khỏi hệ thống và vô hiệu hoá kết nối cùng các Trang/tài khoản con; các bài đã lên lịch trên kết nối đó được chuyển sang "Tạm giữ".',
        'Khi bạn yêu cầu xoá tài khoản AIMA: AIMA dừng đăng bài NGAY — mọi bài đã lên lịch chuyển sang "Tạm giữ" và không được đăng. Tài khoản chờ xoá 30 ngày; nếu khôi phục trong thời gian này, các bài vẫn ở trạng thái Tạm giữ và bạn tự chọn "Kích hoạt lại" trong Lịch đăng.',
        'Hết 30 ngày: tài khoản cùng hồ sơ thương hiệu, nội dung, lịch đăng, kết nối mạng xã hội, số dư token và thông báo bị xoá vĩnh viễn; token Meta được thu hồi.',
        'Đơn thanh toán được giữ lại ở dạng ẨN DANH để phục vụ nghĩa vụ kế toán: chỉ còn số tiền, gói, thời điểm và mã giao dịch của cổng thanh toán — liên kết tới tài khoản của bạn và dữ liệu người chuyển khoản bị xoá. Nhật ký sử dụng AI cũng được giữ ở dạng ẩn danh (không còn gắn với bạn, bỏ địa chỉ IP và thông tin thiết bị) và tự xoá sau tối đa 90–180 ngày.',
        'Nhật ký hoạt động được giữ tối đa 90 ngày và nhật ký lỗi hệ thống tối đa 180 ngày để đảm bảo an ninh.',
      ],
    },
    {
      heading: '7. Quyền của bạn',
      bullets: [
        'Xem, chỉnh sửa thông tin hồ sơ trong trang Hồ sơ.',
        'Ngắt kết nối từng tài khoản trong Cài đặt → Kết nối, hoặc gỡ AIMA tại Facebook → Cài đặt → Ứng dụng và trang web.',
        'Yêu cầu xoá tài khoản trong trang Hồ sơ, hoặc xoá dữ liệu Meta theo hướng dẫn tại trang Xoá dữ liệu (/data-deletion).',
      ],
    },
    {
      heading: '8. Liên hệ',
      paragraphs: [`Mọi câu hỏi về quyền riêng tư, vui lòng gửi email tới ${LEGAL_CONTACT_EMAIL}. Khi chính sách thay đổi, chúng tôi cập nhật ngày hiệu lực ở đầu trang.`],
    },
  ],
};

const privacyEn: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    'AIMA – AI Marketing Assistant ("AIMA", "we") helps you create marketing content with AI and publish it on a schedule to the Facebook Pages, Instagram Business accounts and Threads accounts you connect. This policy explains what data we collect, why we use it, how we protect it and your rights.',
  sections: [
    {
      heading: '1. Data you provide directly',
      bullets: [
        'Account details: email, full name, phone number, date of birth, avatar and password (stored only as a BCrypt hash, never in plain text). If you sign in with Google, we receive your email, name and profile picture from Google.',
        'Brand profiles, content strategies and the content you create or edit in AIMA.',
        'Subscription details and payment history (payments are processed by the payOS gateway; AIMA does not store card or bank account details).',
      ],
    },
    {
      heading: '2. Data received from Meta when you connect an account',
      paragraphs: ['Only when you click connect and approve Meta\'s dialog do we receive:'],
      bullets: [
        'Facebook account: app-scoped account ID, display name and profile picture.',
        'The Facebook Pages you manage and grant access to: Page ID, Page name and Page access token.',
        'The Instagram Business account linked to a Page (if any): ID, username, name and profile picture.',
        'Threads account (if connected): ID, username, name and profile picture.',
        'Your user access token, its issue/expiry time and the list of permissions you actually granted.',
        'For posts AIMA publishes: the platform post ID and engagement metrics (likes, comments, shares, views/impressions when permitted), plus notices when a platform removes a post.',
      ],
    },
    {
      heading: '3. How we use it',
      bullets: [
        'Generate content with AI based on your brand profile and strategy.',
        'Publish on schedule to the exact Page/account you pick when scheduling. AIMA never posts to personal timelines and never posts anything you have not scheduled.',
        'Collect metrics for posts AIMA published to show reports and suggest strategy improvements.',
        'Send in-app/email notifications about publishing results, expiring tokens and account security.',
      ],
      paragraphs: ['We do not use Meta data for advertising, do not profile other users and do not read messages.'],
    },
    {
      heading: '4. How we protect it',
      bullets: [
        'Meta access tokens are encrypted with AES-256-GCM before being stored and are decrypted only on our servers when calling Meta APIs.',
        'Tokens are never sent to the browser and are masked in system logs.',
        'Connections to Meta use HTTPS; AIMA sessions use HttpOnly cookies.',
      ],
    },
    {
      heading: '5. Sharing',
      paragraphs: [
        'We do not sell, rent or share your personal data with third parties for commercial purposes. Data is processed only by the infrastructure providers needed to run the service:',
      ],
      bullets: [
        'Hosting, database and file storage: Render, Vercel, Supabase and a cloud Redis service.',
        'AI models for content generation: Anthropic and Google — they receive brand profiles, strategies, content and aggregated post metrics to generate/optimize content. Meta access tokens are never sent to AI providers.',
        'Email delivery: Brevo. Payments: payOS.',
        'Meta: post content is sent to Meta when publishing on the schedule you set.',
      ],
    },
    {
      heading: '6. Retention',
      bullets: [
        'Meta connection data is kept while the account stays connected.',
        'When you disconnect: AIMA revokes access on Meta (for the root Facebook connection), deletes the access token from our systems and deactivates the connection with its child Pages/accounts; scheduled posts on that connection are put "On hold".',
        'When you request deletion of your AIMA account: AIMA stops publishing IMMEDIATELY — every scheduled post is put "On hold" and will not be published. The account stays pending deletion for 30 days; if you restore it within that time, the posts remain On hold and you choose "Reactivate" in the Calendar yourself.',
        'After 30 days: the account and its brand profiles, content, schedules, social connections, token balance and notifications are permanently deleted; Meta tokens are revoked.',
        'Payment orders are kept in ANONYMIZED form to meet accounting obligations: only the amount, plan, timestamps and the payment gateway transaction code remain — the link to your account and the bank details of the payer are removed. AI usage logs are also kept anonymized (no longer linked to you, IP address and device details removed) and are deleted automatically after at most 90–180 days.',
        'Activity logs are kept up to 90 days and system error logs up to 180 days for security.',
      ],
    },
    {
      heading: '7. Your rights',
      bullets: [
        'View and edit your profile on the Profile page.',
        'Disconnect any account in Settings → Connections, or remove AIMA in Facebook → Settings → Apps and Websites.',
        'Request account deletion on the Profile page, or delete Meta data as described on the Data Deletion page (/data-deletion).',
      ],
    },
    {
      heading: '8. Contact',
      paragraphs: [`For any privacy question, email ${LEGAL_CONTACT_EMAIL}. When this policy changes, we update the effective date at the top of the page.`],
    },
  ],
};

const termsVi: LegalDoc = {
  title: 'Điều khoản sử dụng',
  intro:
    'Bằng việc tạo tài khoản hoặc sử dụng AIMA – AI Marketing Assistant, bạn đồng ý với các điều khoản dưới đây. Vui lòng đọc kỹ trước khi sử dụng.',
  sections: [
    {
      heading: '1. Dịch vụ',
      paragraphs: [
        'AIMA cung cấp công cụ nghiên cứu xu hướng, tạo nội dung bằng AI, định dạng theo nền tảng, lên lịch và tự động đăng bài lên Trang Facebook, Instagram Business và Threads mà bạn liên kết, kèm báo cáo hiệu quả. AI chỉ tạo văn bản và mô tả gợi ý cho hình ảnh/video; AIMA không tự tạo ảnh/video.',
      ],
    },
    {
      heading: '2. Tài khoản',
      bullets: [
        'Bạn cần cung cấp thông tin chính xác và tự bảo mật mật khẩu của mình.',
        'Bạn chịu trách nhiệm với mọi hoạt động diễn ra trên tài khoản.',
        'Chúng tôi có thể khoá tài khoản vi phạm điều khoản hoặc gây rủi ro cho hệ thống.',
      ],
    },
    {
      heading: '3. Kết nối mạng xã hội',
      bullets: [
        'Bạn chỉ được liên kết các Trang/tài khoản mà bạn có quyền quản lý.',
        'Khi liên kết, bạn cho phép AIMA đăng nội dung bạn đã lên lịch lên Trang/tài khoản bạn chọn, và đọc số liệu của các bài đó.',
        'Bạn có thể ngắt kết nối bất kỳ lúc nào trong Cài đặt → Kết nối hoặc trong phần cài đặt ứng dụng của Facebook.',
      ],
    },
    {
      heading: '4. Nội dung',
      bullets: [
        'Bạn sở hữu nội dung của mình và chịu trách nhiệm xem xét, chỉnh sửa nội dung do AI tạo trước khi lên lịch đăng.',
        'Nội dung phải tuân thủ pháp luật và Tiêu chuẩn cộng đồng/chính sách của Meta. AIMA không kiểm duyệt nội dung trước; nếu nền tảng từ chối hoặc gỡ bài, AIMA dừng đăng lại bài đó và thông báo cho bạn.',
        'Không dùng AIMA để gửi spam, nội dung lừa đảo, xâm phạm quyền của người khác hay vượt giới hạn của nền tảng.',
      ],
    },
    {
      heading: '5. Gói dịch vụ và thanh toán',
      paragraphs: [
        'Một số tính năng và hạn mức sử dụng AI phụ thuộc gói dịch vụ. Thanh toán được thực hiện qua cổng payOS; gói có hiệu lực theo chu kỳ bạn đã chọn tại thời điểm mua. Mọi thắc mắc về thanh toán vui lòng liên hệ email bên dưới.',
      ],
    },
    {
      heading: '6. Giới hạn trách nhiệm',
      bullets: [
        'Dịch vụ phụ thuộc API của các nền tảng bên thứ ba (Meta). Chúng tôi không chịu trách nhiệm khi nền tảng thay đổi chính sách, giới hạn tần suất, từ chối hoặc gỡ bài.',
        'Nội dung do AI tạo có thể chưa chính xác; bạn là người quyết định cuối cùng trước khi đăng.',
        'Dịch vụ được cung cấp "như hiện có"; chúng tôi nỗ lực duy trì ổn định nhưng không bảo đảm không gián đoạn.',
      ],
    },
    {
      heading: '7. Chấm dứt',
      paragraphs: [
        'Bạn có thể yêu cầu xoá tài khoản bất kỳ lúc nào trong trang Hồ sơ. Kể từ lúc yêu cầu, AIMA ngừng đăng bài và các bài đã lên lịch được tạm giữ. Tài khoản chờ xoá 30 ngày và có thể khôi phục trong thời gian này (bạn tự kích hoạt lại các bài tạm giữ), sau đó dữ liệu bị xoá vĩnh viễn như mô tả trong Chính sách bảo mật.',
      ],
    },
    {
      heading: '8. Thay đổi và liên hệ',
      paragraphs: [`Chúng tôi có thể cập nhật điều khoản và sẽ ghi ngày hiệu lực mới ở đầu trang. Liên hệ: ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

const termsEn: LegalDoc = {
  title: 'Terms of Service',
  intro:
    'By creating an account or using AIMA – AI Marketing Assistant, you agree to the terms below. Please read them carefully before using the service.',
  sections: [
    {
      heading: '1. The service',
      paragraphs: [
        'AIMA provides trend research, AI content generation, per-platform formatting, scheduling and automatic publishing to the Facebook Pages, Instagram Business accounts and Threads accounts you connect, plus performance reports. AI produces text and suggested descriptions for images/videos only; AIMA does not generate images or videos.',
      ],
    },
    {
      heading: '2. Your account',
      bullets: [
        'Provide accurate information and keep your password secure.',
        'You are responsible for all activity on your account.',
        'We may suspend accounts that violate these terms or put the system at risk.',
      ],
    },
    {
      heading: '3. Social connections',
      bullets: [
        'Only connect Pages/accounts you are authorized to manage.',
        'By connecting, you allow AIMA to publish the content you schedule to the Page/account you choose and to read metrics for those posts.',
        'You can disconnect at any time in Settings → Connections or in Facebook\'s app settings.',
      ],
    },
    {
      heading: '4. Content',
      bullets: [
        'You own your content and are responsible for reviewing and editing AI-generated content before scheduling it.',
        'Content must comply with the law and Meta\'s Community Standards/policies. AIMA does not pre-screen content; if a platform rejects or removes a post, AIMA stops retrying that post and notifies you.',
        'Do not use AIMA for spam, deceptive content, infringing others\' rights or exceeding platform limits.',
      ],
    },
    {
      heading: '5. Plans and payments',
      paragraphs: [
        'Some features and AI usage quotas depend on your plan. Payments are made through the payOS gateway; a plan is valid for the billing period chosen at purchase. For payment questions, contact the email below.',
      ],
    },
    {
      heading: '6. Limitation of liability',
      bullets: [
        'The service relies on third-party platform APIs (Meta). We are not responsible when a platform changes its policies, rate limits, rejects or removes posts.',
        'AI-generated content may be inaccurate; you make the final decision before publishing.',
        'The service is provided "as is"; we work to keep it stable but do not guarantee uninterrupted operation.',
      ],
    },
    {
      heading: '7. Termination',
      paragraphs: [
        'You can request account deletion at any time on the Profile page. From that moment AIMA stops publishing and scheduled posts are put on hold. The account stays pending deletion for 30 days and can be restored during that time (you reactivate the held posts yourself); afterwards the data is permanently deleted as described in the Privacy Policy.',
      ],
    },
    {
      heading: '8. Changes and contact',
      paragraphs: [`We may update these terms and will show the new effective date at the top of the page. Contact: ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

const dataDeletionVi: LegalDoc = {
  title: 'Hướng dẫn xoá dữ liệu',
  intro:
    'Bạn có thể xoá dữ liệu mà AIMA nhận từ Meta (Facebook, Instagram, Threads) hoặc xoá toàn bộ tài khoản AIMA bằng một trong các cách dưới đây.',
  sections: [
    {
      heading: 'Cách 1 — Gỡ AIMA khỏi Facebook',
      bullets: [
        'Mở Facebook → Cài đặt và quyền riêng tư → Cài đặt → Ứng dụng và trang web.',
        'Chọn ứng dụng AIMA → Gỡ bỏ, rồi bấm "Gửi yêu cầu xoá dữ liệu" (nếu có).',
        'Meta gửi yêu cầu tới AIMA; chúng tôi xoá access token, vô hiệu hoá các kết nối Facebook/Trang/Instagram liên quan và tạm giữ các bài đã lên lịch. Bạn nhận một mã xác nhận để tra cứu trạng thái tại trang này.',
      ],
    },
    {
      heading: 'Cách 2 — Ngắt kết nối trong AIMA',
      bullets: [
        'Đăng nhập AIMA → Cài đặt → Kết nối → chọn tài khoản → Ngắt kết nối.',
        'AIMA thu hồi quyền phía Meta, xoá access token và vô hiệu hoá kết nối cùng các Trang/tài khoản con.',
      ],
    },
    {
      heading: 'Cách 3 — Xoá tài khoản AIMA',
      bullets: [
        'Đăng nhập AIMA → Hồ sơ → Xoá tài khoản.',
        'AIMA dừng đăng bài ngay: các bài đã lên lịch chuyển sang Tạm giữ.',
        'Tài khoản chờ xoá 30 ngày (có thể khôi phục), sau đó toàn bộ dữ liệu tài khoản, nội dung, lịch đăng và kết nối mạng xã hội bị xoá vĩnh viễn; token Meta được thu hồi. Đơn thanh toán chỉ được giữ ở dạng ẩn danh cho mục đích kế toán.',
      ],
    },
    {
      heading: 'Cần hỗ trợ?',
      paragraphs: [`Nếu không thể đăng nhập hoặc cần xoá dữ liệu theo cách khác, hãy gửi email tới ${LEGAL_CONTACT_EMAIL} từ địa chỉ email đã đăng ký. Chúng tôi phản hồi trong vòng 30 ngày.`],
    },
  ],
};

const dataDeletionEn: LegalDoc = {
  title: 'Data Deletion Instructions',
  intro:
    'You can delete the data AIMA receives from Meta (Facebook, Instagram, Threads) or delete your whole AIMA account in any of the ways below.',
  sections: [
    {
      heading: 'Option 1 — Remove AIMA from Facebook',
      bullets: [
        'Open Facebook → Settings & privacy → Settings → Apps and Websites.',
        'Select the AIMA app → Remove, then click "Send data deletion request" (if shown).',
        'Meta sends the request to AIMA; we delete the access token, deactivate the related Facebook/Page/Instagram connections and put scheduled posts on hold. You receive a confirmation code to check the status on this page.',
      ],
    },
    {
      heading: 'Option 2 — Disconnect inside AIMA',
      bullets: [
        'Sign in to AIMA → Settings → Connections → pick the account → Disconnect.',
        'AIMA revokes access on Meta, deletes the access token and deactivates the connection with its child Pages/accounts.',
      ],
    },
    {
      heading: 'Option 3 — Delete your AIMA account',
      bullets: [
        'Sign in to AIMA → Profile → Delete account.',
        'AIMA stops publishing immediately: scheduled posts are put on hold.',
        'The account stays pending deletion for 30 days (restorable), then all account data, content, schedules and social connections are permanently deleted; Meta tokens are revoked. Payment orders are kept only in anonymized form for accounting.',
      ],
    },
    {
      heading: 'Need help?',
      paragraphs: [`If you cannot sign in or need another way to delete your data, email ${LEGAL_CONTACT_EMAIL} from your registered email address. We respond within 30 days.`],
    },
  ],
};

const DOCS: Record<LegalDocKey, Record<Lang, LegalDoc>> = {
  privacy: { vi: privacyVi, en: privacyEn },
  terms: { vi: termsVi, en: termsEn },
  dataDeletion: { vi: dataDeletionVi, en: dataDeletionEn },
};

export function getLegalDoc(key: LegalDocKey, lang: Lang): LegalDoc {
  return DOCS[key][lang];
}
