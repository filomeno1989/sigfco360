// SIGFCO - Download autorizado de ficheiros (: acesso privado,
// autorização em cada download, isolamento por empresa)
import { withAuth, jsonError } from '@/lib/api'
import { readAttachmentBytes } from '@/lib/files'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async ({ ctx, params }) => {
  const result = await readAttachmentBytes(params.id, ctx.user.companyId ?? '')
  if (!result) return jsonError(404, 'Ficheiro não encontrado ou sem permissão.')
  const { att, buf, verified } = result
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': att.mime,
      'Content-Disposition': `inline; filename="${att.originalName.replace(/"/g, '')}"`,
      'X-Integrity-Verified': verified ? '1' : '0',
      'Cache-Control': 'private, no-store',
    },
  })
})
