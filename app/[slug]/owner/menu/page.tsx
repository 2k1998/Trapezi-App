import type { Metadata } from 'next'
import { MenuManagementHub } from '@/components/owner/menu/MenuManagementHub'

export const metadata: Metadata = {
  title: 'Menu management | Trapezi',
}

export default function OwnerMenuPage() {
  return <MenuManagementHub />
}
