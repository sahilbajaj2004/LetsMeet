import GoogleProvider from "next-auth/providers/google";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

// NextAuth v4 config, shared by the route handler and any server-side
// `getServerSession(authOptions)` call. JWT sessions for now — no DB adapter
// yet, so login works before the User collection lands in Phase 2.
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // On initial sign-in (account + profile present), persist the Google user
    // into Mongo and carry their Mongo _id on the token. The id is what rooms
    // reference as `host`, so it must be the database id — not Google's sub.
    async jwt({ token, account, profile }) {
      if (account && profile) {
        await connectToDatabase();
        const dbUser = await User.findOneAndUpdate(
          { googleId: profile.sub },
          {
            $set: {
              googleId: profile.sub,
              name: profile.name,
              email: profile.email,
              image: profile.picture,
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
        token.id = dbUser._id.toString();
      }
      return token;
    },
    // Expose id to the client/server session (`session.user.id`).
    async session({ session, token }) {
      if (session.user) session.user.id = token.id ?? token.sub;
      return session;
    },
  },
};

export default authOptions;
