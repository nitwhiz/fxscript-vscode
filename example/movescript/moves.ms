# Deals damage with 100% accuracy
_pound:
  goto effectHit

# Deals damage and has an increased critical-hit ratio
_karate-chop:
  goto effectHit

# Deals damage with 2-5 hits per use; the first hit can be a critical hit and all subsequent hits deal equal damage
# Ends early if it breaks a substitute (Generation I only)
# Bide and Counter only acknowledge the final strike
_double-slap:
  randMultiHitCounter2To5
  goto effectMultiHit

# Deals damage
# Hits 2-5 times per use (37.5% chance for 2 or 3 hits, 12.5% chance for 4 or 5 hits)
# Each strike deals equal damage and can critically hit only on the first strike
# Ends instantly if it breaks a substitute
_comet-punch:
  randMultiHitCounter2To5
  goto effectMultiHit

# Deals damage
_mega-punch:
  goto effectHit

# Deals damage and may scatter coins equal to twice the user's level (up to 200) when it hits a substitute; no coin scattering occurs if the substitute is broken
# In Generation II, coin scattering happens even when the move breaks a substitute
_pay-day:
  goto effectHit

# Deals damage
# 10% chance to burn the target
_fire-punch:
  setSecondaryEffect inflictBurn 10
  goto effectHit

# Deals damage and has a 10% chance of freezing the target
_ice-punch:
  setSecondaryEffect inflictFreeze 10
  goto effectHit

# Deals damage
# 10% chance to paralyze the target; cannot paralyze Electric-type Pokémon
_thunder-punch:
  setSecondaryEffect inflictParalysis 10
  goto effectHit

# Deals damage
_scratch:
  goto effectHit

# Deals damage
# No secondary effect
_vice-grip:
  goto effectHit

# Deals exactly 65535 HP damage if it hits (Generation I)
# Has 30% base accuracy in Generation I
# Breaks a substitute when it hits
# Does not affect a target whose Speed is higher than the user's Speed
# In Generation II, deals damage equal to the target's current HP
# Accuracy in Generation II is calculated by ((Level_user-Level_target)x2+76256)x100%
# If the user is lower level than the target, the move always fails
# If the user is 90 or more levels higher, accuracy becomes 100%
# In Generation III, hit chance is (Level_user-Level_target+30)% and is unaffected by accuracy or evasion
# Cannot hit a semi-invulnerable Pokémon in Generation III
_guillotine:
  goto effectOhKo

# Deals damage on the turn after selection
# Has 75% accuracy in Generation I
# Increases critical hit ratio in Generation II
# Targets all adjacent opponents in Generation III
# Has 100% accuracy in Generation III
_razor-wind:
  goto effectRazorWind

# Increases the user's Attack stat by two stages.
_swords-dance:
  canceler
  setTarget attacker
  call incAttack2
  goto end

# Deals damage (no secondary effect)
_cut:
  goto effectHit

# Deals damage
# Can hit a Pokémon during the semi-invulnerable turns of Fly and Bounce, dealing double damage
_gust:
  goto effectHit

# Deals damage with power 60
# Can hit non-adjacent opponents in Triple Battles
_wing-attack:
  goto effectHit

# Ends a wild battle automatically when successfully used
# Forces the target to switch with a randomly selected Pokémon in Trainer battles
# Has 85% accuracy and normal priority in Generation I; priority drops to -1 in Generation II and -6 in Generation III
# Can hit during the semi-invulnerable turn of Dig (Generation I) and Fly (Generation II)
# May fail if the user's level is lower than the target's, with failure chance calculated as floor(Leveltarget/4)/(Leveltarget+Leveluser+1) in Generation I and approximated as floor(Leveltarget/4)/(Leveltarget+Leveluser) in Generation III
# Fails when used against Pokémon with the Ability Suction Cups or when they are rooted by Ingrain (Generation III)
_whirlwind:
  print msgNothingHappens
  goto end

# Deals damage on the second turn after being selected
# Becomes semi-invulnerable on the first turn, avoiding all attacks except Bide and Swift
# Can be targeted by Gust, Thunder, Twister, and Whirlwind while flying, taking double damage from Gust and Twister
# Can be hit by Sky Uppercut during the semi-invulnerable turn
# Cannot be hit by Swift or Bide while flying
# If the move does not complete, no PP is deducted and it does not count as the last move used
# Prevents switching out until the move fully executes or is disrupted
# Fails if the user becomes fully paralyzed during the semi-invulnerable turn
# Can be caught while in the semi-invulnerable stage
# If the battle ends before the user returns from flying, PP was already deducted on the first turn
_fly:
  goto effectSemiInvulnerableTurn

# Deals damage each turn equal to 1/16 of the target's maximum HP
# The effect lasts for 2-5 turns, with a 37.5% chance for 2 turns, 37.5% for 3 turns, and 12.5% each for 4 and 5 turns
# Traps the target, preventing it from switching out or escaping
# The trapped Pokémon can still attack normally during its turn
# If Bind misses, no damage or trapping effect occurs
_bind:
  goto _notImplemented

