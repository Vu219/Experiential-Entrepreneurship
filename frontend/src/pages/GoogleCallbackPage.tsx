import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Loader } from "../components/ui";

export default function GoogleCallbackPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const errorMsg = params.get("error");
    if (errorMsg) {
      // Chuyển lỗi OAuth (vd huỷ đăng nhập → access_denied) về trang login để
      // hiển thị thông báo thân thiện, KHÔNG dùng banner "thành công" (notice).
      navigate("/login", { replace: true, state: { oauthError: errorMsg } });
      return;
    }
    // Cookie HttpOnly đã được backend set trong lúc redirect.
    // Gọi /me để lấy danh tính rồi điều hướng theo trạng thái hồ sơ.
    refreshUser().then((me) => {
      if (me) {
        navigate(me.profileCompleted ? "/dashboard" : "/complete-profile", {
          replace: true,
        });
      } else {
        setError("Không lấy được thông tin đăng nhập. Vui lòng thử lại.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 text-center">
      {error ? (
        <div className="space-y-3">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Về trang đăng nhập
          </button>
        </div>
      ) : (
        <Loader label="Đang hoàn tất đăng nhập Google..." />
      )}
    </div>
  );
}
