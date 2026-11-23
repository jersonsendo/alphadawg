package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.AppointmentBookingLock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AppointmentBookingLockRepository extends JpaRepository<AppointmentBookingLock, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select bookingLock from AppointmentBookingLock bookingLock where bookingLock.id = :id")
    Optional<AppointmentBookingLock> lockById(@Param("id") Long id);
}
