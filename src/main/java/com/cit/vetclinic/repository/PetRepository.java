package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.Pet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Sort;

import java.util.List;

public interface PetRepository extends JpaRepository<Pet, Long> {
    long countByArchivedFalse();
    long countByOwnerIdAndArchivedFalse(Long ownerId);
    List<Pet> findAllByArchivedFalse(Sort sort);
    List<Pet> findAllByArchivedTrue(Sort sort);
}
