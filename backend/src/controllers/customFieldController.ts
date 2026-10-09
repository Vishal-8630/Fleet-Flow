/**
 * ============================================================================
 * FLEET FLOW — CUSTOM FIELDS CONTROLLER (customFieldController.ts)
 * ============================================================================
 * 
 * WHAT IS THIS CONTROLLER?
 * ------------------------
 * Manages the Custom Fields Studio endpoints: creating, updating, archiving,
 * and listing dynamic custom attributes per tenant and entity.
 * ============================================================================
 */

import { Request, Response } from 'express';
import { CustomFieldDefinition, CustomFieldTargetEntity } from '../models/CustomFieldDefinition.js';
import { Truck } from '../models/Truck.js';
import { Driver } from '../models/Driver.js';
import { TruckJourney } from '../models/TruckJourney.js';
import { BillingParty } from '../models/BillingParty.js';
import { BalanceParty } from '../models/BalanceParty.js';
import { Entry } from '../models/Entry.js';

/**
 * GET /api/settings/custom-fields
 * Lists custom field definitions for the company, optionally filtered by ?entity=
 */
export async function listCustomFields(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { entity, include_archived } = req.query;
    const filter: any = { company_id: req.company._id };

    if (entity) {
      filter.entity = entity;
    }
    if (include_archived !== 'true') {
      filter.is_archived = false;
    }

    const fields = await CustomFieldDefinition.find(filter).sort({ entity: 1, created_at: -1 });
    res.json({ fields });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list custom fields.' });
  }
}

/**
 * POST /api/settings/custom-fields
 * Creates a new custom field definition.
 */
export async function createCustomField(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const {
      entity,
      field_key,
      field_label,
      field_type,
      options,
      is_required,
      default_value,
      placeholder,
      help_text,
    } = req.body;

    if (!entity || !field_key || !field_label || !field_type) {
      res.status(400).json({ error: 'entity, field_key, field_label, and field_type are required.' });
      return;
    }

    // Normalize field key
    const cleanKey = field_key.trim().toLowerCase().replace(/\s+/g, '_');

    // Check duplicate
    const existing = await CustomFieldDefinition.findOne({
      company_id: req.company._id,
      entity,
      field_key: cleanKey,
    });

    if (existing) {
      res.status(400).json({ error: `A field with key "${cleanKey}" already exists for ${entity}.` });
      return;
    }

    const newField = await CustomFieldDefinition.create({
      company_id: req.company._id,
      entity,
      field_key: cleanKey,
      field_label: field_label.trim(),
      field_type,
      options: Array.isArray(options) ? options : [],
      is_required: Boolean(is_required),
      default_value,
      placeholder,
      help_text,
      is_archived: false,
    });

    res.status(201).json({ success: true, field: newField });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create custom field.' });
  }
}

/**
 * PUT /api/settings/custom-fields/:id
 * Updates field metadata (label, help text, options, required flag).
 */
export async function updateCustomField(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { id } = req.params;
    const { field_label, options, is_required, placeholder, help_text } = req.body;

    const field = await CustomFieldDefinition.findOne({
      _id: id,
      company_id: req.company._id,
    });

    if (!field) {
      res.status(404).json({ error: 'Custom field not found.' });
      return;
    }

    if (field_label) field.field_label = field_label.trim();
    if (Array.isArray(options)) field.options = options;
    if (typeof is_required === 'boolean') field.is_required = is_required;
    if (placeholder !== undefined) field.placeholder = placeholder;
    if (help_text !== undefined) field.help_text = help_text;

    await field.save();
    res.json({ success: true, field });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update custom field.' });
  }
}

/**
 * PATCH /api/settings/custom-fields/:id/archive
 * Toggles soft-archived state of a field.
 */
export async function toggleArchiveCustomField(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { id } = req.params;
    const field = await CustomFieldDefinition.findOne({
      _id: id,
      company_id: req.company._id,
    });

    if (!field) {
      res.status(404).json({ error: 'Custom field not found.' });
      return;
    }

    field.is_archived = !field.is_archived;
    await field.save();

    res.json({
      success: true,
      message: `Field ${field.field_label} is now ${field.is_archived ? 'archived' : 'active'}.`,
      field,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to toggle archive status.' });
  }
}

/**
 * DELETE /api/settings/custom-fields/:id
 * Deletes field definition if no active documents store values for it;
 * otherwise recommends archiving.
 */
export async function deleteCustomField(req: Request, res: Response): Promise<void> {
  try {
    if (!req.company) {
      res.status(401).json({ error: 'Company context required.' });
      return;
    }

    const { id } = req.params;
    const field = await CustomFieldDefinition.findOne({
      _id: id,
      company_id: req.company._id,
    });

    if (!field) {
      res.status(404).json({ error: 'Custom field not found.' });
      return;
    }

    // Check if any documents use this field
    const fieldKey = `custom_fields.${field.field_key}`;
    const query = { company_id: req.company._id, [fieldKey]: { $exists: true, $ne: null } };
    let inUseCount = 0;

    switch (field.entity) {
      case 'Truck':
        inUseCount = await Truck.countDocuments(query);
        break;
      case 'Driver':
        inUseCount = await Driver.countDocuments(query);
        break;
      case 'TruckJourney':
        inUseCount = await TruckJourney.countDocuments(query);
        break;
      case 'BillingParty':
        inUseCount = await BillingParty.countDocuments(query);
        break;
      case 'BalanceParty':
        inUseCount = await BalanceParty.countDocuments(query);
        break;
      case 'Entry':
        inUseCount = await Entry.countDocuments(query);
        break;
    }

    if (inUseCount > 0) {
      // Soft-archive instead of hard deletion to protect historical data integrity
      field.is_archived = true;
      await field.save();
      res.status(200).json({
        success: true,
        archived: true,
        message: `Field is used in ${inUseCount} record(s). It has been safely archived instead of deleted to protect historical records.`,
      });
      return;
    }

    await field.deleteOne();
    res.json({ success: true, message: 'Custom field successfully removed.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete custom field.' });
  }
}
