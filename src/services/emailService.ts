/**
 * Email Service using Resend API
 */

const RESEND_API_URL = import.meta.env.PROD ? '/api/send-email' : '/api/resend/emails';
const API_KEY = import.meta.env.VITE_RESEND_API_KEY;

export interface EmailParams {
    to: string | string[];
    subject: string;
    html: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail({ to, subject, html }: EmailParams) {
    // In production, the serverless function handles the API key
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (!import.meta.env.PROD) {
        if (!API_KEY) {
            console.warn('RESEND_API_KEY is not defined. Email will not be sent.');
            return null;
        }
        headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    try {
        const response = await fetch(RESEND_API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                from: 'noreply@send.daftarigroup.com',
                to,
                subject,
                html,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to send email');
        }

        return data;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

/**
 * Generate the bidding email template
 */
export function generateBiddingEmailHtml(vendorName: string, firmName: string, token: string) {
    const bidLink = `${window.location.origin}/bid/${token}`;
    
    return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
            <h2 style="color: #1e293b;">Enquiry Request from ${firmName}</h2>
            <p>Dear ${vendorName},</p>
            <p>We have a new enquiry request for you. Please click the button below to view the items and submit your competitive rates.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${bidLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Items & Submit Rates</a>
            </div>
            <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #4f46e5; font-size: 12px; word-break: break-all;">${bidLink}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated message from the Store Management System.</p>
        </div>
    `;
}
