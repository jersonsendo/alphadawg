package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.Owner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OwnerRepository extends JpaRepository<Owner, Long> {
    Optional<Owner> findFirstByNameIgnoreCaseAndEmailIsNull(String name);

    Optional<Owner> findByEmailIgnoreCase(String email);
}
