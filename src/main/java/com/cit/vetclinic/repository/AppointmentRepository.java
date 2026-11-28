package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    List<Appointment> findByStatusNotAndAppointmentTimeGreaterThanEqualAndAppointmentTimeLessThan(
            Appointment.Status status, LocalDateTime startsAt, LocalDateTime before);
    long countByStatus(Appointment.Status status);
    List<Appointment> findByPetOwnerIdOrderByAppointmentTimeAsc(Long ownerId);
}
