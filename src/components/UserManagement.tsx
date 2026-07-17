'use client';
import React, { useState } from 'react';
import { useSPMS } from '@/lib/SPMSContext';
import { useLang } from '@/lib/LangContext';
import type { User, UserRole } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';

type FormState = {
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  password: string;
  branchId: string;
};

const emptyForm: FormState = {
  username: '',
  fullName: '',
  email: '',
  role: 'user_admin',
  enabled: true,
  password: '',
  branchId: '',
};

export default function UserManagement() {
  const { users, allUsers, currentUser, addUser, updateUser, deleteUser, resetUserPassword, locations } = useSPMS();
  const { t } = useLang();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showReset, setShowReset] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const isSystemAdmin = currentUser?.role === 'system_admin';
  const isBranchAdmin = currentUser?.role === 'branch_admin';

  // System admin sees all users; branch admin sees only users in their branch
  const displayUsers = isSystemAdmin ? allUsers : users;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Determine which roles can be created by the current user
  const allowedRoles: UserRole[] = isSystemAdmin
    ? ['system_admin', 'branch_admin', 'user_admin']
    : ['user_admin']; // branch_admin can only create operators

  const openAdd = () => {
    const defaultRole: UserRole = isSystemAdmin ? 'branch_admin' : 'user_admin';
    const defaultBranch = isBranchAdmin ? (currentUser?.branchId || '') : '';
    setForm({ ...emptyForm, role: defaultRole, branchId: defaultBranch });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, fullName: u.fullName, email: u.email, role: u.role, enabled: u.enabled, password: '', branchId: u.branchId || '' });
    setEditId(u.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enforce: branch_admin can only create user_admin for their own branch
    const finalBranchId = isBranchAdmin ? (currentUser?.branchId || '') : form.branchId;
    const finalRole: UserRole = isBranchAdmin ? 'user_admin' : form.role;

    if (editId) {
      const { password, ...rest } = form;
      updateUser(editId, { ...rest, role: finalRole, branchId: finalBranchId || undefined });
    } else {
      if (!form.password) return;
      addUser({ ...form, role: finalRole, branchId: finalBranchId || undefined });
    }
    setShowForm(false);
    showToast(t('successSaved'));
  };

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) { showToast('Cannot delete yourself'); setConfirmDel(null); return; }
    deleteUser(id);
    setConfirmDel(null);
    showToast(t('successDeleted'));
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { showToast(t('passwordMismatch')); return; }
    if (showReset) resetUserPassword(showReset, newPass);
    setShowReset(null);
    setNewPass(''); setConfirmPass('');
    showToast(t('successSaved'));
  };

  const getRoleBadge = (role: UserRole) => {
    if (role === 'system_admin') return <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">{t('roleSystemAdmin')}</span>;
    if (role === 'branch_admin') return <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{t('roleBranchAdmin')}</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">{t('roleUserAdmin')}</span>;
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return '-';
    return locations.find(l => l.id === branchId)?.name || branchId;
  };

  // Determine if branch selector should show (system_admin creating branch_admin or user_admin)
  const showBranchSelector = isSystemAdmin && (form.role === 'branch_admin' || form.role === 'user_admin');

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{t('userManagement')}</h1>
          {isBranchAdmin && (
            <p className="text-sm text-gray-500 mt-1">{t('managingBranchUsers')}: {getBranchName(currentUser?.branchId)}</p>
          )}
        </div>
        <button onClick={openAdd} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <span>+</span> {t('addUser')}
        </button>
      </div>

      {toast && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{toast}</div>}

      {/* Role legend for system admin */}
      {isSystemAdmin && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700">🔑 {t('roleSystemAdmin')}: {t('roleSystemAdminDesc')}</span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">🏢 {t('roleBranchAdmin')}: {t('roleBranchAdminDesc')}</span>
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">👤 {t('roleUserAdmin')}: {t('roleUserAdminDesc')}</span>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {[t('username'), t('fullName'), t('email'), t('role'), isSystemAdmin ? t('branch') : '', t('status'), t('lastLogin'), t('actions')]
                .filter(Boolean)
                .map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {displayUsers.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                <td className="px-4 py-3 text-gray-700">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                {isSystemAdmin && <td className="px-4 py-3 text-gray-500 text-xs">{getBranchName(u.branchId)}</td>}
                <td className="px-4 py-3">
                  <button
                    onClick={() => updateUser(u.id, { enabled: !u.enabled })}
                    disabled={u.id === currentUser?.id}
                    className={`text-xs px-2 py-1 rounded-full cursor-pointer ${u.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {u.enabled ? t('enabled') : t('disabled')}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.lastLogin || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => openEdit(u)} className="text-blue-500 text-xs border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">{t('edit')}</button>
                    <button onClick={() => setShowReset(u.id)} className="text-orange-500 text-xs border border-orange-200 px-2 py-1 rounded hover:bg-orange-50">{t('resetPassword')}</button>
                    <button onClick={() => setConfirmDel(u.id)} disabled={u.id === currentUser?.id} className="text-red-500 text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40">{t('delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editId ? t('editUser') : t('addUser')}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: 'username', label: t('username'), type: 'text', disabled: !!editId },
                { key: 'fullName', label: t('fullName'), type: 'text' },
                { key: 'email', label: t('email'), type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={(form as Record<string, string>)[f.key]} disabled={f.disabled}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50" required />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                {/* Role selector – system_admin can pick all roles; branch_admin is locked to user_admin */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
                  {isBranchAdmin ? (
                    <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">{t('roleUserAdmin')}</div>
                  ) : (
                    <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      {allowedRoles.map(r => (
                        <option key={r} value={r}>
                          {r === 'system_admin' ? t('roleSystemAdmin') : r === 'branch_admin' ? t('roleBranchAdmin') : t('roleUserAdmin')}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">{t('enabled')}</span>
                  </label>
                </div>
              </div>

              {/* Branch selector – only for system_admin assigning branch_admin or user_admin */}
              {showBranchSelector && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('assignBranch')}</label>
                  <select value={form.branchId} onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required>
                    <option value="">{t('selectBranch')}</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {!editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                  <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600">{t('cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-blue-500 text-white rounded-lg">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t('resetPassword')}</h3>
            <form onSubmit={handleReset} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('newPassword')}</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('confirmPassword')}</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowReset(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600">{t('cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-orange-500 text-white rounded-lg">{t('reset')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDelete')}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => handleDelete(confirmDel)}
        />
      )}
    </div>
  );
}
