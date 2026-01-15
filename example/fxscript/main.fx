@include messages.fx
@include functions.fx
@include macros.fx
@include moves.fx
@include effects.fx

_notImplemented:
  print msgMoveNotImplemented
  goto end

# todo: these "is no longer ..." are printed every turn

_beforeTurn:
  # check sleep
  jumpIfNotFlag attackerStatus + 1, monsterStatus1Sleep, _tickSleepEnd
  jumpIf attackerStatus1Turns 0 _tickSleepWakeUp
  print "{attackerSide}'s {attacker} is asleep!"
  add attackerStatus1Turns, -1
  goto _cancelTurn
_tickSleepWakeUp:
  print "{attackerSide}'s {attacker} woke up!"
_tickSleepEnd:
  # check flinching
  jumpIfNotFlag attackerStatus, monsterStatus2Flinching, _tickFlinchingEnd
  print "{attackerSide}'s {attacker} flinched!"
  clearFlag targetStatus monsterStatus2Flinching
  goto _cancelTurn
_tickFlinchingEnd:
  # check confusion hit
  jumpIfNotFlag attackerStatus monsterStatus2Confusion _tickConfusionEnd
  jumpIf attackerConfusionTurns 0 _tickConfusionStopped
  print "{attackerSide}'s {attacker} is confused!"
  add attackerConfusionTurns, -1
  randJump _confusionHit 50
  goto _tickConfusionEnd
_confusionHit:
  setTarget attacker
  print msgConfusionHit
  damageCalc
  hpUpdate
  goto _cancelTurn
_tickConfusionStopped:
  print "{attackerSide}'s {attacker} is no longer confused!"
_tickConfusionEnd:
  # check disable
  jumpIf attackerDisabledMoveTurns 0 _tickDisabledStopped
  add attackerDisabledMoveTurns, -1
  goto _tickDisabledEnd
_tickDisabledStopped:
  print "{attackerSide}'s {attacker} is no longer disabled!"
_tickDisabledEnd:
  # check wrapped hit
  jumpIf attackerWrappedTurns 0 _tickWrappedStopped
  add attackerWrappedTurns, -1
  setTarget attacker
  damageSet damageTypeHp16
  hpUpdate
  setTarget defender
  canceler
  goto _tickWrappedEnd
_tickWrappedStopped:
  print "{attackerSide}'s {attacker} is no longer wrapped!"
_tickWrappedEnd:
  # check semi-invulnerable target
  jumpIfMove "swift" _checkSemiInvulnerableEnd
  jumpIfMove "earthquake" _checkSemiInvulnerableEnd
  jumpIfNotFlag targetFlags semiInvulnerable _checkSemiInvulnerableEnd
  print "It missed!"
  setFlag moveResult turnCanceled
_checkSemiInvulnerableEnd:
  ret
_cancelTurn:
  setFlag moveResult turnCanceled
  ret

end:
  moveEnd
  set dontPrintFailed 0
  clearFlag moveResult moveMissed
  clearFlag moveResult turnCanceled
  set secondaryEffect 0
  set secondaryEffectChance 0
  clearFlag targetFlags disableLastMove