# Deals damage and has no secondary effect
_slam:
  goto effectHit

# Deals damage
_vine-whip:
  goto effectHit

# Deals damage and has a 30% chance to cause the target to flinch.
# Cannot make a target with a substitute flinch.
# If Stomp hits a Pokémon that had previously used Minimize, the damage dealt will be doubled.
_stomp:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

# Deals damage on each strike
# Hits twice per use; each hit deals equal damage
# Only the first strike can be a critical hit
# If the first strike breaks a substitute, an additional strike occurs
# The extra strike is also counted for Bide and Counter
_double-kick:
  set multiHitCounter 2
  goto effectMultiHit

# Deals damage
_mega-kick:
  goto effectHit

# Deals damage with a power of 70
# If the move misses, the user receives crash damage equal to half of the damage it would have dealt
# The move always misses when used against a Ghost-type Pokémon
# When the user moves first and faints due to crash damage, the opponent does not perform any further action that turn
_jump-kick:
  goto effectRecoilOnMiss

# Deals damage and has a 30% chance of causing the target to flinch
# Cannot cause a target with a substitute to flinch
_rolling-kick:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

# Reduces the target's accuracy by one stage, with a 25% chance for the move to miss (fail)
_sand-attack:
  canceler
  accuracyCheck
  setTarget defender
  call decAccuracy1
  goto end

# Deals damage
# 30% chance to cause the target to flinch
_headbutt:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

# Deals damage
_horn-attack:
  goto effectHit

# Deals damage with 2-5 hits per use
# 37.5% chance to hit 2 times, 37.5% chance to hit 3 times, 12.5% chance to hit 4 times, and 12.5% chance to hit 5 times
# Only the first strike can be a critical hit in Generation I; each strike deals equal damage
# The move ends immediately if it breaks a substitute in Generation I, and only the final strike is considered by Bide and Counter
# In Generation II all strikes can be critical hits and can continue after breaking a substitute
_fury-attack:
  randMultiHitCounter2To5
  goto effectMultiHit

# Deals damage equal to the target's current HP when it hits
# Hit chance is calculated as (Level_user - Level_target + 30)%
# Starts at 30% accuracy when levels are equal and increases by 1% per level the user is higher
# If the user is at least 70 levels higher, Horn Drill always hits
# If the user is lower level than the target, the move automatically fails
# Accuracy and evasion stats do not affect the hit chance
# Cannot hit a semi-invulnerable Pokémon
# When it hits, it breaks any substitute protecting the target
# Does not bypass type immunities; immune targets are unaffected
# Damage is calculated as the target's current HP (effectively an instant KO)
_horn-drill:
  goto effectOhKo

# Deals damage with no secondary effect
_tackle:
  goto effectHit

# Deals damage and has a 30% chance of paralyzing the target
_body-slam:
  setSecondaryEffect inflictParalysis 30
  goto effectHit

# Deals damage with 85% accuracy
# Hits 2-5 times per use (37.5% chance for 2 hits, 37.5% for 3 hits, 12.5% for 4 hits, 12.5% for 5 hits); each strike deals equal damage and can critically hit only on the first hit
# Continues dealing damage each turn for the selected number of turns; target cannot attack during those turns, including the starting turn if user moves first
# Cannot affect Ghost-type Pokémon (no damage), but still prevents them from attacking while active
# If the user switches out before the duration ends, the target is unable to attack that turn; if the target switches out, the user automatically uses Wrap against the incoming Pokémon and loses additional PP
# While Wrap is ongoing, neither Pokémon can select moves (selecting "Fight" causes continued damage but no other action)
# No message appears on the final turn of Wrap's duration
_wrap:
  canceler
  accuracyCheck
  call inflictWrapped
  goto end

# Deals damage and inflicts recoil equal to ¼ of the damage dealt
# If the user attacks first and faints from recoil, the opponent does not attack or receive recurrent damage that round
# Breaking a substitute prevents recoil damage
# In Stadium, no recoil damage is taken when Take Down knocks out an opponent
_take-down:
  goto effectRecoil25

# Deals damage each turn for 3-4 consecutive turns with a base power of 90
# Automatically hits on each subsequent turn after being selected; the user cannot switch out while Thrash is active
# Accuracy can be modified on each automatic turn and the reduced accuracy reapplies each strike
# If Thrash completes its full duration, the user becomes confused afterward due to fatigue
# If the multi-turn effect is disrupted (e.g., by paralysis, self-inflicted confusion, or other interruptions), it ends early and no confusion is inflicted
# Sleep, freeze, binding, and flinching pause the multi-turn effect but do not reset its duration
_thrash:
  goto _notImplemented

# Deals damage and causes recoil equal to one-third of the damage dealt; user takes recoil even if a substitute is broken; if the user attacks first and faints from recoil, the target does not act or receive recurrent damage that round
_double-edge:
  goto effectRecoil25

# Decreases the Defense stat of all adjacent opponents by one stage
# In Generation I and II, when used by an in-game opponent outside the Battle Tower, the move has a 25% chance to fail
_tail-whip:
  canceler
  accuracyCheck
  call decDefense1
  goto end

