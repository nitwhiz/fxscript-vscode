macro randMultiHitCounter2To5
  set multiHitCounter -1
endmacro

# canceler is to be called explicitly as there may be attacks
# ignoring a fainted source or target
macro canceler
  jumpIfFlag moveResult turnCanceled end
  jumpIfFlag moveResult sourceFainted end
  jumpIfFlag moveResult targetFainted end
  jumpIfFlag moveResult moveMissed end
endmacro

macro moveHit
  canceler
  accuracyCheck
  damageCalc
  typeCalc
  critCalc
  hpUpdate
endmacro
