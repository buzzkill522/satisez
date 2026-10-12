/**
 * A miniature Bluebook-style question screen for the landing page: pure markup and CSS,
 * no real question (the copy is original), so visitors see the product before scrolling.
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
            <span className="mc on"><i>B</i><span className="ln w70" /></span>
            <span className="mc"><i>C</i><span className="ln w50" /></span>
            <span className="mc"><i>D</i><span className="ln w65" /></span>
          </div>
        </div>
      </div>
      <div className="mock-bottom">
        <span className="mock-nav">Question 4 of 27 ▴</span>
        <span className="mock-btns"><i>Back</i><i className="next">Next</i></span>
      </div>
      <div className="mock-toast">✓ Correct · 0:48</div>
    </div>
  )
}
