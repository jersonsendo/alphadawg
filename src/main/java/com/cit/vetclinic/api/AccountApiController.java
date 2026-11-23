package com.cit.vetclinic.api;

import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.repository.ClinicUserRepository;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api")
public class AccountApiController {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final ClinicUserRepository users;
    private final PasswordEncoder passwordEncoder;

    public AccountApiController(ClinicUserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @PutMapping("/account/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void changePassword(@Valid @RequestBody PasswordChangeRequest request, Authentication authentication) {
        ClinicUser user = (ClinicUser) authentication.getPrincipal();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");
        }
        ensureBcryptLength(request.newPassword());
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a new password different from your current password.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangeRequired(false);
        users.save(user);
    }

    @GetMapping("/staff")
    @PreAuthorize("hasRole('ADMIN')")
    public List<StaffResponse> staff() {
        return users.findAllByOrderByCreatedAtAsc().stream().map(StaffResponse::from).toList();
    }

    @PostMapping("/staff")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    public StaffCreationResponse createStaff(@Valid @RequestBody StaffCreateRequest request,
                                             HttpServletResponse response) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists.");
        }
        String temporaryPassword = generateTemporaryPassword();
        ClinicUser staff = new ClinicUser(email, request.displayName().trim(),
                passwordEncoder.encode(temporaryPassword));
        staff.setRole(ClinicUser.Role.STAFF);
        staff.setPasswordChangeRequired(true);
        response.setHeader("Cache-Control", "no-store");
        return new StaffCreationResponse(StaffResponse.from(users.save(staff)), temporaryPassword);
    }

    @PostMapping("/staff/{id}/password-reset")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public TemporaryPasswordResponse resetStaffPassword(@PathVariable Long id,
                                                         Authentication authentication,
                                                         HttpServletResponse response) {
        ClinicUser target = users.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff account not found."));
        ClinicUser current = (ClinicUser) authentication.getPrincipal();
        if (target.getId().equals(current.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Ask another administrator to reset your password.");
        }
        String temporaryPassword = generateTemporaryPassword();
        target.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        target.setPasswordChangeRequired(true);
        target.resetFailedLogins();
        users.save(target);
        response.setHeader("Cache-Control", "no-store");
        return new TemporaryPasswordResponse(temporaryPassword);
    }

    @PutMapping("/staff/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public StaffResponse updateStaff(@PathVariable Long id, @Valid @RequestBody StaffUpdateRequest request,
                                     Authentication authentication) {
        ClinicUser target = users.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff account not found."));
        ClinicUser current = (ClinicUser) authentication.getPrincipal();
        boolean removingAdmin = target.getRole() == ClinicUser.Role.ADMIN
                && (request.role() != ClinicUser.Role.ADMIN || !request.active());
        if (removingAdmin && users.findAllByOrderByCreatedAtAsc().stream()
                .filter(ClinicUser::isActive)
                .filter(user -> user.getRole() == ClinicUser.Role.ADMIN)
                .count() <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The clinic must have at least one active admin.");
        }
        if (target.getId().equals(current.getId()) && !request.active()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot deactivate your own account.");
        }
        if (target.getId().equals(current.getId()) && request.role() != ClinicUser.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You cannot change your own administrator role.");
        }
        target.setRole(request.role());
        target.setActive(request.active());
        return StaffResponse.from(users.save(target));
    }

    private static void ensureBcryptLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password must be at most 72 UTF-8 bytes.");
        }
    }

    private static String generateTemporaryPassword() {
        byte[] passwordBytes = new byte[18];
        SECURE_RANDOM.nextBytes(passwordBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(passwordBytes);
    }

    public record PasswordChangeRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 72) String newPassword) {}

    public record StaffUpdateRequest(@NotNull ClinicUser.Role role, boolean active) {}

    public record StaffCreateRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 100) String displayName) {}

    public record TemporaryPasswordResponse(String temporaryPassword) {}

    public record StaffCreationResponse(StaffResponse staff, String temporaryPassword) {}

    public record StaffResponse(Long id, String email, String displayName, String role,
                                boolean active, java.time.LocalDateTime createdAt) {
        static StaffResponse from(ClinicUser user) {
            return new StaffResponse(user.getId(), user.getEmail(), user.getDisplayName(),
                    user.getRole().name(), user.isActive(), user.getCreatedAt());
        }
    }
}
