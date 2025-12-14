effectHit:
  moveHit
  canceler
  secondaryEffect
  goto end

effectRazorWind:
  jumpIfFlag sourceFlags secondTurn razorWindTurn2
  canceler
  print msgRazorWindTurn1
  setFlag sourceFlags secondTurn
  setFlag sourceFlags moveLocked
  goto end
razorWindTurn2:
  clearFlag sourceFlags secondTurn
  clearFlag sourceFlags moveLocked
  moveHit
  goto end

effectMultiHit:
  canceler
  accuracyCheck
  copy multiHitCounter multiHitSuccessCounter
multiHitLoop:
  canceler
  damageCalc
  typeCalc
  critCalc
  hpUpdate
  add multiHitCounter -1
  jumpIf multiHitCounter 0 endMultiHit
  goto multiHitLoop
endMultiHit:
  print msgMultiHitCount multiHitSuccessCounter
  set multiHitSuccessCounter 0
  goto end

effectOhKo:
  canceler
  accuracyCheck
  ohKo
  goto end

effectRecoilOnMiss:
  canceler
  accuracyCheck missedRecoil
  damageCalc
  typeCalc
  critCalc
  hpUpdate
missedRecoil:
  recoil recoilTypeMiss
  goto end

effectRecoil25:
  canceler
  accuracyCheck
  damageCalc
  typeCalc
  critCalc
  hpUpdate
  recoil recoilType25
  goto end

effectSemiInvulnerableTurn:
  jumpIfFlag sourceFlags secondTurn semiInvulnerableTurn2
  canceler
  jumpIfMove "dig" semiInvulnerableTurn1Dig
  print msgFlyTurn1
  goto semiInvulnerableTurn1
semiInvulnerableTurn1Dig:
  print msgDigTurn1
semiInvulnerableTurn1:
  setFlag sourceFlags semiInvulnerable
  setFlag sourceFlags secondTurn
  setFlag sourceFlags moveLocked
  goto end
semiInvulnerableTurn2:
  clearFlag sourceFlags semiInvulnerable
  clearFlag sourceFlags secondTurn
  clearFlag sourceFlags moveLocked
  canceler
  accuracyCheck
  damageCalc
  typeCalc
  critCalc
  hpUpdate
  goto end
