import { useQuery } from '@tanstack/react-query'
import { FileText, FolderOpen, Lock, ShieldCheck, ShieldOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchFolders } from '@/services/documents'
import { getVaultStatus, listSecrets } from '@/services/secrets'
import { MiniCard } from './mini-card'
import { SystemSection } from './system-section'

export function OverviewSection() {
  const { data: folders } = useQuery({
    queryKey: ['doc-folders-summary'],
    queryFn: () => fetchFolders(),
    staleTime: 120_000,
    retry: 1,
  })

  const { data: vaultStatus } = useQuery({
    queryKey: ['vault-status-summary'],
    queryFn: () => getVaultStatus(),
    staleTime: 120_000,
    retry: 1,
  })

  const { data: secrets } = useQuery({
    queryKey: ['secrets-summary'],
    queryFn: () => listSecrets(),
    staleTime: 120_000,
    retry: 1,
    enabled: vaultStatus?.available !== false,
  })

  const totalDocs = folders?.reduce((sum, f) => sum + f.docCount, 0) ?? 0
  const folderCount = folders?.length ?? 0
  const vaultActive = vaultStatus?.available ?? false
  const secretCount = secrets?.length ?? 0

  return (
    <>
      <MiniCard icon={FileText} iconColor="text-muted-foreground" label="Documents" to="/documents">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-foreground">{totalDocs}</span>
          <span className="text-sm text-muted-foreground">docs</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          <FolderOpen size={14} className="inline mr-1 -mt-0.5" />
          {folderCount} folder{folderCount !== 1 ? 's' : ''}
        </p>
      </MiniCard>

      <MiniCard icon={Lock} iconColor="text-primary" label="Vault" to="/vault">
        <div className="flex items-center gap-2 mb-1">
          {vaultActive ? (
            <ShieldCheck size={16} className="text-primary" />
          ) : (
            <ShieldOff size={16} className="text-muted-foreground" />
          )}
          <span className={cn('text-sm font-medium', vaultActive ? 'text-primary' : 'text-muted-foreground')}>
            {vaultActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-foreground">{secretCount}</span>
          <span className="text-sm text-muted-foreground">secret{secretCount !== 1 ? 's' : ''}</span>
        </div>
      </MiniCard>
      <SystemSection />
    </>
  )
}
