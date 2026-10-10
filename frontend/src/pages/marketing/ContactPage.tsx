/**
 * ============================================================================
 * CONTACT & DEMO REQUEST PAGE (ContactPage.tsx)
 * ============================================================================
 * Allows fleet operators to schedule an interactive 1-on-1 walkthrough with a
 * logistics specialist or submit enterprise custom contract inquiries.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Mail, Phone, MapPin, CheckCircle2, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import api from '../../api/client';
import { toast } from '../../stores/uiStore';

export const ContactPage: React.FC = () => {
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    work_email: '',
    phone: '',
    fleet_size: '11-25',
    pain_point: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.company_name || !form.phone) {
      toast.error('Please fill in your name, company name, and phone number.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/public/demo-request', form);
      setSubmitted(true);
      toast.success('Demo request submitted successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit demo request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '5rem 1.5rem', flex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '4rem', alignItems: 'center' }}>
            {/* Left Column: Context & Contact Points */}
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.375rem 1rem',
                  borderRadius: '9999px',
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818cf8',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  marginBottom: '1rem',
                }}
              >
                TALK TO OUR LOGISTICS ENGINEERS
              </span>
              <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 1.25rem 0', lineHeight: 1.15 }}>
                See How Fleet Flow Eliminates <br />
                <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Billing & Settlement Leakage
                </span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 2rem 0' }}>
                Join hundreds of Indian transport carriers who have streamlined 3-part LRs, automated driver trip settlements, and cut billing delays from 45 days to 24 hours.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Phone size={18} color="#818cf8" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Direct Sales Hotline</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>+91 98200 12345 / +91 22 4567 8900</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Mail size={18} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enterprise Support</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>enterprise@fleetflow.io</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <MapPin size={18} color="#f59e0b" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Corporate Headquarters</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Transport Nagar, Sector 18, Navi Mumbai, Maharashtra 400705</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <ShieldCheck size={16} color="#10b981" />
                  <span>DPDP Act 2023 Compliant</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Clock size={16} color="#6366f1" />
                  <span>Response within 2 hours</span>
                </div>
              </div>
            </div>

            {/* Right Column: Demo Booking Form */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1.5rem',
                padding: '2.5rem',
                boxShadow: '0 0 40px rgba(0,0,0,0.5)',
              }}
            >
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <CheckCircle2 size={36} color="#10b981" />
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.75rem 0' }}>Request Received!</h2>
                  <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 0 2rem 0' }}>
                    Thank you, <strong>{form.full_name}</strong>. One of our transport specialists will call you at <strong>{form.phone}</strong> to coordinate your live walkthrough.
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ full_name: '', company_name: '', work_email: '', phone: '', fleet_size: '11-25', pain_point: '' }); }}
                    style={{
                      padding: '0.625rem 1.25rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Book a 1-on-1 Walkthrough</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: 0 }}>
                      Customized to your fleet type, regional corridors, and billing setup.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>Your Full Name *</label>
                    <input
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="e.g. Rajesh Sharma"
                      style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>Transport Company *</label>
                      <input
                        required
                        value={form.company_name}
                        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                        placeholder="e.g. Sharma Roadways"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>Mobile / WhatsApp *</label>
                      <input
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="e.g. 98220 01122"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>Work Email</label>
                      <input
                        type="email"
                        value={form.work_email}
                        onChange={(e) => setForm({ ...form, work_email: e.target.value })}
                        placeholder="e.g. rajesh@sharmaroadways.com"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>Fleet Size *</label>
                      <select
                        value={form.fleet_size}
                        onChange={(e) => setForm({ ...form, fleet_size: e.target.value })}
                        style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: '#1e1e24', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' }}
                      >
                        <option value="1-10">1 to 10 Trucks</option>
                        <option value="11-25">11 to 25 Trucks</option>
                        <option value="26-50">26 to 50 Trucks</option>
                        <option value="51-100">51 to 100 Trucks</option>
                        <option value="100+">100+ Trucks (Enterprise)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>Biggest Operational Challenge</label>
                    <textarea
                      rows={3}
                      value={form.pain_point}
                      onChange={(e) => setForm({ ...form, pain_point: e.target.value })}
                      placeholder="e.g. Driver fuel disputes, delayed customer billing, RTO compliance expired..."
                      style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.875rem',
                      borderRadius: '0.625rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 0 25px rgba(99,102,241,0.3)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{submitting ? 'Submitting...' : 'Schedule Walkthrough'}</span>
                    <ArrowRight size={18} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
export default ContactPage;
