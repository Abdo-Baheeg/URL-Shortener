'use strict';

const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema(
  {
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Url',
      required: true,
      index: true,
    },
    shortCode: {
      type: String,
      required: true,
      index: true,
    },
    ip: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: '',
    },
    browser: {
      type: String,
      default: 'Unknown',
    },
    browserVersion: {
      type: String,
      default: '',
    },
    os: {
      type: String,
      default: 'Unknown',
    },
    osVersion: {
      type: String,
      default: '',
    },
    deviceType: {
      // desktop | mobile | tablet | bot | unknown
      type: String,
      default: 'unknown',
    },
    referrer: {
      type: String,
      default: 'Direct',
    },
    referrerDomain: {
      type: String,
      default: 'Direct',
    },
    country: {
      type: String,
      default: 'Unknown',
    },
    countryCode: {
      type: String,
      default: '',
    },
    region: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: 'Unknown',
    },
    isp: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast per-URL stats queries
clickSchema.index({ shortCode: 1, createdAt: -1 });

module.exports = mongoose.model('Click', clickSchema);
