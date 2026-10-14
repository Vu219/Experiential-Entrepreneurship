package org.springframework.web.servlet.mvc.method.annotation;

import org.springframework.http.MediaType;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * CHỈ cho test: gắn handler giả vào {@link ResponseBodyEmitter} (API {@code initialize} là package-private) để đọc
 * những gì một {@link SseEmitter} đã ghi, và mô phỏng client ngắt kết nối ({@link #failNextWrite}).
 */
public final class EmitterCapture implements ResponseBodyEmitter.Handler {

    private final List<String> chunks = new CopyOnWriteArrayList<>();
    private volatile boolean completed;
    private volatile boolean failNextWrite;
    private volatile Runnable completionCallback;

    public static EmitterCapture attach(ResponseBodyEmitter emitter) throws IOException {
        EmitterCapture capture = new EmitterCapture();
        emitter.initialize(capture);
        return capture;
    }

    public String text() {
        return String.join("", chunks);
    }

    public boolean completed() {
        return completed;
    }

    public void failNextWrite() {
        failNextWrite = true;
    }

    @Override
    public void send(Object data, MediaType mediaType) throws IOException {
        if (failNextWrite) throw new IOException("Broken pipe (simulated)");
        chunks.add(String.valueOf(data));
    }

    @Override
    public void send(Set<ResponseBodyEmitter.DataWithMediaType> items) throws IOException {
        for (ResponseBodyEmitter.DataWithMediaType item : items) send(item.getData(), item.getMediaType());
    }

    @Override
    public void complete() {
        completed = true;
        Runnable callback = completionCallback;
        if (callback != null) callback.run(); // container gọi onCompletion khi async request kết thúc
    }

    @Override
    public void completeWithError(Throwable failure) {
        complete();
    }

    @Override
    public void onTimeout(Runnable callback) {
    }

    @Override
    public void onError(Consumer<Throwable> callback) {
    }

    @Override
    public void onCompletion(Runnable callback) {
        completionCallback = callback;
    }
}
