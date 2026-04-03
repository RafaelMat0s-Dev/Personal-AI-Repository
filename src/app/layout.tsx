import type { Metadata } from 'next'
import { Syne, DM_Mono, Fraunces } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
})
const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['300', '400', '500'],
  display: 'swap',
})
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Personal OS',
  description: 'Your personal command center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${syne.variable} ${dmMono.variable} ${fraunces.variable} antialiased`}
        style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--surface2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '12px',
            },
          }}
        />
      </body>
    </html>
  )
}
