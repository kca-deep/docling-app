"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCategories, createItem, ShowcaseCategory } from "@/lib/showcase"
import { useAuth } from "@/components/auth/auth-provider"
import { ItemEditor } from "../components/ItemEditor"

export default function ShowcaseNewPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [categories, setCategories] = useState<ShowcaseCategory[]>([])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login")
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error)
  }, [])

  if (isLoading || !isAuthenticated) return null

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">새 아이템 등록</h1>
      <ItemEditor categories={categories} onSubmit={createItem} submitLabel="등록" />
    </div>
  )
}
