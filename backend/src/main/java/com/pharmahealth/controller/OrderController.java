package com.pharmahealth.controller;

import com.pharmahealth.model.*;
import com.pharmahealth.payload.request.OrderRequest;
import com.pharmahealth.payload.response.MessageResponse;
import com.pharmahealth.repository.*;
import com.pharmahealth.security.UserDetailsImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/orders")
@Tag(name = "Order & Delivery Management", description = "Order processing, deliveries, and tracking")
@SecurityRequirement(name = "Bearer Authentication")
public class OrderController {

    private static final BigDecimal TAX_RATE = new BigDecimal("0.05"); // 5% pharmacy tax
    private static final double CASHBACK_RATE = 0.12; // 12% PH Coin reward on subtotal
    private static final Random RANDOM = new Random();

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private MedicineRepository medicineRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private BillRepository billRepository;

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN') or hasRole('PHARMACIST')")
    @Operation(summary = "List all customer orders with delivery status (Admin view)")
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderRepository.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/my")
    @Transactional(readOnly = true)
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List current user orders (Customer view)")
    public ResponseEntity<List<Order>> getMyOrders(Authentication authentication) {
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return ResponseEntity.ok(orderRepository.findByUserIdOrderByCreatedAtDesc(userDetails.getId()));
    }

