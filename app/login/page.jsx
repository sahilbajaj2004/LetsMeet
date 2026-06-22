import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Logo from "../_components/logo";
import GoogleSignInButton from "../_components/google-signin-button";

export const metadata = {
  title: "Sign in — LetsMeet",
};

export default async function LoginPage({ searchParams }) {
  const session = await getServerSession(authOptions);

  // Already signed in → skip the form. Honor a `callbackUrl` if one came in.
  const { callbackUrl } = await searchParams;
  if (session) redirect(callbackUrl || "/dashboard");

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Link href="/" aria-label="LetsMeet home">
            <Logo />
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-canvas p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Sign in to LetsMeet
          </h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
            Google sign-in is the only way in. You need an account to create a
            room — guests join with just a name once you share the link.
          </p>

          <div className="mt-8">
            <GoogleSignInButton callbackUrl={callbackUrl || "/dashboard"} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-faint">
          We only read your name, email, and avatar. No posts, no contacts.
        </p>
      </div>
    </main>
  );
}
