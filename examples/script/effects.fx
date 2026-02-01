# standard move hit effect with accuracy check and canceler
macro MoveHit
  AccuracyCheck
  Canceler
  damageCalc
  typeCalc
  critCalc
  hpUpdate
endmacro

EffectHit:
  MoveHit
  goto End

EffectMultiHit:
  AccuracyCheck
  Canceler
  damageCalc
  typeCalc
  critCalc
  RandMultiHitCounter2To5
%_loop:
  Canceler
  hpUpdate
  set multiHitCounter, multiHitCounter - 1 
  jumpIf multiHitCounter > 0, %_loop
  goto End
