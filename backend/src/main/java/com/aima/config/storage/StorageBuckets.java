package com.aima.config.storage;

public final class StorageBuckets {

    private StorageBuckets() {
    }

    public static final String AVATARS = "avatars";
    public static final String DOCUMENTS = "documents";
    public static final String AVATAR_PUBLIC_PREFIX = "/object/public/" + AVATARS + "/";
}
