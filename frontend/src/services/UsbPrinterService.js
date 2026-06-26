'use strict';

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { buildJewelryLabel } from './TsplBuilder';

const { UsbPrinter } = NativeModules;

// NativeEventEmitter only works on native platforms
const emitter = Platform.OS === 'android' && UsbPrinter
  ? new NativeEventEmitter(UsbPrinter)
  : null;

/**
 * Returns true if the native USB printer module is loaded.
 * Will be false on iOS and on Android dev builds before the module is registered.
 */
export function isUsbPrinterAvailable() {
  return Platform.OS === 'android' && !!UsbPrinter;
}

/**
 * Subscribe to USB printer connection-state events.
 * Status values: "connected" | "disconnected" | "permission_denied" | "requesting_permission"
 *
 * @param {(status: string) => void} callback
 * @returns {{ remove: () => void }} subscription handle
 */
export function subscribeToStatus(callback) {
  if (!emitter) return { remove: () => {} };
  const sub = emitter.addListener('UsbPrinterStatus', callback);
  return sub;
}

/**
 * Probe for a connected USB printer and request permission if needed.
 * Resolves with the current status string.
 */
export async function checkConnection() {
  if (!isUsbPrinterAvailable()) {
    return 'unavailable';
  }
  try {
    const status = await UsbPrinter.checkConnection();
    console.log('[UsbPrinter] checkConnection →', status);
    return status;
  } catch (e) {
    console.error('[UsbPrinter] checkConnection error:', e.message);
    return 'disconnected';
  }
}

/**
 * Print a jewelry label via USB.
 *
 * @param {object} labelData  - Fields for TsplBuilder.buildJewelryLabel
 * @throws Error with user-readable message on failure
 */
export async function printJewelryLabel(labelData) {
  if (!isUsbPrinterAvailable()) {
    throw new Error('USB printing is only available on Android devices.');
  }

  const tspl = buildJewelryLabel(labelData);
  console.log('[UsbPrinter] Sending TSPL:\n', tspl);

  try {
    const bytesSent = await UsbPrinter.print(tspl);
    console.log('[UsbPrinter] Print success, bytes sent:', bytesSent);
  } catch (e) {
    console.error('[UsbPrinter] Print failed:', e.code, e.message);
    const msg = e.code === 'NOT_CONNECTED'
      ? 'USB printer not connected.\n\nPlease connect the TVS LP46 Lite via USB OTG cable and try again.'
      : e.code === 'TRANSFER_FAILED'
      ? 'USB data transfer failed. Check the cable connection and try again.'
      : `Print error: ${e.message || 'Unknown error'}`;
    throw new Error(msg);
  }
}
