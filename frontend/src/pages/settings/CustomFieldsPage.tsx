/**
 * ============================================================================
 * FLEET FLOW — CUSTOM FIELDS STUDIO (CustomFieldsPage.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS PAGE?
 * ------------------
 * Studio allowing transport administrators to register dynamic custom fields
 * on core operational entities:
 * - Truck (e.g. GPS IMEI, FASTag Barcode, Engine Series)
 * - Driver (e.g. Blood Group, Badge Number, Police Verification ID)
 * - TruckJourney (e.g. Seal Number, Escort Guard Name)
 * - BillingParty & BalanceParty (e.g. Port Code, Credit Insurance Ref)
 * - Entry / LR (e.g. Customs Bond No., Warehouse Dock Bay)
 * 
 * FEATURES:
 * ---------
 * - Entity tab navigation.
 * - Dynamic field type selector (`text`, `number`, `date`, `dropdown`, `boolean`, `url`).
 * - Soft-archive toggle to preserve historical records without data loss.
 * - Form state retention on modal backdrop click.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Database, Archive, Trash2, CheckCircle, Sliders, Edit3 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { FeatureGate } from '../../components/common/FeatureGate';

type EntityType = 'Truck' | 'Driver' | 'TruckJourney' | 'BillingParty' | 'BalanceParty' | 'Entry';

interface CustomField {
  _id: string;
  entity: EntityType;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'dropdown' | 'multi_select' | 'url';
  options?: string[];
  is_required: boolean;
  help_text?: string;
  placeholder?: string;
  is_archived: boolean;
  created_at: string;
}

const ENTITIES: { key: EntityType; label: string }[] = [
  { key: 'Truck', label: 'Fleet Trucks' },
  { key: 'Driver', label: 'Commercial Drivers' },
  { key: 'TruckJourney', label: 'Trip Dispatches' },
  { key: 'Entry', label: 'Lorry Receipts (LR)' },
  { key: 'BillingParty', label: 'Customer Shippers' },
  { key: 'BalanceParty', label: 'Vendors & Brokers' },
];

export const CustomFieldsPage: React.FC = () => {
  const enabledFeatures = useAuthStore((state) => state.enabledFeatures);
  const isUnlocked = enabledFeatures.includes('MOD_CUSTOM_FIELDS');

  const [activeEntity, setActiveEntity] = useState<EntityType>('Truck');
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    field_label: '',
    field_key: '',
    field_type: 'text',
    is_required: false,
    options_text: '',
    help_text: '',
    placeholder: '',
  });

  useEffect(() => {
    if (!isUnlocked) {
      setLoading(false);
      return;
    }
    fetchCustomFields();
  }, [activeEntity, isUnlocked]);

  const fetchCustomFields = async () => {
    if (!isUnlocked) return;
    try {
      setLoading(true);
      const res = await axios.get(`/api/settings/custom-fields?entity=${activeEntity}&include_archived=true`, {
        withCredentials: true,
      });
      setFields(res.data.fields || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        useAuthStore.getState().checkAuth();
        return;
      }
      toast.error(err.response?.data?.error || 'Failed to load custom fields.');
    } finally {
      setLoading(false);
    }
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const label = e.target.value;
    // Auto-generate snake_case key if not manually edited
    const autoKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    setFormData((prev) => ({
      ...prev,
      field_label: label,
      field_key: autoKey,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.field_label || !formData.field_key) {
      toast.warning('Field Label and Key are required.');
      return;
    }

    setSubmitting(true);
    try {
      const optionsArray = formData.field_type === 'dropdown'
        ? formData.options_text.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      await axios.post(
        '/api/settings/custom-fields',
        {
          entity: activeEntity,
          field_label: formData.field_label,
          field_key: formData.field_key,
          field_type: formData.field_type,
          is_required: formData.is_required,
          options: optionsArray,
          help_text: formData.help_text,
          placeholder: formData.placeholder,
        },
        { withCredentials: true }
      );

      toast.success(`Custom field "${formData.field_label}" registered successfully!`);
      setModalOpen(false);
      setFormData({
        field_label: '',
        field_key: '',
        field_type: 'text',
        is_required: false,
        options_text: '',
        help_text: '',
        placeholder: '',
      });
      fetchCustomFields();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create custom field.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async (field: CustomField) => {
    try {
      const res = await axios.patch(
        `/api/settings/custom-fields/${field._id}/archive`,
        {},
        { withCredentials: true }
      );
      toast.success(res.data.message);
      fetchCustomFields();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle archive status.');
    }
  };

  const handleDelete = async (field: CustomField) => {
    if (!window.confirm(`Are you sure you want to delete "${field.field_label}"?`)) return;

    try {
      const res = await axios.delete(`/api/settings/custom-fields/${field._id}`, { withCredentials: true });
      toast.success(res.data.message);
      fetchCustomFields();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete custom field.');
    }
  };

  return (
    <div className="shell-container">
      <PageHeader
        title="Dynamic Custom Fields Studio"
        subtitle="Define custom attributes, metadata, and validation rules per operational entity"
        actions={
          isUnlocked ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
            >
              <Plus size={16} />
              Register Custom Field
            </button>
          ) : undefined
        }
      />

      {!isUnlocked ? (
        <FeatureGate
          feature="MOD_CUSTOM_FIELDS"
          pageMode={true}
          titleOverride="Dynamic Custom Fields Studio is Locked"
          descOverride="Define custom attributes, metadata, and validation rules across Trucks, Drivers, Trips, Parties, and LRs. Upgrade to Pro Enterprise to unlock custom fields studio."
        >
          {null}
        </FeatureGate>
      ) : (
        <>
          {/* Entity Selector Tabs */}
          <div className="custom-fields-entity-tabs">
            {ENTITIES.map((ent) => (
              <button
                key={ent.key}
                type="button"
                className={`entity-tab-btn ${activeEntity === ent.key ? 'active' : ''}`}
                onClick={() => setActiveEntity(ent.key)}
              >
                {ent.label}
              </button>
            ))}
          </div>

          {/* Custom Fields Table */}
          <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading entity definitions...</p>
          </div>
        ) : fields.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Sliders size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} />
            <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Custom Fields Defined</h4>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              There are no user-defined attributes configured for {activeEntity} yet.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: '16px' }}
              onClick={() => setModalOpen(true)}
            >
              Add First Field
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Field Label</th>
                  <th>Database Key</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field._id}>
                    <td>
                      <strong>{field.field_label}</strong>
                      {field.help_text && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {field.help_text}
                        </div>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
                        {field.field_key}
                      </code>
                    </td>
                    <td>
                      <span className={`field-type-pill ${field.field_type}`}>
                        {field.field_type}
                      </span>
                      {field.options && field.options.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          [{field.options.join(', ')}]
                        </div>
                      )}
                    </td>
                    <td>
                      {field.is_required ? (
                        <span className="badge badge-warning">Required</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Optional</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${field.is_archived ? 'archived' : 'active'}`}>
                        {field.is_archived ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          title={field.is_archived ? 'Restore field' : 'Archive field'}
                          onClick={() => handleToggleArchive(field)}
                        >
                          <Archive size={14} />
                          {field.is_archived ? 'Restore' : 'Archive'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ color: '#ef4444' }}
                          title="Delete field"
                          onClick={() => handleDelete(field)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}

      {/* Register Custom Field Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Register Custom Field for ${activeEntity}`}
        subtitle="Custom attributes are strictly validated with dynamic Zod schemas"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Field Label *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. FASTag Barcode, Blood Group, Seal No."
              value={formData.field_label}
              onChange={handleLabelChange}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Database Attribute Key *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. fastag_barcode"
              value={formData.field_key}
              onChange={(e) => setFormData({ ...formData, field_key: e.target.value })}
              required
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Must be alphanumeric with underscores (snake_case).
            </small>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Data Type *</label>
            <select
              className="form-control"
              value={formData.field_type}
              onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
            >
              <option value="text">Text (Single-line string)</option>
              <option value="number">Numeric (Integers or Decimals)</option>
              <option value="date">Date & Timestamp</option>
              <option value="boolean">Boolean Switch (Yes / No)</option>
              <option value="dropdown">Dropdown Selection</option>
              <option value="url">URL Link (Validated link)</option>
            </select>
          </div>

          {formData.field_type === 'dropdown' && (
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Dropdown Options (Comma-separated) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Option A, Option B, Option C"
                value={formData.options_text}
                onChange={(e) => setFormData({ ...formData, options_text: e.target.value })}
                required
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Help Text / Tooltip</label>
            <input
              type="text"
              className="form-control"
              placeholder="Guidance shown below input field"
              value={formData.help_text}
              onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                Mandatory field (form submissions cannot be empty)
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Register Field'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
