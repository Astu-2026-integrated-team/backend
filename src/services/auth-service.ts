import { supabase  } from '../db/supabase-client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ERROR_CODES  } from '../config/constants';

async function loginAdmin(username, password) {
  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !admin) {
    const err = new Error('Username or password is incorrect');
    (err as any).code = ERROR_CODES.INVALID_CREDENTIALS;
    throw err;
  }

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) {
    const err = new Error('Username or password is incorrect');
    (err as any).code = ERROR_CODES.INVALID_CREDENTIALS;
    throw err;
  }

  const payload = {
    adminId: admin.adminId,
    username: admin.username
  };

  const token = jwt.sign({ admin: payload }, (process.env.JWT_SECRET as string), { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '24h' });

  await supabase.from('admin_users').update({ lastLoginAt: new Date().toISOString() }).eq('adminId', admin.adminId);

  return {
    token,
    admin: payload
  };
}

export { loginAdmin };
