import { Link } from 'react-router-dom'
import { FREE_PERKS, PREMIUM_PERKS, Paywall } from '../components/Paywall'
import { useAuth, usePremium } from '../lib/auth'
import { CheckIcon } from '../components/Icons'
import pricing from '../../server/pricing.json'
import { useEffect, useState } from 'react'
import { loadMyReferral, type MyReferral } from '../lib/billing'

/** /upgrade — plans, prices and what Premium includes. */
export default function Upgrade() {
  const { user } = useAuth()
  const { premium } = usePremium()

  return (
    <div className="page upgrade-page">
      {premium && user && (
        <div className="notice">
          <b>You're on Premium.</b>
          <p>
            {user.admin ? 'Admins always have full access.' : user.premiumUntil ? `Your access runs until ${new Date(user.premiumUntil).toLocaleDateString()}.` : 'Full access is on.'}{' '}
            <Link to="/practice">Go practise</Link> or <Link to="/guide">open the guide</Link>.
          </p>
        </div>
      )}

      <div className="compare">
        <div className="compare-col">
          <h3>Free</h3>
          <div className="compare-price">₹0 / $0</div>
          <ul>
            {FREE_PERKS.map((p) => <li key={p}><CheckIcon width={18} height={18} /> {p}</li>)}
          </ul>
          <Link className="btn-secondary" to="/practice">Do today's 5</Link>
        </div>
        <div className="compare-col premium">
          <h3>Premium</h3>
          <div className="compare-price">From ₹{pricing.plans.monthly.INR.price} / ${pricing.plans.monthly.USD.price} a month</div>
          <ul>
            {PREMIUM_PERKS.map((p) => <li key={p}><CheckIcon width={18} height={18} /> {p}</li>)}
          </ul>
        </div>
      </div>

      {user && <ReferralCard />}

      <Paywall title="Unlock the full bank and the guide" reason="One payment, no auto-renew surprises: when the period ends you simply decide whether to come back." />

      <section className="home-section faq">
        <h2>Questions</h2>
        <dl>
          <div><dt>Why only five free questions a day?</dt><dd>Everyone gets the same five, chosen fresh each day, so you can try the site properly. The full bank and the guide are what we charge for.</dd></div>
          <div><dt>Does it renew automatically?</dt><dd>No. You pay once for a month or a year. When it ends, the site goes back to the free five until you buy again.</dd></div>
          <div><dt>Which payment methods work?</dt><dd>In India: UPI, cards, net banking and wallets through Razorpay. Elsewhere: cards and PayPal through Paddle, billed in dollars.</dd></div>
          <div><dt>How do referral codes work?</dt><dd>Every account has a code. A friend who uses yours on their first purchase gets {pricing.referral.discountPercent}% off, and you get {pricing.referral.rewardDays} days of Premium free once they’ve paid.</dd></div>
          <div><dt>Is the discount permanent?</dt><dd>The launch price is what you pay for the whole period you buy. Prices shown with a line through them are the regular prices.</dd></div>
        </dl>
      </section>
    </div>
  )
}

/** The signed-in user's own code, a share link and how many friends have used it. */
function ReferralCard() {
  const [ref, setRef] = useState<MyReferral | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  useEffect(() => {
    loadMyReferral().then(setRef).catch((e) => setError(e.message))
  }, [])
  if (error) return null
  const link = ref ? `${window.location.origin}/#/upgrade?ref=${ref.code}` : ''
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      /* clipboard blocked — the text is still selectable */
    }
  }
  return (
    <section className="ref-card">
      <div>
        <span className="pw-eyebrow">Refer a friend</span>
        <h2>Give {ref?.percent ?? pricing.referral.discountPercent}% off, get a free month</h2>
        <p className="muted">
          Friends get {ref?.percent ?? pricing.referral.discountPercent}% off their first purchase with your code. You get {ref?.rewardDays ?? pricing.referral.rewardDays} days of Premium for each friend who pays.
        </p>
      </div>
      {ref ? (
        <div className="ref-share">
          <div className="ref-code">
            <code>{ref.code}</code>
            <button onClick={() => copy(ref.code, 'code')}>{copied === 'code' ? 'Copied ✓' : 'Copy code'}</button>
          </div>
          <div className="ref-code">
            <input readOnly value={link} aria-label="Your share link" onFocus={(e) => e.target.select()} />
            <button onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Copied ✓' : 'Copy link'}</button>
          </div>
          <p className="muted small">
            {ref.referrals ? `${ref.referrals} friend${ref.referrals === 1 ? '' : 's'} joined with your code · ${ref.earnedDays} free days earned` : 'No one has used your code yet.'}
          </p>
        </div>
      ) : (
        <p className="muted small">Loading your code…</p>
      )}
    </section>
  )
}