    @GetMapping("/track/{trackingNumber}")
    @Transactional(readOnly = true)
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Track delivery by tracking number (own orders only, staff can track any)")
    public ResponseEntity<?> trackDelivery(@PathVariable String trackingNumber, Authentication authentication) {
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        boolean isStaff = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_PHARMACIST"));

        return orderRepository.findFirstByTrackingNumberIgnoreCase(trackingNumber)
                .filter(o -> isStaff || o.getUser().getId().equals(userDetails.getId()))
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Transactional
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Place order, decrease stock, generate tracking number and invoice bill")
    public ResponseEntity<?> placeOrder(@Valid @RequestBody OrderRequest req, Authentication authentication) {
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        // 1. Validate everything before mutating anything, so a rejected order leaves stock and wallet untouched
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (OrderRequest.OrderItemRequest itemReq : req.getItems()) {
            if (itemReq.getMedicineId() == null || itemReq.getQuantity() == null || itemReq.getQuantity() <= 0) {
                throw new IllegalArgumentException("Each order item needs a medicine and a quantity of at least 1.");
            }
            quantities.merge(itemReq.getMedicineId(), itemReq.getQuantity(), Integer::sum);
        }

        Map<Medicine, Integer> lines = new LinkedHashMap<>();
        boolean prescriptionNeeded = false;
        BigDecimal subtotal = BigDecimal.ZERO;
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            Medicine medicine = medicineRepository.findById(entry.getKey())
                    .orElseThrow(() -> new IllegalArgumentException("Medicine ID not found: " + entry.getKey()));
            int quantity = entry.getValue();

            if (medicine.getStockQuantity() < quantity) {
                return ResponseEntity.badRequest().body(new MessageResponse("Insufficient stock for: " + medicine.getName() + " (Only " + medicine.getStockQuantity() + " units available)."));
            }

            prescriptionNeeded |= Boolean.TRUE.equals(medicine.getPrescriptionRequired());
            subtotal = subtotal.add(medicine.getPrice().multiply(BigDecimal.valueOf(quantity)));
            lines.put(medicine, quantity);
        }

        Prescription prescription = null;
        if (req.getPrescriptionId() != null) {
            prescription = prescriptionRepository.findById(req.getPrescriptionId())
                    .filter(p -> p.getUser().getId().equals(user.getId()))
                    .orElse(null);
            if (prescription == null) {
                return ResponseEntity.badRequest().body(new MessageResponse("Prescription not found."));
            }
            if (prescription.getStatus() == Prescription.PrescriptionStatus.REJECTED) {
                return ResponseEntity.badRequest().body(new MessageResponse("The selected prescription was rejected. Please upload a new one."));
            }
        }
        if (prescriptionNeeded && prescription == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Your basket contains Rx medicines. Please upload and attach a prescription to place this order."));
        }

        BigDecimal taxAmount = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal grandTotal = subtotal.add(taxAmount);
        double rewardCoins = round2(subtotal.doubleValue() * CASHBACK_RATE);

        String rawMethod = req.getPaymentMethod() != null ? req.getPaymentMethod().trim().toUpperCase() : "CARD";
        String normalizedMethod;
        if (rawMethod.contains("PH_COIN") || rawMethod.contains("COIN")) {
            normalizedMethod = "PH_COINS";
        } else if (rawMethod.contains("COD") || rawMethod.contains("CASH") || rawMethod.contains("DELIVERY")) {
            normalizedMethod = "CASH_ON_DELIVERY";
        } else if (rawMethod.contains("UPI")) {
            normalizedMethod = "UPI";
        } else {
            normalizedMethod = "CARD";
        }
        boolean isPaid = !normalizedMethod.equals("CASH_ON_DELIVERY");

        if (normalizedMethod.equals("PH_COINS") && user.getPhCoins() < grandTotal.doubleValue()) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                String.format("Insufficient PH Coins balance. Order total (incl. tax) requires %.2f PH Coins, but your current balance is %.2f PH Coins.",
                    grandTotal.doubleValue(), user.getPhCoins())));
        }

        // 2. Apply stock and wallet changes
        List<OrderItem> items = new ArrayList<>();
        for (Map.Entry<Medicine, Integer> line : lines.entrySet()) {
            Medicine medicine = line.getKey();
            int quantity = line.getValue();
            medicine.setStockQuantity(medicine.getStockQuantity() - quantity);
            medicineRepository.save(medicine);

            BigDecimal lineTotal = medicine.getPrice().multiply(BigDecimal.valueOf(quantity));
            items.add(new OrderItem(null, medicine, quantity, medicine.getPrice(), lineTotal));
        }

        if (normalizedMethod.equals("PH_COINS")) {
            user.setPhCoins(round2(user.getPhCoins() - grandTotal.doubleValue()));
        } else if (isPaid) {
            // Cash on delivery earns its cashback once the order is delivered and paid
            user.setPhCoins(round2(user.getPhCoins() + rewardCoins));
        }
        userRepository.save(user);

        Order order = new Order();
        order.setUser(user);
        order.setShippingAddress(req.getShippingAddress());
        order.setContactPhone(req.getContactPhone());
        order.setPaymentMethod(normalizedMethod);
        order.setStatus(Order.OrderStatus.PENDING);
        order.setPaymentStatus(isPaid ? Order.PaymentStatus.PAID : Order.PaymentStatus.PENDING);
        order.setTrackingNumber(generateTrackingNumber());
        order.setEstimatedDeliveryDate(LocalDateTime.now().plusDays(2));
        order.setDeliveryNotes(normalizedMethod.equals("PH_COINS")
            ? "Paid 100% using " + grandTotal + " PH Coins. Dispensary packing in progress."
            : isPaid
                ? "Payment confirmed via " + normalizedMethod + ". Earned +" + rewardCoins + " PH Coins (12% Cashback)."
                : "Cash on Delivery (COD) selected. Earn +" + rewardCoins + " PH Coins once delivered and paid.");
        order.setPrescription(prescription);
        order.setTotalAmount(grandTotal);
        for (OrderItem it : items) {
            it.setOrder(order);
        }
        order.setItems(items);

        Order saved = orderRepository.save(order);

        // Automatically generate Billing record & invoice
        Bill bill = new Bill();
        bill.setOrder(saved);
        bill.setUser(user);
        bill.setInvoiceNumber(String.format("INV-PH-%06d", saved.getId()));
        bill.setSubtotal(subtotal);
        bill.setTaxAmount(taxAmount);
        bill.setDiscountAmount(BigDecimal.ZERO);
        bill.setTotalAmount(grandTotal);
        bill.setPaymentStatus(isPaid ? Bill.PaymentStatus.PAID : Bill.PaymentStatus.PENDING);
        bill.setPaymentMethod(normalizedMethod);
        bill.setTransactionId(normalizedMethod.equals("PH_COINS")
            ? "PH-COIN-TXN-" + System.currentTimeMillis()
            : isPaid ? "TXN-" + System.currentTimeMillis() : "COD-PENDING-" + saved.getId());
        bill.setBillDate(LocalDateTime.now());
        billRepository.save(bill);

        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/status")
    @Transactional
    @PreAuthorize("hasRole('ADMIN') or hasRole('PHARMACIST')")
    @Operation(summary = "Update delivery status and milestones")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestParam Order.OrderStatus status,
            @RequestParam(required = false) String deliveryNotes) {

        Order order = orderRepository.findById(id).orElse(null);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }

        Order.OrderStatus current = order.getStatus();
        if (current == status) {
            return ResponseEntity.ok(order);
        }
        if (current == Order.OrderStatus.DELIVERED || current == Order.OrderStatus.CANCELLED) {
            return ResponseEntity.badRequest().body(new MessageResponse("Order is already " + current + " and can no longer be changed."));
        }
        if (status != Order.OrderStatus.CANCELLED && status.ordinal() < current.ordinal()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Order cannot move back from " + current + " to " + status + "."));
        }

        Bill bill = billRepository.findByOrderId(order.getId()).orElse(null);
        if (status == Order.OrderStatus.CANCELLED) {
            cancelOrder(order, bill);
        } else if (status == Order.OrderStatus.DELIVERED && order.getPaymentStatus() != Order.PaymentStatus.PAID) {
            settleCashOnDelivery(order, bill);
        }

        order.setStatus(status);
        if (deliveryNotes != null && !deliveryNotes.isBlank()) {
            order.setDeliveryNotes(deliveryNotes);
        } else {
            switch (status) {
                case PROCESSING -> order.setDeliveryNotes("Pharmacist verifying and packing pharmaceuticals.");
                case SHIPPED -> order.setDeliveryNotes("Dispatched via Cold-Chain Express Courier.");
                case OUT_FOR_DELIVERY -> order.setDeliveryNotes("Out for delivery with courier agent.");
                case DELIVERED -> order.setDeliveryNotes("Delivered and received at customer destination.");
                case CANCELLED -> order.setDeliveryNotes("Order cancelled.");
                default -> {}
            }
        }
        order.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(orderRepository.save(order));
    }

    // Returns stock, refunds PH Coin payments and takes back cashback that was credited for the order
    private void cancelOrder(Order order, Bill bill) {
        for (OrderItem item : order.getItems()) {
            Medicine medicine = item.getMedicine();
            if (medicine != null) {
                medicine.setStockQuantity(medicine.getStockQuantity() + item.getQuantity());
                medicineRepository.save(medicine);
            }
        }

        boolean wasPaid = order.getPaymentStatus() == Order.PaymentStatus.PAID;
        User user = order.getUser();
        if ("PH_COINS".equals(order.getPaymentMethod())) {
            user.setPhCoins(round2(user.getPhCoins() + order.getTotalAmount().doubleValue()));
        } else if (wasPaid) {
            user.setPhCoins(round2(Math.max(0, user.getPhCoins() - cashbackFor(order, bill))));
        }
        userRepository.save(user);

        order.setPaymentStatus(wasPaid ? Order.PaymentStatus.REFUNDED : Order.PaymentStatus.FAILED);
        if (bill != null) {
            bill.setPaymentStatus(wasPaid ? Bill.PaymentStatus.REFUNDED : Bill.PaymentStatus.FAILED);
            billRepository.save(bill);
        }
    }

    // Cash on delivery is paid on delivery, which is also when its cashback is earned
    private void settleCashOnDelivery(Order order, Bill bill) {
        User user = order.getUser();
        user.setPhCoins(round2(user.getPhCoins() + cashbackFor(order, bill)));
        userRepository.save(user);

        order.setPaymentStatus(Order.PaymentStatus.PAID);
        if (bill != null) {
            bill.setPaymentStatus(Bill.PaymentStatus.PAID);
            billRepository.save(bill);
        }
    }

    private double cashbackFor(Order order, Bill bill) {
        BigDecimal subtotal = bill != null && bill.getSubtotal() != null
                ? bill.getSubtotal()
                : order.getItems().stream().map(OrderItem::getTotalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        return round2(subtotal.doubleValue() * CASHBACK_RATE);
    }

    private String generateTrackingNumber() {
        String trackingNumber;
        do {
            trackingNumber = "PH-TRK-" + (100000 + RANDOM.nextInt(900000));
        } while (orderRepository.existsByTrackingNumber(trackingNumber));
        return trackingNumber;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
