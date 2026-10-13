import { useEffect, useState } from 'react'
import { refreshMe, signOut } from '../lib/auth'
import { loadMyReferral, type MyReferral } from '../lib/billing'

/**
 * Shown instead of the whole site for an account an admin has flagged. It clears itself the
 * moment someone signs up through this account's referral link (checked every 20 seconds).
 */
export function PrankScreen() {
  const [ref, setRef] = useState<MyReferral | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadMyReferral().then(setRef).catch(() => {})
    const t = setInterval(() => refreshMe(), 20000)
    return () => clearInterval(t)
  }, [])

  const link = ref ? `${window.location.origin}/#/upgrade?ref=${ref.code}` : ''
  return (
    <div className="prank">
      <h1>YOU ARE AN IDIOT</h1>
      <p>This page will stop showing this when you get your first sign-up through your referral.</p>
      {ref && (
        <div className="prank-share">
          <span>Your link</span>
          <code>{link}</code>
          <button
            onClick={() =>
              navigator.clipboard?.writeText(link).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
      )}
      <button className="link prank-out" onClick={signOut}>Sign out</button>
    </div>
  )
}
