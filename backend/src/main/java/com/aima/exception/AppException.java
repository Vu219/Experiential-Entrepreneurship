    package com.aima.exception;

    import lombok.NoArgsConstructor;

    @NoArgsConstructor
    public class AppException extends RuntimeException {

        private ErrorCode errorCode;

        // Truyền message của ErrorCode vào super để getMessage() không bao giờ null —
        // log/worker chỉ cần e.getMessage() thay vì tự bóc errorCode ra.
        public AppException(ErrorCode errorCode) {
            super(errorCode == null ? null : errorCode.getMessage());
            this.errorCode = errorCode;
        }

        public ErrorCode getErrorCode() {
            return errorCode;
        }

        public void setErrorCode(ErrorCode errorCode) {
            this.errorCode = errorCode;
        }
    }
