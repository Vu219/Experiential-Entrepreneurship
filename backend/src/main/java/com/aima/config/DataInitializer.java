package com.aima.config;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.UserStatus;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;

@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(2)
public class DataInitializer implements CommandLineRunner {

    UserRepository userRepository;
    RoleRepository roleRepository;
    PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        log.info("Initializing sample data...");

        // 1. Initialize Roles
        Role adminRole = initRole("ADMIN", "System Administrator Role");
        Role userRole = initRole("USER", "Standard Application User Role");

        // 2. Initialize Admin User
        initAdminUser(adminRole);

        // 3. Backfill profile_completed for rows created before the column existed.
        backfillProfileCompleted();

        log.info("Data initialization completed.");
    }

    private void backfillProfileCompleted() {
        var pending = userRepository.findAll().stream()
                .filter(u -> u.getProfileCompleted() == null)
                .toList();
        if (pending.isEmpty()) return;

        pending.forEach(u -> {
            boolean isGoogle = "GOOGLE".equalsIgnoreCase(u.getProvider());
            boolean completed = !isGoogle || u.getLastPasswordChangeAt() != null;
            u.setProfileCompleted(completed);
        });
        userRepository.saveAll(pending);
        log.info("Backfilled profile_completed for {} existing user(s).", pending.size());
    }

    private Role initRole(String roleName, String description) {
        return roleRepository.findByRoleName(roleName)
                .orElseGet(() -> {
                    Role newRole = Role.builder()
                            .roleName(roleName)
                            .description(description)
                            .build();
                    log.info("Created role: {}", roleName);
                    return roleRepository.save(newRole);
                });
    }

    private void initAdminUser(Role adminRole) {
        String adminEmail = "admin@gmail.com";
        if (!userRepository.existsByEmail(adminEmail)) {
            User adminUser = User.builder()
                    .email(adminEmail)
                    .username("admin")
                    .password(passwordEncoder.encode("Admin123"))
                    .fullName("System Administrator")
                    .phone("0123456789")
                    .status(UserStatus.ACTIVE)
                    .profileCompleted(true)
                    .role(adminRole)
                    .build();
            userRepository.save(adminUser);
            log.info("Created sample admin user: {}", adminEmail);
        }
    }
}
