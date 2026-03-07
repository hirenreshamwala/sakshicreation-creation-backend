const mongoose = require("mongoose");

// Reusable schema for permission actions
const permissionSchema = new mongoose.Schema(
  {
    account_master: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    assign_task: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    party_call: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    all_orders: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
      status: { type: Boolean, default: false }
    },
    sell_orders: {
      view_global: { type: Boolean, default: false },
      view_own: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    payment_folders: {
      view_global: { type: Boolean, default: false },
      view_own: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    driver: {
      view_global: { type: Boolean, default: false },
    },
    all_complains: {
      view_global: { type: Boolean, default: false },
      view_own: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    // for quality packaging company
    order_factory: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    quality_packaging: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    proforma_invoice: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    reports: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    printer_inventory: {
      view_global: { type: Boolean, default: false }
    },
    binder_inventory: {
      view_global: { type: Boolean, default: false }
    },
    booklet_binder_inventory: {
      view_global: { type: Boolean, default: false }
    },
    inventory: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    purchase: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    task: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    qp_task: {
      view_global: { type: Boolean, default: false },
      view_own: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    history: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    designer_task: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    cancel_order: {
      view_global: { type: Boolean, default: false },
    },
    printer_task: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    blinder_task: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    booklet_blinder_task: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
    setup: {
      view_global: { type: Boolean },
      view_own: { type: Boolean },
      create: { type: Boolean },
      edit: { type: Boolean },
      delete: { type: Boolean },
    },
  },
  { _id: false } // prevents automatic _id for subdocuments
);

module.exports = permissionSchema;
