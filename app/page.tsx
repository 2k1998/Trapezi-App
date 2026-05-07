export const metadata = {
  title: 'Trapezi',
}

import Image from 'next/image'
import { Dancing_Script } from 'next/font/google'

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

export default function HomePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at top right, #3F9EF4 0%, transparent 50%), linear-gradient(to bottom, #216AB7 0%, #0D4386 40%, #082A63 70%, #020B33 100%)',
      }}
    >
      <Image
        src="/logo.png"
        alt="Trapezi"
        width={420}
        height={144}
        className="mb-6 object-contain"
        priority
      />
      <p
        className={`${dancingScript.className} text-5xl tracking-wide text-white opacity-90 md:text-6xl`}
      >
        Coming Soon
      </p>
    </main>
  )
}
