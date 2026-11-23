package com.cit.vetclinic.api;

import jakarta.servlet.http.Cookie;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

final class CsrfTestSupport {
    private CsrfTestSupport() {}

    static RequestPostProcessor csrfToken(MockMvc mockMvc) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        if (cookie == null) {
            throw new IllegalStateException("CSRF endpoint did not return its token and cookie.");
        }
        return request -> {
            request.setCookies(cookie);
            request.addHeader("X-CSRF-TOKEN", cookie.getValue());
            return request;
        };
    }
}
