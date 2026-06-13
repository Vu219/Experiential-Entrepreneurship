package com.aima.brand;

/**
 * Allowed posting frequencies (FR-09: frequency must be valid). Any value
 * outside this set is rejected at deserialization with a 400 response.
 */
public enum PostingFrequency {
    DAILY,
    WEEKLY,
    BIWEEKLY,
    MONTHLY
}
