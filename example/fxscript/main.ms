@include messages.ms
@include functions.ms
@include engine_functions.ms
@include macros.ms
@include moves.ms

goto end

@include effects.ms

_notImplemented:
  print msgMoveNotImplemented
  goto end

end:
  moveEnd
  set dontPrintFailed 0
  clearFlag moveResult moveMissed
  clearFlag moveResult turnCanceled
  set secondaryEffect 0
  set secondaryEffectChance 0
  clearFlag targetFlags disableLastMove
