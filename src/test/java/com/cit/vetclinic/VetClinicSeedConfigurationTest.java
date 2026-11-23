package com.cit.vetclinic;

import com.cit.vetclinic.repository.PetRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "app.seed-demo-data=false",
        "spring.datasource.url=jdbc:h2:mem:vetclinic-no-demo;DB_CLOSE_DELAY=-1"
})
class VetClinicSeedConfigurationTest {
    @Autowired
    private PetRepository pets;

    @Test
    void demoPetsAreNotSeededWhenDisabled() {
        assertThat(pets.count()).isZero();
    }
}
