package com.cit.vetclinic.model;

import jakarta.persistence.*;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDateTime;

@Entity
public class Appointment {
    public enum Status { PENDING, CONFIRMED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Pet pet;

    @ManyToOne(fetch = FetchType.LAZY)
    private ClinicUser assignedStaff;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime appointmentTime;

    private Integer durationMinutes = 30;

    @Column(length = 80)
    private String resource;

    private String reason;

    @Enumerated(EnumType.STRING)
    private Status status = Status.PENDING;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Pet getPet() { return pet; }
    public void setPet(Pet pet) { this.pet = pet; }
    public ClinicUser getAssignedStaff() { return assignedStaff; }
    public void setAssignedStaff(ClinicUser assignedStaff) { this.assignedStaff = assignedStaff; }
    public LocalDateTime getAppointmentTime() { return appointmentTime; }
    public void setAppointmentTime(LocalDateTime appointmentTime) { this.appointmentTime = appointmentTime; }
    public int getDurationMinutes() { return durationMinutes == null ? 30 : durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
    public String getResource() { return resource; }
    public void setResource(String resource) { this.resource = resource; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
}
