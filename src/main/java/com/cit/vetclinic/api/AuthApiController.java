package com.cit.vetclinic.api;

import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.model.Owner;
import com.cit.vetclinic.repository.ClinicUserRepository;
import com.cit.vetclinic.repository.OwnerRepository;
import com.cit.vetclinic.service.LoginAttemptService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthApiController {
    private static final Set<ClinicUser.Role> STAFF_ROLES =
            EnumSet.of(ClinicUser.Role.ADMIN, ClinicUser.Role.STAFF);
    private static final Set<ClinicUser.Role> CUSTOMER_ROLES =
            EnumSet.of(ClinicUser.Role.CUSTOMER);

    private final ClinicUserRepository users;
    private final OwnerRepository owners;
    private final LoginAttemptService loginAttempts;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private final SecurityContextLogoutHandler logoutHandler;

    public AuthApiController(ClinicUserRepository users, OwnerRepository owners,
                             PasswordEncoder passwordEncoder,
                             LoginAttemptService loginAttempts,
                             AuthenticationManager authenticationManager,
                             SecurityContextRepository securityContextRepository,
                             SessionAuthenticationStrategy sessionAuthenticationStrategy,
                             SecurityContextLogoutHandler logoutHandler) {
        this.users = users;
        this.owners = owners;
        this.loginAttempts = loginAttempts;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
        this.logoutHandler = logoutHandler;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getToken());
    }

    @GetMapping("/me")
    public AuthResponse currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof ClinicUser user)) {
            boolean staffRegistrationAvailable = users.countByRoleIn(STAFF_ROLES) == 0;
            return new AuthResponse(false, null, null, null, null, false, staffRegistrationAvailable);
        }
        return AuthResponse.from(user);
    }

    @PostMapping("/register")
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public synchronized AuthResponse register(@Valid @RequestBody RegisterRequest request,
                                              HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        if (users.countByRoleIn(STAFF_ROLES) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Public registration is closed. Contact a clinic administrator for an account.");
        }
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists.");
        }
        ensureBcryptLength(request.password());

        ClinicUser user = new ClinicUser(email, request.displayName().trim(),
                passwordEncoder.encode(request.password()));
        user.setRole(ClinicUser.Role.ADMIN);
        user = users.save(user);
        Authentication authentication = authenticate(email, request.password());
        establishSession(authentication, servletRequest, servletResponse);
        return AuthResponse.from(user);
    }

    @PostMapping("/customer/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AuthResponse registerCustomer(@Valid @RequestBody CustomerRegisterRequest request,
                                         HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists.");
        }
        ensureBcryptLength(request.password());

        String displayName = request.displayName().trim();
        String phone = cleanOptional(request.phone());
        String address = cleanOptional(request.address());

        Owner owner = owners.findByEmailIgnoreCase(email).map(existing -> {
            if ((existing.getPhone() == null || existing.getPhone().isBlank()) && phone != null) {
                existing.setPhone(phone);
            }
            if ((existing.getAddress() == null || existing.getAddress().isBlank()) && address != null) {
                existing.setAddress(address);
            }
            return owners.save(existing);
        }).orElseGet(() -> owners.save(new Owner(displayName, email, phone, address)));

        ClinicUser user = new ClinicUser(email, displayName, passwordEncoder.encode(request.password()));
        user.setRole(ClinicUser.Role.CUSTOMER);
        user.setOwner(owner);
        user = users.save(user);

        Authentication authentication = authenticate(email, request.password());
        establishSession(authentication, servletRequest, servletResponse);
        return AuthResponse.from(user);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        return performLogin(request, EnumSet.allOf(ClinicUser.Role.class), null, servletRequest, servletResponse);
    }

    @PostMapping("/staff/login")
    public AuthResponse staffLogin(@Valid @RequestBody LoginRequest request,
                                   HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        return performLogin(
                request,
                STAFF_ROLES,
                "This account belongs to the Customer / Pet Owner portal. Please use Customer Login.",
                servletRequest,
                servletResponse);
    }

    @PostMapping("/customer/login")
    public AuthResponse customerLogin(@Valid @RequestBody LoginRequest request,
                                      HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        return performLogin(
                request,
                CUSTOMER_ROLES,
                "This account belongs to the Clinic Staff / Admin portal. Please use Staff Login.",
                servletRequest,
                servletResponse);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        logoutHandler.logout(request, response, authentication);
    }

    private AuthResponse performLogin(LoginRequest request,
                                      Set<ClinicUser.Role> allowedRoles,
                                      String wrongPortalMessage,
                                      HttpServletRequest servletRequest,
                                      HttpServletResponse servletResponse) {
        String email = normalizeEmail(request.email());
        Authentication authentication;
        try {
            authentication = authenticate(email, request.password());
        } catch (DisabledException exception) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This account is inactive. Contact a clinic administrator.");
        } catch (LockedException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        } catch (BadCredentialsException exception) {
            loginAttempts.recordFailure(email);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        }

        ClinicUser principal = (ClinicUser) authentication.getPrincipal();
        if (!allowedRoles.contains(principal.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, wrongPortalMessage);
        }

        loginAttempts.reset(email);
        establishSession(authentication, servletRequest, servletResponse);
        return AuthResponse.from(principal);
    }

    private Authentication authenticate(String email, String password) {
        return authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, password));
    }

    private void establishSession(Authentication authentication, HttpServletRequest request,
                                  HttpServletResponse response) {
        sessionAuthenticationStrategy.onAuthentication(authentication, request, response);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    private static void ensureBcryptLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at most 72 UTF-8 bytes.");
        }
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 100) String displayName,
            @NotBlank @Size(min = 8, max = 72) String password) {}

    public record CustomerRegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 100) String displayName,
            @Size(max = 32) String phone,
            @Size(max = 500) String address,
            @NotBlank @Size(min = 8, max = 72) String password) {}

    public record LoginRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 72) String password) {}

    public record AuthResponse(boolean authenticated, String email, String displayName, String role,
                               Long ownerId, boolean passwordChangeRequired, boolean registrationAvailable) {
        static AuthResponse from(ClinicUser user) {
            return new AuthResponse(true, user.getEmail(), user.getDisplayName(), user.getRole().name(),
                    user.getOwnerId(), user.isPasswordChangeRequired(), false);
        }
    }

    public record CsrfResponse(String token) {}
}
