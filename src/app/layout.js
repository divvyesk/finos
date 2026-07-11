import { cookies } from 'next/headers';
import { getData } from './lib/db';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'FinOS - AI Financial Onboarding Operating System',
  description: 'Learn how money works, parse your paycheck, simulate scenarios, and build a personalized financial roadmap.',
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;
  
  let user = null;
  if (sessionId) {
    try {
      const data = getData();
      const found = data.users.find(u => u.id === sessionId);
      if (found) {
        user = { id: found.id, name: found.name, email: found.email };
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className}`}>
        <main>{children}</main>
      </body>
    </html>
  );
}