# Deals damage
# 30% chance to poison the target
_poison-sting:
  setSecondaryEffect inflictPoison 20
  goto effectHit

# Deals damage with two strikes per use
# The first strike may be a critical hit; the second strike deals equal damage
# 20% chance of poisoning the target on the second strike, unless the target is Poison-type
# Effect stops if the first strike breaks a substitute
# Bide and Counter only register the second strike
_twineedle:
  set multiHitCounter 2
  setSecondaryEffect inflictPoison 20
  goto effectMultiHit

# Deals damage with 85% accuracy, hitting 2-5 times per use (37.5% chance for 2 or 3 hits, 12.5% for 4 or 5 hits)
# Each strike deals equal damage and can be a critical hit
# The move continues attacking after breaking a substitute
# Base power is 14
_pin-missile:
  randMultiHitCounter2To5
  goto effectMultiHit

# Decreases the target's Defense by one stage
# Has a 25% chance to fail when used by an in-game opponent outside the Battle Tower (Generation I-II)
_leer:
  canceler
  accuracyCheck
  call decDefense1
  goto end

# Deals damage and may cause flinching (10%)
_bite:
  setSecondaryEffect inflictFlinching 30
  goto effectHit

# Lowers the Attack stat of all adjacent opposing Pokémon by one stage
# Cannot affect a Pokémon positioned behind a substitute
_growl:
  canceler
  accuracyCheck
  call decAttack1
  goto end

# Does not deal damage
# Priority -6
# 100% accuracy
# Sound-based; fails against Pokémon with Soundproof, Suction Cups, or rooted by Ingrain
# May fail when user's level is lower than target's; failure chance ≈ ⌊Leveltarget/4⌋ / (Leveltarget + Leveluser)
_roar:
  canceler
  accuracyCheck
  setFlag moveResult mustSwitchToRandom
  goto end

# Puts the target to sleep
# In Generation I, can affect a target behind a substitute
# In Generation II, cannot affect a target behind a substitute and has a 25% chance to fail when used by in-game opponents outside the Battle Tower
_sing:
  canceler
  accuracyCheck
  call inflictSleep
  goto end

# Does not deal damage
# Causes confusion in the target
# Fails if the target is already confused or has Own Tempo
# Cannot affect a Pokémon behind a substitute
_supersonic:
  canceler
  accuracyCheck
  setSecondaryEffect inflictConfusion 100
  goto end

# Deals exactly 20 damage if it hits
# No secondary effects
# Not affected by type immunities; can hit Ghost-type Pokémon
_sonic-boom:
  canceler
  accuracyCheck
  goto effectHit

# Does not deal damage
# In Generation I randomly selects a usable target move and disables it, failing if the target has no moves with PP left
# In Generation I the effect lasts 0-7 turns and only counts when the target attempts to use a move; turns spent flinching, asleep, frozen, recharging, or bound are not counted
# In Generation II onward disables the last move the target used, failing if the target has not acted or used Struggle
# Disabled status ends when the Pokémon switches out, faints, or the battle ends
# Attempting to use a disabled move results in a wasted turn and the "disabled!" message
# Disable cannot be transferred via Baton Pass
# If the target levels up and replaces the disabled move in Generation I, the new move becomes disabled instead
_disable:
  canceler
  accuracyCheck
  jumpIfFlag targetFlags hasDisabledMove disableEffectFailed
  setFlag targetFlags disableLastMove
  goto disableEffectEnd
disableEffectFailed:
  print _msgFailed
disableEffectEnd:
  goto end

# Deals damage to all adjacent opponents
_acid:
  canceler
  setSecondaryEffect decDefense1 100
  goto effectHit

# Deals damage and has a 10% chance to burn the target
_ember:
  setSecondaryEffect inflictBurn 10
  goto effectHit

# Deals damage and has a 10% chance to burn the target
_flamethrower:
  goto _notImplemented

# Prevents the user's stats from being lowered by opponents until the user switches out
# Also prevents stat reductions caused by damaging moves
_mist:
  goto _notImplemented

# Deals damage and has no secondary effect
_water-gun:
  goto _notImplemented

# Deals damage using Hydro Pump's base power of 120 and has no secondary effect
_hydro-pump:
  goto _notImplemented

# Deals damage with power 95
# Can hit during the target's semi-invulnerable turn of Dive, dealing double damage
# In Double or Triple Battles, hits all adjacent opposing Pokémon
_surf:
  goto _notImplemented

# Deals damage and has a 10% chance of freezing the target
_ice-beam:
  goto _notImplemented

# Deals damage with 70% accuracy
# 10% chance to freeze the target
# Hits both opponents in a Double Battle
_blizzard:
  goto _notImplemented

# Deals damage
# 10% chance to confuse the target
_psybeam:
  goto _notImplemented

# Deals damage with 100% accuracy
# 10% chance to lower the target's Speed by one stage
_bubble-beam:
  goto _notImplemented

# Deals damage and has an 85/256 (~33.2%) chance of lowering the target's Attack by one stage
# No additional failure chance when used by an in-game opponent
_aurora-beam:
  goto _notImplemented

