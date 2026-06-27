package com.aima.enums;

/**
 * Trạng thái version API của một nền tảng (so currentVersion với latestVersion / deprecation date).
 */
public enum VersionStatus {
    UP_TO_DATE,
    UPDATE_AVAILABLE,
    DEPRECATING_SOON,
    DEPRECATED
}
