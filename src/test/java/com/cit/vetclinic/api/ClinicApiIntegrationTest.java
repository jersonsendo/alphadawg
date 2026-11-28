package com.cit.vetclinic.api;

import com.cit.vetclinic.repository.OwnerRepository;
import com.cit.vetclinic.repository.PetRepository;
import com.cit.vetclinic.repository.ClinicUserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cit.vetclinic.model.ClinicUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "STAFF")
class ClinicApiIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OwnerRepository owners;

    @Autowired
    private PetRepository pets;

    @Autowired
    private ClinicUserRepository clinicUsers;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void petDetailsCanBeViewedAndOwnerInformationUpdated() throws Exception {
        mockMvc.perform(get("/api/pets/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Bantay"))
                .andExpect(jsonPath("$.ownerName").value("Maria Santos"));

        mockMvc.perform(put("/api/pets/1")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Bantay","species":"Dog","breed":"Aspin","ownerName":"Updated Owner"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerName").value("Updated Owner"));

        mockMvc.perform(get("/api/pets/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerName").value("Updated Owner"));
    }

    @Test
    @Transactional
    void petProfilesStoreClinicalIdentificationDetails() throws Exception {
        String request = """
                {
                  "name":"Poppy","species":"Dog","breed":"Mixed","ownerName":"Test Owner",
                  "birthDate":"2021-06-15","sex":"FEMALE","color":"Brown",
                  "microchipNumber":"985112000123456","weightKg":12.5,
                  "allergies":"Chicken","medicalAlerts":"Sensitive stomach"
                }
                """;
        mockMvc.perform(post("/api/pets")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.birthDate").value("2021-06-15"))
                .andExpect(jsonPath("$.sex").value("FEMALE"))
                .andExpect(jsonPath("$.microchipNumber").value("985112000123456"))
                .andExpect(jsonPath("$.weightKg").value(12.5))
                .andExpect(jsonPath("$.allergies").value("Chicken"))
                .andExpect(jsonPath("$.medicalAlerts").value("Sensitive stomach"));
    }

    @Test
    void dashboardReturnsClinicCounts() throws Exception {
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.petCount").value(3))
                .andExpect(jsonPath("$.appointmentCount").isNumber())
                .andExpect(jsonPath("$.unpaidPaymentCount").isNumber());
    }

    @Test
    void appointmentBookingRejectsAnOccupiedTimeSlot() throws Exception {
        String request = """
                {"petId":1,"appointmentTime":"2099-04-11T10:00:00","reason":"Annual check-up"}
                """;
        mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"));

        mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("That time slot is already taken."));
    }

    @Test
    void cancelledAppointmentReleasesItsTimeSlot() throws Exception {
        String request = """
                {"petId":1,"appointmentTime":"2099-04-12T10:00:00","reason":"Annual check-up"}
                """;
        String response = mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        long appointmentId = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(patch("/api/appointments/" + appointmentId + "/cancel")
                        .with(CsrfTestSupport.csrfToken(mockMvc)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated());
    }

    @Test
    @Transactional
    void appointmentOverlapIsScopedToAssignedStaffAndResource() throws Exception {
        ClinicUser first = new ClinicUser("first-" + java.util.UUID.randomUUID() + "@example.com",
                "Dr. First", "test-hash");
        ClinicUser second = new ClinicUser("second-" + java.util.UUID.randomUUID() + "@example.com",
                "Dr. Second", "test-hash");
        first.setRole(ClinicUser.Role.STAFF);
        second.setRole(ClinicUser.Role.STAFF);
        first = clinicUsers.save(first);
        second = clinicUsers.save(second);

        String firstBooking = """
                {"petId":1,"appointmentTime":"2099-04-15T10:00:00","reason":"Check-up",
                 "staffId":%d,"durationMinutes":30,"resource":"Exam Room A"}
                """.formatted(first.getId());
        mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(firstBooking))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.staffName").value("Dr. First"))
                .andExpect(jsonPath("$.durationMinutes").value(30));

        String sameStaff = """
                {"petId":1,"appointmentTime":"2099-04-15T10:15:00","reason":"Follow-up",
                 "staffId":%d,"durationMinutes":30,"resource":"Exam Room B"}
                """.formatted(first.getId());
        mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sameStaff))
                .andExpect(status().isConflict());

        String differentStaff = """
                {"petId":1,"appointmentTime":"2099-04-15T10:15:00","reason":"Follow-up",
                 "staffId":%d,"durationMinutes":30,"resource":"Exam Room B"}
                """.formatted(second.getId());
        mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(differentStaff))
                .andExpect(status().isCreated());

        String sameRoom = differentStaff.replace("Exam Room B", "Exam Room A");
        mockMvc.perform(post("/api/appointments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sameRoom))
                .andExpect(status().isConflict());
    }

    @Test
    void legacyServerRenderedClinicRoutesAreDisabled() throws Exception {
        mockMvc.perform(get("/appointments")).andExpect(status().isNotFound());
        mockMvc.perform(get("/payments")).andExpect(status().isNotFound());
        mockMvc.perform(get("/records")).andExpect(status().isNotFound());
    }

    @Test
    void paymentAmountMustBePositive() throws Exception {
        mockMvc.perform(post("/api/payments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"petId":1,"description":"Consultation","amount":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @Transactional
    void itemizedInvoiceUsesCatalogPriceAndDeductsStockOnlyOnceWhenPaid() throws Exception {
        String sku = "TEST-" + java.util.UUID.randomUUID();
        String productResponse = mockMvc.perform(post("/api/inventory")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sku":"%s","name":"Flea treatment","category":"Medication",
                                 "quantityOnHand":5,"reorderLevel":2,"unitPrice":125.50}
                                """.formatted(sku)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lowStock").value(false))
                .andReturn()
                .getResponse()
                .getContentAsString();
        long productId = objectMapper.readTree(productResponse).get("id").asLong();

        String invoiceResponse = mockMvc.perform(post("/api/payments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"petId":1,"items":[
                                  {"description":"Flea treatment","quantity":2,"unitPrice":999,"productId":%d},
                                  {"description":"Consultation","quantity":1,"unitPrice":25}
                                ]}
                                """.formatted(productId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount").value(276.0))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].unitPrice").value(125.5))
                .andReturn()
                .getResponse()
                .getContentAsString();
        long paymentId = objectMapper.readTree(invoiceResponse).get("id").asLong();

        mockMvc.perform(post("/api/payments/" + paymentId + "/pay")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"method\":\"Cash\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"));

        mockMvc.perform(post("/api/payments/" + paymentId + "/pay")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"method\":\"Cash\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/inventory/" + productId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantityOnHand").value(3));
    }

    @Test
    @Transactional
    void medicalRecordsCaptureVitalsMedicationAndFollowUp() throws Exception {
        mockMvc.perform(post("/api/pets/1/records")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "diagnosis":"Routine check-up","treatment":"Vaccination",
                                  "notes":"Doing well","recordDate":"2026-11-19","weightKg":8.4,
                                  "temperatureC":38.2,"heartRateBpm":100,
                                  "respiratoryRateBpm":24,"medications":"None",
                                  "followUpDate":"2027-11-19"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.weightKg").value(8.4))
                .andExpect(jsonPath("$.temperatureC").value(38.2))
                .andExpect(jsonPath("$.heartRateBpm").value(100))
                .andExpect(jsonPath("$.medications").value("None"))
                .andExpect(jsonPath("$.followUpDate").value("2027-11-19"));
    }

    @Test
    @Transactional
    void ownerContactsCanBeCreatedUpdatedAndLinkedToMultiplePets() throws Exception {
        String email = "owner-" + java.util.UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/owners")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Taylor Owner","email":"%s","phone":"555-0100","address":"Main Street"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Taylor Owner"));

        Long ownerId = owners.findByEmailIgnoreCase(email).orElseThrow().getId();
        String petRequest = """
                {"name":"Poppy","species":"Dog","breed":"Mixed","ownerName":"Taylor Owner","ownerId":%d}
                """.formatted(ownerId);
        mockMvc.perform(post("/api/pets")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(petRequest))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownerId").value(ownerId))
                .andExpect(jsonPath("$.ownerPhone").value("555-0100"));
        mockMvc.perform(post("/api/pets")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(petRequest.replace("\"Poppy\"", "\"Mochi\"")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownerId").value(ownerId));

        mockMvc.perform(put("/api/owners/" + ownerId)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Taylor Updated","email":"%s","phone":"555-0199","address":"New Street"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("555-0199"))
                .andExpect(jsonPath("$.petCount").value(2));

        mockMvc.perform(get("/api/pets/" + pets.findAll().stream()
                        .filter(pet -> pet.getName().equals("Poppy"))
                        .findFirst().orElseThrow().getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerName").value("Taylor Updated"))
                .andExpect(jsonPath("$.ownerPhone").value("555-0199"));
    }

    @Test
    void petsCanBeArchivedAndRestoredWithoutChangingTheirRecords() throws Exception {
        Long petId = pets.findAll().stream().filter(pet -> pet.getName().equals("Bantay"))
                .findFirst().orElseThrow().getId();
        mockMvc.perform(patch("/api/pets/" + petId + "/archive")
                        .with(CsrfTestSupport.csrfToken(mockMvc)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));

        mockMvc.perform(get("/api/pets"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[?(@.id == " + petId + ")]").doesNotExist());
        mockMvc.perform(get("/api/pets?includeArchived=true"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[?(@.id == " + petId + ")].archived").value(true));

        mockMvc.perform(patch("/api/pets/" + petId + "/restore")
                        .with(CsrfTestSupport.csrfToken(mockMvc)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void auditTrailCapturesClinicChangesAndIsAvailableToAdministrators() throws Exception {
        mockMvc.perform(post("/api/pets")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Audit test pet","species":"Dog","ownerName":"Audit test owner"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/audit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].actor").value("user"))
                .andExpect(jsonPath("$[0].method").value("POST"))
                .andExpect(jsonPath("$[0].requestPath").value("/api/pets"))
                .andExpect(jsonPath("$[0].responseStatus").value(201));
    }

    @Test
    void auditTrailIsRestrictedToAdministrators() throws Exception {
        mockMvc.perform(get("/api/audit"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void paidPaymentsCanBeExportedForAnInclusiveDateRange() throws Exception {
        String paymentResponse = mockMvc.perform(post("/api/payments")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"petId":1,"description":"CSV report visit","amount":42.50}
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        long paymentId = objectMapper.readTree(paymentResponse).get("id").asLong();

        mockMvc.perform(post("/api/payments/" + paymentId + "/pay")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"method\":\"Cash\"}"))
                .andExpect(status().isOk());

        String from = java.time.LocalDate.now().minusDays(1).toString();
        String to = java.time.LocalDate.now().toString();
        mockMvc.perform(get("/api/reports/payments.csv").param("from", from).param("to", to))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/csv;charset=UTF-8"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("CSV report visit")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("42.50")));
    }
}