# Deals damage; after use, the user must recharge on the next turn unless the attack misses, breaks a substitute, knocks out the target, or the user is targeted by a binding move (even if it misses) before the recharge turn.
# If the move misses or the battle ends that turn, no recharge is required.
_hyper-beam:
  goto _notImplemented

# Deals damage and can hit non-adjacent opponents in Triple Battles
_peck:
  goto _notImplemented

# Deals damage and has no secondary effect
# Can hit non-adjacent opponents in Triple Battles
_drill-peck:
  goto _notImplemented

# Deals damage and inflicts recoil equal to 25% of the damage dealt
# If the user moves first and faints from recoil, the target does not attack that round
# Recurrent damage still applies to the user even if the target faints
# No recoil damage is taken when Submission knocks out a target in Stadium
_submission:
  goto _notImplemented

# Deals damage with 100% accuracy
# Power varies depending on the target's weight (heavier targets receive more damage)
# Cannot cause the target to flinch
# Fails when used against a Dynamax or Gigantamax Pokémon
_low-kick:
  goto _notImplemented

# Deals damage; Generation I counters Normal or Fighting-type attacks for double the damage taken and otherwise misses
# Has negative priority (Generation I -1, Generation III -5) so it usually acts after most moves
# In Generation II it counters any physical move for twice the damage dealt to the user; Ghost-type Pokémon are immune
# In Generation III it only hits the last opponent that inflicted physical damage in double battles and cannot affect allies; it fails if no physical damage was received that turn
_counter:
  goto _notImplemented

# Deals damage equal to the user's level
# Cannot usually affect Ghost-type Pokémon
_seismic-toss:
  goto _notImplemented

# Deals damage with no secondary effect
_strength:
  goto _notImplemented

# Deals damage and restores up to 50% of the damage dealt as HP (minimum 1 HP), up to the user's maximum HP
# If the target has a substitute, the move will miss in Japanese Generation I and all Stadium and Generation II games; in localized Generation I games it will break the substitute but restore no HP
# In Generation III, the move properly restores HP even when breaking a substitute
_absorb:
  goto _notImplemented

# Deals damage with 40 base power
# Restores up to 50% of the damage dealt as HP (minimum 1 HP), up to the user's maximum HP; this healing also occurs when a substitute is broken in Generation III
# In Generation I localized versions, if Mega Drain breaks a substitute it fails to restore HP; in Japanese and Stadium/Generation II versions it always misses when targeting a Pokémon with a substitute
_mega-drain:
  goto _notImplemented

# Drains target's HP each turn and restores that amount to user
_leech-seed:
  goto _notImplemented

# Increases the user's Special Attack by one stage.
_growth:
  goto _notImplemented

# Deals damage and has an increased critical-hit ratio
# In double battles it can target all adjacent opposing Pokémon
# Each target's critical-hit chance is evaluated separately
_razor-leaf:
  goto _notImplemented

# Deals damage on the second turn after charging
# Requires one turn to charge unless harsh sunlight is active, allowing immediate use
# Power is halved when used in rain, hail, fog, or sandstorm
# The user cannot switch out while Solar Beam is charging or executing
# If disrupted by flinching, paralysis, or confusion the move fails and does not deal damage
_solar-beam:
  goto _notImplemented

# Poisons the target
# Does not affect Steel-type or Poison-type Pokémon
_poison-powder:
  goto _notImplemented

# Does not deal damage
# Paralyzes the target
# In Generation I, can affect a target behind a substitute
# In Generation II, when used by in-game opponents outside the Battle Tower, has a 25% chance to fail in addition to normal miss chance
_stun-spore:
  goto _notImplemented

# Puts target to sleep
# In Generation I can affect a target behind a substitute
# In Generation II, when used by an in-game opponent outside the Battle Tower, has an additional 25% chance to fail
# Cannot affect targets with Insomnia, Vital Spirit, or Sap Sipper
_sleep-powder:
  goto _notImplemented

# Deals damage with base power 70 over 2-3 consecutive turns
# Hits an adjacent opponent each turn; in battles with multiple opponents the target is chosen at random each use
# After the final turn the user becomes confused
# Can be used in a Contest combination, awarding 4 bonus appeal points if Growth was used in the previous turn
_petal-dance:
  goto _notImplemented

# Lowers the target's Speed by one stage
# 25% chance to fail when used by an opposing Pokémon outside the Battle Tower
# Targets all adjacent opposing Pokémon in double battles
_string-shot:
  goto _notImplemented

# Deals damage, inflicting exactly 40 HP if it hits
# No secondary effects
# Does not bypass type immunity; if the target is immune, the move does nothing
_dragon-rage:
  goto _notImplemented

# Deals damage with 70% accuracy
# May last 2-5 turns, dealing damage each turn
# On each subsequent turn deals damage equal to 1/16 of the target's maximum HP
# Traps the target, preventing it from switching or escaping
# If the user switches out, the trap ends
_fire-spin:
  goto _notImplemented

