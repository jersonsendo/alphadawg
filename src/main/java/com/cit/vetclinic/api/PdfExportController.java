package com.cit.vetclinic.api;

import com.cit.vetclinic.model.MedicalRecord;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.model.Pet;
import com.cit.vetclinic.repository.MedicalRecordRepository;
import com.cit.vetclinic.repository.PaymentRepository;
import com.cit.vetclinic.repository.PetRepository;
import com.cit.vetclinic.service.PdfDocumentService;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
public class PdfExportController {
    private final PetRepository pets;
    private final MedicalRecordRepository records;
    private final PaymentRepository payments;
    private final PdfDocumentService pdfDocuments;

    public PdfExportController(PetRepository pets, MedicalRecordRepository records, PaymentRepository payments,
                               PdfDocumentService pdfDocuments) {
        this.pets = pets;
        this.records = records;
        this.payments = payments;
        this.pdfDocuments = pdfDocuments;
    }

    @GetMapping("/pets/{petId}/records/pdf")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> medicalHistory(@PathVariable Long petId) throws IOException {
        Pet pet = requirePet(petId);
        List<MedicalRecord> petRecords = records.findByPetIdOrderByRecordDateDesc(petId);
        return pdf("medical-history-pet-" + petId + ".pdf", pdfDocuments.medicalHistory(pet, petRecords));
    }

    @GetMapping("/pets/{petId}/records/{recordId}/pdf")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> medicalRecord(@PathVariable Long petId, @PathVariable Long recordId)
            throws IOException {
        Pet pet = requirePet(petId);
        MedicalRecord record = records.findById(recordId).orElseThrow(
                () -> new ResponseStatusException(NOT_FOUND, "Medical record not found."));
        if (!record.getPet().getId().equals(petId)) {
            throw new ResponseStatusException(NOT_FOUND, "Medical record not found for this pet.");
        }
        return pdf("medical-record-" + recordId + ".pdf", pdfDocuments.medicalRecord(pet, record));
    }

    @GetMapping("/payments/{id}/pdf")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> paymentDocument(@PathVariable Long id) throws IOException {
        Payment payment = payments.findById(id).orElseThrow(
                () -> new ResponseStatusException(NOT_FOUND, "Payment not found."));
        String filename = (payment.getStatus() == Payment.Status.PAID ? "receipt-" : "invoice-")
                + payment.getId() + ".pdf";
        return pdf(filename, pdfDocuments.paymentDocument(payment));
    }

    private Pet requirePet(Long id) {
        return pets.findById(id).orElseThrow(
                () -> new ResponseStatusException(NOT_FOUND, "Pet not found."));
    }

    private static ResponseEntity<byte[]> pdf(String filename, byte[] document) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setCacheControl(CacheControl.noStore());
        return ResponseEntity.ok().headers(headers).body(document);
    }
}
