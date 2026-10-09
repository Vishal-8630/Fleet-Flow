/**
 * ============================================================================
 * FLEET FLOW — CREATE SUPER ADMIN ACCOUNT SCRIPT (createSuperAdmin.ts)
 * ============================================================================
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://vishh8630:5Esz5f7k5M325v1z@cluster0.o7aiv.mongodb.net/transport-management?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas.');

  const email = 'vishh8630@gmail.com'.toLowerCase().trim();
  const plainPassword = 'vish@shiv123';
  const name = 'Vishal Super Admin';

  const password_hash = await bcrypt.hash(plainPassword, 12);

  // 1. Create or update User
  let user = await User.findOne({ email });
  if (user) {
    user.name = name;
    user.password_hash = password_hash;
    user.is_platform_super_admin = true;
    user.is_verified = true;
    await user.save();
    console.log(`Updated existing user ${email} to be platform super-admin.`);
  } else {
    user = await User.create({
      name,
      email,
      password_hash,
      is_platform_super_admin: true,
      is_verified: true,
    });
    console.log(`Created new super-admin user ${email}.`);
  }

  // 2. Find or create a company to attach as primary workspace
  let company = await Company.findOne({ slug: 'patel-roadways' }) || await Company.findOne();

  if (!company) {
    company = await Company.create({
      name: 'Fleet Flow Master Admin',
      slug: 'fleet-flow-admin',
      email,
      subscription_status: 'active',
    });
    console.log('Created default admin company.');
  }

  // 3. Ensure CompanyMember join record exists so login succeeds
  let membership = await CompanyMember.findOne({ user_id: user._id, company_id: company._id });
  if (!membership) {
    membership = await CompanyMember.create({
      company_id: company._id,
      user_id: user._id,
      email: user.email,
      role: 'admin',
      status: 'active',
    });
    console.log(`Linked user to company ${company.name} with role admin.`);
  } else {
    membership.status = 'active';
    membership.role = 'admin';
    await membership.save();
    console.log(`Updated membership for company ${company.name}.`);
  }

  console.log('\n======================================================');
  console.log('🎉 SUPER ADMIN ACCOUNT READY!');
  console.log(`Email:      ${email}`);
  console.log(`Password:   ${plainPassword}`);
  console.log(`SuperAdmin: ${user.is_platform_super_admin}`);
  console.log(`Workspace:  ${company.name} (${company.slug})`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed to create super-admin:', err);
  process.exit(1);
});
