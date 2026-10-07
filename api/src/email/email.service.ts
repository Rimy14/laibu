import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import {
  ApprovalOutcomeEmailParams,
  AuthorApprovalEmailParams,
  EmailPayload,
  PayoutDisbursedEmailParams,
} from './email.types.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brandName: string;

  constructor(config: ConfigService<Env, true>) {
    this.brandName = config.get('BRAND_NAME', { infer: true }) || 'Laibu';
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    // In production, integrate with SES/SendGrid/SMTP.
    // In dev, log formatted email to terminal for immediate developer access.
    this.logger.log(`\n================== [OUTGOING EMAIL] ==================
To: ${payload.to}
Subject: ${payload.subject}
------------------------------------------------------
${payload.text}
======================================================\n`);
  }

  async sendAuthorApprovalRequest(params: AuthorApprovalEmailParams): Promise<void> {
    const subject = `${params.publisherName} wants to publish "${params.bookTitle}" on ${this.brandName}. Please review`;

    const text = `Hi ${params.authorName},

${params.publisherName} has asked to sell your book "${params.bookTitle}" on ${this.brandName}.
Nothing goes live until you agree. After that, our team reviews it too.

What they're proposing:
- Price: KES ${params.priceKes.toFixed(2)}
- Your Royalty: ${params.authorRoyaltyPct}% of each sale, after the ${this.brandName} fee

Worked Example for one sale at KES ${params.priceKes.toFixed(2)}:
- Sale Price: KES ${params.priceKes.toFixed(2)}
- ${this.brandName} fee (${params.feeRate}%): -KES ${params.exFee.toFixed(2)}
- Remainder: KES ${params.exRemainder.toFixed(2)}
- You receive (${params.authorRoyaltyPct}%): KES ${params.exAuthor.toFixed(2)}
- Publisher receives: KES ${params.exPublisher.toFixed(2)}

Review and respond here:
${params.reviewUrl}

This link is personal to you and expires on ${params.expiresOn}.
If you don't recognise this request, choose Decline or ignore this email.

The ${this.brandName} team`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        <h2 style="color: #1a1a1a;">Book Publication Proposal</h2>
        <p>Hi <strong>${params.authorName}</strong>,</p>
        <p><strong>${params.publisherName}</strong> has asked to sell your book <strong>"${params.bookTitle}"</strong> on ${this.brandName}.</p>
        <p>Nothing goes live until you agree. After that, our team reviews it too.</p>

        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 16px;">What they're proposing:</h3>
          <p><strong>Price:</strong> KES ${params.priceKes.toFixed(2)}</p>
          <p><strong>Your royalty:</strong> ${params.authorRoyaltyPct}% of each sale, after the ${this.brandName} fee</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #dee2e6; text-align: left;">
              <th style="padding: 8px;">Breakdown (1 Sale)</th>
              <th style="padding: 8px;">KES</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 8px;">Sale price</td>
              <td style="padding: 8px;">${params.priceKes.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6; color: #6c757d;">
              <td style="padding: 8px;">${this.brandName} fee (${params.feeRate}%)</td>
              <td style="padding: 8px;">-${params.exFee.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 8px;">Remainder</td>
              <td style="padding: 8px;">${params.exRemainder.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 2px solid #1a1a1a; font-weight: bold; background: #e8f5e9;">
              <td style="padding: 8px;">You receive (${params.authorRoyaltyPct}%)</td>
              <td style="padding: 8px;">KES ${params.exAuthor.toFixed(2)}</td>
            </tr>
            <tr style="color: #495057;">
              <td style="padding: 8px;">Publisher receives</td>
              <td style="padding: 8px;">KES ${params.exPublisher.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.reviewUrl}" style="background: #f59e0b; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Review and Respond
          </a>
        </div>

        <p style="font-size: 12px; color: #6c757d;">
          This link is personal to you and expires on <strong>${params.expiresOn}</strong>.
        </p>
      </div>
    `;

    await this.sendEmail({ to: params.toEmail, subject, text, html });
  }

  async sendApprovalOutcome(params: ApprovalOutcomeEmailParams): Promise<void> {
    const subject = `Update on "${params.bookTitle}": ${params.outcome.toUpperCase()}`;
    const text = `Hi ${params.publisherName},

Your publication request for "${params.bookTitle}" has been ${params.outcome}.
${params.notes ? `Notes: ${params.notes}` : ''}

The ${this.brandName} team`;

    await this.sendEmail({
      to: params.publisherEmail,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
    });
  }

  async sendPayoutDisbursed(params: PayoutDisbursedEmailParams): Promise<void> {
    const subject = `Payout Disbursed: KES ${params.netAmountKes.toLocaleString('en-KE', { minimumFractionDigits: 2 })} · ${this.brandName}`;
    const text = `Hi ${params.recipientName},

Good news! Your earnings for the payout cycle (${params.paydayFormatted}) have been disbursed.

- Net Amount: KES ${params.netAmountKes.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
- Payment Destination: ${params.payoutMethodLabel}
- Reference ID: ${params.paymentReference}

Thank you for publishing on ${this.brandName}.

The ${this.brandName} team`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        <h2 style="color: #10b981;">Payout Successfully Disbursed 🎉</h2>
        <p>Hi <strong>${params.recipientName}</strong>,</p>
        <p>Your earnings for the payout cycle ending <strong>${params.paydayFormatted}</strong> have been sent.</p>
        
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="font-size: 14px; color: #166534; margin: 0 0 4px 0;">Net Amount Disbursed</p>
          <h1 style="color: #15803d; margin: 0; font-size: 28px;">KES ${params.netAmountKes.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</h1>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tbody>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px; font-weight: bold;">Destination</td>
              <td style="padding: 10px; text-align: right;">${params.payoutMethodLabel}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px; font-weight: bold;">Payment Reference</td>
              <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 14px;">${params.paymentReference}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px; font-weight: bold;">Settlement Cycle</td>
              <td style="padding: 10px; text-align: right;">${params.paydayFormatted}</td>
            </tr>
          </tbody>
        </table>

        <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
          You can view your detailed sales breakdown and past statements in your creator dashboard at any time.
        </p>
      </div>
    `;

    await this.sendEmail({ to: params.toEmail, subject, text, html });
  }
}
