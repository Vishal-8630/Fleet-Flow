import jwt from 'jsonwebtoken';
import { Company, ICompany } from '../models/Company.js';
import { User, IUser } from '../models/User.js';
import { CompanyMember, ICompanyMember, UserRole } from '../models/CompanyMember.js';

export interface TestTenantContext {
  company: ICompany;
  user: IUser;
  member: ICompanyMember;
  token: string;
}

let counter = 0;

export async function createTestTenant(options?: {
  name?: string;
  role?: UserRole;
  subscription_status?: string;
  is_deleted?: boolean;
}): Promise<TestTenantContext> {
  counter += 1;
  const uniqueId = `${Date.now()}-${counter}-${Math.random().toString(36).substring(2, 7)}`;
  const role = options?.role || 'admin';
  const subStatus = options?.subscription_status || 'active';

  const company = await Company.create({
    name: options?.name || `Test Company ${uniqueId}`,
    slug: `test-company-${uniqueId}`,
    email: `company-${uniqueId}@test.com`,
    phone: `+9198${String(counter).padStart(8, '0')}`,
    subscription_status: subStatus,
    is_deleted: options?.is_deleted || false,
    settings: {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      lr_prefix: 'LR-',
      lr_zero_pad: 5,
      invoice_prefix: 'INV-',
      invoice_zero_pad: 5,
      settlement_prefix: 'SET-',
      settlement_zero_pad: 5,
      date_format: 'DD/MM/YYYY',
      number_system: 'indian_lakhs',
      expense_categories: [],
    },
  });

  const user = await User.create({
    name: `User ${uniqueId}`,
    email: `user-${uniqueId}@test.com`,
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    is_verified: true,
    is_platform_super_admin: false,
    token_version: 0,
  });

  const member = await CompanyMember.create({
    company_id: company._id,
    user_id: user._id,
    email: user.email,
    role,
    status: 'active',
  });

  const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345678901234567890';
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      companyId: company._id.toString(),
      token_version: user.token_version || 0,
    },
    secret,
    { expiresIn: '1d' }
  );

  return { company, user, member, token };
}

export async function createSuperAdmin(): Promise<{ user: IUser; token: string }> {
  counter += 1;
  const uniqueId = `super-${Date.now()}-${counter}`;
  const user = await User.create({
    name: `Super Admin ${uniqueId}`,
    email: `${uniqueId}@platform.com`,
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    is_verified: true,
    is_platform_super_admin: true,
    token_version: 0,
  });

  const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345678901234567890';
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      token_version: user.token_version || 0,
    },
    secret,
    { expiresIn: '1d' }
  );

  return { user, token };
}
