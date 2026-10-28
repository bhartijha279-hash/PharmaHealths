import React, { useState, useEffect } from 'react';
import { medicineService, orderService, prescriptionService, billService, supportService, userService } from '../services/api';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function AdminDashboard({ categories, onRefreshMedicines, activeTab = 'customers', onTabChange }) {
  const [internalTab, setInternalTab] = useState(activeTab);
  const tab = onTabChange ? activeTab : internalTab;
  const setTab = onTabChange ? onTabChange : setInternalTab;

  const [medicines, setMedicines] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customerSubTab, setCustomerSubTab] = useState('customers');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: ''
  });
  const [adminRegisterLoading, setAdminRegisterLoading] = useState(false);
  const [adminRegisterMsg, setAdminRegisterMsg] = useState('');
  const [adminRegisterError, setAdminRegisterError] = useState('');
  const [bills, setBills] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Response to support ticket
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketResponse, setTicketResponse] = useState('');

  // Selected Bill receipt view
  const [selectedBill, setSelectedBill] = useState(null);

  // Notifications active filter
  const [notifFilter, setNotifFilter] = useState('ALL');

  // New Medicine Form State
  const [newMed, setNewMed] = useState({
    name: '',
    manufacturer: '',
    price: '',
    stockQuantity: '',
    dosageForm: 'Tablet',
    strength: '500mg',
    manufactureDate: '',
    expiryDate: '',
    imageUrl: '',
    prescriptionRequired: false,
    description: ''
  });

  const loadData = async (forceFresh = false, isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      if (tab === 'customers') {
        const [custRes, staffRes] = await Promise.all([
          userService.getActiveCustomers(forceFresh),
          userService.getStaffMembers(forceFresh).catch(() => ({ data: [] }))
        ]);
        setCustomers(custRes.data);
        setStaff(staffRes.data);
      } else if (tab === 'inventory') {
        const res = await medicineService.getMedicines(null, '', forceFresh);
        setMedicines(res.data);
      } else if (tab === 'billing') {
        const res = await billService.getAllBills(forceFresh);
        setBills(res.data);
      } else if (tab === 'support') {
        const res = await supportService.getAllTickets(forceFresh);
        setTickets(res.data);
      } else if (tab === 'prescriptions') {
        const res = await prescriptionService.getAllPrescriptions(forceFresh);
        setPrescriptions(res.data);
      } else if (tab === 'notifications') {
        const [medRes, ticketRes, rxRes] = await Promise.all([
          medicineService.getMedicines(null, '', forceFresh),
          supportService.getAllTickets(forceFresh),
          prescriptionService.getAllPrescriptions(forceFresh)
        ]);
        setMedicines(medRes.data);
        setTickets(ticketRes.data);
        setPrescriptions(rxRes.data);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false, false);
  }, [tab]);

  // Real-time automatic background polling every 10 seconds
  useAutoRefresh(() => {
    loadData(true, true);
  }, 10000);


  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminRegisterLoading(true);
    setAdminRegisterMsg('');
    setAdminRegisterError('');
    try {
      await userService.createAdminUser(newAdmin);
      setAdminRegisterMsg('New Administrator registered successfully!');
      setNewAdmin({ fullName: '', username: '', email: '', phone: '', password: '' });
      loadData();
      setTimeout(() => {
        setIsAdminModalOpen(false);
        setAdminRegisterMsg('');
      }, 1500);
    } catch (err) {
      setAdminRegisterError(err.response?.data?.message || 'Failed to create administrator account.');
    } finally {
      setAdminRegisterLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    try {
      await medicineService.addMedicine({
        name: newMed.name,
        manufacturer: newMed.manufacturer,
        price: parseFloat(newMed.price),
        stockQuantity: parseInt(newMed.stockQuantity, 10),
        dosageForm: newMed.dosageForm,
        strength: newMed.strength,
        manufactureDate: newMed.manufactureDate || null,
        expiryDate: newMed.expiryDate || null,
        imageUrl: newMed.imageUrl,
        prescriptionRequired: newMed.prescriptionRequired,
        description: newMed.description
      });
      alert('Medicine added to catalog!');
      loadData(true);
      if (onRefreshMedicines) onRefreshMedicines(true);
      setNewMed({
        name: '',
        manufacturer: '',
        price: '',
        stockQuantity: '',
        dosageForm: 'Tablet',
        strength: '500mg',
        manufactureDate: '',
        expiryDate: '',
        imageUrl: '',
        prescriptionRequired: false,
        description: ''
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Error creating medicine.';
      alert(`Error creating medicine: ${errMsg}`);
    }
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('Image file size exceeds 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800; // Optimal catalog dimension

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to lightweight, high-quality JPEG data URL (~40-80KB)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setNewMed(prev => ({ ...prev, imageUrl: compressedDataUrl }));
        } catch (canvasErr) {
          // Fallback to raw data URL if canvas cannot process
          setNewMed(prev => ({ ...prev, imageUrl: event.target.result }));
        }
      };
      img.onerror = () => {
        setNewMed(prev => ({ ...prev, imageUrl: event.target.result }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setNewMed(prev => ({ ...prev, imageUrl: '' }));
  };

  const handleDeleteMedicine = async (medicine) => {
    const medId = typeof medicine === 'object' ? medicine.id : medicine;
    const medName = typeof medicine === 'object' ? medicine.name : 'this medicine';
    if (!window.confirm(`Are you sure you want to permanently delete "${medName}" from listed medicines?`)) return;
    try {
      await medicineService.deleteMedicine(medId);
      alert(`"${medName}" deleted successfully!`);
      loadData(true);
      if (onRefreshMedicines) onRefreshMedicines(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete medicine.';
      alert(msg);
    }
  };

  const handleUpdateBillStatus = async (id, status) => {
    try {
      await billService.updateBillStatus(id, status);
      loadData();
    } catch (err) {
      alert('Failed to update payment status.');
    }
  };

  const handleRespondTicket = async (e) => {
    e.preventDefault();
    if (!activeTicket) return;
    try {
      await supportService.respondToTicket(activeTicket.id, ticketResponse, 'RESOLVED');
      setActiveTicket(null);
      setTicketResponse('');
      loadData();
    } catch (err) {
      alert('Failed to respond to ticket.');
    }
  };

  const handleUpdatePrescriptionStatus = async (id, status) => {
    try {
      await prescriptionService.updateStatus(id, status);
      loadData();
    } catch (err) {
      alert('Failed to update prescription status.');
    }
  };

  return (
    <div className="container py-4">


      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted small mt-2">Loading control center data...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: CUSTOMERS & STAFF MANAGEMENT */}
          {tab === 'customers' && (

            <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white p-3 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm ${customerSubTab === 'customers' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setCustomerSubTab('customers')}
                  >
                    <i className="bi bi-people me-1"></i> Registered Customers ({customers.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${customerSubTab === 'staff' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setCustomerSubTab('staff')}
                  >
                    <i className="bi bi-shield-check me-1"></i> System Administrators ({staff.length})
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info text-white d-flex align-items-center gap-1"
                  onClick={() => {
                    setAdminRegisterMsg('');
                    setAdminRegisterError('');
                    setIsAdminModalOpen(true);
                  }}
                  style={{ backgroundColor: 'rgba(2, 132, 199, 0.25)', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                >
                  <i className="bi bi-person-plus-fill text-info"></i>
                  <span>Register New Admin</span>
                </button>
              </div>

              {customerSubTab === 'customers' ? (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light small">
                      <tr>
                        <th>Customer ID</th>
                        <th>Full Legal Name</th>
                        <th>Username / Email</th>
                        <th>Contact Phone</th>
                        <th>Registered Delivery Address</th>
                        <th>Orders Placed</th>
                        <th>Member Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-4 text-muted">No customers found.</td></tr>
                      ) : (
                        customers.map(c => (
                          <tr key={c.id}>
                            <td><strong>CUST-{c.id}</strong></td>
                            <td><strong>{c.fullName}</strong></td>
                            <td>
                              <div>{c.username}</div>
                              <div className="small text-muted">{c.email}</div>
                            </td>
                            <td>{c.phone || 'N/A'}</td>
                            <td className="small" style={{ maxWidth: '250px' }}>{c.address || 'Not specified'}</td>
                            <td>
                              <span className="badge bg-primary-subtle text-primary fs-6 px-2">
                                {c.totalOrders} Orders
                              </span>
                            </td>
                            <td className="small text-muted">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light small">
                      <tr>
                        <th>Admin ID</th>
                        <th>Full Legal Name</th>
                        <th>Username</th>
                        <th>Email Address</th>
                        <th>Contact Phone</th>
                        <th>Access Scope</th>
                        <th>Joined Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-4 text-muted">No administrators found.</td></tr>
                      ) : (
                        staff.map(u => (
                          <tr key={u.id}>
                            <td><strong>ADM-{u.id}</strong></td>
                            <td><strong>{u.fullName}</strong></td>
                            <td><code>@{u.username}</code></td>
                            <td>{u.email}</td>
                            <td>{u.phone || 'N/A'}</td>
                            <td>
                              <span className="badge bg-warning text-dark">
                                System Administrator
                              </span>
                            </td>
                            <td className="small text-muted">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVENTORY & STOCK */}
          {tab === 'inventory' && (
            <div className="row g-4">
              <div className="col-lg-4">
                <div className="card shadow-sm border-0 rounded-4">
                  <div className="card-header bg-primary text-white fw-semibold rounded-top-4">
                    <i className="bi bi-plus-circle me-2"></i>Add Medicine Supply
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleAddMedicine}>
                      <div className="mb-2">
                        <label className="form-label small fw-semibold">Medicine / Drug Name</label>
                        <input 
                          type="text" 
                          className="form-control form-control-sm" 
                          required 
                          placeholder="e.g. Paracetamol Extra"
                          value={newMed.name} 
                          onChange={e => setNewMed({...newMed, name: e.target.value})} 
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small fw-semibold">Manufacturer</label>
                        <input 
                          type="text" 
                          className="form-control form-control-sm" 
                          placeholder="e.g. Sun Pharma, Cipla"
                          value={newMed.manufacturer} 
                          onChange={e => setNewMed({...newMed, manufacturer: e.target.value})} 
                        />
                      </div>
                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <label className="form-label small fw-semibold">Dosage Form</label>
                          <select 
                            className="form-select form-select-sm" 
                            value={newMed.dosageForm} 
                            onChange={e => setNewMed({...newMed, dosageForm: e.target.value})}
                          >
                            <option value="Tablet">Tablet</option>
                            <option value="Capsule">Capsule</option>
                            <option value="Syrup">Syrup</option>
                            <option value="Injection">Injection</option>
                            <option value="Ointment">Ointment / Cream</option>
                            <option value="Drops">Drops (Eye / Ear)</option>
                            <option value="Inhaler">Inhaler</option>
                            <option value="Powder">Powder</option>
                            <option value="Lotion">Lotion / Gel</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="col-6">
                          <label className="form-label small fw-semibold">Strength</label>
                          <input 
                            type="text" 
                            className="form-control form-control-sm" 
                            placeholder="e.g. 500mg, 100ml"
                            value={newMed.strength} 
                            onChange={e => setNewMed({...newMed, strength: e.target.value})} 
                          />
                        </div>
                      </div>
                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <label className="form-label small fw-semibold">Price (₹)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            className="form-control form-control-sm" 
                            required 
                            placeholder="e.g. 150.00"
                            value={newMed.price} 
                            onChange={e => setNewMed({...newMed, price: e.target.value})} 
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label small fw-semibold">Stock Quantity</label>
                          <input 
                            type="number" 
                            className="form-control form-control-sm" 
                            required 
                            placeholder="e.g. 100"
                            value={newMed.stockQuantity} 
                            onChange={e => setNewMed({...newMed, stockQuantity: e.target.value})} 
                          />
                        </div>
                      </div>
                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <label className="form-label small fw-semibold">Mfg Date</label>
                          <input 
                            type="date" 
                            className="form-control form-control-sm" 
                            value={newMed.manufactureDate} 
                            onChange={e => setNewMed({...newMed, manufactureDate: e.target.value})} 
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label small fw-semibold">Expiry Date</label>
                          <input 
                            type="date" 
                            className="form-control form-control-sm" 
                            value={newMed.expiryDate} 
                            onChange={e => setNewMed({...newMed, expiryDate: e.target.value})} 
                          />
                        </div>
                      </div>
                      <div className="mb-2">
                        <label className="form-label small fw-semibold text-white">Upload Medicine Photo</label>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="form-control form-control-sm" 
                          onChange={handleImageFileChange}
                        />
                        <div className="form-text small">Select photo directly from your device (PNG, JPG, WEBP).</div>
                        {newMed.imageUrl && (
                          <div className="mt-2 p-2 border rounded position-relative d-flex align-items-center justify-content-between" style={{ backgroundColor: 'rgba(4, 26, 20, 0.9)' }}>
                            <div className="d-flex align-items-center gap-2">
                              <img src={newMed.imageUrl} alt="Preview" style={{ height: '48px', width: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                              <span className="small text-success fw-semibold"><i className="bi bi-check-circle me-1"></i>Image attached</span>
                            </div>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-danger" 
                              onClick={handleRemoveImage}
                              title="Remove photo"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mb-2">
                        <label className="form-label small fw-semibold">Description / Notes</label>
                        <textarea 
                          className="form-control form-control-sm" 
                          rows="2"
                          placeholder="Usage instructions, symptoms treated..."
                          value={newMed.description} 
                          onChange={e => setNewMed({...newMed, description: e.target.value})} 
                        ></textarea>
                      </div>
                      <div className="form-check mb-3">
                        <input className="form-check-input" type="checkbox" checked={newMed.prescriptionRequired} onChange={e => setNewMed({...newMed, prescriptionRequired: e.target.checked})} id="reqRx" />
                        <label className="form-check-label small" htmlFor="reqRx">Requires Prescription (Rx)</label>
                      </div>
                      <button type="submit" className="btn btn-primary btn-sm w-100 fw-semibold">Add Supply to Inventory</button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="col-lg-8">
                <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                  <div className="card-header bg-white p-3">
                    <h6 className="fw-bold mb-0">Medication Stock Level Inventory ({medicines.length})</h6>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light small">
                        <tr>
                          <th>Medication</th>
                          <th>Dosage &amp; Strength</th>
                          <th>Mfg / Expiry</th>
                          <th>Price</th>
                          <th>In Stock</th>
                          <th>Rx</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {medicines.map(m => {
                          const isExpired = m.expiryDate && new Date(m.expiryDate) < new Date();
                          const diffDays = m.expiryDate ? Math.ceil((new Date(m.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                          const isExpiringSoon = diffDays !== null && diffDays >= 0 && diffDays <= 60;

                          return (
                            <tr key={m.id}>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  {m.imageUrl ? (
                                    <img 
                                      src={m.imageUrl} 
                                      alt={m.name} 
                                      className="rounded border" 
                                      style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="badge bg-primary-subtle text-info p-2 rounded">
                                      <i className="bi bi-capsule fs-6"></i>
                                    </div>
                                  )}
                                  <div>
                                    <strong>{m.name}</strong>
                                    <div className="small text-muted">{m.manufacturer || 'Pharmaceutical'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="badge bg-secondary-subtle text-secondary">{m.dosageForm || 'Tablet'}</span>
                                <div className="small text-muted">{m.strength || 'Standard'}</div>
                              </td>
                              <td>
                                <div className="small text-muted">Mfg: {m.manufactureDate ? new Date(m.manufactureDate).toLocaleDateString() : 'N/A'}</div>
                                <div className="small">
                                  Exp: {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : 'N/A'}
                                  {isExpired ? (
                                    <span className="badge bg-danger ms-1">Expired</span>
                                  ) : isExpiringSoon ? (
                                    <span className="badge bg-warning text-dark ms-1">{diffDays}d left</span>
                                  ) : null}
                                </div>
                              </td>
                              <td><strong>₹{m.price.toFixed(2)}</strong></td>
                              <td>
                                <span className={`badge ${m.stockQuantity === 0 ? 'bg-danger' : m.stockQuantity > 50 ? 'bg-success' : m.stockQuantity > 10 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                                  {m.stockQuantity} units
                                </span>
                              </td>
                              <td>{m.prescriptionRequired ? 'Yes (Rx)' : 'No (OTC)'}</td>
                              <td>
                                <button 
                                  className="btn btn-outline-danger btn-sm rounded-pill px-2" 
                                  onClick={() => handleDeleteMedicine(m)}
                                  title={`Delete ${m.name}`}
                                >
                                  <i className="bi bi-trash me-1"></i> Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BILLS & PAYMENTS */}
          {tab === 'billing' && (
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white p-3 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0">Customer Bills, Invoices & Payment History ({bills.length})</h6>
                <button className="btn btn-sm btn-outline-secondary" onClick={loadData}>
                  <i className="bi bi-arrow-clockwise me-1"></i>Refresh
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small">
                    <tr>
                      <th>Invoice #</th>
                      <th>Order ID</th>
                      <th>Customer Name</th>
                      <th>Subtotal</th>
                      <th>Tax</th>
                      <th>Grand Total</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Transaction ID</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.length === 0 ? (
                      <tr><td colSpan="10" className="text-center py-4 text-muted">No billing records found.</td></tr>
                    ) : (
                      bills.map(b => (
                        <tr key={b.id}>
                          <td><strong>{b.invoiceNumber}</strong></td>
                          <td>#{b.order?.id}</td>
                          <td>
                            <div>{b.user?.fullName || b.user?.username}</div>
                            <div className="small text-muted">{b.user?.email}</div>
                          </td>
                          <td>₹{b.subtotal?.toFixed(2)}</td>
                          <td>₹{b.taxAmount?.toFixed(2)}</td>
                          <td className="fw-bold text-primary">₹{b.totalAmount?.toFixed(2)}</td>
                          <td><span className="badge bg-light text-dark border">{b.paymentMethod}</span></td>
                          <td>
                            <span className={`badge ${b.paymentStatus === 'PAID' ? 'bg-success text-white' : b.paymentStatus === 'PENDING' ? 'bg-warning text-dark' : 'bg-danger text-white'}`}>
                              <i className={`bi me-1 ${b.paymentStatus === 'PAID' ? 'bi-check-circle-fill' : b.paymentStatus === 'PENDING' ? 'bi-hourglass-split' : 'bi-x-circle'}`}></i>
                              {b.paymentStatus}
                            </span>
                          </td>
                          <td className="small text-muted"><code>{b.transactionId}</code></td>
                          <td>
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedBill(b)}>
                              <i className="bi bi-receipt"></i> Receipt
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SUPPORT TICKETS */}
          {tab === 'support' && (
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white p-3">
                <h6 className="fw-bold mb-0">Customer Support Inquiries & Helpdesk Inbox ({tickets.length})</h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small">
                    <tr>
                      <th>Ticket #</th>
                      <th>Patient / Customer</th>
                      <th>Category</th>
                      <th>Subject & Question</th>
                      <th>Current Status</th>
                      <th>Pharmacist Response</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-4 text-muted">No support tickets.</td></tr>
                    ) : (
                      tickets.map(t => (
                        <tr key={t.id}>
                          <td><strong>#{t.id}</strong></td>
                          <td>
                            <div>{t.user?.fullName || t.user?.username}</div>
                            <div className="small text-muted">{t.user?.phone || t.user?.email}</div>
                          </td>
                          <td><span className="badge bg-secondary-subtle text-secondary small">{t.category}</span></td>
                          <td style={{ maxWidth: '280px' }}>
                            <strong className="d-block text-dark">{t.subject}</strong>
                            <span className="small text-muted">{t.message}</span>
                          </td>
                          <td>
                            <span className={`badge ${t.status === 'RESOLVED' ? 'bg-success' : t.status === 'IN_PROGRESS' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="small" style={{ maxWidth: '220px' }}>
                            {t.adminResponse ? (
                              <span className="text-success"><i className="bi bi-check-circle me-1"></i>{t.adminResponse}</span>
                            ) : (
                              <span className="text-muted fst-italic">Pending reply</span>
                            )}
                          </td>
                          <td>
                            <button 
                              className="btn btn-outline-primary btn-sm rounded-pill"
                              onClick={() => {
                                setActiveTicket(t);
                                setTicketResponse(t.adminResponse || '');
                              }}
                            >
                              <i className="bi bi-reply me-1"></i>Reply & Resolve
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: PRESCRIPTIONS */}
          {tab === 'prescriptions' && (
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white p-3">
                <h6 className="fw-bold mb-0">Doctor Prescriptions Pending Verification ({prescriptions.length})</h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small">
                    <tr>
                      <th>Rx ID</th>
                      <th>Patient</th>
                      <th>Doctor / Clinic</th>
                      <th>Clinical Diagnosis</th>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-4 text-muted">No prescriptions pending.</td></tr>
                    ) : (
                      prescriptions.map(p => (
                        <tr key={p.id}>
                          <td><strong>RX-{p.id}</strong></td>
                          <td>{p.user?.fullName || p.user?.username}</td>
                          <td>{p.doctorName || 'Not specified'}</td>
                          <td>{p.diagnosis || 'None'}</td>
                          <td>
                            <a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-link">
                              <i className="bi bi-file-earmark-medical me-1"></i>View Document
                            </a>
                          </td>
                          <td>
                            <span className={`badge ${p.status === 'VERIFIED' ? 'bg-success' : p.status === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-outline-success" onClick={() => handleUpdatePrescriptionStatus(p.id, 'VERIFIED')}>Approve</button>
                              <button className="btn btn-outline-danger" onClick={() => handleUpdatePrescriptionStatus(p.id, 'REJECTED')}>Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS & SYSTEM ALERTS HUB */}
          {tab === 'notifications' && (() => {
            const now = new Date();
            const outOfStockMeds = medicines.filter(m => m.stockQuantity === 0);
            const lowStockMeds = medicines.filter(m => m.stockQuantity > 0 && m.stockQuantity <= 10);
            const expiredMeds = medicines.filter(m => m.expiryDate && new Date(m.expiryDate) < now);
            const expiringSoonMeds = medicines.filter(m => {
              if (!m.expiryDate) return false;
              const exp = new Date(m.expiryDate);
              const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
              return diffDays >= 0 && diffDays <= 60;
            });
            const pendingTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'PENDING');
            const pendingPrescriptions = prescriptions.filter(p => p.status === 'PENDING');
            const totalAlertsCount = outOfStockMeds.length + lowStockMeds.length + expiredMeds.length + expiringSoonMeds.length + pendingTickets.length + pendingPrescriptions.length;

            return (
              <div>
                {/* Notification Counters */}
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="card p-3 border-0 rounded-4 shadow-sm text-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                      <div className="fs-3 fw-bold text-danger">{outOfStockMeds.length + lowStockMeds.length}</div>
                      <div className="small text-white fw-semibold"><i className="bi bi-boxes me-1"></i>Stock Reminders</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{outOfStockMeds.length} empty, {lowStockMeds.length} low</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card p-3 border-0 rounded-4 shadow-sm text-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                      <div className="fs-3 fw-bold text-warning">{expiredMeds.length + expiringSoonMeds.length}</div>
                      <div className="small text-white fw-semibold"><i className="bi bi-calendar-x me-1"></i>Expiry Alerts</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{expiredMeds.length} expired, {expiringSoonMeds.length} expiring soon</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card p-3 border-0 rounded-4 shadow-sm text-center" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
                      <div className="fs-3 fw-bold text-info">{pendingTickets.length}</div>
                      <div className="small text-white fw-semibold"><i className="bi bi-chat-heart me-1"></i>Helpbox &amp; Complaints</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>Awaiting staff reply</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card p-3 border-0 rounded-4 shadow-sm text-center" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.35)' }}>
                      <div className="fs-3 fw-bold text-light">{pendingPrescriptions.length}</div>
                      <div className="small text-white fw-semibold"><i className="bi bi-file-earmark-medical me-1"></i>Pending Rx</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>Prescriptions to verify</div>
                    </div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="d-flex flex-wrap gap-2 mb-4">
                  <button 
                    className={`btn btn-sm rounded-pill px-3 ${notifFilter === 'ALL' ? 'btn-info text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setNotifFilter('ALL')}
                  >
                    All Notifications ({totalAlertsCount})
                  </button>
                  <button 
                    className={`btn btn-sm rounded-pill px-3 ${notifFilter === 'STOCK' ? 'btn-danger text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setNotifFilter('STOCK')}
                  >
                    Stock Alerts ({outOfStockMeds.length + lowStockMeds.length})
                  </button>
                  <button 
                    className={`btn btn-sm rounded-pill px-3 ${notifFilter === 'EXPIRY' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setNotifFilter('EXPIRY')}
                  >
                    Expiry Warnings ({expiredMeds.length + expiringSoonMeds.length})
                  </button>
                  <button 
                    className={`btn btn-sm rounded-pill px-3 ${notifFilter === 'SUPPORT' ? 'btn-info text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setNotifFilter('SUPPORT')}
                  >
                    Helpbox &amp; Complaints ({pendingTickets.length})
                  </button>
                  <button 
                    className={`btn btn-sm rounded-pill px-3 ${notifFilter === 'RX' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setNotifFilter('RX')}
                  >
                    Prescriptions ({pendingPrescriptions.length})
                  </button>
                </div>

                {/* Alert Feed List */}
                <div className="d-flex flex-column gap-3">
                  {totalAlertsCount === 0 && (
                    <div className="card border-0 rounded-4 shadow-sm p-5 text-center" style={{ backgroundColor: 'rgba(4, 26, 20, 0.7)' }}>
                      <i className="bi bi-check-circle-fill text-success display-3 mb-3 d-block"></i>
                      <h4 className="text-white">All Systems Clear!</h4>
                      <p className="text-muted">No low stock items, expired medications, or pending customer complaints at this time.</p>
                    </div>
                  )}

                  {/* 1. OUT OF STOCK ALERTS */}
                  {(notifFilter === 'ALL' || notifFilter === 'STOCK') && outOfStockMeds.map(m => (
                    <div key={`out-${m.id}`} className="card border-0 rounded-4 p-3 shadow-sm d-flex flex-row justify-content-between align-items-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', borderLeft: '5px solid #ef4444' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', fontSize: '1.3rem' }}>
                          <i className="bi bi-exclamation-octagon-fill"></i>
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="badge bg-danger">OUT OF STOCK (0 UNITS)</span>
                            <span className="text-muted small">Immediate Restock Required</span>
                          </div>
                          <h6 className="fw-bold text-white mb-0">{m.name} ({m.strength || 'Standard'})</h6>
                          <div className="small text-muted">Manufacturer: {m.manufacturer || 'General Pharma'} • Dosage: {m.dosageForm || 'Tablet'}</div>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-danger fw-semibold px-3" onClick={() => setTab('inventory')}>
                        <i className="bi bi-plus-circle me-1"></i> Restock
                      </button>
                    </div>
                  ))}

                  {/* 2. LOW STOCK ALERTS */}
                  {(notifFilter === 'ALL' || notifFilter === 'STOCK') && lowStockMeds.map(m => (
                    <div key={`low-${m.id}`} className="card border-0 rounded-4 p-3 shadow-sm d-flex flex-row justify-content-between align-items-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderLeft: '5px solid #f59e0b' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-warning text-dark d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', fontSize: '1.3rem' }}>
                          <i className="bi bi-box-seam"></i>
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="badge bg-warning text-dark">LOW STOCK REMINDER</span>
                            <span className="text-muted small">Only {m.stockQuantity} units remaining</span>
                          </div>
                          <h6 className="fw-bold text-white mb-0">{m.name} ({m.strength || 'Standard'})</h6>
                          <div className="small text-muted">Price: ₹{m.price.toFixed(2)} • Reorder recommended soon</div>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-warning fw-semibold px-3" onClick={() => setTab('inventory')}>
                        View Stock
                      </button>
                    </div>
                  ))}

                  {/* 3. EXPIRED MEDICINE ALERTS */}
                  {(notifFilter === 'ALL' || notifFilter === 'EXPIRY') && expiredMeds.map(m => (
                    <div key={`exp-${m.id}`} className="card border-0 rounded-4 p-3 shadow-sm d-flex flex-row justify-content-between align-items-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderLeft: '5px solid #dc2626' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', fontSize: '1.3rem' }}>
                          <i className="bi bi-calendar-x-fill"></i>
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="badge bg-danger">EXPIRED DRUG ALERT</span>
                            <span className="text-danger small fw-semibold">Expired on {new Date(m.expiryDate).toLocaleDateString()}</span>
                          </div>
                          <h6 className="fw-bold text-white mb-0">{m.name}</h6>
                          <div className="small text-muted">Quarantine this batch immediately to prevent patient distribution.</div>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-danger fw-semibold px-3" onClick={() => setTab('inventory')}>
                        Manage Batch
                      </button>
                    </div>
                  ))}

                  {/* 4. EXPIRING SOON ALERTS */}
                  {(notifFilter === 'ALL' || notifFilter === 'EXPIRY') && expiringSoonMeds.map(m => {
                    const diffDays = Math.ceil((new Date(m.expiryDate) - now) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={`soon-${m.id}`} className="card border-0 rounded-4 p-3 shadow-sm d-flex flex-row justify-content-between align-items-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderLeft: '5px solid #f59e0b' }}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="rounded-circle bg-warning text-dark d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', fontSize: '1.3rem' }}>
                            <i className="bi bi-hourglass-split"></i>
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="badge bg-warning text-dark">EXPIRING IN {diffDays} DAYS</span>
                              <span className="text-muted small">Expiry: {new Date(m.expiryDate).toLocaleDateString()}</span>
                            </div>
                            <h6 className="fw-bold text-white mb-0">{m.name} ({m.strength || 'Standard'})</h6>
                            <div className="small text-muted">Stock: {m.stockQuantity} units • Prioritize dispensing or supplier return</div>
                          </div>
                        </div>
                        <button className="btn btn-sm btn-outline-warning fw-semibold px-3" onClick={() => setTab('inventory')}>
                          Check Item
                        </button>
                      </div>
                    );
                  })}

                  {/* 5. SUPPORT & HELPBOX COMPLAINTS */}
                  {(notifFilter === 'ALL' || notifFilter === 'SUPPORT') && pendingTickets.map(t => (
                    <div key={`ticket-${t.id}`} className="card border-0 rounded-4 p-3 shadow-sm d-flex flex-row justify-content-between align-items-center" style={{ backgroundColor: 'rgba(56, 189, 248, 0.12)', borderLeft: '5px solid #38bdf8' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-info text-white d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', fontSize: '1.3rem' }}>
                          <i className="bi bi-chat-left-dots-fill"></i>
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="badge bg-info text-white">HELPBOX COMPLAINT #{t.id}</span>
                            <span className="badge bg-secondary-subtle text-secondary">{t.category}</span>
                            <span className="text-muted small">from {t.user?.fullName || t.user?.username}</span>
                          </div>
                          <h6 className="fw-bold text-white mb-0">{t.subject}</h6>
                          <div className="small text-muted text-truncate" style={{ maxWidth: '500px' }}>"{t.message}"</div>
                        </div>
                      </div>
                      <button 
                        className="btn btn-sm btn-info text-white fw-semibold px-3" 
                        onClick={() => { setActiveTicket(t); setTicketResponse(''); }}
                      >
                        Respond Now
                      </button>
                    </div>
                  ))}

                  {/* 6. PENDING PRESCRIPTIONS */}
                  {(notifFilter === 'ALL' || notifFilter === 'RX') && pendingPrescriptions.map(p => (
                    <div key={`rx-${p.id}`} className="card border-0 rounded-4 p-3 shadow-sm d-flex flex-row justify-content-between align-items-center" style={{ backgroundColor: 'rgba(168, 85, 247, 0.12)', borderLeft: '5px solid #a855f7' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', fontSize: '1.3rem' }}>
                          <i className="bi bi-file-earmark-medical-fill"></i>
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="badge bg-primary text-white">PRESCRIPTION RX-{p.id}</span>
                            <span className="text-muted small">Patient: {p.user?.fullName || p.user?.username}</span>
                          </div>
                          <h6 className="fw-bold text-white mb-0">Doctor: {p.doctorName || 'General Practitioner'}</h6>
                          <div className="small text-muted">Diagnosis: {p.diagnosis || 'Standard Prescription File'}</div>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-primary fw-semibold px-3" onClick={() => setTab('prescriptions')}>
                        Verify Rx
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Modal: Support Ticket Response */}
      {activeTicket && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-chat-heart me-2"></i>Respond to Customer Inquiry #{activeTicket.id}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveTicket(null)}></button>
              </div>
              <form onSubmit={handleRespondTicket}>
                <div className="modal-body p-4">
                  <div className="bg-light p-3 rounded-3 mb-3">
                    <span className="badge bg-secondary-subtle text-secondary small mb-1">{activeTicket.category}</span>
                    <h6 className="fw-bold mb-1">{activeTicket.subject}</h6>
                    <p className="small text-muted mb-0">"{activeTicket.message}"</p>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Your Pharmacist / Support Advice</label>
                    <textarea 
                      className="form-control" 
                      rows="4" 
                      required 
                      value={ticketResponse} 
                      onChange={(e) => setTicketResponse(e.target.value)}
                      placeholder="Type your clinical recommendations or delivery solution here..."
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-info text-white w-100 py-2 fw-semibold">
                    Submit Response & Mark Resolved
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bill Receipt Viewer */}
      {selectedBill && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">Invoice #{selectedBill.invoiceNumber}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedBill(null)}></button>
              </div>
              <div className="modal-body p-4">
                <h5 className="fw-bold text-primary mb-1">PharmaHealth Dispensary</h5>
                <p className="text-muted small mb-3">Official Transaction Receipt</p>

                <div className="row g-2 small mb-3 border-top pt-2">
                  <div className="col-6">
                    <span className="text-muted">Customer:</span>
                    <strong>{selectedBill.user?.fullName || selectedBill.user?.username}</strong>
                    <div>{selectedBill.user?.email}</div>
                  </div>
                  <div className="col-6 text-end">
                    <span className="text-muted">Status:</span>
                    <span className="badge bg-success d-block">{selectedBill.paymentStatus}</span>
                    <span className="text-muted small">{new Date(selectedBill.billDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="border-top pt-2 mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Subtotal:</span>
                    <span>₹{selectedBill.subtotal?.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Tax (5%):</span>
                    <span>₹{selectedBill.taxAmount?.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between fw-bold fs-5 border-top pt-1">
                    <span>Total Amount:</span>
                    <span className="text-primary">₹{selectedBill.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-light p-2 rounded small text-muted">
                  Transaction: <code>{selectedBill.transactionId}</code><br/>
                  Method: {selectedBill.paymentMethod}
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedBill(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW ADMINISTRATOR */}
      {isAdminModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-shield-lock-fill text-info me-2"></i>Register New Administrator
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsAdminModalOpen(false)}></button>
              </div>
              <form onSubmit={handleCreateAdmin}>
                <div className="modal-body p-4">
                  <div className="small text-muted mb-3">
                    Authorized administrators have full access to stock inventory, order statuses, prescription approvals, and billing.
                  </div>

                  {adminRegisterMsg && (
                    <div className="alert alert-success py-2 small mb-3">
                      <i className="bi bi-check-circle me-1"></i>{adminRegisterMsg}
                    </div>
                  )}
                  {adminRegisterError && (
                    <div className="alert alert-danger py-2 small mb-3">
                      <i className="bi bi-exclamation-triangle me-1"></i>{adminRegisterError}
                    </div>
                  )}

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Username <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="e.g. admin2"
                        value={newAdmin.username}
                        onChange={e => setNewAdmin({ ...newAdmin, username: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Full Legal Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="e.g. Dr. Alex Smith"
                        value={newAdmin.fullName}
                        onChange={e => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Email Address <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        placeholder="admin@pharmahealth.com"
                        value={newAdmin.email}
                        onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Contact Phone</label>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="+91 98765 43210"
                        value={newAdmin.phone}
                        onChange={e => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Access Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      value={newAdmin.password}
                      onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer bg-light p-3 d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={() => setIsAdminModalOpen(false)}
                    disabled={adminRegisterLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 fw-semibold text-white"
                    disabled={adminRegisterLoading}
                  >
                    {adminRegisterLoading ? 'Registering...' : 'Register Administrator'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
