macro randMultiHitCounter2To5
  set multiHitCounter -1
endmacro

macro moveHit
  canceler
  accuracyCheck
  damageCalc
  typeCalc
  critCalc
  hpUpdate
endmacro
