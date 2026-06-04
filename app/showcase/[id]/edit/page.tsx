"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { getCategories, getItemDetail, updateItem, ShowcaseCategory, ShowcaseItemDetail, ShowcaseItemCreate } from "@/lib/showcase"
import { useAuth } from "@/components/auth/auth-provider"
import { ItemEditor } from "../../components/ItemEditor"

export default function ShowcaseEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [categories, setCategories] = useState<ShowcaseCategory[]>([])
  const [item, setItem] = useState<ShowcaseItemDetail | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login")
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    Promise.all([getCategories(), getItemDetail(Number(id), false)])
      .then(([cats, itm]) => {
        const canEdit = user?.role === "admin" || user?.id === itm.author_id
        if (!canEdit) {
          toast.error("수정 권한이 없습니다.")
          router.replace(`/showcase/${id}`)
          return
        }
        setCategories(cats)
        setItem(itm)
      })
      .catch(() => {
        toast.error("아이템을 불러오지 못했습니다.")
        router.replace("/showcase")
      })
  }, [id, user])

  if (isLoading || !item) return null

  const handleUpdate = (data: ShowcaseItemCreate) => updateItem(Number(id), data)

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">아이템 수정</h1>
      <ItemEditor categories={categories} initial={item} onSubmit={handleUpdate} submitLabel="저장" />
    </div>
  )
}
