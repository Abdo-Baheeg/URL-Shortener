'use strict';

const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema(
  {
    shortCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    lastClickedAt: {
      type: Date,
      default: null,
    },
    password: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    createdByIp: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire TTL index (only effective when expiresAt is set)
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

// Text search index
urlSchema.index({ originalUrl: 'text', title: 'text', tags: 'text' });

// Virtual: is the URL expired?
urlSchema.virtual('isExpired').get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

urlSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Url', urlSchema);
