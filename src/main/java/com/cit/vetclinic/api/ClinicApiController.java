package com.cit.vetclinic.api;

import com.cit.vetclinic.model.Appointment;
import com.cit.vetclinic.model.ClinicProduct;
import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.model.MedicalRecord;
import com.cit.vetclinic.model.Owner;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.model.PaymentLine;
import com.cit.vetclinic.model.Pet;
import com.cit.vetclinic.repository.AppointmentRepository;
import com.cit.vetclinic.repository.AppointmentBookingLockRepository;
import com.cit.vetclinic.repository.ClinicProductRepository;
import com.cit.vetclinic.repository.ClinicUserRepository;
import com.cit.vetclinic.repository.MedicalRecordRepository;
import com.cit.vetclinic.repository.OwnerRepository;
import com.cit.vetclinic.repository.PaymentRepository;
import com.cit.vetclinic.repository.PetRepository;
import jakarta.validation.Valid;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Map;
import java.util.List;
import java.util.Objects;
import java.util.TreeMap;

import static com.cit.vetclinic.api.ApiModels.*;

@RestController
@RequestMapping("/api")
public class ClinicApiController {
    private static final DateTimeFormatter RECEIPT_DATE = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final PetRepository pets;
    private final AppointmentRepository appointments;
    private final AppointmentBookingLockRepository bookingLocks;
    private final ClinicUserRepository clinicUsers;
    private final MedicalRecordRepository records;
    private final PaymentRepository payments;
    private final ClinicProductRepository products;
    private final OwnerRepository owners;

