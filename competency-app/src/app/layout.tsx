import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { CookieBanner } from '@/components/ui/cookie-banner'
import { BrandingProvider } from '@/components/providers/branding-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'SCOUTER - Mesure des compétences',
  description: 'Plateforme de mesure des compétences professionnelles',
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <BrandingProvider>
            {children}
            <Toaster />
            <CookieBanner />
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
