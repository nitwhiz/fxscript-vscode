@include messages.fx
@include functions.fx
@include engine_functions.fx
@include macros.fx
@include moves.fx

goto end

@include effects.fx

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
