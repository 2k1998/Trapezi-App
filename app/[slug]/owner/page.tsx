import { redirect } from 'next/navigation'

export default async function OwnerIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/${slug}/owner/menu`)
}
