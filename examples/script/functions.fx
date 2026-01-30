NextRandom:
  rand random
  ret

NextRandom2To5:
  call NextRandom
  set random, random & 3
  jumpIf random > 1, %_add2
  call NextRandom
  set random, (random & 3) + 2
  goto %_end
%_add2:
  set random, random + 2
%_end:
  ret
