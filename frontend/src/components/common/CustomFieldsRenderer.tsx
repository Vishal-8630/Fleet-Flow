/**
 * ============================================================================
 * FLEET FLOW — DYNAMIC CUSTOM FIELDS RENDERER (CustomFieldsRenderer.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Reusable dynamic form generator that queries registered custom fields for any
 * operational entity (Truck, Driver, TruckJourney, Entry, Parties) and renders
 * typed form controls with real-time state synchronization.
 * 
 * Zero configuration required by parent forms:
 * - If 0 custom fields are defined for the entity, renders null (no UI clutter).
 * - If 1+ fields are defined, renders a polished "Workspace Custom Attributes" section.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sliders, HelpCircle, AlertCircle } from 'lucide-react';

export interface CustomFieldDefinition {
  _id: string;
  entity: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'dropdown' | 'multi_select' | 'url';
  options?: string[];
  is_required: boolean;
  help_text?: string;
  placeholder?: string;
  is_archived: boolean;
}

interface CustomFieldsRendererProps {
  entity: 'Truck' | 'Driver' | 'TruckJourney' | 'Entry' | 'BillingParty' | 'BalanceParty';
  values: Record<string, any>;
  onChange: (updatedValues: Record<string, any>) => void;
  disabled?: boolean;
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({
  entity,
  values,
  onChange,
  disabled = false,
}) => {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchDefinitions = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/settings/custom-fields?entity=${entity}&include_archived=false`, {
          withCredentials: true,
        });
        if (isMounted) {
          setFields(res.data.fields || []);
        }
      } catch (err) {
        console.error(`Failed to load custom fields for ${entity}:`, err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDefinitions();
    return () => {
      isMounted = false;
    };
  }, [entity]);

  if (loading || fields.length === 0) {
    return null;
  }

  const handleFieldChange = (key: string, val: any) => {
    onChange({
      ...values,
      [key]: val,
    });
  };

  return (
    <div
      style={{
        marginTop: '1.25rem',
        marginBottom: '1.25rem',
        padding: '1.25rem',
        backgroundColor: 'var(--color-slate-50)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          paddingBottom: '0.625rem',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary-50)',
              color: 'var(--color-primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sliders size={16} />
          </div>
          <div>
            <h4
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--color-slate-900)',
                margin: 0,
              }}
            >
              Workspace Custom Attributes
            </h4>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)' }}>
              Defined in Custom Fields Studio
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-primary-100)',
            color: 'var(--color-primary-800)',
          }}
        >
          {fields.length} {fields.length === 1 ? 'Field' : 'Fields'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
        {fields.map((field) => {
          const currentValue = values[field.field_key] !== undefined ? values[field.field_key] : '';

          return (
            <div key={field._id} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{field.field_label}</span>
                {field.is_required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                {field.help_text && (
                  <span title={field.help_text} style={{ cursor: 'help', color: 'var(--color-slate-400)' }}>
                    <HelpCircle size={13} />
                  </span>
                )}
              </label>

              {field.field_type === 'boolean' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                  <input
                    type="checkbox"
                    id={`custom-${field.field_key}`}
                    checked={Boolean(currentValue)}
                    onChange={(e) => handleFieldChange(field.field_key, e.target.checked)}
                    disabled={disabled}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor={`custom-${field.field_key}`}
                    style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', cursor: 'pointer' }}
                  >
                    {field.field_label}
                  </label>
                </div>
              ) : field.field_type === 'dropdown' ? (
                <select
                  className="form-control"
                  value={currentValue}
                  onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                  disabled={disabled}
                  required={field.is_required}
                >
                  <option value="">Select {field.field_label}...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.field_type === 'number' ? (
                <input
                  type="number"
                  className="form-control"
                  placeholder={field.placeholder || `Enter ${field.field_label.toLowerCase()}`}
                  value={currentValue}
                  onChange={(e) => handleFieldChange(field.field_key, e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={disabled}
                  required={field.is_required}
                />
              ) : field.field_type === 'date' ? (
                <input
                  type="date"
                  className="form-control"
                  value={currentValue ? String(currentValue).slice(0, 10) : ''}
                  onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                  disabled={disabled}
                  required={field.is_required}
                />
              ) : (
                <input
                  type={field.field_type === 'url' ? 'url' : 'text'}
                  className="form-control"
                  placeholder={field.placeholder || `Enter ${field.field_label.toLowerCase()}`}
                  value={currentValue}
                  onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                  disabled={disabled}
                  required={field.is_required}
                />
              )}

              {field.help_text && (
                <small style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', marginTop: '2px', display: 'block' }}>
                  {field.help_text}
                </small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
