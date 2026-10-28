import React, { useState, useEffect } from 'react';
import { orderService, billService } from '../services/api';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function CustomerOrders({ currentUser, onOpenLogin }) {
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const loadData = async (forceFresh = false, isSilent = false) => {
    if (!currentUser) return;
    if (!isSilent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const [orderRes, billRes] = await Promise.all([
        orderService.getMyOrders(forceFresh),
        billService.getMyBills(forceFresh)
      ]);
      setOrders(orderRes.data);
      setBills(billRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false, false);
  }, [currentUser]);

  // Periodic Auto-Refresh for real-time tracking of order and delivery status
  useAutoRefresh(() => {
    if (currentUser) {
      loadData(true, true);
    }
  }, 12000);

  if (!currentUser) {
    return (
      <div className="container py-5 text-center">
        <i className="bi bi-person-lock display-3 text-info mb-3 d-block"></i>
        <h4 className="text-white">Authentication Required</h4>
        <p className="text-muted">Please sign in to view your orders and billing records.</p>
        <button className="btn btn-primary" onClick={onOpenLogin}>Sign In</button>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold mb-1 text-white">
            <i className="bi bi-bag-check text-info me-2"></i>My Orders & Invoices
          </h3>
          <p className="text-muted small mb-0">View medication order history, live dispatch status, and download official tax receipts.</p>
        </div>
        <button 
          className="btn btn-primary btn-sm d-flex align-items-center gap-1" 
          onClick={() => loadData(true, false)}
          disabled={loading || isRefreshing}
        >
          <i className={`bi bi-arrow-clockwise ${(loading || isRefreshing) ? 'spin' : ''}`}></i>
          <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-5 text-muted card rounded-4 shadow-sm p-5">
          <i className="bi bi-cart-x display-3 mb-3 d-block text-info"></i>
          <h5 className="text-white">No Orders Placed Yet</h5>
          <p>Browse our pharmacy catalog and order prescription or OTC medications.</p>
        </div>
      ) : (
        <div className="row g-4">
          {orders.map(order => {
            const matchingBill = bills.find(b => b.order?.id === order.id);

            return (
              <div key={order.id} className="col-lg-6">
                <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
                  <div className="card-header p-3 d-flex justify-content-between align-items-center">
                    <div>
                      <span className="text-muted small">Order ID</span>
                      <strong className="d-block text-white">#{order.id}</strong>
                    </div>
                    <div>
                      <span className="text-muted small">Date</span>
                      <strong className="d-block text-secondary">{new Date(order.createdAt || order.orderDate || Date.now()).toLocaleDateString()}</strong>
                    </div>
                    <div>
                      <span className={`small fw-semibold ${order.status === 'DELIVERED' ? 'text-success' : 'text-info'}`}>
                        {order.status === 'PENDING' ? 'CONFIRMED' : order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="card-body p-3">
                    <div className="mb-3">
                      <div className="small text-muted mb-1">Ordered Medicines:</div>
                      <div className="list-group list-group-flush border rounded-3">
                        {order.items?.map(it => (
                          <div key={it.id} className="list-group-item py-2 d-flex justify-content-between small">
                            <span className="text-white">{it.medicine?.name || it.medicineName || 'Medication'} <span className="text-muted">x{it.quantity}</span></span>
                            <span className="fw-semibold text-info">₹{it.totalPrice?.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center p-2 rounded mb-2" style={{ backgroundColor: 'rgba(2, 132, 199, 0.35)', border: '1px solid rgba(52, 211, 153, 0.4)' }}>
                      <span className="small text-muted">Grand Total:</span>
                      <span className="fw-bold text-info fs-5">₹{order.totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3 small">
                      <div>
                        <span className="text-muted me-1">Payment:</span>
                        <span className="text-secondary">{order.paymentMethod}</span>
                      </div>
                      <div className="text-secondary text-truncate" style={{ maxWidth: '180px' }}>
                        <i className="bi bi-geo-alt me-1 text-info"></i>{order.shippingAddress || 'Address on file'}
                      </div>
                    </div>

                    <div className="d-flex gap-2">
                      {matchingBill && (
                        <button 
                          className="btn btn-outline-primary btn-sm w-100"
                          onClick={() => setSelectedBill(matchingBill)}
                        >
                          <i className="bi bi-receipt me-1"></i> View Official Invoice Receipt
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bill Receipt Modal */}
      {selectedBill && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-receipt text-info me-2"></i>Invoice #{selectedBill.invoiceNumber}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedBill(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="text-center mb-4 pb-2 border-bottom border-secondary border-opacity-25">
                  <h4 className="fw-bold text-info mb-0">PharmaHealth Dispensary</h4>
                  <p className="text-muted small">Certified Clinical & Pharmaceutical Services</p>
                </div>

                <div className="row g-2 small mb-3">
                  <div className="col-6">
                    <span className="text-muted">Billed To:</span>
                    <strong className="d-block text-white">{selectedBill.user?.fullName || selectedBill.user?.username}</strong>
                    <span className="text-muted">{selectedBill.user?.email}</span>
                  </div>
                  <div className="col-6 text-end">
                    <span className="text-muted">Date:</span>
                    <strong className="d-block text-white">{new Date(selectedBill.billDate).toLocaleDateString()}</strong>
                    <span className="badge bg-success text-white">
                      {selectedBill.paymentStatus === 'PENDING' ? 'CONFIRMED' : selectedBill.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="table-responsive mb-3">
                  <table className="table table-sm">
                    <thead>
                      <tr className="small text-info">
                        <th>Description</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-white">Order #{selectedBill.order?.id} Pharmaceuticals</td>
                        <td className="text-end text-white">₹{selectedBill.subtotal?.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="text-white">Pharmacy Tax & Handling (5%)</td>
                        <td className="text-end text-white">₹{selectedBill.taxAmount?.toFixed(2)}</td>
                      </tr>
                      <tr className="fw-bold border-top border-secondary border-opacity-50">
                        <td className="text-white">Total Paid</td>
                        <td className="text-end text-info fs-5">₹{selectedBill.totalAmount?.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-2 rounded small text-muted" style={{ backgroundColor: 'rgba(4, 26, 20, 0.6)', border: '1px solid var(--border-color)' }}>
                  Transaction Reference: <code>{selectedBill.transactionId || 'N/A'}</code><br/>
                  Payment Method: <span className="text-white">{selectedBill.paymentMethod}</span>
                </div>
              </div>
              <div className="modal-footer justify-content-between">
                <button className="btn btn-outline-light btn-sm" onClick={() => window.print()}>
                  <i className="bi bi-printer me-1"></i> Print Receipt
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setSelectedBill(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
