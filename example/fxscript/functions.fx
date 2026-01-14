printStatUp1:
  print "{targetSide}'s {target}'s {affectedStat} rose!"
  ret

printStatUp2:
  print "{targetSide}'s {target}'s {affectedStat} sharply rose!"
  ret

printStatDown1:
  # todo: why does this know `affectedStat`?
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

incSpeed1:
  stat statSpeed +1
  call printStatUp1
  ret

incAttack2:
  stat statAttack +1
  call printStatUp1
  ret

incDefense2:
  stat statDefense +2
  call printStatUp2
  ret

incSpecialAttack1:
  stat statSpecialAttack +1
  call printStatUp1
  ret

incSpecialDefense2:
  stat statSpecialDefense +2
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
  ret

decSpeed1:
  stat statSpeed -1
  call printStatDown1
  ret

decSpeed2:
  stat statSpeed -2
  call printStatDown2
  ret

decSpecialDefense1:
  stat statSpecialDefense -1
  call printStatDown1
  ret

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
