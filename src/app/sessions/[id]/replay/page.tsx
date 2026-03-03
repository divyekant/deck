import { redirect } from "next/navigation"

export default async function SessionReplayRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/workspace?session=${id}&replay=true`)
}
