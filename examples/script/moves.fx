# Deals damage with 100% accuracy
_pound:
  goto EffectHit

# Deals damage and has an increased critical-hit ratio
_karate-chop:
  goto EffectHit

# Deals damage with 2-5 hits per use; the first hit can be a critical hit and all subsequent hits deal equal damage
# Ends early if it breaks a substitute (Generation I only)
# Bide and Counter only acknowledge the final strike
_double-slap:
  goto EffectMultiHit
