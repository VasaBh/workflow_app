'use client';

import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types';

const roleRank: Record<UserRole, number> = {
  admin: 4,
  editor: 3,
  executor: 2,
  viewer: 1,
};

interface RoleGateProps {
  minRole: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGate({ minRole, children, fallback = null }: RoleGateProps) {
  const user = useAuthStore((s) => s.user);

  if (!user) return <>{fallback}</>;

  const userRank = roleRank[user.role] ?? 0;
  const requiredRank = roleRank[minRole] ?? 0;

  if (userRank >= requiredRank) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
