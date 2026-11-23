package com.cit.vetclinic.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "appointment_booking_lock")
public class AppointmentBookingLock {
    @Id
    private Long id;

    protected AppointmentBookingLock() {}

    public AppointmentBookingLock(Long id) {
        this.id = id;
    }

    public Long getId() {
        return id;
    }
}
