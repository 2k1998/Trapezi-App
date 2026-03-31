import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50 px-6 py-16">
      <h1 className="text-center font-display text-3xl text-brand-900">
        Table ordering
      </h1>
      <p className="mt-4 max-w-md text-center text-sm text-brand-600">
        Guests open the menu from the QR code or NFC link on their table. That URL
        includes the restaurant and table number.
      </p>
      <p className="mt-6 text-xs text-brand-500">
        Local demo (seed data):{' '}
        <Link
          href="/test-restaurant?table=1"
          className="font-medium text-accent-500 underline underline-offset-2"
        >
          /test-restaurant?table=1
        </Link>
      </p>
      <Link
        href="/login"
        className="mt-10 text-sm font-medium text-brand-700 hover:text-brand-900"
      >
        Staff login
      </Link>
    </div>
  )
}
