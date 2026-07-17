

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      fullName: string;
      email: string;
      role: string;
      branchId: string | null;
      enabled: boolean;
    };
  }

  interface User {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: string;
    branchId: string | null;
    enabled: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    fullName: string;
    role: string;
    branchId: string | null;
    enabled: boolean;
  }
}
