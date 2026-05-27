import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export function generateTOTPSecret(email: string) {
  const secret = speakeasy.generateSecret({
    name: `TL-Management (${email})`,
    length: 20
  });
  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url || ''
  };
}

export async function generateQRCode(otpauthUrl: string): Promise<string> {
  return await QRCode.toDataURL(otpauthUrl);
}

export function verifyTOTP(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1
  });
}