# Deals damage
# 10% chance to paralyze the target
# Cannot paralyze Electric-type Pokémon
_thunder-shock:
  goto _notImplemented

# Deals damage
# 10% chance to paralyze the target
# Cannot paralyze Electric-type Pokémon
_thunderbolt:
  goto _notImplemented

# No damage dealt
# 100% accuracy
# Paralyzes the target
# Cannot affect Ground-type Pokémon
# In Generation I, can affect a target behind a substitute
# In Generation II, when used by an in-game opponent outside the Battle Tower, has a 25% chance to fail
_thunder-wave:
  goto _notImplemented

# Deals damage and has a 10% chance to paralyze the target; cannot paralyze Electric-type Pokémon
_thunder:
  goto _notImplemented

# Deals damage with 65% accuracy
_rock-throw:
  goto _notImplemented

# Deals damage
# Can hit a Pokémon during the semi-invulnerable turn of Dig; if it does, its power is doubled for that Pokémon
_earthquake:
  goto _notImplemented

# Deals damage equal to the target's current HP (instant KO)
# Accuracy is calculated as (Level_user - Level_target + 30)%; starts at 30% when levels are equal and increases by 1% per level difference, reaching 100% when the user is 70 or more levels higher
# If the user's level is lower than the target's, the move always fails
# The move breaks a substitute if it hits
# It does not bypass type immunities; normal type effectiveness applies
# In Generation I it cannot affect a target whose Speed stat exceeds the user's Speed stat
# In Generation II the accuracy is also influenced by accuracy and evasion stats and the move can hit during Dig's semi-invulnerable turn
_fissure:
  goto _notImplemented

# Deals damage (80 power) after a semi-invulnerable turn
# Executes on the second turn; PP is deducted only if the move completes
# The user cannot switch out until Dig fully executes or is disrupted
# During the semi-invulnerable turn the user is immune to most moves but can be hit by Earthquake, Magnitude, and Fissure (double damage from Generation II onward)
# Can be interrupted by full paralysis, infatuation, or confusion self-damage, which may reset the semi-invulnerable turn
_dig:
  goto _notImplemented

# Inflicts badly poison status with 85% accuracy (cannot affect Poison-type Pokémon)
# Badly poisoned target takes damage each turn equal to Nx⌊HPmax/16⌋, where N starts at 1 and increases after each poison or Leech Seed damage instance
# Damage from bad poison is applied before any other effects for that turn
# If the target switches out or the battle ends, badly poison becomes regular poison; using Rest cures poison but does not reset the N counter
_toxic:
  goto _notImplemented

# Deals damage and has a 10% chance to confuse the target
_confusion:
  goto _notImplemented

# Deals damage
# 10% chance to lower the target's Special Defense by one stage
# No additional failure chance when used by an in-game opponent
_psychic:
  goto _notImplemented

# Does not deal damage; 60% accuracy
# Puts the target to sleep
# In Generation I, can affect a target behind a substitute
# In Generation II, when used by in-game opponents outside the Battle Tower it has an additional 25% chance to fail
# In Generation III, fails on Pokémon with Insomnia or Vital Spirit
_hypnosis:
  goto _notImplemented

# Does not deal damage; raises user's Attack by one stage
_meditate:
  goto _notImplemented

# Increases the user's Speed by one stage
_agility:
  goto _notImplemented

# Deals damage with +1 priority
# Priority remains unchanged while the user is asleep or frozen and is only reset after the user wakes up, is defrosted, or switches out
_quick-attack:
  goto _notImplemented

# Deals damage on the turn it is used
# Increases the user's Attack stat by one stage each time it is damaged by an opponent's move
# The Attack boost continues to accumulate even if the initial use of Rage misses or fails
# The effect persists through subsequent turns until the Pokémon faints or the battle ends
_rage:
  goto _notImplemented

# Teleport does not deal damage; it attempts to flee wild battles, ending the battle.
# In Trainer battles Teleport always fails.
# If the user's level is lower than the opponent's, the failure chance ranges from about 10% to 25%, calculated as ⌊Levelopponent⁴⌋ / (Levelopponent + Leveluser + 1).
# Teleport fails when the user is trapped by any trapping move (including Ingrain and binding moves) or by an Ability.
# Holding a Smoke Ball causes Teleport to succeed regardless of trapping moves or Abilities.
# Teleport fails in wild battles that are not Single Battles.
# Teleport also fails when used by opposing NPCs or in specific scripted locations (e.g., Team Rocket's Hideout, GS Ball Celebi, Tin Tower Suicune, Red Gyarados).
_teleport:
  goto _notImplemented

# Deals damage equal to the user's level
# Not affected by type immunities, allowing it to hit Pokémon that are immune to Ghost-type moves
_night-shade:
  goto _notImplemented

# Copies a move from the target's moveset
# Always hits; accuracy checks are bypassed unless the target is in a semi-invulnerable turn such as Dig or Fly
# Cannot copy Shadow-type moves
_mimic:
  goto _notImplemented

# Decreases the target's Defense by two stat stages
# Cannot affect a Pokémon behind a substitute
# In Generation I and II, when used by an in-game opponent outside the Battle Tower, there is a 25% additional chance of failure; this extra failure chance was removed in Generation III
_screech:
  goto _notImplemented

