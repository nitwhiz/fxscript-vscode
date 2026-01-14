_beforeTurn:
  goto _cancelTurn
  # check sleep
  jumpIfNotFlag attackerStatus monsterStatus1Sleep _tickSleepEnd
  jumpIf attackerStatus1Turns 0 _tickSleepWakeUp
  print "{attackerSide}'s {attacker} is asleep!"
  add attackerStatus1Turns -1
  goto _cancelTurn
_tickSleepWakeUp:
  print "{attackerSide}'s {attacker} woke up!"
_tickSleepEnd:
  # check flinching
  jumpIfNotFlag attackerStatus monsterStatus2Flinching _tickFlinchingEnd
  print "{attackerSide}'s {attacker} flinched!"
  clearFlag targetStatus monsterStatus2Flinching
  goto _cancelTurn
_tickFlinchingEnd:
  # check confusion hit
  jumpIfNotFlag attackerStatus monsterStatus2Confusion _tickConfusionEnd
  jumpIf attackerConfusionTurns 0 _tickConfusionStopped
  print "{attackerSide}'s {attacker} is confused!"
  add attackerConfusionTurns -1
  randJump 50 _confusionHit
  goto _tickConfusionEnd
_confusionHit:
  setTarget attacker
  print msgConfusionHit
  damageCalc 40
  hpUpdate
  goto _cancelTurn
_tickConfusionStopped:
  print "{attackerSide}'s {attacker} is no longer confused!"
_tickConfusionEnd:
  # check disable
  jumpIf attackerDisabledMoveTurns 0 _tickDisabledStopped
  add attackerDisabledMoveTurns -1
  goto _tickDisabledEnd
_tickDisabledStopped:
  print "{attackerSide}'s {attacker} is no longer disabled!"
_tickDisabledEnd:
  # check wrapped hit
  jumpIf attackerWrappedTurns 0 _tickWrappedStopped
  add attackerWrappedTurns -1
  setTarget attacker
  damageSet damageTypeHp16
  hpUpdate
  setTarget defender
  canceler _cancelTurn
  goto _tickWrappedEnd
_tickWrappedStopped:
  print "{attackerSide}'s {attacker} is no longer wrapped!"
_tickWrappedEnd:
  # check semi-invulnerable target
  jumpIfNotFlag targetFlags semiInvulnerable _checkSemiInvulnerableEnd
  print "It missed."
  setFlag moveResult turnCanceled
_checkSemiInvulnerableEnd:
  ret
_cancelTurn:
  setFlag moveResult turnCanceled
  ret

_printUseMove:
  print "{attackerSide}'s {attacker} uses {currentMove}."
  ret

_printCriticalHit:
  print "Critical hit!"
  ret

_printVeryEffective:
  print "It's very effective!"
  ret

_printNotVeryEffective:
  print "It's not very effective!"
  ret

_printOhKo:
  print "OH-KO!"
  ret

_printRecoil:
  print "{sourceSide}'s {source} hurt itself!"
  ret

_printFailed:
  print "It failed."
  ret

_printMissed:
  print "It missed."
  ret
