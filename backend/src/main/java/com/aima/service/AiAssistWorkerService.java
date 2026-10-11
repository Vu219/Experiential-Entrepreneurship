package com.aima.service;

import java.util.UUID;

/** Worker nền cho {@code ai_assist_jobs} (rule #28): gọi AI ngoài transaction, mỗi lần ghi DB một transaction ngắn. */
public interface AiAssistWorkerService {

    void process(UUID jobId);
}
