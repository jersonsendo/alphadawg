package com.cit.vetclinic.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_events")
public class AuditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 254)
    private String actor;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false, length = 300)
    private String requestPath;

    @Column(nullable = false)
    private int responseStatus;

    @Column(nullable = false, updatable = false)
    private LocalDateTime occurredAt;

    protected AuditEvent() {}

    public AuditEvent(String actor, String method, String requestPath, int responseStatus) {
        this.actor = actor;
        this.method = method;
        this.requestPath = requestPath;
        this.responseStatus = responseStatus;
    }

    @PrePersist
    void setOccurredAt() {
        occurredAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getActor() {
        return actor;
    }

    public String getMethod() {
        return method;
    }

    public String getRequestPath() {
        return requestPath;
    }

    public int getResponseStatus() {
        return responseStatus;
    }

    public LocalDateTime getOccurredAt() {
        return occurredAt;
    }
}
