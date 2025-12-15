_pound:
  goto effectHit

_karate-chop:
  goto effectHit

_double-slap:
  randMultiHitCounter2To5
  goto effectMultiHit

_comet-punch:
  randMultiHitCounter2To5
  goto effectMultiHit

_mega-punch:
  goto effectHit

_pay-day:
  goto effectHit

_fire-punch:
  setSecondaryEffect inflictBurn 10
  goto effectHit

_ice-punch:
  setSecondaryEffect inflictFreeze 10
  goto effectHit

_thunder-punch:
  setSecondaryEffect inflictParalysis 10
  goto effectHit

_scratch:
  goto effectHit

_vice-grip:
  goto effectHit

_guillotine:
  goto effectOhKo

_razor-wind:
  goto effectRazorWind

_swords-dance:
  canceler
  setTarget attacker
  call incAttack2
  goto end

_cut:
  goto effectHit

_gust:
  goto effectHit

_wing-attack:
  goto effectHit

_whirlwind:
  # we're always in a trainer battle
  print msgNothingHappens
  goto end

_fly:
  goto effectSemiInvulnerableTurn

_bind:
  # todo: implement me
  goto _notImplemented

_slam:
  goto effectHit

_vine-whip:
  goto effectHit

_stomp:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

_double-kick:
  set multiHitCounter 2
  goto effectMultiHit

_mega-kick:
  goto effectHit

_jump-kick:
  goto effectRecoilOnMiss

_rolling-kick:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

_sand-attack:
  canceler
  accuracyCheck
  setTarget defender
  call decAccuracy1
  goto end

_headbutt:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

_horn-attack:
  goto effectHit

_fury-attack:
  randMultiHitCounter2To5
  goto effectMultiHit

_horn-drill:
  goto effectOhKo

_tackle:
  goto effectHit

_body-slam:
  setSecondaryEffect inflictParalysis 30
  goto effectHit

_wrap:
  canceler
  accuracyCheck
  call inflictWrapped
  goto end

_take-down:
  goto effectRecoil25

_thrash:
  # todo: implement me
  goto _notImplemented

_double-edge:
  goto effectRecoil25

_tail-whip:
  canceler
  accuracyCheck
  call decDefense1
  goto end

_poison-sting:
  setSecondaryEffect inflictPoison 20
  goto effectHit

_twineedle:
  set multiHitCounter 2
  setSecondaryEffect inflictPoison 20
  goto effectMultiHit

_pin-missile:
  randMultiHitCounter2To5
  goto effectMultiHit

_leer:
  canceler
  accuracyCheck
  call decDefense1
  goto end

_bite:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

_growl:
  canceler
  accuracyCheck
  call decAttack1
  goto end

_roar:
  canceler
  accuracyCheck
  setFlag moveResult mustSwitchToRandom
  goto end

_sing:
  canceler
  accuracyCheck
  call inflictSleep
  goto end

_supersonic:
  canceler
  accuracyCheck
  setSecondaryEffect inflictConfusion 100
  goto end

_sonic-boom:
  canceler
  accuracyCheck
  goto effectHit

_disable:
  canceler
  accuracyCheck
  jumpIfFlag targetFlags hasDisabledMove disableEffectFailed
  setFlag targetFlags disableLastMove
  goto disableEffectEnd
disableEffectFailed:
  call _printFailed
disableEffectEnd:
  goto end

_acid:
  canceler
  setSecondaryEffect decDefense1 100
  goto effectHit

# todo: this move comes later in the list
_splash:
  canceler
  accuracyCheck
  print msgNothingHappens
  goto end
