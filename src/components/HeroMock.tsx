/**
 * A miniature Bluebook-style question screen for the landing page that plays a short CSS loop:
 * a cursor picks B, taps Check, the choice turns green with the explanation. No real question.
 * Under prefers-reduced-motion it shows the finished state.
 */
export function HeroMock() {
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock-top">
        <span className="mock-title">Section 1, Module 1: Reading and Writing</span>
        <span className="mock-clock">27:14 <i>Hide</i></span>
      </div>
      <div className="mock-rule"><span>THIS IS A PRACTICE TEST</span></div>
      <div className="mock-body">
        <div className="mock-passage">
          <span className="ln w90" /><span className="ln w100" /><span className="ln w80" /><span className="ln w95" /><span className="ln w60" />
        </div>
        <div className="mock-q">
          <div className="mock-qhead"><b>4</b> <span>Mark for Review</span><em>ABC</em></div>
          <span className="ln w85 dark" /><span className="ln w55 dark" />
          <div className="mock-choices">
            <span className="mc"><i>A</i><span className="ln w60" /></span>
            <span className="mc b"><i>B</i><span className="ln w70" /></span>
            <span className="mc"><i>C</i><span className="ln w50" /></span>
            <span className="mc"><i>D</i><span className="ln w65" /></span>
          </div>
          <div className="mock-slot">
            <span className="mock-check">Check answer</span>
            <div className="mock-explain">
              <b>✓ Correct</b>
              <span className="ln w95" /><span className="ln w80" />
            </div>
          </div>
        </div>
      </div>
      <svg className="mock-cursor" viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6 1.5L16.5 20l-2.6 1.2-3.6-7.5L5 17z" fill="#fff" stroke="#1e1e1e" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      <div className="mock-bottom">
        <span className="mock-nav">Question 4 of 27 ▴</span>
        <span className="mock-btns"><i>Back</i><i className="next">Next</i></span>
      </div>
      <div className="mock-toast">✓ Correct · 0:48</div>
    </div>
  )
}
