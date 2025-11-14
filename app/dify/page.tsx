"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DifyRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/upload?tab=dify")
  }, [router])

  return null
}
