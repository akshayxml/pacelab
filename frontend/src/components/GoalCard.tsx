
import { ArrowDownRight, Mountain, Target } from "lucide-react";

export default function GoalCard() {
  return (
    <div className="panel goal-panel" id="goal">
      <div className="panel-heading">
        <div>
          <h2>Race goal</h2>
          <p>Your next milestone</p>
        </div>
        <div className="goal-icon">
          <Target size={20} />
        </div>
      </div>

      <div className="goal-kicker">5K PERSONAL TARGET</div>
      <div className="goal-time">Sub-22:00<span>.</span></div>
      <p className="goal-description">
        A little faster, a little stronger, every week.
      </p>

      <div className="goal-progress-label">
        <span>Target pace</span>
        <strong>4:24 /km</strong>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: "78%" }} />
      </div>

      <div className="goal-foot">
        <span><Mountain size={14} /> Keep showing up</span>
        <span>5K</span>
      </div>

      <div className="goal-note">
        <ArrowDownRight size={16} />
        Goal progress is illustrative until real race data is connected.
      </div>
    </div>
  );
}
