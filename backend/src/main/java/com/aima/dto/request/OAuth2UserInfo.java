package com.aima.dto.request;

import com.aima.enums.UserStatus;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OAuth2UserInfo {
    String username;
    String email;
    String fullName;
    String googleId;
    String provider;
    String avatarUrl;
    UserStatus status;
}
