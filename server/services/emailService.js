import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { Resend } from "resend";

// ─────────────────────────────────────────────────────────────────────────────
// Transport selection
//
// Render free-tier blocks outbound SMTP ports 25, 465 and 587 at the network
// level.  Any connection attempt to smtp.gmail.com:587 from a Render dyno will
// simply time out — no error code, just a silent hang until the socket timer
// fires.
//
// Resolution: when RESEND_API_KEY is present in the environment we use the
// Resend HTTP SDK which communicates over HTTPS (port 443) — never blocked.
// When RESEND_API_KEY is absent (e.g. local dev) we fall back to the existing
// Nodemailer/SMTP transporter so local development behaviour is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the Resend HTTP transport should be used.
 * Logs a clear, credential-free diagnostic on startup.
 */
const useResend = () => {
  const hasKey = !!process.env.RESEND_API_KEY;
  return hasKey;
};

// Cached Nodemailer SMTP transporter (local-dev / fallback only)
let _smtpTransporter = null;

const getSmtpTransporter = () => {
  if (_smtpTransporter) return _smtpTransporter;

  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_PORT || "587", 10);

  console.info(
    "[emailService] SMTP fallback transport — host=%s port=%d secure=%s",
    host,
    port,
    port === 465
  );

  _smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true only for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Explicit timeouts so failures surface quickly instead of hanging
    connectionTimeout: 10_000,  // 10 s to establish TCP connection
    greetingTimeout:   8_000,   // 8 s for SMTP greeting
    socketTimeout:     15_000,  // 15 s of socket inactivity
  });

  return _smtpTransporter;
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF invoice generator — unchanged
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a professional PDF invoice in memory and returns it as a Buffer.
 *
 * @param {object} data
 * @param {string} data.invoiceNumber
 * @param {string} data.userName
 * @param {string} data.userEmail
 * @param {string} data.plan
 * @param {number} data.amount
 * @param {string} data.paymentId
 * @param {string} data.orderId
 * @param {Date}   data.paymentDate
 * @param {Date}   data.subscriptionStart
 * @param {Date}   data.subscriptionEnd
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDF = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const fmt = (d) =>
        d
          ? new Date(d).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "Asia/Kolkata",
            })
          : "N/A";

      // ── Header ──────────────────────────────────────────────────────────────
      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("CODEQUEST", { align: "center" });

      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#555555")
        .text("Subscription Invoice", { align: "center" });

      doc.moveDown(0.5);

      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#e0e0e0")
        .lineWidth(1)
        .stroke();

      doc.moveDown(1);

      // ── Invoice Meta ────────────────────────────────────────────────────────
      const addRow = (label, value, bold = false) => {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#333333")
          .text(`${label}:`, 50, doc.y, { continued: true, width: 180 });
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor(bold ? "#1a1a2e" : "#555555")
          .text(value, { width: 315 });
        doc.moveDown(0.4);
      };

      addRow("Invoice Number", data.invoiceNumber, true);
      addRow("Payment Date", fmt(data.paymentDate));

      doc.moveDown(0.6);

      // ── Customer Details ────────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("Customer Details");
      doc.moveDown(0.4);

      addRow("Name", data.userName);
      addRow("Email", data.userEmail);

      doc.moveDown(0.6);

      // ── Subscription Details ────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("Subscription Details");
      doc.moveDown(0.4);

      addRow("Plan", `${data.plan} Plan`);
      addRow("Amount", `₹${data.amount}/month`);
      addRow("Subscription Start", fmt(data.subscriptionStart));
      addRow("Subscription End", fmt(data.subscriptionEnd));

      doc.moveDown(0.6);

      // ── Payment Info ────────────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("Payment Information");
      doc.moveDown(0.4);

      addRow("Payment ID", data.paymentId);
      addRow("Order ID", data.orderId);

      // Payment Status badge
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#333333")
        .text("Payment Status:", 50, doc.y, { continued: true, width: 180 });
      doc.font("Helvetica-Bold").fillColor("#16a34a").text("PAID");
      doc.moveDown(0.4);

      doc.moveDown(1);

      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#e0e0e0")
        .lineWidth(1)
        .stroke();

      doc.moveDown(1);

      // ── Footer ──────────────────────────────────────────────────────────────
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#777777")
        .text("Thank you for subscribing to CodeQuest.", { align: "center" });

      doc
        .fontSize(9)
        .fillColor("#aaaaaa")
        .text(
          "This is a system-generated invoice. For support, contact us via the platform.",
          { align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Email body builders — unchanged
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the HTML body for the invoice email.
 */
const buildHtmlBody = (data) => {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Kolkata",
        })
      : "N/A";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeQuest Invoice</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:2px;">CODEQUEST</h1>
              <p style="margin:6px 0 0;color:#aaaacc;font-size:13px;">Subscription Invoice</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 20px;font-size:15px;color:#333;">Hello <strong>${data.userName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
                Your <strong>CodeQuest ${data.plan} Plan</strong> subscription has been successfully activated. Your invoice is attached to this email.
              </p>

              <!-- Detail table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                <tr style="background:#f9fafb;">
                  <td colspan="2" style="padding:12px 16px;font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Subscription Details</td>
                </tr>
                <tr style="border-top:1px solid #e5e7eb;">
                  <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600;width:180px;">Plan</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;">${data.plan} Plan</td>
                </tr>
                <tr style="background:#f9fafb;border-top:1px solid #e5e7eb;">
                  <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600;">Amount</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;">₹${data.amount}/month</td>
                </tr>
                <tr style="border-top:1px solid #e5e7eb;">
                  <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600;">Payment Status</td>
                  <td style="padding:10px 16px;font-size:13px;color:#16a34a;font-weight:bold;">Paid</td>
                </tr>
                <tr style="background:#f9fafb;border-top:1px solid #e5e7eb;">
                  <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600;">Payment ID</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;font-family:monospace;">${data.paymentId}</td>
                </tr>
                <tr style="border-top:1px solid #e5e7eb;">
                  <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600;">Subscription Start</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;">${fmt(data.subscriptionStart)}</td>
                </tr>
                <tr style="background:#f9fafb;border-top:1px solid #e5e7eb;">
                  <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600;">Subscription End</td>
                  <td style="padding:10px 16px;font-size:13px;color:#111827;">${fmt(data.subscriptionEnd)}</td>
                </tr>
              </table>

              <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 8px;">
                Thank you for using CodeQuest.
              </p>
              <p style="font-size:14px;color:#555;margin:0;">
                Regards,<br />
                <strong>CodeQuest Team</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:18px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Invoice #${data.invoiceNumber} &nbsp;·&nbsp; ${new Date(data.paymentDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Plain-text fallback for the invoice email.
 */
const buildTextBody = (data) => {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Kolkata",
        })
      : "N/A";

  return `Hello ${data.userName},

Your CodeQuest ${data.plan} Plan subscription has been successfully activated.

--- Subscription Details ---
Plan: ${data.plan}
Amount: ₹${data.amount}/month
Payment Status: Paid
Payment ID: ${data.paymentId}
Subscription Start: ${fmt(data.subscriptionStart)}
Subscription End: ${fmt(data.subscriptionEnd)}

Your invoice (${data.invoiceNumber}) is attached to this email.

Thank you for using CodeQuest.

Regards,
CodeQuest Team`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Resend HTTP transport (production — works on Render free tier)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends the invoice email via the Resend HTTP API.
 * Uses HTTPS (port 443) — never blocked by Render's firewall.
 *
 * @param {object} invoiceData
 * @param {Buffer} pdfBuffer
 */
