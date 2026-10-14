package com.aima.config;

import com.aima.service.Impl.RealtimeMessageListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * Realtime SSE: mọi instance subscribe MỘT kênh Redis ({@code aima.realtime.channel}). Lettuce tự nối lại và
 * subscribe lại khi kết nối idle bị cắt (Upstash). {@code aima.realtime.bus=local} (test) thì không subscribe.
 */
@Configuration
@EnableConfigurationProperties(RealtimeProperties.class)
public class RealtimeConfig {

    @Bean
    @ConditionalOnProperty(name = "aima.realtime.bus", havingValue = "redis", matchIfMissing = true)
    public RedisMessageListenerContainer realtimeListenerContainer(RedisConnectionFactory connectionFactory,
                                                                   RealtimeMessageListener listener,
                                                                   RealtimeProperties properties) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listener, new ChannelTopic(properties.channel()));
        return container;
    }
}
