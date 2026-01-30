macro SetFlag $v, $f
  set $v, $v | ($f)
endmacro

macro ClearFlag $v, $f
  set $v, $v & (^$f)
endmacro

macro Canceler
  jumpIf moveResult & (fTurnCanceled | fSourceFainted | fTargetFainted | fMoveMissed), %_cancel
  goto %_continue
%_cancel:
  goto End
%_continue:
endmacro

macro AccuracyCheck
  accuracyCheck %_miss
  inc A # this does not exist
  goto F # this identifier does not exist
  3 + 5 # this is just incorrect on a line
  goto 5 + 3 + # incomplete expression
  goto %_continue
%_miss:
  SetFlag moveResult, fMoveMissed
%_continue:
endmacro

macro RandMultiHitCounter2To5
  call NextRandom2To5
  set multiHitCounter, random
endmacro
