package com.cit.vetclinic.model;

import jakarta.persistence.*;
import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
public class MedicalRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Pet pet;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate recordDate = LocalDate.now();

    @Column(length = 1000)
    private String diagnosis;
    @Column(length = 1000)
    private String treatment;
    @Column(length = 1000)
    private String notes;
    @Column(precision = 6, scale = 2)
    private BigDecimal weightKg;
    @Column(precision = 4, scale = 1)
    private BigDecimal temperatureC;
    private Integer heartRateBpm;
    private Integer respiratoryRateBpm;
    @Column(length = 2000)
    private String medications;
    private LocalDate followUpDate;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Pet getPet() { return pet; }
    public void setPet(Pet pet) { this.pet = pet; }
    public LocalDate getRecordDate() { return recordDate; }
    public void setRecordDate(LocalDate recordDate) { this.recordDate = recordDate; }
    public String getDiagnosis() { return diagnosis; }
    public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }
    public String getTreatment() { return treatment; }
    public void setTreatment(String treatment) { this.treatment = treatment; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }
    public BigDecimal getTemperatureC() { return temperatureC; }
    public void setTemperatureC(BigDecimal temperatureC) { this.temperatureC = temperatureC; }
    public Integer getHeartRateBpm() { return heartRateBpm; }
    public void setHeartRateBpm(Integer heartRateBpm) { this.heartRateBpm = heartRateBpm; }
    public Integer getRespiratoryRateBpm() { return respiratoryRateBpm; }
    public void setRespiratoryRateBpm(Integer respiratoryRateBpm) { this.respiratoryRateBpm = respiratoryRateBpm; }
    public String getMedications() { return medications; }
    public void setMedications(String medications) { this.medications = medications; }
    public LocalDate getFollowUpDate() { return followUpDate; }
    public void setFollowUpDate(LocalDate followUpDate) { this.followUpDate = followUpDate; }
}
