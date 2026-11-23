package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.Payment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    long countByStatus(Payment.Status status);
    List<Payment> findByStatus(Payment.Status status);
    List<Payment> findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtAsc(
            LocalDateTime start, LocalDateTime end);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payment from Payment payment where payment.id = :id")
    Optional<Payment> lockById(@Param("id") Long id);
}
