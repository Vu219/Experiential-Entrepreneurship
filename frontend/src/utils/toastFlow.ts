import { globalToast } from "../components/toast/ToastProvider";

export interface ToastMessages {
  loading: string;
  success: string | ((data: any) => string);
  error?: string | ((err: any) => string);
  title?: string; // Optional custom title for success/error
}

export const withToast = async <T,>(
  promise: Promise<T>,
  messages: ToastMessages
): Promise<T> => {
  // Require ToastProvider to be mounted
  if (!globalToast) {
    return promise;
  }

  const id = globalToast.loading(messages.loading, { title: messages.title || "Đang xử lý..." });
  try {
    const res = await promise;
    const successMsg = typeof messages.success === 'function' ? messages.success(res) : messages.success;
    globalToast.success(successMsg, { id, title: messages.title || "Thành công" });
    return res;
  } catch (err) {
    let errorMsg = (err as Error).message;
    if (messages.error) {
      errorMsg = typeof messages.error === 'function' ? messages.error(err) : messages.error;
    }
    globalToast.error(errorMsg, { id, title: messages.title || "Lỗi" });
    throw err;
  }
};
