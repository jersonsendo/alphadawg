package com.cit.vetclinic.api;

import com.cit.vetclinic.model.Appointment;
import com.cit.vetclinic.model.MedicalRecord;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.model.PaymentLine;
import com.cit.vetclinic.model.Pet;
import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.model.ClinicProduct;
import com.cit.vetclinic.model.Owner;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class ApiModels {
    private ApiModels() {}

    public record PetRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 80) String species,
            @Size(max = 120) String breed,
            @NotBlank @Size(max = 120) String ownerName,
            Long ownerId,
            @Email @Size(max = 254) String ownerEmail,
            @Size(max = 32) String ownerPhone,
            @Size(max = 500) String ownerAddress,
            @PastOrPresent LocalDate birthDate,
            @Pattern(regexp = "MALE|FEMALE|UNKNOWN") @Size(max = 16) String sex,
            @Size(max = 80) String color,
            @Size(max = 80) String microchipNumber,
            @DecimalMin(value = "0.01") @DecimalMax(value = "9999.99") BigDecimal weightKg,
            @Size(max = 1000) String allergies,
            @Size(max = 1000) String medicalAlerts) {}

    public record PetResponse(Long id, String name, String species, String breed, String ownerName, String label,
                              Long ownerId, String ownerEmail, String ownerPhone, String ownerAddress,
                              boolean archived, LocalDate birthDate, String sex, String color,
                              String microchipNumber, BigDecimal weightKg, String allergies, String medicalAlerts) {
        public static PetResponse from(Pet pet) {
            Owner owner = pet.getOwner();
            return new PetResponse(pet.getId(), pet.getName(), pet.getSpecies(), pet.getBreed(),
                    pet.getOwnerName(), pet.getLabel(), owner == null ? null : owner.getId(),
                    owner == null ? null : owner.getEmail(), owner == null ? null : owner.getPhone(),
                    owner == null ? null : owner.getAddress(), pet.isArchived(), pet.getBirthDate(), pet.getSex(),
                    pet.getColor(), pet.getMicrochipNumber(), pet.getWeightKg(), pet.getAllergies(),
                    pet.getMedicalAlerts());
        }
    }

    public record InventoryProductRequest(
            @NotBlank @Size(max = 64) String sku,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 80) String category,
            @NotNull @Min(0) @Max(1000000) Integer quantityOnHand,
            @NotNull @Min(0) @Max(1000000) Integer reorderLevel,
            @NotNull @DecimalMin(value = "0.00") @DecimalMax(value = "99999999.99") BigDecimal unitPrice) {}

    public record InventoryProductUpdateRequest(
            @NotBlank @Size(max = 64) String sku,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 80) String category,
            @NotNull @Min(0) @Max(1000000) Integer reorderLevel,
            @NotNull @DecimalMin(value = "0.00") @DecimalMax(value = "99999999.99") BigDecimal unitPrice,
            boolean active) {}

    public record StockAdjustmentRequest(
            @NotNull @Min(-1000000) @Max(1000000) Integer adjustment,
            @Size(max = 300) String reason) {}

    public record InventoryProductResponse(Long id, String sku, String name, String category,
                                           int quantityOnHand, int reorderLevel, BigDecimal unitPrice,
                                           boolean active, boolean lowStock) {
        public static InventoryProductResponse from(ClinicProduct product) {
            return new InventoryProductResponse(product.getId(), product.getSku(), product.getName(),
                    product.getCategory(), product.getQuantityOnHand(), product.getReorderLevel(),
                    product.getUnitPrice(), product.isActive(), product.isLowStock());
        }
    }

    public record OwnerRequest(
            @NotBlank @Size(max = 120) String name,
            @Email @Size(max = 254) String email,
            @Size(max = 32) String phone,
            @Size(max = 500) String address) {}

    public record OwnerResponse(Long id, String name, String email, String phone, String address, long petCount) {
        public static OwnerResponse from(Owner owner, long petCount) {
            return new OwnerResponse(owner.getId(), owner.getName(), owner.getEmail(),
                    owner.getPhone(), owner.getAddress(), petCount);
        }
    }

    public record AppointmentRequest(
            @NotNull Long petId,
            @NotNull @Future LocalDateTime appointmentTime,
            @NotBlank @Size(max = 500) String reason,
            Long staffId,
            @Min(5) @Max(480) Integer durationMinutes,
            @Size(max = 80) String resource) {}

    public record RescheduleRequest(
            @NotNull @Future LocalDateTime appointmentTime,
            Long staffId,
            @Min(5) @Max(480) Integer durationMinutes,
            @Size(max = 80) String resource) {}

    public record AppointmentResponse(Long id, Long petId, String petLabel, LocalDateTime appointmentTime,
                                      String reason, Appointment.Status status, Long staffId, String staffName,
                                      int durationMinutes, String resource) {
        public static AppointmentResponse from(Appointment appointment) {
            return new AppointmentResponse(appointment.getId(), appointment.getPet().getId(),
                    appointment.getPet().getLabel(), appointment.getAppointmentTime(),
                    appointment.getReason(), appointment.getStatus(),
                    appointment.getAssignedStaff() == null ? null : appointment.getAssignedStaff().getId(),
                    appointment.getAssignedStaff() == null ? null : appointment.getAssignedStaff().getDisplayName(),
                    appointment.getDurationMinutes(), appointment.getResource());
        }
    }

    public record AppointmentStaffResponse(Long id, String displayName, ClinicUser.Role role) {
        public static AppointmentStaffResponse from(ClinicUser user) {
            return new AppointmentStaffResponse(user.getId(), user.getDisplayName(), user.getRole());
        }
    }

    public record MedicalRecordRequest(
            @NotBlank @Size(max = 1000) String diagnosis,
            @NotBlank @Size(max = 1000) String treatment,
            @Size(max = 1000) String notes,
            LocalDate recordDate,
            @DecimalMin(value = "0.01") @DecimalMax(value = "9999.99") BigDecimal weightKg,
            @DecimalMin(value = "20.0") @DecimalMax(value = "50.0") BigDecimal temperatureC,
            @jakarta.validation.constraints.Positive @jakarta.validation.constraints.Max(500) Integer heartRateBpm,
            @jakarta.validation.constraints.Positive @jakarta.validation.constraints.Max(300) Integer respiratoryRateBpm,
            @Size(max = 2000) String medications,
            LocalDate followUpDate) {}

    public record MedicalRecordResponse(Long id, Long petId, String diagnosis, String treatment,
                                        String notes, LocalDate recordDate, BigDecimal weightKg,
                                        BigDecimal temperatureC, Integer heartRateBpm,
                                        Integer respiratoryRateBpm, String medications, LocalDate followUpDate) {
        public static MedicalRecordResponse from(MedicalRecord record) {
            return new MedicalRecordResponse(record.getId(), record.getPet().getId(), record.getDiagnosis(),
                    record.getTreatment(), record.getNotes(), record.getRecordDate(), record.getWeightKg(),
                    record.getTemperatureC(), record.getHeartRateBpm(), record.getRespiratoryRateBpm(),
                    record.getMedications(), record.getFollowUpDate());
        }
    }

    public record PaymentItemRequest(
            @NotBlank @Size(max = 300) String description,
            @NotNull @Min(1) @Max(100000) Integer quantity,
            @DecimalMin(value = "0.00") @DecimalMax(value = "99999999.99") BigDecimal unitPrice,
            Long productId) {}

    public record PaymentRequest(
            @NotNull Long petId,
            @Size(max = 300) String description,
            @DecimalMin(value = "0.01") @DecimalMax(value = "9999999999.99") BigDecimal amount,
            @Size(max = 100) List<@Valid PaymentItemRequest> items) {}

    public record PayRequest(@NotBlank String method) {}

    public record PaymentResponse(Long id, Long petId, String petLabel, String description, BigDecimal amount,
                                  Payment.Status status, String paymentMethod, LocalDateTime paidAt,
                                  String receiptNo, List<PaymentItemResponse> items) {
        public static PaymentResponse from(Payment payment) {
            return new PaymentResponse(payment.getId(), payment.getPet().getId(), payment.getPet().getLabel(),
                    payment.getDescription(), payment.getAmount(), payment.getStatus(),
                    payment.getPaymentMethod(), payment.getPaidAt(), payment.getReceiptNo(),
                    payment.getItems().stream().map(PaymentItemResponse::from).toList());
        }
    }

    public record PaymentItemResponse(Long id, String description, int quantity, BigDecimal unitPrice,
                                      BigDecimal lineTotal, Long productId) {
        public static PaymentItemResponse from(PaymentLine item) {
            return new PaymentItemResponse(item.getId(), item.getDescription(), item.getQuantity(),
                    item.getUnitPrice(), item.getLineTotal(),
                    item.getProduct() == null ? null : item.getProduct().getId());
        }
    }

    public record DashboardResponse(long petCount, long ownerCount, long appointmentCount,
                                    long pendingAppointmentCount, long confirmedAppointmentCount,
                                    long unpaidPaymentCount, java.math.BigDecimal outstandingAmount,
                                    java.math.BigDecimal paidAmount) {}

    public record NotificationResponse(String type, String title, String message, String timestamp) {}

    public record ApiError(int status, String message) {}
}
