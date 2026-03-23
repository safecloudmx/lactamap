import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'LactaMap <noreply@lactamap.app>';

const brandHtml = (content: string) => `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #f1f5f9">
    <div style="background:linear-gradient(135deg,#F43F5E,#fb7185);padding:28px 32px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px">LactaMap</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Encuentra espacios seguros para ti y tu bebé</p>
    </div>
    <div style="padding:32px">
      ${content}
    </div>
    <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #f1f5f9">
      <p style="margin:0;color:#94a3b8;font-size:11px">© 2026 LactaMap · WARI</p>
    </div>
  </div>
`;

const otpBlock = (otp: string) => `
  <div style="text-align:center;margin:24px 0">
    <div style="display:inline-block;background:#fff1f4;border:2px dashed #F43F5E;border-radius:12px;padding:16px 32px">
      <span style="font-size:40px;font-weight:800;letter-spacing:14px;color:#F43F5E;font-family:monospace">${otp}</span>
    </div>
  </div>
`;

export async function sendVerificationEmail(email: string, name: string, otp: string) {
  const content = `
    <p style="color:#334155;font-size:15px;margin:0 0 8px">Hola${name ? ` <strong>${name}</strong>` : ''}👋</p>
    <p style="color:#334155;font-size:15px;margin:0 0 20px">Para activar tu cuenta ingresa el siguiente código de verificación:</p>
    ${otpBlock(otp)}
    <p style="color:#64748b;font-size:13px;text-align:center;margin:0 0 24px">Expira en <strong>15 minutos</strong></p>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">Si no creaste esta cuenta, ignora este mensaje.</p>
  `;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verifica tu cuenta — LactaMap',
    html: brandHtml(content),
  });
}

export async function sendPasswordResetEmail(email: string, otp: string) {
  const content = `
    <p style="color:#334155;font-size:15px;margin:0 0 20px">Recibimos una solicitud para restablecer tu contraseña. Usa este código:</p>
    ${otpBlock(otp)}
    <p style="color:#64748b;font-size:13px;text-align:center;margin:0 0 24px">Expira en <strong>1 hora</strong></p>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">Si no solicitaste esto, ignora este mensaje.</p>
  `;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Restablecer contraseña — LactaMap',
    html: brandHtml(content),
  });
}
