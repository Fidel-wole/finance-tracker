import crypto from 'crypto';
import { PartnerConfig, WebhookRequest } from '../interfaces/webhook';

export class WebhookVerifier {
  /**
   * Verify webhook signature using HMAC-SHA256
   * @param request - The webhook request containing headers and raw body
   * @param partnerConfig - Partner configuration with secret key and signature header
   * @returns boolean indicating if signature is valid
   */
  static verifySignature(request: WebhookRequest, partnerConfig: PartnerConfig): boolean {
    try {
      const signature = request.headers[partnerConfig.signatureHeader.toLowerCase()];
      
      if (!signature) {
        console.warn(`Missing signature header: ${partnerConfig.signatureHeader}`);
        return false;
      }

      // Remove prefix if it exists (e.g., "sha256=" from GitHub-style signatures)
      const cleanSignature = partnerConfig.signaturePrefix 
        ? signature.replace(partnerConfig.signaturePrefix, '')
        : signature;

      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', partnerConfig.secretKey)
        .update(request.rawBody)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(cleanSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Extract signature from various header formats
   * @param headers - Request headers
   * @param partnerName - Name of the partner to determine header format
   * @returns extracted signature or null
   */
  static extractSignature(headers: { [key: string]: string }, partnerName: string): string | null {
    const commonHeaders = ['x-signature', 'x-webhook-signature', 'signature'];
    
    // Partner-specific signature headers
    const partnerHeaders: { [key: string]: string[] } = {
      opay: ['x-opay-signature', 'x-signature'],
      kuda: ['x-kuda-signature', 'authorization'],
      palmpay: ['x-palmpay-signature', 'x-signature']
    };

    const headersToCheck = partnerHeaders[partnerName.toLowerCase()] || commonHeaders;
    
    for (const header of headersToCheck) {
      const signature = headers[header.toLowerCase()];
      if (signature) {
        return signature;
      }
    }
    
    return null;
  }
}