const sendViaResend = async (invoiceData, pdfBuffer) => {
  const resend = new Resend(process.env.RESEND_API_KEY);

  // RESEND_FROM must be a verified sender address/domain in your Resend dashboard.
  // Falls back to EMAIL_FROM for convenience, but must still be verified with Resend.
  const from =
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM ||
    "noreply@codequest.dev";

  console.info(
    "[emailService] Sending invoice via Resend HTTP API — from=%s to=%s invoice=%s",
    from,
    invoiceData.userEmail,
    invoiceData.invoiceNumber
  );

  const { data, error } = await resend.emails.send({
    from,
    to: [invoiceData.userEmail],
    subject: `CodeQuest Subscription Activated - ${invoiceData.plan} Plan`,
    text: buildTextBody(invoiceData),
    html: buildHtmlBody(invoiceData),
    attachments: [
      {
        filename: `CodeQuest-Invoice-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    // Log the error type/message — never log credentials
    console.error(
      "[emailService] Resend API returned an error — name=%s message=%s statusCode=%s",
      error.name,
      error.message,
      error.statusCode ?? "n/a"
    );
    throw new Error(`Resend API error: ${error.name} — ${error.message}`);
  }

  console.info(
    "[emailService] Resend accepted the email — id=%s",
    data?.id ?? "unknown"
  );

  return { sent: true, messageId: data?.id };
};

// ─────────────────────────────────────────────────────────────────────────────
// SMTP transport (local development / fallback)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends the invoice email via Nodemailer SMTP.
 * Only used when RESEND_API_KEY is NOT set (local development).
 *
 * @param {object} invoiceData
 * @param {Buffer} pdfBuffer
 */
const sendViaSmtp = async (invoiceData, pdfBuffer) => {
  const transporter = getSmtpTransporter();

  const from =
    process.env.EMAIL_FROM ||
    `"CodeQuest" <${process.env.EMAIL_USER}>`;

  console.info(
    "[emailService] Sending invoice via SMTP — host=%s from=%s to=%s invoice=%s",
    process.env.EMAIL_HOST,
    from,
    invoiceData.userEmail,
    invoiceData.invoiceNumber
  );

  const mailOptions = {
    from,
    to: invoiceData.userEmail, // always from authenticated user DB record
    subject: `CodeQuest Subscription Activated - ${invoiceData.plan} Plan`,
    text: buildTextBody(invoiceData),
    html: buildHtmlBody(invoiceData),
    attachments: [
      {
        filename: `CodeQuest-Invoice-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.info(
      "[emailService] SMTP accepted the email — messageId=%s",
      info.messageId
    );
    return { sent: true, messageId: info.messageId };
  } catch (smtpErr) {
    // Log structured diagnostics without exposing credentials
    console.error(
      "[emailService] SMTP send failed — code=%s command=%s message=%s",
      smtpErr.code ?? "n/a",
      smtpErr.command ?? "n/a",
      smtpErr.message
    );
    // Reset cached transporter so a new attempt uses a fresh connection
    _smtpTransporter = null;
    throw smtpErr;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API — called by the payment controller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a subscription invoice email with a PDF attachment.
 *
 * Transport selection:
 *  - RESEND_API_KEY set → Resend HTTP API (production / Render)
 *  - RESEND_API_KEY absent → Nodemailer SMTP (local dev)
 *
 * @param {object} invoiceData
 * @param {string} invoiceData.invoiceNumber
 * @param {string} invoiceData.userName
 * @param {string} invoiceData.userEmail   — always from the DB, never from the frontend
 * @param {string} invoiceData.plan
 * @param {number} invoiceData.amount
 * @param {string} invoiceData.paymentId
 * @param {string} invoiceData.orderId
 * @param {Date}   invoiceData.paymentDate
 * @param {Date}   invoiceData.subscriptionStart
 * @param {Date}   invoiceData.subscriptionEnd
 * @returns {Promise<{ sent: boolean, messageId?: string }>}
 * @throws on transport / API error
 */
export const sendSubscriptionInvoiceEmail = async (invoiceData) => {
  // Generate PDF in memory (unchanged)
  const pdfBuffer = await generateInvoicePDF(invoiceData);

  if (useResend()) {
    return sendViaResend(invoiceData, pdfBuffer);
  }

  return sendViaSmtp(invoiceData, pdfBuffer);
};
