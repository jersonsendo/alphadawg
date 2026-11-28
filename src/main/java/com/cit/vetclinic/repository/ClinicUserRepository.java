package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.ClinicUser;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;
import java.util.List;

public interface ClinicUserRepository extends JpaRepository<ClinicUser, Long> {
    Optional<ClinicUser> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from ClinicUser user where user.email = :email")
    Optional<ClinicUser> lockByEmail(@Param("email") String email);

    boolean existsByEmail(String email);

    long countByRoleIn(Collection<ClinicUser.Role> roles);

    List<ClinicUser> findAllByOrderByCreatedAtAsc();

    List<ClinicUser> findByRoleInOrderByCreatedAtAsc(Collection<ClinicUser.Role> roles);
}
