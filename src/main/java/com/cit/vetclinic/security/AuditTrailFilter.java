package com.cit.vetclinic.security;

import com.cit.vetclinic.service.AuditTrailService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

public class AuditTrailFilter extends OncePerRequestFilter {
    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private final AuditTrailService auditTrail;

    public AuditTrailFilter(AuditTrailService auditTrail) {
        this.auditTrail = auditTrail;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || path.startsWith("/api/auth/")
                || !MUTATING_METHODS.contains(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String actor = authentication == null || !authentication.isAuthenticated()
                    ? "anonymous" : authentication.getName();
            auditTrail.record(actor.length() > 254 ? actor.substring(0, 254) : actor,
                    request.getMethod(), path.length() > 300 ? path.substring(0, 300) : path,
                    response.getStatus());
        }
    }
}
