import { useParams } from 'react-router'
import { Card } from '@/components/ui'
import { JoinForm } from './OnboardingPage'

/** /join/:code — reached from a shared link; RequireAuth sends the user via login first. */
export function JoinPage() {
  const { code = '' } = useParams()
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="bg-brand-gradient relative overflow-hidden rounded-[2rem] p-6 text-white shadow-float">
        <div
          className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <div className="relative">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Join a home</h1>
          <p className="mt-1.5 text-white/85">
            You’ve been invited to a home on KeyFinder. Add your name and join.
          </p>
        </div>
      </div>
      <Card>
        <JoinForm initialCode={code} />
      </Card>
    </div>
  )
}
