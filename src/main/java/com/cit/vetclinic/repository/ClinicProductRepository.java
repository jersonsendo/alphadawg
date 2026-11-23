package com.cit.vetclinic.repository;

import com.cit.vetclinic.model.ClinicProduct;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ClinicProductRepository extends JpaRepository<ClinicProduct, Long> {
    List<ClinicProduct> findAllByOrderByNameAsc();
    boolean existsBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);
    Optional<ClinicProduct> findBySkuIgnoreCase(String sku);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select product from ClinicProduct product where product.id = :id")
    Optional<ClinicProduct> lockById(@Param("id") Long id);
}
