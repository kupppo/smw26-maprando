import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { ThemeProvider } from './theme-provider'
import './globals.css'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

export const metadata: Metadata = {
  title: 'Super Metroid Winter 2026 Map Rando Tournament',
  description: 'Powered by Inertia',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased min-h-screen ${GeistSans.variable} ${GeistMono.variable}`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          {children}
          <Toaster theme="system" />
        </ThemeProvider>
      </body>
    </html>
  )
}
