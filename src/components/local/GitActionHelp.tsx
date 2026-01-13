import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  RefreshCw,
  Download,
  Upload,
  Archive,
  ArchiveRestore,
  Loader2,
  HelpCircle,
} from 'lucide-react'

interface GitActionInfo {
  id: string
  label: string
  icon: React.ElementType
  shortDesc: string
  longDesc: string
  usage: string[]
  tips: string[]
}

const GIT_ACTIONS: GitActionInfo[] = [
  {
    id: 'fetch',
    label: 'Fetch',
    icon: RefreshCw,
    shortDesc: '원격 저장소의 변경사항을 확인합니다 (병합 없음)',
    longDesc:
      'Fetch는 원격 저장소(origin)의 최신 변경사항을 로컬로 가져오지만, 현재 작업 중인 브랜치에 병합하지 않습니다.',
    usage: [
      '원격 저장소에 새 커밋이 있는지 확인할 때',
      'Pull 전에 변경사항을 미리 검토하고 싶을 때',
      '다른 팀원의 브랜치를 확인하고 싶을 때',
    ],
    tips: [
      'Fetch 후 "ahead/behind" 상태로 동기화 여부를 확인하세요',
      'Fetch는 안전한 작업입니다 - 로컬 변경사항에 영향 없음',
    ],
  },
  {
    id: 'pull',
    label: 'Pull',
    icon: Download,
    shortDesc: '원격 변경사항을 가져와 현재 브랜치에 병합합니다',
    longDesc:
      'Pull은 Fetch + Merge를 한 번에 수행합니다. 원격 저장소의 변경사항을 가져와서 현재 브랜치에 자동으로 병합합니다.',
    usage: [
      '팀원의 최신 작업을 내 로컬에 반영할 때',
      '작업 시작 전 최신 코드로 동기화할 때',
    ],
    tips: [
      '충돌이 발생하면 수동으로 해결 후 커밋해야 합니다',
      '작업 중인 변경사항이 있으면 Stash 후 Pull 하세요',
    ],
  },
  {
    id: 'push',
    label: 'Push',
    icon: Upload,
    shortDesc: '로컬 커밋을 원격 저장소에 업로드합니다',
    longDesc:
      'Push는 로컬에서 만든 커밋을 원격 저장소(origin)에 업로드합니다. 다른 사람들이 내 작업을 볼 수 있게 됩니다.',
    usage: [
      '완료된 작업을 팀과 공유할 때',
      'PR(Pull Request)을 생성하기 전에',
    ],
    tips: [
      '항상 Push 전에 테스트를 실행하세요',
      '민감한 정보가 포함되지 않았는지 확인하세요',
    ],
  },
  {
    id: 'stash',
    label: 'Stash',
    icon: Archive,
    shortDesc: '현재 변경사항을 임시 저장합니다',
    longDesc:
      'Stash는 아직 커밋하지 않은 변경사항을 임시로 저장합니다. 급하게 다른 브랜치로 전환해야 할 때 유용합니다.',
    usage: [
      '작업 중 급하게 다른 브랜치로 전환해야 할 때',
      'Pull 전에 충돌을 피하기 위해',
    ],
    tips: [
      '여러 개의 stash를 쌓아둘 수 있습니다',
      'git stash -m "메시지"로 설명을 추가하세요',
    ],
  },
  {
    id: 'stash_pop',
    label: 'Stash Pop',
    icon: ArchiveRestore,
    shortDesc: '저장한 변경사항을 복원합니다',
    longDesc:
      'Stash Pop은 가장 최근에 저장한 stash를 복원하고 stash 목록에서 제거합니다.',
    usage: [
      'Stash로 저장해둔 작업을 다시 이어서 할 때',
      '브랜치 전환 후 원래 작업을 복원할 때',
    ],
    tips: [
      '충돌 발생 시 stash는 삭제되지 않습니다',
      'git stash apply는 stash를 유지하면서 복원합니다',
    ],
  },
]

interface GitActionButtonProps {
  actionId: string
  onClick: () => void
  loading: boolean
  disabled: boolean
  variant?: 'outline' | 'ghost'
}

export function GitActionButton({
  actionId,
  onClick,
  loading,
  disabled,
  variant = 'outline',
}: GitActionButtonProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const action = GIT_ACTIONS.find((a) => a.id === actionId)

  if (!action) return null

  const Icon = action.icon

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size="sm"
              onClick={onClick}
              disabled={disabled}
              className="rounded-r-none border-r-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Icon className="w-4 h-4 mr-2" />
              )}
              {action.label}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>{action.shortDesc}</p>
          </TooltipContent>
        </Tooltip>

        <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  variant={variant}
                  size="sm"
                  className="rounded-l-none px-2"
                  disabled={disabled}
                >
                  <HelpCircle className="w-3 h-3" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>자세한 도움말</p>
            </TooltipContent>
          </Tooltip>

          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                {action.label}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{action.longDesc}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">언제 사용하나요?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {action.usage.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">팁</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {action.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-yellow-500">*</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
