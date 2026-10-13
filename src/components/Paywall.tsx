import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { refreshMe, useAuth, usePremium } from '../lib/auth'
import { checkReferral, discounted, forgetCode, loadBilling, money, percentOff, rememberedCode, startCheckout, type Billing, type Currency, type Plan, type Referral } from '../lib/billing'
import { CheckIcon } from './Icons'

/** What a free account gets, and what paying unlocks. Shown on the paywall and the Upgrade page. */
export const FREE_PERKS = ["Today's 5 questions, the same 5 for everyone", 'Instant feedback with the official explanations', 'The tutor, flags, notes and your progress page']
export const PREMIUM_PERKS = [
  'Every question in the College Board bank — 3,700+ across both sections',
  'Filter by domain, skill and difficulty, or run a full timed module',
  'The study guide: how each question type works and a method for every one',
  'Browse and search the whole bank, and come back to your mistakes',
  'Cancel any time — your access runs to the end of the period you paid for',
]

export const WHY_PAY = [
  { t: 'Practice is the whole game', d: 'Scores move with the number of real questions you see. Five a day is a start; the full bank is how you cover every skill before test day.' },
  { t: 'Methods, not just answers', d: 'The guide gives you a repeatable set of steps for each of the question types, built on the order they come in on the real test.' },
  { t: 'Less than one tutoring session', d: 'A year costs less than a single hour with a private tutor, and you can use it every day.' },
]

interface PaywallProps {
  /** Headline for why the wall appeared. */
  title?: string
  /** One line of context under the headline. */
  reason?: string
  /** Tighter layout for use inside a modal. */
  compact?: boolean
  /** Extra actions under the plans (e.g. "Review your answers"). */
  children?: ReactNode
}

