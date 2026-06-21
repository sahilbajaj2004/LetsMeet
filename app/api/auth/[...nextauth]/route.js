import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth v4 catch-all handler for the App Router. The same handler serves
// every /api/auth/* endpoint (signin, callback, session, providers, signout).
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
