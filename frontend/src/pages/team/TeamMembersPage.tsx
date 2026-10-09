import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { toast } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import {
  UserPlus,
  Users,
  ShieldCheck,
  Clock,
  MoreVertical,
  Copy,
  Trash2,
  Shield,
  UserX,
  UserCheck,
} from 'lucide-react';

interface TeamMember {
  _id: string;
  email: string;
  role: 'admin' | 'dispatcher' | 'accountant' | 'viewer';
  status: 'invited' | 'active' | 'deactivated';
  created_at: string;
  invitation_token?: string;
  user_id?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  invited_by?: {
    name: string;
    email: string;
  };
}

export const TeamMembersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, company, role } = useAuthStore();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'dispatcher' | 'accountant' | 'viewer' | 'admin'>('dispatcher');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'dispatcher' | 'accountant' | 'viewer'>('dispatcher');

  const isAdmin = role === 'admin';

  // Fetch members
  const { data, isLoading } = useQuery<{ members: TeamMember[] }>({
    queryKey: ['company-members'],
    queryFn: async () => {
      const res = await api.get('/company/members');
      return res.data;
    },
  });

  const members = data?.members || [];

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: string }) => {
      const res = await api.post('/company/members/invite', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Invitation created for ${inviteEmail}!`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      if (data.invitation_link) {
        navigator.clipboard.writeText(data.invitation_link);
        toast.info('Invitation link automatically copied to clipboard!');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to send invitation.');
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await api.patch(`/company/members/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Member role successfully updated.');
      setIsRoleModalOpen(false);
      setSelectedMember(null);
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update member role.');
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'deactivated' }) => {
      const res = await api.patch(`/company/members/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Member ${vars.status === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update member status.');
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/company/members/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Member removed from workspace.');
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to remove member.');
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const handleCopyInviteLink = (token?: string) => {
    if (!token) return;
    const link = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.info('Invitation link copied to clipboard!');
  };

  // Metrics
  const totalCount = members.length;
  const activeCount = members.filter((m) => m.status === 'active').length;
  const pendingCount = members.filter((m) => m.status === 'invited').length;

  return (
    <div>
      <PageHeader
        title="Team & Permissions"
        subtitle="Manage operators, dispatchers, accountants, and workspace access control."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Team & Members' },
        ]}
        actions={
          isAdmin ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <UserPlus size={16} />
              Invite Member
            </button>
          ) : undefined
        }
      />

      {/* KPI Stats */}
      <div className="grid-12" style={{ marginBottom: '1.75rem' }}>
        <div className="col-span-4 col-span-md-12">
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-primary-50)',
                color: 'var(--color-primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
                Total Members
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)' }}>
                {totalCount}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-4 col-span-md-12">
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-emerald-50)',
                color: 'var(--color-emerald-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
                Active Accounts
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)' }}>
                {activeCount}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-4 col-span-md-12">
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-amber-50)',
                color: 'var(--color-amber-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
                Pending Invitations
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-main)' }}>
                {pendingCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)' }}>
              Workspace Members Directory
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Individuals with verified access to {company?.name || 'this workspace'}.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined / Invited</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center" style={{ padding: '2.5rem' }}>
                    <div style={{ display: 'inline-block', width: '1.5rem', height: '1.5rem', border: '2px solid var(--color-primary-200)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center" style={{ padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No members registered yet.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const isSelf = member.user_id?._id === user?.id;
                  const memberName = member.user_id?.name || member.email.split('@')[0];

                  const getRoleBadge = (role: string) => {
                    switch (role) {
                      case 'admin':
                        return <span className="badge badge-primary">Admin</span>;
                      case 'dispatcher':
                        return <span className="badge badge-info">Dispatcher</span>;
                      case 'accountant':
                        return <span className="badge badge-warning">Accountant</span>;
                      case 'viewer':
                      default:
                        return <span className="badge badge-neutral">Viewer</span>;
                    }
                  };

                  const getStatusBadge = (status: string) => {
                    switch (status) {
                      case 'active':
                        return <span className="badge badge-success">Active</span>;
                      case 'invited':
                        return <span className="badge badge-warning">Invited</span>;
                      case 'deactivated':
                        return <span className="badge badge-danger">Deactivated</span>;
                    }
                  };

                  return (
                    <tr key={member._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '2.25rem',
                              height: '2.25rem',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-slate-100)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'var(--font-weight-bold)',
                              color: 'var(--color-slate-700)',
                              fontSize: 'var(--font-size-xs)',
                            }}
                          >
                            {memberName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              {memberName}
                              {isSelf && <span style={{ fontSize: '10px', color: 'var(--color-primary-600)', backgroundColor: 'var(--color-primary-50)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>You</span>}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{getRoleBadge(member.role)}</td>
                      <td>{getStatusBadge(member.status)}</td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {new Date(member.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                            {member.status === 'invited' && member.invitation_token && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                title="Copy Invitation Link"
                                onClick={() => handleCopyInviteLink(member.invitation_token)}
                              >
                                <Copy size={13} />
                              </button>
                            )}

                            {!isSelf && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  title="Change Role"
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setNewRole(member.role);
                                    setIsRoleModalOpen(true);
                                  }}
                                >
                                  <Shield size={13} />
                                </button>

                                {member.status === 'active' ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    title="Deactivate Account"
                                    onClick={() =>
                                      toggleStatusMutation.mutate({ id: member._id, status: 'deactivated' })
                                    }
                                  >
                                    <UserX size={13} color="var(--color-rose-600)" />
                                  </button>
                                ) : member.status === 'deactivated' ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    title="Reactivate Account"
                                    onClick={() =>
                                      toggleStatusMutation.mutate({ id: member._id, status: 'active' })
                                    }
                                  >
                                    <UserCheck size={13} color="var(--color-emerald-600)" />
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  title="Remove Member"
                                  onClick={() => {
                                    if (confirm(`Remove ${member.email} from company workspace?`)) {
                                      removeMutation.mutate(member._id);
                                    }
                                  }}
                                >
                                  <Trash2 size={13} color="var(--color-rose-600)" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite New Team Member"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsInviteModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleInviteSubmit}
              disabled={inviteMutation.isPending || !inviteEmail}
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </button>
          </>
        }
      >
        <form onSubmit={handleInviteSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="inviteEmail">
              Employee Email Address <span style={{ color: 'var(--color-rose-500)' }}>*</span>
            </label>
            <input
              id="inviteEmail"
              type="email"
              className="form-input"
              placeholder="e.g. dispatcher@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="inviteRole">
              Workspace Role & Permissions <span style={{ color: 'var(--color-rose-500)' }}>*</span>
            </label>
            <select
              id="inviteRole"
              className="form-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
            >
              <option value="dispatcher">Dispatcher — Trucks, Drivers, Trips & Movement Tracking</option>
              <option value="accountant">Accountant — Invoices, GST, Settlements & Expenses</option>
              <option value="admin">Administrator — Full Access & Company Settings</option>
              <option value="viewer">Viewer — Read-Only Access across all modules</option>
            </select>
          </div>

          <div
            style={{
              padding: '0.875rem 1rem',
              backgroundColor: 'var(--color-slate-50)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            An activation link will be generated. The invited team member can use it to set up their password and log in to your workspace.
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={`Change Role: ${selectedMember?.email}`}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsRoleModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={changeRoleMutation.isPending}
              onClick={() => {
                if (selectedMember) {
                  changeRoleMutation.mutate({ id: selectedMember._id, role: newRole });
                }
              }}
            >
              Save New Role
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Select Workspace Role</label>
          <select
            className="form-select"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as any)}
          >
            <option value="dispatcher">Dispatcher</option>
            <option value="accountant">Accountant</option>
            <option value="admin">Administrator</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </Modal>
    </div>
  );
};