    public ClinicApiController(PetRepository pets, AppointmentRepository appointments,
                               AppointmentBookingLockRepository bookingLocks,
                               MedicalRecordRepository records, PaymentRepository payments,
                               OwnerRepository owners, ClinicUserRepository clinicUsers,
                               ClinicProductRepository products) {
        this.pets = pets;
        this.appointments = appointments;
        this.bookingLocks = bookingLocks;
        this.clinicUsers = clinicUsers;
        this.records = records;
        this.payments = payments;
        this.products = products;
        this.owners = owners;
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard() {
        BigDecimal outstanding = payments.findByStatus(Payment.Status.UNPAID).stream()
                .map(Payment::getAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paid = payments.findByStatus(Payment.Status.PAID).stream()
                .map(Payment::getAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new DashboardResponse(pets.countByArchivedFalse(), owners.count(), appointments.count(),
                appointments.countByStatus(Appointment.Status.PENDING),
                appointments.countByStatus(Appointment.Status.CONFIRMED),
                payments.countByStatus(Payment.Status.UNPAID), outstanding, paid);
    }

    @GetMapping("/notifications")
    public List<NotificationResponse> notifications() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime tomorrow = now.plusHours(24);
        List<NotificationResponse> notifications = new ArrayList<>();
        for (Appointment appointment : appointments.findAll(Sort.by(Sort.Direction.ASC, "appointmentTime"))) {
            if (appointment.getStatus() == Appointment.Status.CANCELLED) continue;
            if (appointment.getStatus() == Appointment.Status.PENDING) {
                notifications.add(new NotificationResponse("appointment-pending", "Appointment needs confirmation",
                        appointment.getPet().getLabel() + " · " + appointment.getReason(),
                        appointment.getAppointmentTime().toString()));
            } else if (!appointment.getAppointmentTime().isBefore(now)
                    && !appointment.getAppointmentTime().isAfter(tomorrow)) {
                notifications.add(new NotificationResponse("appointment-upcoming", "Upcoming appointment",
                        appointment.getPet().getLabel() + " · " + appointment.getReason(),
                        appointment.getAppointmentTime().toString()));
            }
        }
        for (Payment payment : payments.findByStatus(Payment.Status.UNPAID)) {
            notifications.add(new NotificationResponse("payment-unpaid", "Unpaid bill",
                    payment.getPet().getLabel() + " · " + payment.getDescription()
                            + " · ₱" + payment.getAmount(), payment.getId().toString()));
        }
        return notifications;
    }

    @GetMapping("/pets")
    public List<PetResponse> listPets(@RequestParam(defaultValue = "false") boolean includeArchived) {
        Sort sort = Sort.by(Sort.Direction.ASC, "name");
        List<Pet> results = includeArchived ? pets.findAll(sort) : pets.findAllByArchivedFalse(sort);
        return results.stream().map(PetResponse::from).toList();
    }

    @GetMapping("/pets/{id}")
    public PetResponse getPet(@PathVariable Long id) {
        return PetResponse.from(requirePet(id));
    }

    @PostMapping("/pets")
    @ResponseStatus(HttpStatus.CREATED)
    public PetResponse createPet(@Valid @RequestBody PetRequest request) {
        Pet pet = toPet(request);
        pet.setOwner(resolveOwner(request));
        return PetResponse.from(pets.save(pet));
    }

    @PutMapping("/pets/{id}")
    public PetResponse updatePet(@PathVariable Long id, @Valid @RequestBody PetRequest request) {
        Pet pet = requirePet(id);
        updatePetProfile(pet, request);
        if (request.ownerId() != null) {
            pet.setOwner(requireOwner(request.ownerId()));
        } else {
            Owner owner = pet.getOwner();
            if (owner == null) {
                owner = owners.save(toOwner(request));
                pet.setOwner(owner);
            } else {
                owner.setName(request.ownerName().trim());
                owner.setEmail(cleanOptional(request.ownerEmail()));
                owner.setPhone(cleanOptional(request.ownerPhone()));
                owner.setAddress(cleanOptional(request.ownerAddress()));
            }
        }
        return PetResponse.from(pets.save(pet));
    }

    @PatchMapping("/pets/{id}/archive")
    public PetResponse archivePet(@PathVariable Long id) {
        Pet pet = requirePet(id);
        pet.setArchived(true);
        return PetResponse.from(pets.save(pet));
    }

    @PatchMapping("/pets/{id}/restore")
    public PetResponse restorePet(@PathVariable Long id) {
        Pet pet = requirePet(id);
        pet.setArchived(false);
        return PetResponse.from(pets.save(pet));
    }

    @GetMapping("/owners")
    public List<OwnerResponse> listOwners() {
        return owners.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(owner -> OwnerResponse.from(owner, pets.countByOwnerIdAndArchivedFalse(owner.getId())))
                .toList();
    }

    @PostMapping("/owners")
    @ResponseStatus(HttpStatus.CREATED)
    public OwnerResponse createOwner(@Valid @RequestBody OwnerRequest request) {
        Owner owner = owners.save(toOwner(request));
        return OwnerResponse.from(owner, 0);
    }

    @PutMapping("/owners/{id}")
    public OwnerResponse updateOwner(@PathVariable Long id, @Valid @RequestBody OwnerRequest request) {
        Owner owner = requireOwner(id);
        owner.setName(request.name().trim());
        owner.setEmail(cleanOptional(request.email()));
        owner.setPhone(cleanOptional(request.phone()));
        owner.setAddress(cleanOptional(request.address()));
        owner = owners.save(owner);
        return OwnerResponse.from(owner, pets.countByOwnerIdAndArchivedFalse(id));
    }

    @GetMapping("/appointments")
    public List<AppointmentResponse> listAppointments() {
        return appointments.findAll(Sort.by(Sort.Direction.ASC, "appointmentTime"))
                .stream().map(AppointmentResponse::from).toList();
    }

    @GetMapping("/appointment-staff")
    public List<AppointmentStaffResponse> listAppointmentStaff() {
        return clinicUsers.findAll().stream()
                .filter(ClinicUser::isActive)
                .sorted(Comparator.comparing(ClinicUser::getDisplayName, String.CASE_INSENSITIVE_ORDER))
                .map(AppointmentStaffResponse::from)
                .toList();
    }

    @GetMapping("/inventory")
    public List<InventoryProductResponse> listInventory() {
        return products.findAllByOrderByNameAsc().stream()
                .map(InventoryProductResponse::from)
                .toList();
    }

    @GetMapping("/inventory/{id}")
    public InventoryProductResponse getInventoryProduct(@PathVariable Long id) {
        return InventoryProductResponse.from(requireProduct(id));
    }

    @PostMapping("/inventory")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryProductResponse createInventoryProduct(
            @Valid @RequestBody InventoryProductRequest request) {
        String sku = request.sku().trim();
        if (products.existsBySkuIgnoreCase(sku)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That SKU is already in use.");
        }
        ClinicProduct product = new ClinicProduct();
        product.setSku(sku);
        product.setName(request.name().trim());
        product.setCategory(cleanOptional(request.category()));
        product.setQuantityOnHand(request.quantityOnHand());
        product.setReorderLevel(request.reorderLevel());
        product.setUnitPrice(request.unitPrice().setScale(2, RoundingMode.HALF_UP));
        return InventoryProductResponse.from(products.save(product));
    }

    @PutMapping("/inventory/{id}")
    public InventoryProductResponse updateInventoryProduct(@PathVariable Long id,
            @Valid @RequestBody InventoryProductUpdateRequest request) {
        ClinicProduct product = requireProduct(id);
        String sku = request.sku().trim();
        if (products.existsBySkuIgnoreCaseAndIdNot(sku, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That SKU is already in use.");
        }
        product.setSku(sku);
        product.setName(request.name().trim());
        product.setCategory(cleanOptional(request.category()));
        product.setReorderLevel(request.reorderLevel());
        product.setUnitPrice(request.unitPrice().setScale(2, RoundingMode.HALF_UP));
        product.setActive(request.active());
        return InventoryProductResponse.from(products.save(product));
    }

    @PostMapping("/inventory/{id}/adjustment")
    @Transactional
    public InventoryProductResponse adjustStock(@PathVariable Long id,
            @Valid @RequestBody StockAdjustmentRequest request) {
        ClinicProduct product = products.lockById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found."));
        int adjustment = request.adjustment();
        if (adjustment == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock adjustment cannot be zero.");
        }
        long updatedQuantity = (long) product.getQuantityOnHand() + adjustment;
        if (updatedQuantity < 0 || updatedQuantity > 1_000_000) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stock adjustment would create an invalid quantity.");
        }
        product.setQuantityOnHand((int) updatedQuantity);
        return InventoryProductResponse.from(products.save(product));
    }

    @PostMapping("/appointments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AppointmentResponse createAppointment(@Valid @RequestBody AppointmentRequest request) {
        lockAppointmentWrites();
        Appointment appointment = new Appointment();
        appointment.setPet(requireActivePet(request.petId()));
        appointment.setAppointmentTime(request.appointmentTime());
        appointment.setReason(request.reason().trim());
        appointment.setAssignedStaff(request.staffId() == null ? null : requireActiveStaff(request.staffId()));
        appointment.setDurationMinutes(request.durationMinutes() == null ? 30 : request.durationMinutes());
        appointment.setResource(cleanOptional(request.resource()));
        ensureAppointmentAvailable(appointment, null);
        appointment.setStatus(Appointment.Status.PENDING);
        return AppointmentResponse.from(appointments.save(appointment));
    }

    @PutMapping("/appointments/{id}/reschedule")
    @Transactional
    public AppointmentResponse reschedule(@PathVariable Long id, @Valid @RequestBody RescheduleRequest request) {
        lockAppointmentWrites();
        Appointment appointment = requireAppointment(id);
        if (appointment.getStatus() == Appointment.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled appointments cannot be rescheduled.");
        }
        appointment.setAppointmentTime(request.appointmentTime());
        if (request.staffId() != null) appointment.setAssignedStaff(requireActiveStaff(request.staffId()));
        if (request.durationMinutes() != null) appointment.setDurationMinutes(request.durationMinutes());
        if (request.resource() != null) appointment.setResource(cleanOptional(request.resource()));
        ensureAppointmentAvailable(appointment, id);
        appointment.setStatus(Appointment.Status.PENDING);
        return AppointmentResponse.from(appointments.save(appointment));
    }

    @PatchMapping("/appointments/{id}/confirm")
    public AppointmentResponse confirmAppointment(@PathVariable Long id) {
        Appointment appointment = requireAppointment(id);
        if (appointment.getStatus() == Appointment.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled appointments cannot be confirmed.");
        }
        appointment.setStatus(Appointment.Status.CONFIRMED);
        return AppointmentResponse.from(appointments.save(appointment));
    }

    @PatchMapping("/appointments/{id}/cancel")
    @Transactional
    public AppointmentResponse cancelAppointment(@PathVariable Long id) {
        lockAppointmentWrites();
        Appointment appointment = requireAppointment(id);
        appointment.setStatus(Appointment.Status.CANCELLED);
        return AppointmentResponse.from(appointments.save(appointment));
    }

    @GetMapping("/pets/{petId}/records")
    public List<MedicalRecordResponse> listRecords(@PathVariable Long petId) {
        requirePet(petId);
        return records.findByPetIdOrderByRecordDateDesc(petId).stream()
                .map(MedicalRecordResponse::from).toList();
    }

    @PostMapping("/pets/{petId}/records")
    @ResponseStatus(HttpStatus.CREATED)
    public MedicalRecordResponse createRecord(@PathVariable Long petId,
                                              @Valid @RequestBody MedicalRecordRequest request) {
        MedicalRecord record = new MedicalRecord();
        record.setPet(requireActivePet(petId));
        updateRecord(record, request);
        return MedicalRecordResponse.from(records.save(record));
    }

    @PutMapping("/records/{id}")
    public MedicalRecordResponse updateRecord(@PathVariable Long id,
                                              @Valid @RequestBody MedicalRecordRequest request) {
        MedicalRecord record = records.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Medical record not found."));
        updateRecord(record, request);
        return MedicalRecordResponse.from(records.save(record));
    }

    @GetMapping("/payments")
    @Transactional(readOnly = true)
    public List<PaymentResponse> listPayments() {
        return payments.findAll(Sort.by(Sort.Direction.DESC, "id")).stream()
                .map(PaymentResponse::from).toList();
    }

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PaymentResponse createPayment(@Valid @RequestBody PaymentRequest request) {
        Payment payment = new Payment();
        payment.setPet(requireActivePet(request.petId()));
        BigDecimal total = BigDecimal.ZERO;
        if (request.items() == null || request.items().isEmpty()) {
            if (request.description() == null || request.description().isBlank()
                    || request.amount() == null || request.amount().signum() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Add at least one valid invoice item or provide a description and positive amount.");
            }
            BigDecimal amount = request.amount().setScale(2, RoundingMode.HALF_UP);
            payment.addItem(new PaymentLine(request.description().trim(), 1, amount, amount));
            total = amount;
            payment.setDescription(request.description().trim());
        } else {
            for (PaymentItemRequest itemRequest : request.items()) {
                PaymentLine item = invoiceItem(itemRequest);
                payment.addItem(item);
                total = total.add(item.getLineTotal());
            }
            if (total.signum() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice total must be greater than zero.");
            }
            payment.setDescription(payment.getItems().size() == 1
                    ? payment.getItems().get(0).getDescription()
                    : "Invoice (" + payment.getItems().size() + " items)");
        }
        payment.setAmount(total.setScale(2, RoundingMode.HALF_UP));
        payment.setStatus(Payment.Status.UNPAID);
        return PaymentResponse.from(payments.save(payment));
    }

    @PostMapping("/payments/{id}/pay")
    @Transactional
    public PaymentResponse pay(@PathVariable Long id, @Valid @RequestBody PayRequest request) {
        if (!List.of("Cash", "GCash", "Card").contains(request.method())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Cash, GCash, or Card.");
        }
        Payment payment = payments.lockById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found."));
        if (payment.getStatus() == Payment.Status.UNPAID) {
            deductInvoiceStock(payment);
            payment.setPaymentMethod(request.method());
            payment.setPaidAt(LocalDateTime.now());
            payment.setStatus(Payment.Status.PAID);
            payment.setReceiptNo("RCPT-" + payment.getPaidAt().format(RECEIPT_DATE) + "-" + id);
            payments.save(payment);
        }
        return PaymentResponse.from(payment);
    }

    @GetMapping("/payments/{id}/receipt")
    public PaymentResponse receipt(@PathVariable Long id) {
        Payment payment = requirePayment(id);
        if (payment.getStatus() != Payment.Status.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A receipt is available after payment.");
        }
        return PaymentResponse.from(payment);
    }

    private Pet requirePet(Long id) {
        return pets.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet not found."));
    }

    private Pet requireActivePet(Long id) {
        Pet pet = requirePet(id);
        if (pet.isArchived()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Archived pets cannot receive new clinic activity.");
        }
        return pet;
    }

    private Owner requireOwner(Long id) {
        return owners.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Owner not found."));
    }

    private Owner resolveOwner(PetRequest request) {
        if (request.ownerId() != null) return requireOwner(request.ownerId());
        String email = cleanOptional(request.ownerEmail());
        if (email != null) {
            return owners.findByEmailIgnoreCase(email).orElseGet(() -> owners.save(toOwner(request)));
        }
        return owners.save(toOwner(request));
    }

    private static Pet toPet(PetRequest request) {
        Pet pet = new Pet(request.name().trim(), request.species().trim(),
                cleanOptional(request.breed()), request.ownerName().trim());
        updatePetProfile(pet, request);
        return pet;
    }

    private static Owner toOwner(PetRequest request) {
        return new Owner(request.ownerName().trim(), cleanOptional(request.ownerEmail()),
                cleanOptional(request.ownerPhone()), cleanOptional(request.ownerAddress()));
    }

    private static Owner toOwner(OwnerRequest request) {
        return new Owner(request.name().trim(), cleanOptional(request.email()),
                cleanOptional(request.phone()), cleanOptional(request.address()));
    }

    private Appointment requireAppointment(Long id) {
        return appointments.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found."));
    }

    private Payment requirePayment(Long id) {
        return payments.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found."));
    }

    private ClinicProduct requireProduct(Long id) {
        return products.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found."));
    }

    private PaymentLine invoiceItem(PaymentItemRequest request) {
        ClinicProduct product = null;
        BigDecimal unitPrice;
        String description;
        if (request.productId() != null) {
            product = requireProduct(request.productId());
            if (!product.isActive()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Inactive inventory items cannot be billed.");
            }
            unitPrice = product.getUnitPrice();
            description = product.getName();
        } else {
            if (request.unitPrice() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A unit price is required for service invoice items.");
            }
            unitPrice = request.unitPrice().setScale(2, RoundingMode.HALF_UP);
            description = request.description().trim();
        }
        BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(request.quantity()))
                .setScale(2, RoundingMode.HALF_UP);
        PaymentLine item = new PaymentLine(description, request.quantity(), unitPrice, lineTotal);
        item.setProduct(product);
        return item;
    }

    private void deductInvoiceStock(Payment payment) {
        Map<Long, Integer> quantitiesByProduct = new TreeMap<>();
        for (PaymentLine item : payment.getItems()) {
            if (item.getProduct() != null) {
                quantitiesByProduct.merge(item.getProduct().getId(), item.getQuantity(), Math::addExact);
            }
        }
        Map<Long, ClinicProduct> lockedProducts = new TreeMap<>();
        for (Long productId : quantitiesByProduct.keySet()) {
            ClinicProduct product = products.lockById(productId).orElseThrow(
                    () -> new ResponseStatusException(HttpStatus.CONFLICT, "An invoice product no longer exists."));
            if (!product.isActive() || product.getQuantityOnHand() < quantitiesByProduct.get(productId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Insufficient stock to complete this invoice.");
            }
            lockedProducts.put(productId, product);
        }
        quantitiesByProduct.forEach((productId, quantity) -> {
            ClinicProduct product = lockedProducts.get(productId);
            product.setQuantityOnHand(product.getQuantityOnHand() - quantity);
        });
    }

    private void lockAppointmentWrites() {
        bookingLocks.lockById(1L).orElseThrow(
                () -> new IllegalStateException("Appointment booking lock is not initialized."));
    }

    private ClinicUser requireActiveStaff(Long id) {
        ClinicUser user = clinicUsers.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned staff member not found."));
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Inactive staff members cannot be assigned.");
        }
        return user;
    }

    private void ensureAppointmentAvailable(Appointment requested, Long excludedId) {
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

    private void updateRecord(MedicalRecord record, MedicalRecordRequest request) {
        record.setDiagnosis(request.diagnosis().trim());
        record.setTreatment(request.treatment().trim());
        record.setNotes(cleanOptional(request.notes()));
        record.setRecordDate(request.recordDate() == null ? LocalDate.now() : request.recordDate());
        record.setWeightKg(request.weightKg());
        record.setTemperatureC(request.temperatureC());
        record.setHeartRateBpm(request.heartRateBpm());
        record.setRespiratoryRateBpm(request.respiratoryRateBpm());
        record.setMedications(cleanOptional(request.medications()));
        record.setFollowUpDate(request.followUpDate());
    }

    private static void updatePetProfile(Pet pet, PetRequest request) {
        pet.setName(request.name().trim());
        pet.setSpecies(request.species().trim());
        pet.setBreed(cleanOptional(request.breed()));
        pet.setBirthDate(request.birthDate());
        pet.setSex(cleanOptional(request.sex()));
        pet.setColor(cleanOptional(request.color()));
        pet.setMicrochipNumber(cleanOptional(request.microchipNumber()));
        pet.setWeightKg(request.weightKg());
        pet.setAllergies(cleanOptional(request.allergies()));
        pet.setMedicalAlerts(cleanOptional(request.medicalAlerts()));
    }

    private static String cleanOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