# Increases the user's evasion by one stage
_double-team:
  goto _notImplemented

# Restores up to 50% of the user's maximum HP, rounded down
# In Generation I, fails if the remaining HP difference leaves a remainder of 255 when divided by 256
_recover:
  goto _notImplemented

# Increases the user's Defense by one stage.
_harden:
  goto _notImplemented

# Raises the user's Evasion stat
# Targets that have used Minimize take double damage from certain moves in Generations II-III
_minimize:
  goto _notImplemented

# Lowers the target's Accuracy by one stage
# Has a 25% chance to fail when used by in-game opponents outside the Battle Tower (Generations I-II)
_smokescreen:
  goto _notImplemented

# Causes the target to become confused.
_confuse-ray:
  goto _notImplemented

# Increases user's Defense by one stage
_withdraw:
  goto _notImplemented

# Does not deal damage
# Raises user's Defense by 1 stage
# Doubles the power of Rollout and Ice Ball while the user remains in battle
# Effect does not stack and cannot be Baton Passed
_defense-curl:
  goto _notImplemented

# Raises user's Defense by two stages.
_barrier:
  goto _notImplemented

# Halves damage from special moves to affected Pokémon
# Reduces special damage by one-third when multiple allies are present
# Is removed if an opponent uses Brick Break or Shadow Shed on it (unless protected or the move misses)
_light-screen:
  goto _notImplemented

# Resets both active Pokémon's stat stages to 0 and removes burn and paralysis reductions
# Removes Focus Energy, Dire Hit, Mist, Guard Spec., X Accuracy, Leech Seed, Disable, Reflect, and Light Screen from both sides
# Cures confusion in both active Pokémon
# Turns bad poison into regular poison for both active Pokémon
# Removes any non-volatile status condition from the opponent
# In Generation I: frozen or sleeping targets cannot act that turn if their status is removed by Haze; a frozen Pokémon not recharged from Hyper Beam remains unable to act
# In Stadium: eliminates major status ailments of the user
_haze:
  goto _notImplemented

# Does not deal damage; halves damage from physical moves
# Reduces damage taken to roughly one-third when multiple allies are protected
# Effect is removed if an opponent uses Brick Break or Shadow Shed on the user (unless immune or the move misses)
# No longer influences confusion damage
_reflect:
  goto _notImplemented

# Does not deal damage; raises the user's critical hit ratio by two stages
_focus-energy:
  goto _notImplemented

# Deals damage equal to twice the damage received during the idling period
# Has 100% accuracy and cannot hit Ghost-type Pokémon or Pokémon in a semi-invulnerable turn such as Dig or Fly
# Cannot be used while the user is asleep, frozen, bound, or flinching; those conditions only pause the duration
# After two turns of idling, Bide releases and deals damage; if no attack landed during the period, the move fails
# Damage calculation includes crash damage, self-inflicted confusion damage, and full damage absorbed by a substitute
# If the opponent's last attack missed, the accumulated damage is not reset, so previous turn's damage still counts toward the total
# Hits the last Pokémon that attacked the user, even if it is an ally
# In Generation III only, HP loss from Pain Split contributes to the accumulated damage
_bide:
  goto _notImplemented

# Deals damage by executing a randomly selected move
# The selected move's damage, accuracy, and secondary effects are applied exactly as they would be if used directly
# If the called move is a binding move, it can trap the target for multiple turns
_metronome:
  goto _notImplemented

# Copies the last move targeted at the user by a Pokémon still on the field
# Executes that move as if it were used by the user, inheriting its damage and secondary effects
# Fails if no such move exists, if the source switches out before the turn ends, or if copying itself
# Cannot copy moves that target multiple Pokémon unless the user is one of those targets
_mirror-move:
  goto _notImplemented

# Deals damage; the user faints after using Self-Destruct, even if the attack misses or the target is immune
# The move's power is 130 in Generation I but the target's Defense is halved during damage calculation, effectively doubling the power to 260; in Generation II the power rises to 200 with Defense still halved, effectively 400
# If Self-Destruct breaks a substitute, the user does not faint (in Generations I-II), though other Pokémon may still act after the user faints in Generation III
_self-destruct:
  goto _notImplemented

# Deals damage with no secondary effect
_egg-bomb:
  goto _notImplemented

# Deals damage
# 30% chance to paralyze the target
# Can paralyze Ghost-type Pokémon
_lick:
  goto _notImplemented

# Deals damage and has a 40% chance to poison the target
_smog:
  goto _notImplemented

# Deals damage and has a 30% chance to poison the target
_sludge:
  goto _notImplemented

# Deals damage and has a 10% chance to cause flinching
# Cannot cause flinching if the target has a substitute
_bone-club:
  goto _notImplemented

# Deals damage and has a 10% chance to burn the target
_fire-blast:
  goto _notImplemented

# Deals damage
# 20% chance to cause the target to flinch
_waterfall:
  goto _notImplemented

