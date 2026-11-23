package com.cit.vetclinic.security;

import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.repository.ClinicUserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

final class SessionAccountRefreshFilter extends OncePerRequestFilter {
    private final ClinicUserRepository users;
    private final SecurityContextRepository securityContextRepository;
    private final ObjectMapper objectMapper;

    SessionAccountRefreshFilter(ClinicUserRepository users, SecurityContextRepository securityContextRepository,
                                ObjectMapper objectMapper) {
        this.users = users;
        this.securityContextRepository = securityContextRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof ClinicUser sessionUser) {
            ClinicUser currentUser = users.findById(sessionUser.getId()).orElse(null);
            if (currentUser == null || !currentUser.isActive()) {
                SecurityContextHolder.clearContext();
                var session = request.getSession(false);
                if (session != null) session.invalidate();
            } else {
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                UsernamePasswordAuthenticationToken refreshed =
                        UsernamePasswordAuthenticationToken.authenticated(
                                currentUser, null, currentUser.getAuthorities());
                refreshed.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                context.setAuthentication(refreshed);
                SecurityContextHolder.setContext(context);
                securityContextRepository.saveContext(context, request, response);
                if (currentUser.isPasswordChangeRequired() && !isPasswordChangeRequest(request)) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    objectMapper.writeValue(response.getOutputStream(),
                            Map.of("message", "Change your temporary password before continuing."));
                    return;
                }
            }
        }
        chain.doFilter(request, response);
    }

    private static boolean isPasswordChangeRequest(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String method = request.getMethod();
        return ("GET".equals(method) && ("/api/auth/me".equals(path) || "/api/auth/csrf".equals(path)))
                || ("POST".equals(method) && "/api/auth/logout".equals(path))
                || ("PUT".equals(method) && "/api/account/password".equals(path));
    }
}
