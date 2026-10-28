import React, { useEffect, useState } from 'react';
import { prescriptionService } from '../services/api';

const TAX_RATE = 0.05; // must match the 5% pharmacy tax applied by the backend

export default function CartModal({ isOpen, onClose, cart, onUpdateQuantity, onRemove, onCheckout, currentUser, onNavigateToOrders, onOpenPrescription }) {
  const [shippingAddress, setShippingAddress] = useState(currentUser?.address || '123 Health Ave, Springfield');
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionId, setPrescriptionId] = useState('');

  const needsPrescription = cart.some(item => item.medicine.prescriptionRequired);

  useEffect(() => {
    if (!isOpen || !currentUser || !needsPrescription) return;
    prescriptionService.getMyPrescriptions(true)
      .then(res => {
        const usable = (res.data || []).filter(p => p.status !== 'REJECTED');
        setPrescriptions(usable);
        setPrescriptionId(prev => (usable.some(p => String(p.id) === String(prev)) ? prev : (usable[0]?.id ?? '')));
      })
      .catch(() => setPrescriptions([]));
  }, [isOpen, currentUser?.id, needsPrescription]);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + (item.medicine.price * item.quantity), 0);
  const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
  const totalAmount = subtotal + taxAmount;

  const userCoins = currentUser?.phCoins ?? 0;
  const hasSufficientCoins = userCoins >= totalAmount && totalAmount > 0;
  const cashbackCoins = (subtotal * 0.12).toFixed(2);

  const handlePlaceOrder = async () => {
    if (!currentUser) {
      alert('Please sign in first to place your order.');
      return;
    }
    if (paymentMethod === 'PH_COINS' && !hasSufficientCoins) {
      alert(`Insufficient PH Coins balance. You need 🪙${totalAmount.toFixed(2)} PH Coins, but your current balance is 🪙${userCoins.toFixed(2)}.`);
      return;
    }
    if (needsPrescription && !prescriptionId) {
      alert('Your basket contains Rx medicines. Please upload and select a prescription before placing the order.');
      return;
    }
    const exceedingItem = cart.find(item => item.quantity > (item.medicine.stockQuantity ?? 0));
    if (exceedingItem) {
      alert(`Insufficient stock! "${exceedingItem.medicine.name}" has only ${exceedingItem.medicine.stockQuantity} units available in stock, but you have ${exceedingItem.quantity} in your cart. Please reduce the quantity.`);
      return;
    }

    const placedAmount = totalAmount;
    const placedCashback = cashbackCoins;
    const placedMethod = paymentMethod;

    setLoading(true);
    try {
      await onCheckout({
        shippingAddress,
        contactPhone,
        paymentMethod,
        prescriptionId: needsPrescription ? Number(prescriptionId) : undefined,
        items: cart.map(item => ({
          medicineId: item.medicine.id,
          quantity: item.quantity
        }))
      });
      setLastOrderDetails({
        totalAmount: placedAmount,
        cashbackCoins: placedCashback,
        paymentMethod: placedMethod
      });
      setSuccess(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing order.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setSuccess(false);
    setLastOrderDetails(null);
    onClose();
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-dark text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-cart3 me-2 text-info"></i>Your Pharmacy Basket
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleModalClose}></button>
          </div>
          <div className="modal-body p-4">
            {success ? (
              <div className="text-center py-4">
                <i className="bi bi-check-circle-fill text-success display-3 mb-3"></i>
                <h4 className="text-white">Order Placed Successfully!</h4>
                <p className="text-muted">
                  {(lastOrderDetails?.paymentMethod || paymentMethod) === 'PH_COINS'
                    ? `Payment completed 100% using 🪙 ${Number(lastOrderDetails?.totalAmount ?? totalAmount).toFixed(2)} PH Coins. Zero extra cash needed.`
                    : (lastOrderDetails?.paymentMethod || paymentMethod) === 'CASH_ON_DELIVERY'
                      ? `Your order has been placed. 🪙 ${lastOrderDetails?.cashbackCoins ?? cashbackCoins} PH Coins (12% Cashback) will be credited once it is delivered and paid.`
                      : `Your order has been placed. 🪙 ${lastOrderDetails?.cashbackCoins ?? cashbackCoins} PH Coins (12% Cashback) has been credited to your wallet!`}
                </p>
                <div className="d-flex justify-content-center gap-2 mt-3">
                  <button className="btn btn-outline-light" onClick={handleModalClose}>
                    Continue Shopping
                  </button>
                  <button 
                    className="btn btn-primary fw-semibold" 
                    onClick={() => { 
                      handleModalClose();
                      if (onNavigateToOrders) onNavigateToOrders(); 
                    }}
                  >
                    <i className="bi bi-receipt-cutoff me-1"></i> View In My Orders
                  </button>
                </div>
              </div>
            ) : cart.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-basket display-4 d-block mb-3"></i>
                <p>Your basket is currently empty.</p>
              </div>
            ) : (
              <div>
                <div className="table-responsive mb-3">
                  <table className="table align-middle">
                    <thead>
                      <tr className="text-muted small">
                        <th>Medicine</th>
                        <th>Price</th>
                        <th style={{ width: '135px' }}>Quantity</th>
                        <th>Subtotal</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => {
                        const maxStock = item.medicine.stockQuantity ?? 0;
                        const isAtMax = item.quantity >= maxStock;

                        return (
                          <tr key={item.medicine.id}>
                            <td>
                              <strong>{item.medicine.name}</strong>
                              <div className="small text-muted">
                                {item.medicine.strength} • <span className={maxStock <= 5 ? 'text-warning' : 'text-info'}>In Stock: {maxStock}</span>
                              </div>
                            </td>
                            <td>₹{item.medicine.price.toFixed(2)}</td>
                            <td>
                              <div className="input-group input-group-sm">
                                <button 
                                  className="btn btn-outline-secondary" 
                                  onClick={() => onUpdateQuantity(item.medicine.id, item.quantity - 1)}
                                >-</button>
                                <span className="form-control text-center">{item.quantity}</span>
                                <button 
                                  className={`btn ${isAtMax ? 'btn-outline-warning' : 'btn-outline-secondary'}`}
                                  onClick={() => {
                                    if (isAtMax) {
                                      alert(`Insufficient stock! Only ${maxStock} units of "${item.medicine.name}" are available in stock.`);
                                    } else {
                                      onUpdateQuantity(item.medicine.id, item.quantity + 1);
                                    }
                                  }}
                                  title={isAtMax ? `Maximum available stock (${maxStock}) reached` : 'Add one more'}
                                >+</button>
                              </div>
                              {isAtMax && (
                                <div className="text-warning small mt-1" style={{ fontSize: '0.72rem' }}>
                                  <i className="bi bi-exclamation-circle me-1"></i>Max stock reached ({maxStock})
                                </div>
                              )}
                            </td>
                            <td className="fw-bold">₹{(item.medicine.price * item.quantity).toFixed(2)}</td>
                            <td>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => onRemove(item.medicine.id)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-top pt-3">
                  <h6 className="fw-bold mb-3">Delivery Information</h6>
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small">Shipping Address</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        value={shippingAddress} 
                        onChange={(e) => setShippingAddress(e.target.value)} 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small">Contact Phone</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        value={contactPhone} 
                        onChange={(e) => setContactPhone(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>

                {needsPrescription && (
                  <div className="border-top pt-3 mb-3">
                    <h6 className="fw-bold mb-2 text-white">
                      <i className="bi bi-file-earmark-medical me-2 text-warning"></i>Prescription Required
                    </h6>
                    {prescriptions.length > 0 ? (
                      <select
                        className="form-select form-select-sm"
                        value={prescriptionId}
                        onChange={(e) => setPrescriptionId(e.target.value)}
                      >
                        {prescriptions.map(p => (
                          <option key={p.id} value={p.id}>
                            #{p.id} • {p.doctorName || 'Unknown doctor'} • {p.status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="small text-warning">
                        Your basket contains Rx medicines but you have no prescription on file.{' '}
                        {onOpenPrescription && (
                          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onOpenPrescription}>
                            Upload a prescription
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="border-top pt-3 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0 text-white">Select Payment Mode</h6>
                    {currentUser && (
                      <span className="small text-secondary">
                        Wallet: <strong className="text-success">🪙 {userCoins.toFixed(2)} PH Coins</strong>
                      </span>
                    )}
                  </div>

                  <div className="row g-2 mb-3">
                    {/* 1. PH Coins Direct Payment */}
                    <div className="col-md-6">
                      <div 
                        className={`p-3 rounded-3 border text-center h-100 ${paymentMethod === 'PH_COINS' ? 'border-success' : 'border-secondary border-opacity-25'} ${!hasSufficientCoins ? 'opacity-75' : ''}`}
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: paymentMethod === 'PH_COINS' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(2, 132, 199, 0.25)' 
                        }}
                        onClick={() => {
                          if (hasSufficientCoins) {
                            setPaymentMethod('PH_COINS');
                          } else {
                            alert(`Insufficient PH Coins! You have 🪙 ${userCoins.toFixed(2)} PH Coins, but your cart total is ₹${totalAmount.toFixed(2)} (🪙 ${totalAmount.toFixed(2)} PH Coins required).`);
                          }
                        }}
                      >
                        <div className="fs-4 mb-1">🪙</div>
                        <strong className="d-block text-white small">Pay with PH Coins</strong>
                        <div className={`small ${hasSufficientCoins ? 'text-success' : 'text-warning'}`} style={{ fontSize: '0.75rem' }}>
                          {hasSufficientCoins 
                            ? `✓ 100% Covered (Bal: 🪙${userCoins.toFixed(2)})` 
                            : `Short by 🪙${(totalAmount - userCoins).toFixed(2)} (Bal: 🪙${userCoins.toFixed(2)})`}
                        </div>
                      </div>
                    </div>

                    {/* Standard Payment Modes */}
                    {[
                      { id: 'UPI', icon: 'bi-qr-code-scan', label: 'UPI / QR', sub: 'Google Pay, PhonePe, Paytm' },
                      { id: 'CARD', icon: 'bi-credit-card-2-front', label: 'Card Payment', sub: 'Visa, MasterCard, RuPay' },
                      { id: 'CASH_ON_DELIVERY', icon: 'bi-cash-stack', label: 'Cash on Delivery', sub: 'Pay cash on receipt' }
                    ].map(m => (
                      <div key={m.id} className="col-md-6 col-lg-2 flex-fill">
                        <div 
                          className={`p-3 rounded-3 border text-center h-100 ${paymentMethod === m.id ? 'border-info' : 'border-secondary border-opacity-25'}`}
                          style={{ cursor: 'pointer', backgroundColor: paymentMethod === m.id ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.25)' }}
                          onClick={() => setPaymentMethod(m.id)}
                        >
                          <div className={`fs-4 ${m.id === 'CASH_ON_DELIVERY' ? 'text-warning' : 'text-info'} mb-1`}><i className={`bi ${m.icon}`}></i></div>
                          <strong className="d-block text-white small">{m.label}</strong>
                          <div className="text-white-50" style={{ fontSize: '0.75rem' }}>{m.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Mode Highlight / Reward Notice */}
                  {paymentMethod === 'PH_COINS' ? (
                    <div className="p-2 rounded mb-2 small d-flex align-items-center gap-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981' }}>
                      <i className="bi bi-check-circle-fill text-success fs-5"></i>
                      <span className="text-white">
                        <strong>PH Coin Direct Payment:</strong> 🪙 {totalAmount.toFixed(2)} will be deducted from your wallet. <strong>Zero extra cash needed!</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 rounded mb-2 small d-flex align-items-center gap-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                      <span className="fs-5">🪙</span>
                      <span className="text-white">
                        You will earn <strong className="text-success">🪙 {cashbackCoins} PH Coins (12% Cashback)</strong> on this order{paymentMethod === 'CASH_ON_DELIVERY' ? ' once it is delivered and paid' : ''}!
                      </span>
                    </div>
                  )}
                </div>

                <div className="d-flex justify-content-between small text-white-50 px-3">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between small text-white-50 px-3 mb-2">
                  <span>Pharmacy Tax (5%)</span>
                  <span>₹{taxAmount.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-3 rounded mb-3" style={{ backgroundColor: 'rgba(2, 132, 199, 0.45)', border: '1px solid rgba(52, 211, 153, 0.4)' }}>
                  <span className="fs-5 text-white">Total Amount:</span>
                  <span className="fs-4 fw-bold text-info">₹{totalAmount.toFixed(2)}</span>
                </div>

                <div>
                  <button 
                    className="btn btn-primary w-100 py-2 fw-semibold" 
                    onClick={handlePlaceOrder}
                    disabled={loading}
                  >
                    {loading ? 'Processing Order...' : paymentMethod === 'PH_COINS' ? `Pay 🪙 ${totalAmount.toFixed(2)} PH Coins` : 'Confirm & Place Order'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