# Deals damage for 2-5 turns; the duration is randomly chosen (37.5% chance for 2 or 3 turns, 12.5% chance for 4 or 5 turns) and each strike deals equal damage
# Only the first hit can score a critical hit; all subsequent hits deal the same damage as the first
# Does not deal additional damage while trapping the target; it only prevents the target from attacking
# Traps the target and prevents switching; if the target switches out early, Clamp automatically hits the incoming Pokémon, dealing damage and consuming another PP
# In Generation II the move inflicts 1/16 of the target's maximum HP as damage each trapped turn in addition to the initial hit damage
# If the user switches out before the duration ends, the target is unable to attack during that turn; no damage is dealt on that turn
# A missed Clamp still cancels the recharge turn required for Hyper Beam and can cause Hyper Beam to be used automatically if it was queued; no damage is dealt by the miss
_clamp:
  goto _notImplemented

# Deals damage and always hits, ignoring accuracy checks
# Can hit during the semi-invulnerable turn of moves such as Dig or Fly
# In multi-target battles it strikes all adjacent opposing Pokémon
_swift:
  goto _notImplemented

# Deals damage on the turn after selection
# PP is deducted and the move counts as the last used move
# User cannot switch out until Skull Bash fully executes or is disrupted
# If the user is asleep, frozen, bound, or flinched, the effect pauses but does not end
# In Stadium, Mirror Move can copy Skull Bash on either of its execution turns
_skull-bash:
  goto _notImplemented

# Deals damage; can hit 2-5 times per use (37.5% chance for 2 hits, 37.5% for 3 hits, 12.5% for 4 hits, 12.5% for 5 hits)
# Each strike deals equal damage and may critically hit
# Continues attacking after breaking substitute; only the last strike is recognized by Bide and Counter
_spike-cannon:
  goto _notImplemented

# Deals damage and has a 33.2% chance of lowering the target's Speed by one stage; when used by an in-game opponent there is an additional 25% chance of the effect failing, resulting in an effective 24.9% chance
# Deals damage and lowers the target's Speed by one stage with a 10% chance (Gen II); when used by an in-game opponent there remains a 25% failure chance, giving an effective 7.5% chance unless Lock-On or Mind Reader are active or in the Battle Tower
# Deals damage, and no additional failure chance occurs for the Speed-lowering effect when used by an in-game opponent (Gen III)
_constrict:
  goto _notImplemented

# Does not deal damage; raises the user's Special Defense by two stages
_amnesia:
  goto _notImplemented

# Decreases target's accuracy by one stage
# Has 25% chance to fail when used by in-game opponents outside the Battle Tower (Generations I-II)
_kinesis:
  goto _notImplemented

# Restores up to 50% of the user's maximum HP (rounded down); does not deal damage
# Fails if the user's current HP is already at its maximum
# In Generation I, also fails when the difference between max and current HP is 255 modulo 256
_soft-boiled:
  goto _notImplemented

# Deals damage with power 85
# If the move misses, the user receives 1 HP of crash damage unless the target is Ghost-type
# When used by a Pokémon that attacks first and faints from crash damage, the opposing target will not get to attack
_high-jump-kick:
  goto _notImplemented

# Paralyzes the target with 75% accuracy
# Cannot affect Ghost-type Pokémon unless Foresight or Odor Sleuth is active
# In Generation II, when used by an opponent outside the Battle Tower, there is a 25% chance of failing in addition to normal miss
_glare:
  goto _notImplemented

# Deals damage only if the target is asleep
# Restores HP equal to 50% of the damage dealt, up to the user's maximum HP (1 HP restores 1 HP)
# Fails if the target has a substitute
# Cannot be used on a Pokémon under Heal Block
_dream-eater:
  goto _notImplemented

# Poisons the target with 55% accuracy
# Has a 25% chance to fail when used by in-game opponents outside the Battle Tower
_poison-gas:
  goto _notImplemented

# Deals damage, hitting the target 2-5 times per use
# Distribution: 37.5% chance for 2 hits, 37.5% chance for 3 hits, 12.5% chance for 4 hits, 12.5% chance for 5 hits
# Each strike deals equal damage; only the first strike could be a critical hit in Generation I, but from Generation II onward any strike may become a critical hit
# Barrage stops immediately if it breaks a substitute; Bide and Counter only register the final strike
# When the user holds a King's Rock or Razor Fang, each consecutive hit has an equal chance to cause the opponent to flinch (Generation III effect)
_barrage:
  goto _notImplemented

# Deals damage
# Restores up to 50% of the damage dealt as HP (minimum 1 HP), up to the user's maximum HP
# Misses if the target has a substitute in Japanese Generation I and all Generation II games
_leech-life:
  goto _notImplemented

# Does not deal damage; causes target to fall asleep
# In Generation I handheld games only, can affect a target behind a substitute
# In Generation II, when used by an in-game opponent outside the Battle Tower, has a 25% chance to fail in addition to normal miss chance
_lovely-kiss:
  goto _notImplemented

# Deals damage on the second turn after being selected
# 30% chance to cause the target to flinch
# Increases critical hit ratio
_sky-attack:
  goto _notImplemented

