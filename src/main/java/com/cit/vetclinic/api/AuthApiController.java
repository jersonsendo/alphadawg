package com.cit.vetclinic.api;

import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.repository.ClinicUserRepository;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthApiController {
    private final ClinicUserRepository users;
    private final LoginAttemptService loginAttempts;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private final SecurityContextLogoutHandler logoutHandler;

    public AuthApiController(ClinicUserRepository users, PasswordEncoder passwordEncoder,
                             LoginAttemptService loginAttempts,
                             AuthenticationManager authenticationManager,
                             SecurityContextRepository securityContextRepository,
                             SessionAuthenticationStrategy sessionAuthenticationStrategy,
                             SecurityContextLogoutHandler logoutHandler) {
        this.users = users;
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
            return new AuthResponse(false, null, null, null, false, users.count() == 0);
        }
        return AuthResponse.from(user);
    }

    @PostMapping("/register")
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public synchronized AuthResponse register(@Valid @RequestBody RegisterRequest request,
                                 HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        if (users.count() > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Public registration is closed. Contact a clinic administrator for an account.");
        }
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists.");
        }
        if (request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at most 72 UTF-8 bytes.");
        }

        ClinicUser user = new ClinicUser(email, request.displayName().trim(),
                passwordEncoder.encode(request.password()));
        user.setRole(ClinicUser.Role.ADMIN);
        user = users.save(user);
        Authentication authentication = authenticate(email, request.password());
        establishSession(authentication, servletRequest, servletResponse);
        return AuthResponse.from(user);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        Authentication authentication;
        try {
            authentication = authenticate(normalizeEmail(request.email()), request.password());
        } catch (DisabledException exception) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This account is inactive. Contact a clinic administrator.");
        } catch (LockedException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        } catch (BadCredentialsException exception) {
            loginAttempts.recordFailure(normalizeEmail(request.email()));
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        }
        loginAttempts.reset(normalizeEmail(request.email()));
        establishSession(authentication, servletRequest, servletResponse);
        return AuthResponse.from((ClinicUser) authentication.getPrincipal());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        logoutHandler.logout(request, response, authentication);
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

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 100) String displayName,
            @NotBlank @Size(min = 8, max = 72) String password) {}

    public record LoginRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 72) String password) {}

    public record AuthResponse(boolean authenticated, String email, String displayName, String role,
                               boolean passwordChangeRequired, boolean registrationAvailable) {
        static AuthResponse from(ClinicUser user) {
            return new AuthResponse(true, user.getEmail(), user.getDisplayName(), user.getRole().name(),
                    user.isPasswordChangeRequired(), false);
        }
    }

    public record CsrfResponse(String token) {}
}
