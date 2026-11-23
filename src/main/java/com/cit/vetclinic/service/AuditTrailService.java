package com.cit.vetclinic.service;

import com.cit.vetclinic.model.AuditEvent;
import com.cit.vetclinic.repository.AuditEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditTrailService {
    private final AuditEventRepository events;

    public AuditTrailService(AuditEventRepository events) {
        this.events = events;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String actor, String method, String requestPath, int responseStatus) {
        events.save(new AuditEvent(actor, method, requestPath, responseStatus));
    }
}
