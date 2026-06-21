"use client";

import { SessionProvider } from "next-auth/react";

// Makes `useSession()` available to every Client Component in the tree.
export default function AuthProvider({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
