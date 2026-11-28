package com.cit.vetclinic.api;

import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.model.MedicalRecord;
import com.cit.vetclinic.model.Owner;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.model.Pet;
import com.cit.vetclinic.repository.ClinicUserRepository;
import com.cit.vetclinic.repository.MedicalRecordRepository;
import com.cit.vetclinic.repository.OwnerRepository;
import com.cit.vetclinic.repository.PaymentRepository;
import com.cit.vetclinic.repository.PetRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CustomerPortalIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OwnerRepository owners;

    @Autowired
    private PetRepository pets;

    @Autowired
    private ClinicUserRepository users;

    @Autowired
    private MedicalRecordRepository records;

    @Autowired
    private PaymentRepository payments;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void customerRegistrationAutoLinksExistingOwnerAndEnforcesPortalSeparation() throws Exception {
        String customerEmail = "owner-" + UUID.randomUUID() + "@example.com";
        Owner existingOwner = owners.save(new Owner("Elena Cruz", customerEmail, "09171234567", "Cebu City"));
        Pet ownPet = new Pet("Milo", "Dog", "Beagle", existingOwner.getName());
        ownPet.setOwner(existingOwner);
        ownPet = pets.save(ownPet);

        Owner otherOwner = owners.save(new Owner("Other Owner", "other-" + UUID.randomUUID() + "@example.com", null, null));
        Pet otherPet = new Pet("Shadow", "Cat", "Siamese", otherOwner.getName());
        otherPet.setOwner(otherOwner);
        otherPet = pets.save(otherPet);

        MedicalRecord ownRecord = new MedicalRecord();
        ownRecord.setPet(ownPet);
        ownRecord.setRecordDate(LocalDate.of(2026, 11, 20));
        ownRecord.setDiagnosis("Wellness exam");
        ownRecord.setTreatment("5-in-1 booster");
        ownRecord = records.save(ownRecord);

        Payment ownPayment = new Payment();
        ownPayment.setPet(ownPet);
        ownPayment.setDescription("Vaccination");
        ownPayment.setAmount(new BigDecimal("950.00"));
        ownPayment.setStatus(Payment.Status.PAID);
        ownPayment.setPaymentMethod("GCash");
        ownPayment.setPaidAt(LocalDateTime.of(2026, 11, 20, 14, 0));
        ownPayment.setReceiptNo("RCPT-20261120140000-99");
        ownPayment = payments.save(ownPayment);

        String staffEmail = "staff-" + UUID.randomUUID() + "@example.com";
        ClinicUser staff = new ClinicUser(staffEmail, "Dr. Reyes", passwordEncoder.encode("StaffPass123"));
        staff.setRole(ClinicUser.Role.STAFF);
        users.save(staff);

        // Customer self-registration links to existing owner record by email
        MvcResult customerReg = mockMvc.perform(post("/api/auth/customer/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"Elena Cruz","password":"CustomerPass123"}
                                """.formatted(customerEmail)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.ownerId").value(existingOwner.getId()))
                .andReturn();
        MockHttpSession customerSession = (MockHttpSession) customerReg.getRequest().getSession(false);

        // Portal login separation: customer cannot sign in through staff login, staff cannot sign in through customer login
        mockMvc.perform(post("/api/auth/staff/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"CustomerPass123"}
                                """.formatted(customerEmail)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Customer")));

        mockMvc.perform(post("/api/auth/customer/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"StaffPass123"}
                                """.formatted(staffEmail)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Staff")));

        mockMvc.perform(post("/api/auth/customer/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"CustomerPass123"}
                                """.formatted(customerEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("CUSTOMER"));

        // Customer sees only their own pet, records, payments, and PDFs
        mockMvc.perform(get("/api/portal/overview").session(customerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.petCount").value(1))
                .andExpect(jsonPath("$.paidAmount").value(950.0));

        mockMvc.perform(get("/api/portal/pets").session(customerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Milo"));

        mockMvc.perform(get("/api/portal/pets/" + ownPet.getId() + "/records").session(customerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].diagnosis").value("Wellness exam"));

        mockMvc.perform(get("/api/portal/pets/" + ownPet.getId() + "/records/" + ownRecord.getId() + "/pdf")
                        .session(customerSession))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));

        mockMvc.perform(get("/api/portal/payments").session(customerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].receiptNo").value("RCPT-20261120140000-99"));

        mockMvc.perform(get("/api/portal/payments/" + ownPayment.getId() + "/pdf").session(customerSession))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));

        // Customer can book, reschedule, and cancel an appointment for their own pet
        String booked = mockMvc.perform(post("/api/portal/appointments")
                        .session(customerSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"petId":%d,"appointmentTime":"2099-05-10T10:00:00","reason":"Check-up"}
                                """.formatted(ownPet.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long apptId = objectMapper.readTree(booked).get("id").asLong();

        mockMvc.perform(put("/api/portal/appointments/" + apptId + "/reschedule")
                        .session(customerSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appointmentTime\":\"2099-05-11T11:00:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        mockMvc.perform(patch("/api/portal/appointments/" + apptId + "/cancel")
                        .session(customerSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        // Customer cannot access staff APIs or another owner's pet
        mockMvc.perform(get("/api/dashboard").session(customerSession))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/pets").session(customerSession))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/inventory").session(customerSession))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/portal/pets/" + otherPet.getId()).session(customerSession))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/portal/appointments")
                        .session(customerSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"petId":%d,"appointmentTime":"2099-05-12T10:00:00","reason":"Unauthorized"}
                                """.formatted(otherPet.getId())))
                .andExpect(status().isNotFound());
    }

    @Test
    void newCustomerCanRegisterOwnPetAndBookAppointmentWithHtmlDateTimeFormat() throws Exception {
        String email = "new-customer-" + UUID.randomUUID() + "@example.com";
        MvcResult registration = mockMvc.perform(post("/api/auth/customer/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"New Owner","password":"CustomerPass123"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        MockHttpSession session = (MockHttpSession) registration.getRequest().getSession(false);

        String petJson = mockMvc.perform(post("/api/portal/pets")
                        .session(session)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Buddy","species":"Dog","breed":"Golden Retriever","sex":"MALE","weightKg":15.2}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Buddy"))
                .andExpect(jsonPath("$.ownerName").value("New Owner"))
                .andReturn().getResponse().getContentAsString();
        long petId = objectMapper.readTree(petJson).get("id").asLong();

        mockMvc.perform(post("/api/portal/appointments")
                        .session(session)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"petId":%d,"appointmentTime":"2099-06-01T14:30","reason":"First vaccination"}
                                """.formatted(petId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.petId").value(petId));
    }
}
