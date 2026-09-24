# WeatherAI — AI Weather Intelligence

Ứng dụng dự báo thời tiết bằng React + Vite, backend Node.js, Open-Meteo và Leaflet. Giao diện tiếng Việt, responsive, dark/light mode.

## Chạy dự án

Yêu cầu Node.js 24+.

```sh
npm install
npm run dev
```

Mở http://localhost:5173. Backend và frontend dùng cùng một địa chỉ.

```sh
npm run build
npm start
npm test
```

## Kết nối AI và PostgreSQL

Sao chép `.env.example` thành `.env` và điền `OPENAI_API_KEY` để bật Ask the Sky và bản tin AI tự động. Khóa chỉ dùng trên server, không gửi tới trình duyệt. `OPENAI_MODEL` cho phép chọn model Responses API. Sau khi đổi `.env`, khởi động lại server.

`DATABASE_URL` là tùy chọn PostgreSQL (có thể dùng Supabase PostgreSQL). Khi chạy local mà chưa cấu hình, ứng dụng lưu sở thích bằng SQLite tại `.data/weather.sqlite`. Trên Vercel, filesystem không phải nơi lưu dữ liệu bền vững; nếu chưa có `DATABASE_URL`, server dùng bộ nhớ tạm cho từng instance. Hãy cấu hình PostgreSQL nếu muốn giữ sở thích lâu dài. Người dùng được phân biệt bằng cookie phiên HttpOnly, không phải hệ thống tài khoản. Lịch trình lưu tại trình duyệt. `COOKIE_SECURE=true` khi triển khai HTTPS.

## Triển khai lên Vercel

Vercel hiện hỗ trợ Node server root-level. Vì vậy API và frontend được deploy trong cùng một project, còn frontend gọi API cùng origin bằng các URL `/api/...` (không cần cấu hình URL API riêng).

`vercel.json` đã cấu hình:

- Framework: `node` để Vercel nhận `server.ts` làm entrypoint.
- Build command: `npm run build` để tạo `dist/`.
- `dist/**` được đưa vào bundle của function để `server.ts` có thể phục vụ frontend trong production.

Không cần tạo thư mục `api/` riêng: root `server.ts` đã nhận toàn bộ request, gồm `/api/status`, `/api/weather`, `/api/chat` và các endpoint khác.

Trong Vercel Dashboard, đặt các biến môi trường cho cả Production và Preview:

- `OPENAI_API_KEY` (bắt buộc nếu muốn bật chat AI).
- `OPENAI_MODEL` (tùy chọn, mặc định `gpt-4.1-mini`).
- `DATABASE_URL` (khuyến nghị nếu cần lưu sở thích lâu dài).

Sau khi đẩy code lên Git, import repository vào Vercel hoặc chạy `npx vercel --prod`; **Root Directory** phải là thư mục chứa `package.json` và `vercel.json`. Kiểm tra nhanh bằng `/api/status`; response phải là JSON với `ai` và `database`. Nếu project cũ đang cấu hình framework là Vite/Other, hãy đổi sang **Node** rồi redeploy.

## Tính năng

- Thời tiết thực theo tọa độ, cảm nhận, độ ẩm, mưa, gió, áp suất, tầm nhìn, UV và US AQI khi có.
- Timeline 24 giờ với biểu đồ nhiệt/mưa và chi tiết từng giờ, dự báo 7 ngày, bình minh/hoàng hôn.
- Vị trí thiết bị theo yêu cầu; tìm kiếm thành phố; chọn tọa độ trên bản đồ; reverse geocoding. Hà Nội mặc định được ghi rõ, không giả định là vị trí người dùng.
- Bản đồ với 7 chỉ số, 9 điểm dự báo quanh vị trí chọn. Đây là các điểm dữ liệu thực, không phải ảnh radar hay bề mặt nội suy.
- 10 điểm hoạt động xác định từ dữ liệu và giải thích từng yếu tố. Không dùng số ngẫu nhiên. Điều kiện giông/mưa lớn/gió nguy hiểm giới hạn điểm ở 15/100.
- Lịch trình đối chiếu dự báo đúng ngày/giờ, gợi ý khung giờ; không tự đổi lịch.
- So sánh 2 ngày và 4 thành phố, cảnh báo theo ngưỡng, sở thích cá nhân trong database.
- Chat AI dựng WeatherContext trên server trước mỗi câu hỏi; không tin dữ liệu thời tiết từ client. Bản tin tự động dùng AI khi có khóa; thiếu khóa thì ghi rõ là tổng hợp theo quy tắc.

## Kiến trúc và dữ liệu

- `server/weather.js`: WeatherProvider, OpenMeteoProvider, geocoding, normalization, cache theo lat/lon (5 phút), cache lớp bản đồ (10 phút).
- `server/index.js`: tạo/export native HTTP server, API, cookie, giới hạn chat, tạo WeatherContext và gọi Responses API.
- `server.ts`: root Node server entrypoint được Vercel nhận diện; `server.listen()` là điểm Vercel dùng để capture server.
- `vercel.json`: chọn framework Node, chạy Vite build và đưa `dist/` vào function bundle.
- `server/preferences.js`: PostgreSQL/SQLite local preferences và memory fallback cho Vercel.
- `shared/weather.js`: điểm hoạt động, cảnh báo, khung giờ, xử lý dữ liệu thiếu.
- `src/`: dashboard và các màn hình.
- `tests/weather.test.js`: kiểm tra tọa độ, cache, dữ liệu thiếu, điểm hoạt động, thời gian và cảnh báo.

API: `GET /api/weather?lat=&lon=`, `GET /api/map-weather?lat=&lon=`, `GET /api/geocode?q=`, `GET/POST /api/preferences`, `GET /api/status`, `POST /api/chat`.

Tất cả giá trị nội bộ dùng °C, km/h, mm, mét và US AQI. Chuyển °F chỉ ở trình bày. Dữ liệu theo timezone của vị trí, tọa độ người dùng được giữ riêng với tọa độ ô lưới của provider. Độ chính xác GPS không phải độ phân giải dự báo. Dấu `—` nghĩa là chưa có dữ liệu; AQI thất bại không làm mất toàn bộ dự báo.

## Giới hạn hiện tại

- Chưa có khóa API trong dự án: không thể thực hiện/kiểm thử câu trả lời AI thực cho đến khi cấu hình.
- Cảnh báo là phân tích ngưỡng, không phải cảnh báo chính thức. Điểm hoạt động là heuristic, không phải xác suất an toàn hay độ tin cậy mô hình.
- Tìm kiếm Open-Meteo chủ yếu theo thành phố; địa chỉ chi tiết nên chọn bằng bản đồ/GPS. Reverse geocoding thiếu trường nào thì giữ null/không có.
- Bản đồ lấy mẫu 9 điểm, chưa có radar liên tục hoặc hoạt ảnh hạt gió. Dữ liệu gió không được tự suy diễn giữa các điểm.
- Chưa có đăng nhập/đồng bộ lịch giữa thiết bị. `npm run dev` chạy native server + Vite middleware; Vercel dùng root `server.ts` và phục vụ frontend từ `dist/`.
- Open-Meteo free API phù hợp thử nghiệm phi thương mại; triển khai thương mại cần xem điều khoản provider. Trên Vercel cần cấu hình `DATABASE_URL` nếu muốn lưu sở thích lâu dài.

Tài liệu nguồn: [Open-Meteo](https://open-meteo.com/en/docs), [OpenAI Responses API](https://developers.openai.com/api/docs/quickstart), [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).
