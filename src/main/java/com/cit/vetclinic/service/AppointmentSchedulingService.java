package com.cit.vetclinic.service;

import com.cit.vetclinic.model.Appointment;
import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.repository.AppointmentBookingLockRepository;
import com.cit.vetclinic.repository.AppointmentRepository;
import com.cit.vetclinic.repository.ClinicUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class AppointmentSchedulingService {
    private final AppointmentRepository appointments;
    private final AppointmentBookingLockRepository bookingLocks;
    private final ClinicUserRepository clinicUsers;

    public AppointmentSchedulingService(AppointmentRepository appointments,
                                        AppointmentBookingLockRepository bookingLocks,
                                        ClinicUserRepository clinicUsers) {
        this.appointments = appointments;
        this.bookingLocks = bookingLocks;
        this.clinicUsers = clinicUsers;
    }

    public void lockAppointmentWrites() {
        bookingLocks.lockById(1L).orElseThrow(
                () -> new IllegalStateException("Appointment booking lock is not initialized."));
    }

    public ClinicUser requireActiveStaff(Long id) {
        ClinicUser user = clinicUsers.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned staff member not found."));
        if (!user.isActive() || !user.isStaffOrAdmin()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Inactive or non-staff accounts cannot be assigned.");
        }
        return user;
    }

    public void ensureAppointmentAvailable(Appointment requested, Long excludedId) {
        LocalDateTime startsAt = requested.getAppointmentTime();
        LocalDateTime endsAt = startsAt.plusMinutes(requested.getDurationMinutes());
        List<Appointment> candidates = appointments
                .findByStatusNotAndAppointmentTimeGreaterThanEqualAndAppointmentTimeLessThan(
                        Appointment.Status.CANCELLED, startsAt.minusMinutes(480), endsAt);
        for (Appointment existing : candidates) {
            if (Objects.equals(existing.getId(), excludedId)
                    || !existing.getAppointmentTime().plusMinutes(existing.getDurationMinutes()).isAfter(startsAt)) {
                continue;
            }
            Long requestedStaffId = requested.getAssignedStaff() == null
                    ? null : requested.getAssignedStaff().getId();
            Long existingStaffId = existing.getAssignedStaff() == null
                    ? null : existing.getAssignedStaff().getId();
            boolean staffConflict = requestedStaffId == null || existingStaffId == null
                    || requestedStaffId.equals(existingStaffId);
            String requestedResource = requested.getResource();
            boolean resourceConflict = requestedResource != null && existing.getResource() != null
                    && requestedResource.equalsIgnoreCase(existing.getResource());
            if (staffConflict || resourceConflict) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "That time slot is already taken.");
            }
        }
    }
}
