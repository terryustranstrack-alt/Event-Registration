import QRCode from "qrcode";

const options = { errorCorrectionLevel: "M" as const, margin: 2, width: 480 };

export function qrCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, options);
}

export function qrCodePngBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...options, type: "png" });
}

export function qrCodeSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...options, type: "svg" });
}
