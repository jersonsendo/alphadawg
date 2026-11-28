package com.cit.vetclinic.api;

import com.cit.vetclinic.model.Appointment;
import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.model.MedicalRecord;
import com.cit.vetclinic.model.Owner;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.model.Pet;
import com.cit.vetclinic.repository.AppointmentRepository;
import com.cit.vetclinic.repository.ClinicUserRepository;
import com.cit.vetclinic.repository.MedicalRecordRepository;
import com.cit.vetclinic.repository.OwnerRepository;
import com.cit.vetclinic.repository.PaymentRepository;
import com.cit.vetclinic.repository.PetRepository;
import com.cit.vetclinic.service.AppointmentSchedulingService;
import com.cit.vetclinic.service.PdfDocumentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Sort;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import static com.cit.vetclinic.api.ApiModels.*;

@RestController
@RequestMapping("/api/portal")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerPortalApiController {
    private final ClinicUserRepository clinicUsers;
    private final OwnerRepository owners;
    private final PetRepository pets;
    private final AppointmentRepository appointments;
    private final MedicalRecordRepository records;
    private final PaymentRepository payments;
    private final AppointmentSchedulingService scheduling;
    private final PdfDocumentService pdfDocuments;

    public CustomerPortalApiController(ClinicUserRepository clinicUsers,
                                       OwnerRepository owners,
                                       PetRepository pets,
                                       AppointmentRepository appointments,
                                       MedicalRecordRepository records,
                                       PaymentRepository payments,
                                       AppointmentSchedulingService scheduling,
                                       PdfDocumentService pdfDocuments) {
        this.clinicUsers = clinicUsers;
        this.owners = owners;
        this.pets = pets;
        this.appointments = appointments;
        this.records = records;
        this.payments = payments;
        this.scheduling = scheduling;
        this.pdfDocuments = pdfDocuments;
    }

    @GetMapping("/overview")
    @Transactional
    public PortalOverviewResponse overview(Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        List<Pet> ownerPets = pets.findAllByOwnerIdAndArchivedFalse(owner.getId(), Sort.by(Sort.Direction.ASC, "name"));
        List<Appointment> ownerAppointments = appointments.findByPetOwnerIdOrderByAppointmentTimeAsc(owner.getId());
        List<Payment> ownerPayments = payments.findByPetOwnerIdOrderByIdDesc(owner.getId());

        LocalDateTime now = LocalDateTime.now();
        long upcomingCount = ownerAppointments.stream()
                .filter(appt -> appt.getStatus() != Appointment.Status.CANCELLED && !appt.getAppointmentTime().isBefore(now))
                .count();
        long pendingCount = ownerAppointments.stream()
                .filter(appt -> appt.getStatus() == Appointment.Status.PENDING)
                .count();
        long unpaidCount = ownerPayments.stream()
                .filter(payment -> payment.getStatus() == Payment.Status.UNPAID)
                .count();
        BigDecimal outstanding = ownerPayments.stream()
                .filter(payment -> payment.getStatus() == Payment.Status.UNPAID)
                .map(Payment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paid = ownerPayments.stream()
                .filter(payment -> payment.getStatus() == Payment.Status.PAID)
                .map(Payment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new PortalOverviewResponse(
                owner.getId(),
                owner.getName(),
                owner.getEmail(),
                owner.getPhone(),
                owner.getAddress(),
                ownerPets.size(),
                upcomingCount,
                pendingCount,
                unpaidCount,
                outstanding,
                paid
        );
    }

    @PutMapping("/profile")
    @Transactional
    public PortalProfileResponse updateProfile(@Valid @RequestBody PortalProfileRequest request,
                                               Authentication authentication) {
        ClinicUser user = requireCurrentUser(authentication);
        Owner owner = requireLinkedOwner(user);
        String name = request.name().trim();
        owner.setName(name);
        owner.setPhone(cleanOptional(request.phone()));
        owner.setAddress(cleanOptional(request.address()));
        owners.save(owner);

        user.setDisplayName(name);
        clinicUsers.save(user);
        return new PortalProfileResponse(owner.getId(), owner.getName(), owner.getEmail(),
                owner.getPhone(), owner.getAddress());
    }

    @GetMapping("/pets")
    @Transactional
    public List<PetResponse> listPets(Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        return pets.findAllByOwnerIdAndArchivedFalse(owner.getId(), Sort.by(Sort.Direction.ASC, "name"))
                .stream()
                .map(PetResponse::from)
                .toList();
    }

    @PostMapping("/pets")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PetResponse createPet(@Valid @RequestBody CustomerPetRequest request, Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        Pet pet = new Pet(request.name().trim(), request.species().trim(),
                cleanOptional(request.breed()), owner.getName());
        pet.setBirthDate(request.birthDate());
        pet.setSex(cleanOptional(request.sex()));
        pet.setColor(cleanOptional(request.color()));
        pet.setWeightKg(request.weightKg());
        pet.setAllergies(cleanOptional(request.allergies()));
        pet.setMedicalAlerts(cleanOptional(request.medicalAlerts()));
        pet.setOwner(owner);
        return PetResponse.from(pets.save(pet));
    }

    @GetMapping("/pets/{petId}")
    @Transactional
    public PetResponse getPet(@PathVariable Long petId, Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        return PetResponse.from(requireOwnedPet(petId, owner.getId()));
    }

    @GetMapping("/staff")
    @Transactional(readOnly = true)
    public List<AppointmentStaffResponse> listClinicStaff() {
        return clinicUsers.findAll().stream()
                .filter(user -> user.isActive() && user.isStaffOrAdmin())
                .sorted(Comparator.comparing(ClinicUser::getDisplayName, String.CASE_INSENSITIVE_ORDER))
                .map(AppointmentStaffResponse::from)
                .toList();
    }

    @GetMapping("/appointments")
    @Transactional
    public List<AppointmentResponse> listAppointments(Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        return appointments.findByPetOwnerIdOrderByAppointmentTimeAsc(owner.getId())
                .stream()
                .map(AppointmentResponse::from)
                .toList();
    }

    @PostMapping("/appointments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AppointmentResponse createAppointment(@Valid @RequestBody CustomerAppointmentRequest request,
                                                 Authentication authentication) {
        scheduling.lockAppointmentWrites();
        Owner owner = requireLinkedOwner(authentication);
        Pet pet = requireOwnedActivePet(request.petId(), owner.getId());

        Appointment appointment = new Appointment();
        appointment.setPet(pet);
        appointment.setAppointmentTime(request.appointmentTime());
        appointment.setReason(request.reason().trim());
        appointment.setAssignedStaff(request.staffId() == null ? null : scheduling.requireActiveStaff(request.staffId()));
        appointment.setDurationMinutes(30);
        appointment.setResource(null);
        scheduling.ensureAppointmentAvailable(appointment, null);
        appointment.setStatus(Appointment.Status.PENDING);
        return AppointmentResponse.from(appointments.save(appointment));
    }

    @PutMapping("/appointments/{id}/reschedule")
    @Transactional
    public AppointmentResponse rescheduleAppointment(@PathVariable Long id,
                                                     @Valid @RequestBody CustomerRescheduleRequest request,
                                                     Authentication authentication) {
        scheduling.lockAppointmentWrites();
        Owner owner = requireLinkedOwner(authentication);
        Appointment appointment = requireOwnedAppointment(id, owner.getId());
        if (appointment.getStatus() == Appointment.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled appointments cannot be rescheduled.");
        }
        appointment.setAppointmentTime(request.appointmentTime());
        scheduling.ensureAppointmentAvailable(appointment, id);
        appointment.setStatus(Appointment.Status.PENDING);
        return AppointmentResponse.from(appointments.save(appointment));
    }

    @PatchMapping("/appointments/{id}/cancel")
    @Transactional
    public AppointmentResponse cancelAppointment(@PathVariable Long id, Authentication authentication) {
        scheduling.lockAppointmentWrites();
        Owner owner = requireLinkedOwner(authentication);
        Appointment appointment = requireOwnedAppointment(id, owner.getId());
        appointment.setStatus(Appointment.Status.CANCELLED);
        return AppointmentResponse.from(appointments.save(appointment));
    }

    @GetMapping("/pets/{petId}/records")
    @Transactional
    public List<MedicalRecordResponse> listRecords(@PathVariable Long petId, Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        requireOwnedPet(petId, owner.getId());
        return records.findByPetIdOrderByRecordDateDesc(petId).stream()
                .map(MedicalRecordResponse::from)
                .toList();
    }

    @GetMapping("/pets/{petId}/records/pdf")
    @Transactional
    public ResponseEntity<byte[]> medicalHistoryPdf(@PathVariable Long petId, Authentication authentication)
            throws IOException {
        Owner owner = requireLinkedOwner(authentication);
        Pet pet = requireOwnedPet(petId, owner.getId());
        List<MedicalRecord> petRecords = records.findByPetIdOrderByRecordDateDesc(petId);
        return pdf("medical-history-pet-" + petId + ".pdf", pdfDocuments.medicalHistory(pet, petRecords));
    }

    @GetMapping("/pets/{petId}/records/{recordId}/pdf")
    @Transactional
    public ResponseEntity<byte[]> medicalRecordPdf(@PathVariable Long petId,
                                                   @PathVariable Long recordId,
                                                   Authentication authentication) throws IOException {
        Owner owner = requireLinkedOwner(authentication);
        Pet pet = requireOwnedPet(petId, owner.getId());
        MedicalRecord record = records.findById(recordId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Medical record not found."));
        if (!record.getPet().getId().equals(petId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Medical record not found for this pet.");
        }
        return pdf("medical-record-" + recordId + ".pdf", pdfDocuments.medicalRecord(pet, record));
    }

    @GetMapping("/payments")
    @Transactional
    public List<PaymentResponse> listPayments(Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        return payments.findByPetOwnerIdOrderByIdDesc(owner.getId()).stream()
                .map(PaymentResponse::from)
                .toList();
    }

    @GetMapping("/payments/{id}/receipt")
    @Transactional
    public PaymentResponse getReceipt(@PathVariable Long id, Authentication authentication) {
        Owner owner = requireLinkedOwner(authentication);
        Payment payment = requireOwnedPayment(id, owner.getId());
        if (payment.getStatus() != Payment.Status.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A receipt is available after payment.");
        }
        return PaymentResponse.from(payment);
    }

    @GetMapping("/payments/{id}/pdf")
    @Transactional
    public ResponseEntity<byte[]> paymentDocumentPdf(@PathVariable Long id, Authentication authentication)
            throws IOException {
        Owner owner = requireLinkedOwner(authentication);
        Payment payment = requireOwnedPayment(id, owner.getId());
        String filename = (payment.getStatus() == Payment.Status.PAID ? "receipt-" : "invoice-")
                + payment.getId() + ".pdf";
        return pdf(filename, pdfDocuments.paymentDocument(payment));
    }

    private ClinicUser requireCurrentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof ClinicUser principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in to continue.");
        }
        return clinicUsers.findById(principal.getId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found."));
    }

    private Owner requireLinkedOwner(Authentication authentication) {
        return requireLinkedOwner(requireCurrentUser(authentication));
    }

    private Owner requireLinkedOwner(ClinicUser user) {
        if (user.getOwner() != null) {
            return owners.findById(user.getOwner().getId()).orElse(user.getOwner());
        }
        Owner linked = owners.findByEmailIgnoreCase(user.getEmail())
                .orElseGet(() -> owners.save(new Owner(user.getDisplayName(), user.getEmail(), null, null)));
        user.setOwner(linked);
        clinicUsers.save(user);
        return linked;
    }

    private Pet requireOwnedPet(Long petId, Long ownerId) {
        Pet pet = pets.findById(petId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet not found."));
        if (pet.getOwner() == null || !pet.getOwner().getId().equals(ownerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet not found.");
        }
        return pet;
    }

    private Pet requireOwnedActivePet(Long petId, Long ownerId) {
        Pet pet = requireOwnedPet(petId, ownerId);
        if (pet.isArchived()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived pets cannot receive new clinic activity.");
        }
        return pet;
    }

    private Appointment requireOwnedAppointment(Long appointmentId, Long ownerId) {
        Appointment appointment = appointments.findById(appointmentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found."));
        if (appointment.getPet() == null || appointment.getPet().getOwner() == null
                || !appointment.getPet().getOwner().getId().equals(ownerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found.");
        }
        return appointment;
    }

    private Payment requireOwnedPayment(Long paymentId, Long ownerId) {
        Payment payment = payments.findById(paymentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found."));
        if (payment.getPet() == null || payment.getPet().getOwner() == null
                || !payment.getPet().getOwner().getId().equals(ownerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found.");
        }
        return payment;
    }

    private static ResponseEntity<byte[]> pdf(String filename, byte[] document) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setCacheControl(CacheControl.noStore());
        return ResponseEntity.ok().headers(headers).body(document);
    }

    private static String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PortalOverviewResponse(
            Long ownerId,
            String ownerName,
            String email,
            String phone,
            String address,
            long petCount,
            long upcomingAppointmentCount,
            long pendingAppointmentCount,
            long unpaidPaymentCount,
            BigDecimal outstandingAmount,
            BigDecimal paidAmount) {}

    public record PortalProfileRequest(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 32) String phone,
            @Size(max = 500) String address) {}

    public record PortalProfileResponse(
            Long ownerId,
            String name,
            String email,
            String phone,
            String address) {}

    public record CustomerPetRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 80) String species,
            @Size(max = 120) String breed,
            @PastOrPresent LocalDate birthDate,
            @Pattern(regexp = "MALE|FEMALE|UNKNOWN") @Size(max = 16) String sex,
            @Size(max = 80) String color,
            @DecimalMin(value = "0.01") @DecimalMax(value = "9999.99") BigDecimal weightKg,
            @Size(max = 1000) String allergies,
            @Size(max = 1000) String medicalAlerts) {}

    public record CustomerAppointmentRequest(
            @NotNull Long petId,
            @NotNull @Future LocalDateTime appointmentTime,
            @NotBlank @Size(max = 500) String reason,
            Long staffId) {}

    public record CustomerRescheduleRequest(
            @NotNull @Future LocalDateTime appointmentTime) {}
}
