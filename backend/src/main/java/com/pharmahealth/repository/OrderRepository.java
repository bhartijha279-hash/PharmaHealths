package com.pharmahealth.repository;

import com.pharmahealth.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(Long userId);
    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Order> findAllByOrderByCreatedAtDesc();
    long countByUserId(Long userId);
    Optional<Order> findFirstByTrackingNumberIgnoreCase(String trackingNumber);
    boolean existsByTrackingNumber(String trackingNumber);
}
