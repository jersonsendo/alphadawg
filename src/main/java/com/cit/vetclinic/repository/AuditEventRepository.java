package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    List<AuditEvent> findTop100ByOrderByOccurredAtDesc();
}
