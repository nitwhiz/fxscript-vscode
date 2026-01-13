expression_test:
  print (33 - multiHitCounter + 22.0) * (14 / 5)
  ret

printStatUp1:
  print "{targetSide}'s {target}'s {affectedStat} rose!"
  ret

printStatUp2:
  print "{targetSide}'s {target}'s {affectedStat} sharply rose!"
  ret

printStatDown1:
  print "{targetSide}'s {target}'s {affectedStat} fell!"
  ret

printStatDown2:
  print "{targetSide}'s {target}'s {affectedStat} sharply fell!"
  ret

decAttack1:
  stat statAttack -1
  call printStatDown1
  ret

decAttack2:
  stat statAttack -2
  call printStatDown2
  ret

incAttack1:
  stat statAttack +1
  call printStatUp1
  ret

incAttack2:
  stat statAttack +1
  call printStatUp2
  ret

decDefense1:
  stat statDefense -1
  call printStatDown1
  ret

decDefense2:
  stat statDefense -2
  call printStatDown2
  ret

decAccuracy1:
  stat statAccuracy -1
  call printStatDown1

# todo: inflictWrap?

inflictBurn:
  ailment ailmentBurn
  print "{targetSide}'s {target} is burned!"
  ret

inflictPoison:
  ailment ailmentPoison
  print "{targetSide}'s {target} is poisoned!"
  ret

inflictParalysis:
  ailment ailmentParalysis
  print "{targetSide}'s {target} is paralyzed!"
  ret

inflictSleep:
  ailment ailmentSleep
  print "{targetSide}'s {target} is asleep!"
  ret

inflictFreeze:
  ailment ailmentFreeze
  print "{targetSide}'s {target} is frozen solid!"
  ret

inflictFlinching:
  ailment ailmentFlinching
  ret

inflictConfusion:
  ailment ailmentConfusion
  print "{targetSide}'s {target} is confused!"
  ret

inflictWrapped:
  ailment ailmentWrapped
  print "{targetSide}'s {target} is wrapped!"
  ret
