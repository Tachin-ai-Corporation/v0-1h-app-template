import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { HomePageClient } from "@/components/home-page-client"

export default async function HomePage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("access_token")

  if (!accessToken?.value) {
    redirect("/auth")
  }

  return <HomePageClient />
}
