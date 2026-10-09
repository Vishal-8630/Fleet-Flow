import React from 'react';
import { Building2, LogOut, Clock, UserCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const Navbar: React.FC = () => {
  const { user, company, role, logout } = useAuthStore();

  const calculateDaysRemaining = (dateStr?: string) => {
    if (!dateStr) return 14;
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysRemaining(company?.trialEndsAt);

  return (
    <header className="top-navbar">
      <div className="flex items-center" style={{ gap: '1rem' }}>
        <div className="flex items-center" style={{ gap: '0.5rem', backgroundColor: 'var(--color-slate-100)', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
          <Building2 size={16} color="var(--color-primary-600)" />
          <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
            {company?.name || 'Workspace'}
          </span>
          <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
            {company?.status || 'Active'}
          </span>
        </div>

        {company?.status === 'trialing' && (
          <div className="badge badge-warning" style={{ gap: '0.375rem' }}>
            <Clock size={12} />
            <span>{daysLeft} Days Free Trial Left</span>
          </div>
        )}
      </div>

      <div className="flex items-center" style={{ gap: '1.25rem' }}>
        <div className="flex items-center" style={{ gap: '0.5rem' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={16} color="var(--color-primary-600)" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1.1 }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              Role: {role}
            </div>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="btn btn-ghost btn-sm"
          title="Sign out of workspace"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
