package com.cit.vetclinic.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
public class Pet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String species;
    private String breed;
    private LocalDate birthDate;
    @Column(length = 16)
    private String sex;
    @Column(length = 80)
    private String color;
    @Column(length = 80)
    private String microchipNumber;
    @Column(precision = 6, scale = 2)
    private BigDecimal weightKg;
    @Column(length = 1000)
    private String allergies;
    @Column(length = 1000)
    private String medicalAlerts;
    private String ownerName;

    @ManyToOne(fetch = FetchType.LAZY)
    private Owner owner;

    private Boolean archived = false;

    public Pet() {}

    public Pet(String name, String species, String breed, String ownerName) {
        this.name = name;
        this.species = species;
        this.breed = breed;
        this.ownerName = ownerName;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSpecies() { return species; }
    public void setSpecies(String species) { this.species = species; }
    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }
    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
    public String getSex() { return sex; }
    public void setSex(String sex) { this.sex = sex; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getMicrochipNumber() { return microchipNumber; }
    public void setMicrochipNumber(String microchipNumber) { this.microchipNumber = microchipNumber; }
    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }
    public String getAllergies() { return allergies; }
    public void setAllergies(String allergies) { this.allergies = allergies; }
    public String getMedicalAlerts() { return medicalAlerts; }
    public void setMedicalAlerts(String medicalAlerts) { this.medicalAlerts = medicalAlerts; }
    public String getOwnerName() { return owner == null ? ownerName : owner.getName(); }
    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
        if (owner != null) owner.setName(ownerName);
    }
    public Owner getOwner() { return owner; }
    public void setOwner(Owner owner) {
        this.owner = owner;
        if (owner != null) this.ownerName = owner.getName();
    }
    public boolean isArchived() { return Boolean.TRUE.equals(archived); }
    public Boolean getStoredArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    // Shown in dropdowns
    public String getLabel() { return name + " (" + getOwnerName() + ")"; }
}
