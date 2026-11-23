package com.cit.vetclinic.service;

import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.repository.ClinicUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class LoginAttemptService {
    private final ClinicUserRepository users;

    public LoginAttemptService(ClinicUserRepository users) {
        this.users = users;
    }

    @Transactional
    public void recordFailure(String email) {
        users.lockByEmail(email).ifPresent(user -> {
            user.recordFailedLogin(LocalDateTime.now());
            users.save(user);
        });
    }

    @Transactional
    public void reset(String email) {
        users.lockByEmail(email).ifPresent(user -> {
            user.resetFailedLogins();
            users.save(user);
        });
    }
}
