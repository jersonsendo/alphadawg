package com.cit.vetclinic;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import com.cit.vetclinic.model.ClinicUser;
import com.cit.vetclinic.model.AppointmentBookingLock;
import com.cit.vetclinic.model.Owner;
import com.cit.vetclinic.model.Pet;
import com.cit.vetclinic.repository.AppointmentBookingLockRepository;
import com.cit.vetclinic.repository.ClinicUserRepository;
import com.cit.vetclinic.repository.OwnerRepository;
import com.cit.vetclinic.repository.PetRepository;
import org.springframework.beans.factory.annotation.Value;

@SpringBootApplication
public class VetClinicApplication {

    public static void main(String[] args) {
        SpringApplication.run(VetClinicApplication.class, args);
    }

    @Bean
    CommandLineRunner seedData(PetRepository pets, OwnerRepository owners, ClinicUserRepository users,
                               AppointmentBookingLockRepository bookingLocks,
                               @Value("${app.seed-demo-data:true}") boolean seedDemoData) {
        return args -> {
            if (!bookingLocks.existsById(1L)) {
                bookingLocks.save(new AppointmentBookingLock(1L));
            }
            if (seedDemoData && pets.count() == 0) {
                pets.save(new Pet("Bantay", "Dog", "Aspin", "Maria Santos"));
                pets.save(new Pet("Mingming", "Cat", "Puspin", "Juan Dela Cruz"));
                pets.save(new Pet("Coco", "Dog", "Shih Tzu", "Ana Reyes"));
            }
            for (Pet pet : pets.findAll()) {
                boolean changed = false;
                if (pet.getStoredArchived() == null) {
                    pet.setArchived(false);
                    changed = true;
                }
                if (pet.getOwner() == null && pet.getOwnerName() != null && !pet.getOwnerName().isBlank()) {
                    Owner owner = owners.findFirstByNameIgnoreCaseAndEmailIsNull(pet.getOwnerName())
                            .orElseGet(() -> owners.save(new Owner(pet.getOwnerName(), null, null, null)));
                    pet.setOwner(owner);
                    changed = true;
                }
                if (changed) {
                    pets.save(pet);
                }
            }
            var staff = users.findAllByOrderByCreatedAtAsc();
            boolean hasAdmin = staff.stream().anyMatch(user -> user.getStoredRole() == ClinicUser.Role.ADMIN);
            boolean assignedAdmin = hasAdmin;
            for (ClinicUser user : staff) {
                if (user.getStoredRole() == null) {
                    user.setRole(assignedAdmin ? ClinicUser.Role.STAFF : ClinicUser.Role.ADMIN);
                    assignedAdmin = true;
                    users.save(user);
                }
            }
        };
    }
}
