@include variables.fx
@include macros.fx
@include functions.fx
@include effects.fx
@include moves.fx

goto End

BeforeTurn:
  ClearFlag moveResult, fTurnCanceled | fMoveMissed
  goto End

End:
  # end
