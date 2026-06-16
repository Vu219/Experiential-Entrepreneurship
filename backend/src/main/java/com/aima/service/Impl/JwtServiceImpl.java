package com.aima.service.Impl;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.aima.entity.User;
import com.aima.security.JwtProperties;
import com.aima.service.JwtService;

import java.text.ParseException;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class JwtServiceImpl implements JwtService {
    private final JwtProperties jwtProperties;

    @Override
    public String generateAccessToken(User user) {
        return generateToken(user, jwtProperties.accessTokenExpiration(), "access", null);
    }

    @Override
    public String generateRefreshToken(User user, String jti) {
        return generateToken(user, jwtProperties.refreshTokenExpiration(), "refresh", jti);
    }

    private String generateToken(User user, long expirationSeconds, String type, String jti) {
        try {
            JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

            JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                    .subject(user.getEmail())
                    .issuer("AIMA")
                    .issueTime(new Date())
                    .expirationTime(new Date(
                            Instant.now().plusSeconds(expirationSeconds).toEpochMilli()
                    ))
                    .claim("uid", user.getId())
                    .claim("email", user.getEmail())
                    .claim("typ", type);

            if (jti != null) {
                builder.jwtID(jti);
            } else {
                builder.jwtID(UUID.randomUUID().toString());
            }

            if ("access".equals(type)) {
                builder.claim("scope", "ROLE_" + user.getRole().getRoleName());
                builder.claim("role", "ROLE_" + user.getRole().getRoleName());
            }

            JWTClaimsSet jwtClaimsSet = builder.build();
            Payload payload = new Payload(jwtClaimsSet.toJSONObject());
            JWSObject jwsObject = new JWSObject(header, payload);

            jwsObject.sign(new MACSigner(jwtProperties.signerKey().getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Cannot create token", e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public JWTClaimsSet parseClaims(String token) throws JOSEException, ParseException {
        SignedJWT signedJWT = SignedJWT.parse(token);
        JWSVerifier verifier = new MACVerifier(jwtProperties.signerKey().getBytes());

        if (!signedJWT.verify(verifier)) {
            throw new RuntimeException("Invalid token signature");
        }

        Date expirationTime = signedJWT.getJWTClaimsSet().getExpirationTime();
        if (expirationTime == null || expirationTime.before(new Date())) {
            throw new RuntimeException("Token expired");
        }

        return signedJWT.getJWTClaimsSet();
    }
}
