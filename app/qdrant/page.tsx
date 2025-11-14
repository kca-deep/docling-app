"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function QdrantRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/upload?tab=qdrant")
  }, [router])

  return null
}
