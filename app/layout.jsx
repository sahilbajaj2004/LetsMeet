import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "LetsMeet — peer-to-peer video rooms",
  description:
    "Small, private video rooms for up to 4 people. Audio and video travel browser to browser over a peer-to-peer mesh — never through a media server.",
  applicationName: "LetsMeet",
  authors: [{ name: "LetsMeet" }],
  openGraph: {
    title: "LetsMeet — peer-to-peer video rooms",
    description:
      "Up to 4 people, browser to browser, no media server in the middle.",
    type: "website",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0e0c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfdfb" },
  ],
};

// Runs before paint: defaults to dark, honors a stored choice. Prevents the
// flash of the wrong theme before React hydrates.
const themeScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='light'){d.classList.remove('dark');}else{d.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
