import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Cairo } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { MotionProvider } from '@/components/providers/motion-provider';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'YallaMotors — Control Center',
  description: 'Admin & Control Center for YallaMotors marketplace',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${cairo.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <MotionProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
