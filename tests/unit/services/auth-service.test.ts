import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

let queryResults: any[] = [];
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  then: jest.fn((resolve, reject) => {
    const next = queryResults.shift() || { data: null, error: null };
    if (next instanceof Error) {
      reject(next);
    } else {
      resolve(next);
    }
  })
};

jest.mock('../../../src/db/supabase-client', () => ({
  supabase: mockSupabase
}));

import { loginAdmin } from '../../../src/services/auth-service';

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
    process.env.JWT_SECRET = 'secret';
  });

  describe('loginAdmin', () => {
    it('should login successfully and return token', async () => {
      queryResults.push({ data: { adminId: '1', username: 'admin', passwordHash: 'hash' } });
      queryResults.push({ error: null }); 

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('fake-token');

      const res = await loginAdmin('admin', 'password');
      expect(res.token).toBe('fake-token');
      expect(res.admin.username).toBe('admin');
    });

    it('should throw INVALID_CREDENTIALS if user not found', async () => {
      queryResults.push({ error: { message: 'Not found' }, data: null });
      await expect(loginAdmin('admin', 'password')).rejects.toThrow('Username or password is incorrect');
    });

    it('should throw INVALID_CREDENTIALS if password invalid', async () => {
      queryResults.push({ data: { adminId: '1', username: 'admin', passwordHash: 'hash' } });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(loginAdmin('admin', 'wrong')).rejects.toThrow('Username or password is incorrect');
    });
  });
});
