import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';
import { signUrl } from '../lib/s3';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const VERIFY_OTP_EXPIRY_MINUTES = 15;

async function buildUserPayload(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email.split('@')[0],
    role: user.role,
    points: user.points,
    level: Math.floor(Math.sqrt(user.points / 100)) + 1,
    avatarUrl: await signUrl(user.avatarUrl),
    sex: user.sex ?? null,
    birthDate: user.birthDate?.toISOString() ?? null,
    stats: { roomsAdded: 0, reviewsWritten: 0 },
  };
}

const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos', code: 'MISSING_FIELDS' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido', code: 'INVALID_EMAIL' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres', code: 'WEAK_PASSWORD' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      // If unverified account exists, resend OTP instead of rejecting
      if (!(existing as any).emailVerified) {
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, 8);
        const expiry = new Date(Date.now() + VERIFY_OTP_EXPIRY_MINUTES * 60 * 1000);
        await prisma.user.update({
          where: { id: existing.id },
          data: { emailVerifyOtp: hashedOtp, emailVerifyExpiry: expiry } as any,
        });
        await sendVerificationEmail(existing.email, existing.name || '', otp).catch(console.error);
        return res.status(200).json({ requiresVerification: true, email: existing.email });
      }
      return res.status(409).json({ error: 'Este correo ya está registrado', code: 'EMAIL_TAKEN' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 8);
    const expiry = new Date(Date.now() + VERIFY_OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        passwordHash: hashedPassword,
        role: 'VISITOR',
        status: 'ACTIVE',
        emailVerified: false,
        emailVerifyOtp: hashedOtp,
        emailVerifyExpiry: expiry,
        lastLogin: new Date(),
      } as any,
    });

    await sendVerificationEmail(email.toLowerCase().trim(), name?.trim() || '', otp).catch(console.error);

    res.status(201).json({ requiresVerification: true, email: email.toLowerCase().trim() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la cuenta', code: 'SERVER_ERROR' });
  }
};

const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Correo y código son requeridos', code: 'MISSING_FIELDS' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      return res.status(404).json({ error: 'Cuenta no encontrada', code: 'USER_NOT_FOUND' });
    }
    const u = user as any;
    if (u.emailVerified) {
      // Already verified — just log them in
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: await buildUserPayload(user) });
    }
    if (!u.emailVerifyOtp || !u.emailVerifyExpiry) {
      return res.status(400).json({ error: 'No hay verificación pendiente', code: 'NO_PENDING_VERIFICATION' });
    }
    if (u.emailVerifyExpiry < new Date()) {
      return res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.', code: 'OTP_EXPIRED' });
    }

    const validOtp = await bcrypt.compare(otp.trim(), u.emailVerifyOtp);
    if (!validOtp) {
      return res.status(400).json({ error: 'Código incorrecto', code: 'INVALID_OTP' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyOtp: null, emailVerifyExpiry: null } as any,
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: await buildUserPayload(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar', code: 'SERVER_ERROR' });
  }
};

const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo es requerido', code: 'MISSING_FIELDS' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || (user as any).emailVerified) {
      return res.json({ message: 'Si el correo tiene verificación pendiente recibirás un nuevo código.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 8);
    const expiry = new Date(Date.now() + VERIFY_OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyOtp: hashedOtp, emailVerifyExpiry: expiry } as any,
    });

    await sendVerificationEmail(user.email, user.name || '', otp).catch(console.error);

    res.json({ message: 'Código reenviado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al reenviar el código', code: 'SERVER_ERROR' });
  }
};

const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos', code: 'MISSING_FIELDS' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      return res.status(404).json({ error: 'No existe una cuenta con este correo', code: 'USER_NOT_FOUND' });
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'Esta cuenta ha sido desactivada permanentemente', code: 'ACCOUNT_BANNED' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Esta cuenta está suspendida. Contacta a soporte.', code: 'ACCOUNT_SUSPENDED' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        error: `Cuenta bloqueada temporalmente. Intenta en ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.lockedUntil,
      });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      const newFailed = user.failedLoginAttempts + 1;
      const remaining = MAX_FAILED_ATTEMPTS - newFailed;
      const updateData: any = { failedLoginAttempts: newFailed };

      if (newFailed >= MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await prisma.user.update({ where: { id: user.id }, data: updateData });
        return res.status(429).json({
          error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_MINUTES} minutos.`,
          code: 'ACCOUNT_LOCKED',
          lockedUntil: updateData.lockedUntil,
        });
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });
      return res.status(401).json({
        error: `Contraseña incorrecta. Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.`,
        code: 'WRONG_PASSWORD',
        attemptsRemaining: remaining,
      });
    }

    // Check email verification
    if (!(user as any).emailVerified) {
      // Resend OTP automatically
      const otp = crypto.randomInt(100000, 999999).toString();
      const hashedOtp = await bcrypt.hash(otp, 8);
      const expiry = new Date(Date.now() + VERIFY_OTP_EXPIRY_MINUTES * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyOtp: hashedOtp, emailVerifyExpiry: expiry } as any,
      });
      await sendVerificationEmail(user.email, user.name || '', otp).catch(console.error);
      return res.status(403).json({
        error: 'Debes verificar tu correo antes de iniciar sesión.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLogin: new Date() },
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: await buildUserPayload(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión', code: 'SERVER_ERROR' });
  }
};

const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo es requerido', code: 'MISSING_FIELDS' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || user.status === 'BANNED') {
      return res.json({ message: 'Si el correo está registrado recibirás el código.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 8);
    const expiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashedOtp, passwordResetExpiry: expiry },
    });

    await sendPasswordResetEmail(user.email, otp).catch(console.error);

    res.json({ message: 'Si el correo está registrado recibirás el código.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la solicitud', code: 'SERVER_ERROR' });
  }
};

const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Correo, código y nueva contraseña son requeridos', code: 'MISSING_FIELDS' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres', code: 'WEAK_PASSWORD' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      return res.status(400).json({ error: 'Solicitud inválida o expirada', code: 'INVALID_RESET' });
    }
    if (user.passwordResetExpiry < new Date()) {
      return res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.', code: 'OTP_EXPIRED' });
    }

    const validOtp = await bcrypt.compare(otp, user.passwordResetToken);
    if (!validOtp) {
      return res.status(400).json({ error: 'Código incorrecto', code: 'INVALID_OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al restablecer la contraseña', code: 'SERVER_ERROR' });
  }
};

export default { register, login, verifyEmail, resendVerification, forgotPassword, resetPassword };
