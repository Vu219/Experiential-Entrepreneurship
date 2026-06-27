package com.aima.enums;

/**
 * - MANUAL_UPDATE: admin đổi version thủ công.
 * - AUTO_DETECTED: job tự phát hiện version mới.
 * - ROLLBACK: quay lại version cũ.
 */
public enum VersionChangeType {
    MANUAL_UPDATE,
    AUTO_DETECTED,
    ROLLBACK
}
