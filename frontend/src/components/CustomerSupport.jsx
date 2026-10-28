import React, { useState, useEffect } from 'react';
import { supportService } from '../services/api';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function CustomerSupport({ currentUser, onOpenLogin }) {
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('DELIVERY');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadTickets = async (forceFresh = false) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await supportService.getMyTickets(forceFresh);
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [currentUser]);

  useAutoRefresh(() => {
    if (currentUser) loadTickets(true);
  }, 12000);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    setSubmitting(true);
    setSuccessMsg('');
    try {
      await supportService.createTicket(subject, category, message);
      setSuccessMsg('Your support inquiry has been submitted! Our clinical team will respond shortly.');
      setSubject('');
      setMessage('');
      loadTickets();
    } catch (err) {
      alert('Failed to send support message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="fw-bold text-white">PharmaHealth Customer Support & Guidance</h2>
        <p className="text-muted">Have questions regarding medication dosage, your delivery status, or payments? We're here to help.</p>
      </div>

      <div className="row g-4">
        {/* Support Inquiry Form */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
            <h5 className="fw-bold mb-3 text-white">
              <i className="bi bi-chat-left-dots text-info me-2"></i>Send Us an Inquiry
            </h5>

            {successMsg && <div className="alert alert-success py-2 small">{successMsg}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-white">Inquiry Category</label>
                <select 
                  className="form-select" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="DELIVERY">Delivery & Courier Tracking</option>
                  <option value="ORDER">Order & Prescription Status</option>
                  <option value="MEDICINE_INQUIRY">Medicine Information & Dosage</option>
                  <option value="BILLING">Billing, Invoices & Refunds</option>
                  <option value="GENERAL">General Inquiries</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-white">Subject</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. When will order #PH-7849 arrive?" 
                  required 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-white">Describe Your Question</label>
                <textarea 
                  className="form-control" 
                  rows="4" 
                  placeholder="Provide all details so our pharmacist or customer agent can help quickly..." 
                  required 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)}
                ></textarea>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary w-100 py-2 fw-semibold" 
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Send Inquiry to Support'}
              </button>
            </form>

            <div className="mt-4 pt-3 border-top border-secondary border-opacity-25 small text-muted">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-telephone-inbound text-info fs-5"></i>
                <span className="text-secondary">Urgent Medical Emergency? Call <strong className="text-white">911</strong> or Hospital Hotline</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-clock-history text-info fs-5"></i>
                <span className="text-secondary">Typical Pharmacist Response Time: <strong className="text-white">&lt; 30 Minutes</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Previous Support Tickets */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0 text-white">
                <i className="bi bi-journal-text text-info me-2"></i>My Inquiries & Responses
              </h5>
              <button 
                className="btn btn-primary btn-sm d-flex align-items-center gap-1" 
                onClick={() => loadTickets(true)}
                disabled={loading}
              >
                <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
                <span>Refresh</span>
              </button>
            </div>

            {!currentUser ? (
              <div className="text-center py-5 text-muted">
                <p>Please sign in to view your previous customer support tickets.</p>
                <button className="btn btn-primary btn-sm" onClick={onOpenLogin}>Sign In</button>
              </div>
            ) : loading ? (
              <div className="text-center py-5 text-muted">Loading your tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox fs-1 d-block mb-2 text-info"></i>
                <p className="text-white">You haven't submitted any inquiries yet.</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3 overflow-auto" style={{ maxHeight: '600px' }}>
                {tickets.map(t => (
                  <div key={t.id} className="border border-secondary border-opacity-25 rounded-3 p-3 bg-opacity-25">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="text-info small me-2 fw-semibold">[{t.category}]</span>
                        <strong className="text-white">{t.subject}</strong>
                      </div>
                      <span className={`small fw-semibold ${t.status === 'RESOLVED' ? 'text-success' : t.status === 'IN_PROGRESS' ? 'text-info' : 'text-warning'}`}>
                        {t.status}
                      </span>
                    </div>

                    <p className="small text-secondary mb-2 p-2 rounded border border-secondary border-opacity-10">
                      "{t.message}"
                    </p>

                    {t.adminResponse ? (
                      <div className="p-3 rounded border border-info border-opacity-30 mt-2">
                        <div className="d-flex align-items-center gap-1 text-info fw-bold small mb-1">
                          <i className="bi bi-person-badge"></i> Pharmacist / Support Team Response:
                        </div>
                        <p className="small text-white mb-0">{t.adminResponse}</p>
                      </div>
                    ) : (
                      <div className="small text-muted fst-italic">
                        <i className="bi bi-hourglass-split me-1 text-info"></i> Awaiting review from pharmacist on duty.
                      </div>
                    )}

                    <div className="small text-muted mt-2 text-end">
                      {new Date(t.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
