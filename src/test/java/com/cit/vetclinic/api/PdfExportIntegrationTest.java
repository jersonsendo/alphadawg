package com.cit.vetclinic.api;

import com.cit.vetclinic.model.MedicalRecord;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.model.PaymentLine;
import com.cit.vetclinic.model.Pet;
import com.cit.vetclinic.repository.MedicalRecordRepository;
import com.cit.vetclinic.repository.PaymentRepository;
import com.cit.vetclinic.repository.PetRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "STAFF")
class PdfExportIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PetRepository pets;

    @Autowired
    private MedicalRecordRepository records;

    @Autowired
    private PaymentRepository payments;

    @Test
    @Transactional
    void medicalRecordAndPetHistoryAreDownloadablePdfsWithPetAndOwnerDetails() throws Exception {
        Pet pet = pets.findAll().get(0);
        MedicalRecord record = new MedicalRecord();
        record.setPet(pet);
        record.setRecordDate(LocalDate.of(2026, 11, 18));
        record.setDiagnosis("Seasonal allergy");
        record.setTreatment("Antihistamine");
        record.setNotes("Return if symptoms continue.");
        record.setWeightKg(new BigDecimal("8.40"));
        record.setTemperatureC(new BigDecimal("38.2"));
        record.setMedications("Cetirizine");
        record.setFollowUpDate(LocalDate.of(2026, 12, 2));
        record = records.save(record);

        assertPdf(mockMvc.perform(get("/api/pets/{petId}/records/{recordId}/pdf", pet.getId(), record.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("medical-record-")))
                .andReturn(), "Seasonal allergy", "Antihistamine", "8.40", "38.2", "Cetirizine",
                "2026-12-02", pet.getName(), pet.getOwnerName());

        assertPdf(mockMvc.perform(get("/api/pets/{petId}/records/pdf", pet.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andReturn(), "Medical history", "Seasonal allergy", "Return if symptoms continue.",
                "Cetirizine", "2026-12-02");
    }

    @Test
    @Transactional
    void unpaidBillsAndPaidReceiptsAreDownloadablePdfs() throws Exception {
        Pet pet = pets.findAll().get(0);
        Payment unpaid = new Payment();
        unpaid.setPet(pet);
        unpaid.setDescription("Wellness examination");
        unpaid.setAmount(new BigDecimal("125.50"));
        unpaid.setStatus(Payment.Status.UNPAID);
        unpaid = payments.save(unpaid);

        assertPdf(mockMvc.perform(get("/api/payments/{id}/pdf", unpaid.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("invoice-")))
                .andReturn(), "Bill / invoice", "INV-", "UNPAID", "PHP 125.50", pet.getOwnerName());

        Payment paid = new Payment();
        paid.setPet(pet);
        paid.setDescription("Vaccination");
        paid.setAmount(new BigDecimal("80.00"));
        paid.setStatus(Payment.Status.PAID);
        paid.setPaymentMethod("Cash");
        paid.setPaidAt(LocalDateTime.of(2026, 11, 18, 12, 30));
        paid.setReceiptNo("RCPT-20261118123000-1");
        paid.addItem(new PaymentLine("Vaccine", 2, new BigDecimal("40.00"), new BigDecimal("80.00")));
        paid = payments.save(paid);

        assertPdf(mockMvc.perform(get("/api/payments/{id}/pdf", paid.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("receipt-")))
                .andReturn(), "Payment receipt", "Vaccine", "Quantity", "2", "PHP 40.00",
                "RCPT-20261118123000-1", "Cash", "PAID", "PHP 80.00");
    }

    private static void assertPdf(MvcResult result, String... expectedText) throws Exception {
        byte[] bytes = result.getResponse().getContentAsByteArray();
        assertTrue(bytes.length > 4);
        assertTrue(new String(bytes, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).startsWith("%PDF"));
        try (PDDocument document = Loader.loadPDF(bytes)) {
            String text = new PDFTextStripper().getText(document);
            for (String expected : expectedText) {
                assertTrue(text.contains(expected), "PDF text should include: " + expected);
            }
        }
    }
}
