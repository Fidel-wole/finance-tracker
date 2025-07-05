import { PartnerConfig } from '../interfaces/webhook';

export default class PartnerService {
  private static partners: Map<string, PartnerConfig> = new Map();

  static initialize(): void {
    const supportedPartners = ['opay', 'kuda', 'palmpay'];

    supportedPartners.forEach(partner => {
      const config = this.getPartnerConfigFromEnv(partner);
      if (config) {
        this.partners.set(partner.toLowerCase(), config);
      }
    });

    console.log(`Initialized ${this.partners.size} partner(s): ${Array.from(this.partners.keys()).join(', ')}`);
  }

  static getPartnerConfig(partnerName: string): PartnerConfig | null {
    return this.partners.get(partnerName.toLowerCase()) || null;
  }

  static getSupportedPartners(): string[] {
    return Array.from(this.partners.keys());
  }


  static isPartnerSupported(partnerName: string): boolean {
    return this.partners.has(partnerName.toLowerCase());
  }


  static registerPartner(partnerName: string, config: PartnerConfig): void {
    this.partners.set(partnerName.toLowerCase(), config);
    console.log(`Registered new partner: ${partnerName}`);
  }


  private static getPartnerConfigFromEnv(partnerName: string): PartnerConfig | null {
    const upperPartner = partnerName.toUpperCase();
    const secretKey = process.env[`${upperPartner}_WEBHOOK_SECRET`];
    
    if (!secretKey) {
      console.warn(`Missing webhook secret for ${partnerName}. Set ${upperPartner}_WEBHOOK_SECRET in environment variables.`);
      return null;
    }

    const partnerConfigs: { [key: string]: Partial<PartnerConfig> } = {
      opay: {
        signatureHeader: 'x-opay-signature',
        signaturePrefix: 'sha256=',
      },
      kuda: {
        signatureHeader: 'x-kuda-signature',
      },
      palmpay: {
        signatureHeader: 'x-palmpay-signature',
        signaturePrefix: 'sha256=',
      },
    };

    const baseConfig = partnerConfigs[partnerName.toLowerCase()] || {
      signatureHeader: 'x-signature',
    };

    return {
      name: partnerName,
      secretKey,
      signatureHeader: baseConfig.signatureHeader || 'x-signature',
      signaturePrefix: baseConfig.signaturePrefix,
    };
  }


  static validatePartnerConfig(config: PartnerConfig): boolean {
    return !!(
      config.name &&
      config.secretKey &&
      config.signatureHeader
    );
  }

  static getPartnerWebhookUrl(partnerName: string, baseUrl: string): string {
    return `${baseUrl}/webhook/${partnerName.toLowerCase()}`;
  }
}
