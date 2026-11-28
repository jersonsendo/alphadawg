package com.cit.vetclinic.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {
    @GetMapping({
            "/",
            "/login",
            "/staff",
            "/staff/{path:[^\\.]*}",
            "/customer",
            "/customer/{path:[^\\.]*}",
            "/portal",
            "/portal/{path:[^\\.]*}"
    })
    public String home() {
        return "forward:/index.html";
    }
}
