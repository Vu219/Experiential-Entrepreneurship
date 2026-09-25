package com.aima.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutException;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * WebClient gọi payOS: base URL cố định + header xác thực + <b>timeout tường minh</b>.
 *
 * <p>Khác {@link MetaWebClientConfig}/{@link AiServiceWebClientConfig} ở chỗ ép timeout ở tầng
 * transport. Với thanh toán, một lời gọi treo không chỉ giữ thread mà còn để đơn hàng ở trạng
 * thái không xác định — phải kết thúc bằng {@link ReadTimeoutException} để tầng service phân
 * biệt "cổng từ chối" với "không biết kết quả".</p>
 */
@Configuration
@EnableConfigurationProperties({PayOSProperties.class, PaymentProperties.class})
public class PayOSWebClientConfig {

    /** Header xác thực của payOS — khai một chỗ, dùng lại ở client (rule #23). */
    public static final String HEADER_CLIENT_ID = "x-client-id";
    public static final String HEADER_API_KEY = "x-api-key";

    @Bean(name = "payosWebClient")
    public WebClient payosWebClient(PayOSProperties properties) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS,
                        (int) Duration.ofSeconds(properties.connectTimeoutSeconds()).toMillis())
                .responseTimeout(Duration.ofSeconds(properties.readTimeoutSeconds()));

        // Credential KHÔNG gắn ở đây: bean được tạo cả khi chạy cổng giả lập (lúc đó chúng
        // rỗng). Client tự kiểm và gắn header theo từng request.
        return WebClient.builder()
                .baseUrl(properties.baseUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}