# Bypasses accuracy checks and always hits unless the target is in a semi-invulnerable turn (e.g., during Dig or Fly)
# Copies the target's species, current form, types, Ability, base stats, IVs, EVs, and final stat values
# Retains the user's current HP and level; transformed stats are derived from the target's final values
# In Generation I only, critical-hit calculations use the user's untransformed stats
# Fails if the target is behind a substitute or protected by Crafty Shield (but works against Protect or Detect)
# In Generation II, using a Love Ball on a transformed wild Pokémon copies its IVs
# Copied moves receive 5 PP (or the move's maximum PP if lower) and follow generation-specific PP rules
# Transform does not alter volatile status conditions or existing stat changes on the user
_transform:
  goto _notImplemented

# Deals damage
# 33.2% chance to lower the target's Speed by one stage
# In double battles, hits both opposing Pokémon
_bubble:
  goto _notImplemented

# Deals damage
# 20% chance to confuse the target
_dizzy-punch:
  goto _notImplemented

# Puts the target to sleep
# In Generation I, can affect a target behind a substitute
_spore:
  goto _notImplemented

# Does not deal damage; reduces target's accuracy by one stage
# 70% accuracy in Generation I-II
# In Generation I-II, when used by an in-game opponent outside the Battle Tower, has a 25% additional chance to fail
_flash:
  goto _notImplemented

# Deals damage using the formula ⌊Level_userx(10r+50)/100⌋ where r is a random integer from 0 to 10
# Minimum damage is 1 HP if the calculated value would be 0
# Accuracy is 80%
_psywave:
  goto _notImplemented

# Does nothing.
_splash:
  canceler
  accuracyCheck
  print msgNothingHappens
  goto end

# Raises user's Defense by two stages without dealing damage
_acid-armor:
  goto _notImplemented

# Deals damage with 90 base power and 85% accuracy
# Has an increased critical hit ratio
_crabhammer:
  goto _notImplemented

# Deals damage; power is doubled by halving the target's Defense (effective 340 in Generation I, 500 in Generation II)
# Always causes the user to faint after execution
# User faints even if the move misses or the target is immune (e.g., Ghost type)
# If Explosion breaks a substitute, the user does not faint in Generations I-II
# When used by a Pokémon that attacks first and faints itself, other Pokémon may still act on that turn
_explosion:
  goto _notImplemented

# Deals damage with 2-5 hits per use; 37.5% chance for 2, 37.5% for 3, 12.5% for 4, and 12.5% for 5 hits
# Only the first strike can be a critical hit; subsequent strikes deal equal damage
# All strikes can continue after breaking substitute and still deal damage (Generation II onward)
# When holding a King's Rock, the final strike may cause flinch as it deals damage (Generation II)
# Each strike can activate contact-triggering abilities individually and still deal damage (Generation III)
# With the Ability Skill Link, Fury Swipes always hits five times if it does not miss, dealing damage each time (Generation III)
# When holding a King's Rock or Razor Fang, each consecutive hit may cause flinch as it deals damage (Generation III)
_fury-swipes:
  goto _notImplemented

# Deals damage and may cause the target to flinch on each hit if the user holds a King's Rock or Razor Fang
_bonemerang:
  goto _notImplemented

# Restores the user's HP to its maximum amount.
# Puts the user to sleep for 2 turns, preventing it from using moves.
# Cures any non-volatile status condition (poison, paralysis, burn, or freeze) when the user falls asleep.
# Can be used through Sleep Talk in Generation II, restoring HP and resetting the sleep counter.
# Fails if used via Sleep Talk in Generation III regardless of remaining HP.
_rest:
  goto _notImplemented

# Deals damage
# 30% chance to cause each target to flinch
# Targets all adjacent opponents
_rock-slide:
  goto _notImplemented

# Deals damage and has a 10% chance of causing the target to flinch
_hyper-fang:
  goto _notImplemented

# Increases the user's Attack by one stage
_sharpen:
  goto _notImplemented

# Changes the user's type to match the target's current type(s)
# Restores the user's original type when switched out, fainted, or battle ends
_conversion:
  goto _notImplemented

# Deals damage and has no secondary effect
_tri-attack:
  goto _notImplemented

# Deals damage equal to 50% of the target's current HP (rounded down), minimum 1 HP
# Damage cannot be prevented by type immunities
_super-fang:
  goto _notImplemented

# Deals damage and has an increased critical-hit ratio
_slash:
  goto effectHit

# Does not deal damage
# Creates a substitute with HP equal to half the user's current HP (rounded down)
# The substitute blocks one attack and absorbs its damage
# After absorbing a hit, the substitute disappears
# User loses HP equal to the amount allocated to the substitute when using the move
_substitute:
  goto _notImplemented

# Deals damage and causes the user to take recoil damage; recoil is avoided if the move breaks a substitute
# Can score a critical hit
# In Double Battles it targets a randomly selected opponent
# Can hit through Wonder Guard
# May be copied by Mirror Move
# Does not consume PP and is used automatically when no other moves are available
_struggle:
  goto _notImplemented
