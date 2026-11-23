package com.cit.vetclinic.api;

import com.cit.vetclinic.repository.ClinicUserRepository;
import com.cit.vetclinic.model.ClinicUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthApiIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClinicUserRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void registrationCreatesHashedAccountAndAuthenticatedSession() throws Exception {
        String email = "clinic-" + UUID.randomUUID() + "@example.com";
        MvcResult registration = mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"Clinic Staff","password":"StrongPass123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").exists())
                .andExpect(jsonPath("$.registrationAvailable").value(false))
                .andReturn();

        String storedHash = users.findByEmail(email).orElseThrow().getPassword();
        org.junit.jupiter.api.Assertions.assertNotEquals("StrongPass123", storedHash);
        org.junit.jupiter.api.Assertions.assertTrue(storedHash.startsWith("$2a$"));

        MockHttpSession session = (MockHttpSession) registration.getRequest().getSession(false);
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.displayName").value("Clinic Staff"));

        mockMvc.perform(get("/api/pets").session(session))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/pets").session(session))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginRejectsWrongPasswordAndDuplicateRegistration() throws Exception {
        String email = "clinic-" + UUID.randomUUID() + "@example.com";
        String payload = """
                {"email":"%s","displayName":"Clinic Staff","password":"StrongPass123"}
                """.formatted(email);
        mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"WrongPass123"}
                                """.formatted(email)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Email or password is incorrect."));

        mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"StrongPass123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true));
    }

    @Test
    void loginLocksAnAccountAfterFiveConsecutivePasswordFailures() throws Exception {
        String email = "lockout-" + UUID.randomUUID() + "@example.com";
        users.save(new ClinicUser(email, "Lockout Test", passwordEncoder.encode("StrongPass123")));

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .with(CsrfTestSupport.csrfToken(mockMvc))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"email":"%s","password":"WrongPass123"}
                                    """.formatted(email)))
                    .andExpect(status().isUnauthorized());
        }

        ClinicUser lockedUser = users.findByEmail(email).orElseThrow();
        assertEquals(5, lockedUser.getFailedLoginAttempts());
        assertFalse(lockedUser.isAccountNonLocked());

        mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"StrongPass123"}
                                """.formatted(email)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Email or password is incorrect."));
    }

    @Test
    void publicRegistrationClosesAfterBootstrapAdminAndAdminCanCreateStaff() throws Exception {
        String adminEmail = "bootstrap-" + UUID.randomUUID() + "@example.com";
        MvcResult registration = mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"Clinic Admin","password":"AdminPass123"}
                                """.formatted(adminEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andReturn();
        MockHttpSession adminSession = (MockHttpSession) registration.getRequest().getSession(false);

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationAvailable").value(false));
        mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"attacker@example.com","displayName":"Uninvited","password":"StrongPass123"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        "Public registration is closed. Contact a clinic administrator for an account."));

        MvcResult createdStaff = mockMvc.perform(post("/api/staff")
                        .session(adminSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"new-staff@example.com","displayName":"New Staff"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.staff.role").value("STAFF"))
                .andExpect(jsonPath("$.temporaryPassword").isNotEmpty())
                .andReturn();
        String temporaryPassword = objectMapper.readTree(createdStaff.getResponse().getContentAsString())
                .get("temporaryPassword").asText();
        ClinicUser staff = users.findByEmail("new-staff@example.com").orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(staff.isPasswordChangeRequired());
        org.junit.jupiter.api.Assertions.assertTrue(passwordEncoder.matches(temporaryPassword, staff.getPassword()));
    }

    @Test
    void protectedApiRequiresLogin() throws Exception {
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Please log in to continue."));
    }

    @Test
    void currentUserEndpointReportsAnAnonymousSession() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.registrationAvailable").value(true))
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void registrationValidatesEmailAndPasswordLength() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email","displayName":"Clinic Staff","password":"short"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void passwordCanBeChangedOnlyWithTheCurrentPassword() throws Exception {
        String email = "password-" + UUID.randomUUID() + "@example.com";
        MvcResult registration = mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"Password Test","password":"StrongPass123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession session = (MockHttpSession) registration.getRequest().getSession(false);
        MvcResult csrf = mockMvc.perform(get("/api/auth/csrf").session(session))
                .andExpect(status().isOk())
                .andReturn();
        Cookie csrfCookie = csrf.getResponse().getCookie("XSRF-TOKEN");

        mockMvc.perform(put("/api/account/password")
                        .session(session)
                        .cookie(csrfCookie)
                        .header("X-CSRF-TOKEN", csrfCookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"WrongPassword","newPassword":"UpdatedPass123"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/account/password")
                        .session(session)
                        .cookie(csrfCookie)
                        .header("X-CSRF-TOKEN", csrfCookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"StrongPass123","newPassword":"UpdatedPass123"}
                                """))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"UpdatedPass123"}
                                """.formatted(email)))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "STAFF")
    void staffCannotReadAdministratorDirectory() throws Exception {
        mockMvc.perform(get("/api/staff"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/staff")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"unauthorized@example.com","displayName":"Unauthorized"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void administratorResetRequiresStaffToChangeTemporaryPasswordBeforeUsingClinicApis() throws Exception {
        String suffix = UUID.randomUUID().toString();
        ClinicUser admin = new ClinicUser("admin-" + suffix + "@example.com", "Clinic Admin",
                passwordEncoder.encode("AdminPass123"));
        admin.setRole(ClinicUser.Role.ADMIN);
        admin = users.save(admin);
        ClinicUser staff = users.save(new ClinicUser("staff-" + suffix + "@example.com", "Clinic Staff",
                passwordEncoder.encode("OldPass123")));

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .with(CsrfTestSupport.csrfToken(mockMvc))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"email":"%s","password":"WrongPass123"}
                                    """.formatted(staff.getEmail())))
                    .andExpect(status().isUnauthorized());
        }

        MvcResult adminLogin = mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"AdminPass123"}
                                """.formatted(admin.getEmail())))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession adminSession = (MockHttpSession) adminLogin.getRequest().getSession(false);

        MvcResult reset = mockMvc.perform(post("/api/staff/" + staff.getId() + "/password-reset")
                        .session(adminSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.temporaryPassword").isNotEmpty())
                .andReturn();
        String temporaryPassword = objectMapper.readTree(reset.getResponse().getContentAsString())
                .get("temporaryPassword").asText();
        ClinicUser updatedStaff = users.findById(staff.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(updatedStaff.isPasswordChangeRequired());
        assertEquals(0, updatedStaff.getFailedLoginAttempts());
        org.junit.jupiter.api.Assertions.assertTrue(updatedStaff.isAccountNonLocked());
        org.junit.jupiter.api.Assertions.assertTrue(passwordEncoder.matches(temporaryPassword, updatedStaff.getPassword()));

        MvcResult staffLogin = mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(staff.getEmail(), temporaryPassword)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passwordChangeRequired").value(true))
                .andReturn();
        MockHttpSession staffSession = (MockHttpSession) staffLogin.getRequest().getSession(false);

        mockMvc.perform(get("/api/dashboard").session(staffSession))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Change your temporary password before continuing."));

        mockMvc.perform(put("/api/account/password")
                        .session(staffSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"%s","newPassword":"NewStaffPass123"}
                                """.formatted(temporaryPassword)))
                .andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertFalse(
                users.findById(staff.getId()).orElseThrow().isPasswordChangeRequired());
        mockMvc.perform(get("/api/dashboard").session(staffSession))
                .andExpect(status().isOk());
    }

    @Test
    void deactivatedStaffSessionsAreRevokedOnTheirNextApiRequest() throws Exception {
        String adminEmail = "admin-" + UUID.randomUUID() + "@example.com";
        MvcResult adminRegistration = mockMvc.perform(post("/api/auth/register")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"Clinic Admin","password":"AdminPass123"}
                                """.formatted(adminEmail)))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession adminSession = (MockHttpSession) adminRegistration.getRequest().getSession(false);

        String staffEmail = "staff-" + UUID.randomUUID() + "@example.com";
        ClinicUser staff = new ClinicUser(staffEmail, "Clinic Staff",
                passwordEncoder.encode("StaffPass123"));
        staff.setRole(ClinicUser.Role.STAFF);
        staff = users.save(staff);
        MvcResult staffLogin = mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"StaffPass123"}
                                """.formatted(staffEmail)))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession staffSession = (MockHttpSession) staffLogin.getRequest().getSession(false);
        mockMvc.perform(get("/api/dashboard").session(staffSession))
                .andExpect(status().isOk());

        ClinicUser admin = users.findByEmail(adminEmail).orElseThrow();
        assertEquals(ClinicUser.Role.ADMIN, users.findByEmail(adminEmail).orElseThrow().getRole());
        mockMvc.perform(get("/api/auth/me").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));
        mockMvc.perform(get("/api/staff").session(adminSession))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/staff/" + staff.getId())
                        .session(adminSession)
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"STAFF","active":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        mockMvc.perform(get("/api/dashboard").session(staffSession))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/login")
                        .with(CsrfTestSupport.csrfToken(mockMvc))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"StaffPass123"}
                                """.formatted(staffEmail)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        "This account is inactive. Contact a clinic administrator."));
    }
}
