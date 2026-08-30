import PaymentModel from "../models/payment.js";
import { getCurrentTime } from "./timeHelper.js";

/**
 * Generates a unique sequential invoice number in the format CQ-INV-YYYY-XXXXXX.
 * Counts all existing Payment documents and uses count+1 as the sequence.
 * This is safe for single-region, low-concurrency usage consistent with the
 * existing project architecture.
 *
 * @returns {Promise<string>} e.g. "CQ-INV-2026-000001"
 */
export const generateInvoiceNumber = async () => {
  const count = await PaymentModel.countDocuments();
  const sequence = String(count + 1).padStart(6, "0");
  const year = getCurrentTime().getFullYear();
  return `CQ-INV-${year}-${sequence}`;
};

/**
 * Formats a plan name + amount into a display string.
 * @param {string} plan
 * @param {number} amount
 * @returns {string}
 */
export const formatPlanAmount = (plan, amount) => {
  return `₹${amount}/month`;
};
