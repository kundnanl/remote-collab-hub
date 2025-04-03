import { ClerkLoaded, ClerkLoading, ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Provider from '@/components/Provider'
import { Navbar } from '@/components/Navbar'
import { auth } from '@clerk/nextjs/server'
import FullPageLoader from '@/components/FullPageLoader'
import { LoadingProvider } from '@/components/LoadingProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata = {
  title: ' RemoteHub',
  description: 'Your remote workspace',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { userId } = await auth()

  if (userId === undefined) {
    return <FullPageLoader />
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <Provider>
            <LoadingProvider>
            <ClerkLoading>
            <div><FullPageLoader /></div>
          </ClerkLoading>
          <ClerkLoaded>
          <main className="min-h-screen w-full bg-gradient-to-br from-[#f9fafb] to-[#e6e8ec] text-gray-900">
            <Navbar />
          {children}
          </main>
          </ClerkLoaded>
          </LoadingProvider>
          </Provider>
        </body>
      </html>
    </ClerkProvider>
  )
}