/** Plans, prices with the launch discount, and the pay buttons. Needs sign-in to pay. */
export function Paywall({ title = 'Unlock everything with Premium', reason, compact, children }: PaywallProps) {
  const { user, country, configured } = useAuth()
  const location = useLocation()
  const [billing, setBilling] = useState<Billing | null>(null)
  const [loadError, setLoadError] = useState('')
  const [currency, setCurrency] = useState<Currency | null>(null)
  const [busy, setBusy] = useState<Plan | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [referral, setReferral] = useState<Referral | null>(null)

  useEffect(() => {
    loadBilling().then(setBilling).catch((e) => setLoadError(e.message))
  }, [])

  const cur: Currency = currency ?? (billing?.currency ?? (country === 'IN' ? 'INR' : 'USD'))
  const here = location.pathname + location.search
  const signInLink = `/signin?next=${encodeURIComponent(here === '/signin' ? '/upgrade' : here)}`
  const available = billing ? (cur === 'INR' ? billing.razorpay : billing.paddle) : false
  // Referral discounts apply to ₹ payments, and to $ payments once a Paddle discount is set up.
  const refApplies = Boolean(referral && billing && (cur === 'INR' || billing.paddleReferralDiscount))

  async function pay(plan: Plan) {
    if (!billing || !user) return
    setBusy(plan)
    setMessage(null)
    try {
      await startCheckout(plan, cur, billing, user, refApplies ? referral : null)
      // Razorpay is confirmed server-side before this resolves; Paddle's webhook may take a moment.
      let tries = 0
      while (tries++ < 10) {
        await refreshMe()
        if (user.premium) break
        const fresh = await fetch(`${import.meta.env.BASE_URL}api/me`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
        if (fresh?.user?.premium) break
        await new Promise((r) => setTimeout(r, 1500))
      }
      await refreshMe()
      if (refApplies) forgetCode()
      setMessage({ kind: 'ok', text: "Payment received — you're on Premium. Thank you!" })
    } catch (e) {
      setMessage({ kind: 'bad', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`paywall ${compact ? 'compact' : ''}`}>
      <div className="pw-head">
        <span className="pw-eyebrow">Premium</span>
        <h2>{title}</h2>
        {reason && <p className="pw-reason">{reason}</p>}
      </div>

      {!compact && (
        <ul className="pw-why">
          {WHY_PAY.map((w) => (
            <li key={w.t}>
              <b>{w.t}</b>
              <span>{w.d}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className="pw-perks">
        {PREMIUM_PERKS.map((p) => (
          <li key={p}><CheckIcon width={18} height={18} /> {p}</li>
        ))}
      </ul>

      <div className="pw-currency" role="group" aria-label="Currency">
        <span className="muted small">Pay in</span>
        <div className="seg">
          <button type="button" className={cur === 'INR' ? 'active' : ''} onClick={() => setCurrency('INR')}>₹ INR <small>UPI, cards</small></button>
          <button type="button" className={cur === 'USD' ? 'active' : ''} onClick={() => setCurrency('USD')}>$ USD <small>cards, PayPal</small></button>
        </div>
      </div>

      {loadError && <p className="error">{loadError}</p>}
      {billing && (
        <div className="plans">
          {(['monthly', 'yearly'] as Plan[]).map((plan) => {
            const base = billing.pricing.plans[plan][cur]
            const p = refApplies && referral ? { list: base.list, price: discounted(base.price, referral.percent, cur) } : base
            const off = percentOff(p.list, p.price)
            const perMonth = cur === 'INR' ? Math.round(p.price / 12) : Math.round((p.price / 12) * 100) / 100
            return (
              <div key={plan} className={`plan ${plan === 'yearly' ? 'best' : ''}`}>
                {plan === 'yearly' && <span className="plan-flag">Best value</span>}
                <div className="plan-name">{plan === 'monthly' ? '1 month' : '1 year'}</div>
                <div className="plan-price">
                  <s className="plan-list" aria-label={`Usual price ${money(p.list, cur)}`}>{money(p.list, cur)}</s>
                  <span className="plan-now">{money(p.price, cur)}</span>
                  <span className="plan-off">{off}% off</span>
                </div>
                <div className="muted small">
                  {refApplies && referral ? `${billing.pricing.launchDiscount} + ${referral.percent}% referral` : billing.pricing.launchDiscount} · {plan === 'yearly' ? `about ${money(perMonth, cur)} a month` : `${billing.pricing.plans.monthly.days} days of access`}
                </div>
                {user ? (
                  <button className="primary" disabled={!available || busy !== null} onClick={() => pay(plan)}>
                    {busy === plan ? 'Opening payment…' : `Get ${plan === 'monthly' ? 'a month' : 'a year'}`}
                  </button>
                ) : (
                  <Link className="btn-primary" to={configured ? signInLink : '/upgrade'}>Sign in to continue</Link>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!billing && !loadError && <p className="muted small">Loading prices…</p>}
      {billing && <ReferralBox referral={referral} setReferral={setReferral} percent={billing.pricing.referral.discountPercent} usdNote={cur === 'USD' && !billing.paddleReferralDiscount} />}

      {billing && !available && (
        <p className="pw-note">
          Payments in {cur === 'INR' ? 'rupees' : 'dollars'} are being set up. Try the other currency, or check back shortly.
        </p>
      )}
      {!user && configured && <p className="pw-note">You'll need an account so Premium follows you across devices. Signing in takes a few seconds.</p>}
      {message && <p className={`pw-message ${message.kind === 'ok' ? 'is-ok' : 'is-bad'}`}>{message.text}</p>}

      {children && <div className="pw-actions">{children}</div>}
      <p className="muted small pw-fine">
        Prices include the launch discount. Secure checkout by Razorpay (India) and Paddle (everywhere else); we never see your card details.
      </p>
    </div>
  )
}

/** "Have a referral code?" — checks the code and shows the discount on the plans above. */
function ReferralBox({ referral, setReferral, percent, usdNote }: { referral: Referral | null; setReferral: (r: Referral | null) => void; percent: number; usdNote: boolean }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function apply(value: string, quiet = false) {
    const v = value.trim()
    if (!v) return
    setBusy(true)
    setError('')
    try {
      setReferral(await checkReferral(v))
      setOpen(false)
    } catch (e) {
      if (quiet) forgetCode()
      else setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // A code from a share link is filled in and applied automatically.
  useEffect(() => {
    const saved = rememberedCode()
    if (saved && !referral) {
      setCode(saved)
      apply(saved, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  if (referral)
    return (
      <div className="ref-box applied">
        <span>
          <b>Referral code {referral.code}</b> · {referral.percent}% off your first purchase
          {usdNote && <span className="muted"> (applies to ₹ payments)</span>}
        </span>
        <button className="link" onClick={() => { setReferral(null); forgetCode(); setCode('') }}>Remove</button>
      </div>
    )
  if (!open)
    return (
      <button className="link ref-toggle" onClick={() => setOpen(true)}>
        Have a referral code? Get {percent}% off
      </button>
    )
  return (
    <form className="ref-box" onSubmit={(e) => { e.preventDefault(); apply(code) }}>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Referral code" aria-label="Referral code" autoFocus maxLength={16} />
      <button type="submit" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Apply'}</button>
      <button type="button" className="link" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

/**
 * Gate for whole pages (Browse, Guide, full Practice). Shows the paywall in place of the page for
 * free users, with a sentence on why this part is paid.
 */
export function RequirePremium({ reason, children }: { reason: string; children: ReactNode }) {
  const { loading, premium } = usePremium()
  if (loading) return <div className="page"><p className="muted">One moment…</p></div>
  if (!premium)
    return (
      <div className="page">
        <Paywall title="This part is for Premium members" reason={reason}>
          <Link className="btn-secondary" to="/practice">Do today's 5 free questions instead</Link>
        </Paywall>
      </div>
    )
  return <>{children}</>
}

/** Full-screen version shown over the question screen when the fifth free answer goes in. */
export function PaywallModal({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="pw-overlay" role="dialog" aria-modal="true" aria-label="Upgrade to Premium">
      <div className="pw-dialog">
        <button className="pw-close" onClick={onClose} aria-label="Close">×</button>
        <Paywall compact title="That's your 5 free questions for today" reason="You can still review these five and retry them. New questions arrive tomorrow — or unlock the whole bank now.">
          {children}
        </Paywall>
      </div>
    </div>
  )
}
