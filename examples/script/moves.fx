# * Deals damage
_pound:
  MoveHit
  goto End

# * Deals damage
# * Increased critical hit ratio
_karate-chop:
  MoveHit
  goto End

# * Deals damage
# * Hits 2-5 times: 37.5% chance for 2 hits, 37.5% for 3 hits, 12.5% for 4 hits, 12.5% for 5 hits
# * Only the first strike can be a critical hit
# * Ends immediately if it breaks a substitute
# * Bide and Counter only acknowledge the last strike of this move
_double-slap:
  goto End

# * Deals damage
# * Hits 2-5 times with 37.5%, 37.5%, 12.5%, 12.5% chance respectively
# * Only the first strike can be a critical hit
# * Ends instantly upon breaking a substitute
_comet-punch:
  goto End

# * Deals damage
_mega-punch:
  goto End

# * Deals damage
_pay-day:
  goto End

# * Deals damage
# * 10% chance to burn target
_fire-punch:
  goto End

# * Deals damage
# * 10% chance to freeze target
_ice-punch:
  goto End

# * Deals damage
# * 10% chance to paralyze target
# * Does not affect Electric-type Pokémon
_thunder-punch:
  goto End

# * Deals damage
_scratch:
  goto End

# * Deals damage
_vice-grip:
  goto End

# * Deals damage
# * One-hit KO move
# * 30% accuracy
# * Does not affect target if target's Speed stat is greater than user's Speed stat
# * Breaks a substitute if it hits
_guillotine:
  goto End

# * Does not deal damage
# * Deals damage
# * 75% accuracy
# * User cannot switch out until Razor Wind is executed or disrupted
# * PP is deducted upon successful execution
# * If target uses Mirror Move during the charge turn, it copies the move executed immediately before Razor Wind (or fails if unable)
# * Sleep, freeze, binding, and flinching pause but do not disrupt Razor Wind's execution
_razor-wind:
  goto End

# * Does not deal damage
# * Increases user's Attack stat by two stages
_swords-dance:
  goto End

# * Deals damage
_cut:
  goto End

# * Deals damage
_gust:
  goto End

# * Deals damage
_wing-attack:
  goto End

# * Does not deal damage
# * 85% accuracy
# * Failure chance = ⌊Leveltarget/4⌋ / (Leveltarget + Leveluser + 1)
# * Can hit Pokémon during the semi-invulnerable turn of Dig
# * Fails if user's level < target's level, with failure chance increasing as target's level is higher than user's
_whirlwind:
  goto End

# * Deals damage
# * Charging turn (first turn)
# * If not fully executed, PP is not deducted
# * If fully executed, PP is deducted and counts as last move used
# * Fully paralysis during the first turn disrupts the move
_fly:
  goto End

# * Deals damage
# * 75% accuracy
# * Target is bound (unable to attack for 2-5 turns)
# * 37.5% chance to attack for 2 turns, 37.5% for 3, 12.5% for 4, 12.5% for 5
# * Only the first hit can be a critical hit
# * Each turn's hit deals the same damage
_bind:
  goto End

# * Deals damage
_slam:
  goto End

# * Deals damage
_vine-whip:
  goto End

# * Deals damage
# * 30% chance to cause target to flinch
# * Flinch effect fails if target has a substitute
_stomp:
  goto End

# * Deals damage
# * Hits exactly 2 times
# * Only the first hit can be a critical hit
# * Ends immediately if the first hit breaks a substitute
# * Bide and Counter only acknowledge the second hit
_double-kick:
  goto End

# * Deals damage
_mega-kick:
  goto End

# * Deals damage
# * User takes 1 HP crash damage if move misses
# * Always misses against Ghost-type targets
# * If user faints from crash damage, opponent does not attack during that round
_jump-kick:
  goto End

# * Deals damage
# * 30% chance to flinch
# * Cannot flinch a target with a substitute
_rolling-kick:
  goto End

# * Does not deal damage
# * Lowers target's Accuracy by 1 stage
# * 25% chance to fail when used by an in-game opponent
_sand-attack:
  goto End

# * Deals damage
# * 30% chance to cause target to flinch
_headbutt:
  goto End

# * Deals damage
_horn-attack:
  goto End

# * Deals damage
# * Hits 2-5 times: 37.5% chance for 2 hits, 37.5% for 3 hits, 12.5% for 4 hits, 12.5% for 5 hits
# * Only the first strike can be a critical hit
# * Ends immediately if it breaks a substitute
# * Bide and Counter only acknowledge the last strike of this move
_fury-attack:
  goto End

# * Deals damage
# * 30% accuracy
# * One-hit KO move
# * Breaks a substitute if it hits
# * Does not affect a target whose current Speed stat is greater than the user's current Speed stat
_horn-drill:
  goto End

# * Deals damage
_tackle:
  goto End

# * Deals damage
# * 30% chance to paralyze target (if target is not Normal-type)
_body-slam:
  goto End

# * Deals damage
# * 85% accuracy
# * Hits for 2-5 turns (37.5% chance for 2, 3, 4, or 5 turns)
# * Prevents target from attacking during duration (binding)
# * First hit can be a critical hit
_wrap:
  goto End

# * Deals damage
# * User takes recoil damage equal to 1/4 of the damage done
# * If user faints from recoil, opponent does not attack that round
# * No recoil damage if move breaks a substitute
_take-down:
  goto End

# * Deals damage
# * Hits for 3-4 turns
# * PP is deducted only on the turn it is first called
# * User cannot switch out during Thrash
# * After Thrash finishes, user becomes confused
# * If duration is disrupted by paralysis, confusion, or self-inflicted damage, Thrash ends immediately and user does not become confused
# * Sleep, freeze, binding, and flinching pause but do not disrupt the duration of Thrash
# * Accuracy decreases each turn if affected by accuracy/evasion modifiers
_thrash:
  goto End

# * Deals damage
# * User takes 25% recoil damage
# * If user faints from recoil, target does not attack or take damage that round
# * If substitute is broken, user takes no recoil damage
_double-edge:
  goto End

# * Does not deal damage
# * Decreases the Defense stat of all adjacent opponents by one stage
_tail-whip:
  goto End

# * Deals damage
# * 20% chance to poison target
_poison-sting:
  goto End

# * Deals damage
# * Hits exactly 2 times
# * Second strike has 20% chance to poison target unless target is Poison-type
# * Only first strike can be a critical hit
# * Ends immediately if first strike breaks a substitute
# * Bide and Counter only acknowledge second strike
_twineedle:
  goto End

# * Deals damage
# * 85% accuracy
# * Hits 2–5 times: 37.5% chance for 2 hits, 37.5% for 3 hits, 12.5% for 4 hits, 12.5% for 5 hits
# * Only the first strike can be a critical hit
# * Ends immediately if it breaks a substitute
# * Bide and Counter only acknowledge the last strike of this move
_pin-missile:
  goto End

# * Does not deal damage
# * Decreases target's Defense by 1 stage
_leer:
  goto End

# * Deals damage
# * 10% chance to cause target to flinch
_bite:
  goto End

# * Does not deal damage
# * Decreases Attack stat of all adjacent opponents by one stage
_growl:
  goto End

# * Does not deal damage
# * Fails if user's level < target's level, with failure chance = ⌊Leveltarget/4⌋ / (Leveltarget + Leveluser + 1)
# * Can hit Pokémon during semi-invulnerable turn of Dig
_roar:
  goto End

# * Does not deal damage
# * Causes target to sleep
# * Can affect target behind a substitute in handheld games only
_sing:
  goto End

# * Does not deal damage
# * 100% chance to confuse target
# * Fails if target is already confused or has Own Tempo
_supersonic:
  goto End

# * Deals damage
# * Always inflicts exactly 20 damage
# * Ignores type immunities (can hit Ghost-type Pokémon)
# * Does not consider weaknesses or resistances
_sonic-boom:
  goto End

# * Does not deal damage
# * Fails if target has no moves with PP remaining
# * Disables a random move with PP > 0
# * Lasts 0 to 7 turns
# * Ends when target switches out, faints, or battle ends
# * Turns not counted if target is flinching, asleep, frozen, recharging, or bound
# * Attempting to use disabled move results in wasted turn
# * Using against Pokémon using Rage builds rage
# * Locks target into Thrash/Petal Dance/Rage until Disable ends
# * Thrash/Petal Dance counter does not decrease during Disable
# * If target levels up in battle, new move replaces disabled one
_disable:
  goto End

# * Deals damage
# * 33.2% chance to lower target's Defense by 1 stage
# * 25% chance of effect failing when used by an in-game opponent
_acid:
  goto End

# * Deals damage
# * 10% chance to burn target
_ember:
  goto End

# * Deals damage
# * 10% chance to burn target
_flamethrower:
  goto End

# * Does not deal damage
# * Prevents stat decreases from opponents' status moves until user switches out
# * Fails if already under effect
# * Effect can be removed by Haze
_mist:
  goto End

# * Deals damage
_water-gun:
  goto End

# * Deals damage
_hydro-pump:
  goto End

# * Deals damage
# * In a Double Battle, hits both opposing Pokémon
_surf:
  goto End

# * Deals damage
# * 10% chance to freeze target
_ice-beam:
  goto End

# * Deals damage
# * 10% chance to freeze target
# * 90% accuracy
_blizzard:
  goto End

# * Deals damage
# * 10% chance to confuse target
_psybeam:
  goto End

# * Deals damage
# * 33.2% chance to lower target's Speed by 1 stage
# * 25% chance effect fails when used by in-game opponent
_bubble-beam:
  goto End

# * Deals damage
# * 85/256 (~33.2%) chance to lower target's Attack by one stage
# * 25% chance effect fails when used by in-game opponent (effective chance 24.9%)
_aurora-beam:
  goto End

# * Deals damage
# * Requires a recharge turn on the turn after damage is done, during which no action may be performed
# * Does not require a recharge turn if it misses, breaks a substitute, knocks out the target, the user is targeted by a binding move (even if it misses), the user flinches, or the user is put to sleep after the attack but before the recharge turn
# * If the user is confused, the recharge turn does not count towards the number of turns the user will remain confused
# * If one Pokémon attacks first with a binding move that misses in a round in which the other Pokémon must recharge from a use of Hyper Beam, the user of Hyper Beam will automatically use Hyper Beam again during that turn instead of recharging
# * If at such a time Hyper Beam has 0 PP, Hyper Beam will still be used, and afterward its PP will roll over to 63, and full PP Ups will be applied to it
_hyper-beam:
  goto End

# * Deals damage
_peck:
  goto End

# * Deals damage
_drill-peck:
  goto End

# * Deals damage
# * User takes 25% recoil damage
# * If user faints from recoil and attacks first, target does not attack that round
# * No recoil if Submission breaks a substitute
# * Self-inflicted recoil damage from previous turn can be countered if target does not move on following turn
_submission:
  goto End

# * Deals damage
# * 90% accuracy
# * 30% chance to make target flinch
# * Cannot make target with a substitute flinch
_low-kick:
  goto End

# * Deals damage
# * 2x damage if last hit was Normal or Fighting type
# * Counters the last hit of a multi-strike or binding move
# * Can cause a critical hit
# * Priority of -1
# * Fails if used by Metronome
# * Fails if last damage was not Normal or Fighting type or if move is Counter
# * Both users using Counter in same round fail
_counter:
  goto End

# * Deals damage
# * Damage equals user's level
# * Not affected by type immunities
# * Can hit Ghost-type Pokémon
_seismic-toss:
  goto End

# * Deals damage
_strength:
  goto End

# * Deals damage
# * Restores up to 50% of damage dealt to user (but not less than 1 HP)
# * If breaks a substitute, no HP is restored
# * Always misses if target has a substitute
_absorb:
  goto End

# * Deals damage
# * Restores up to 50% of the damage dealt to the user as HP (but not less than 1 HP)
# * If the move breaks a substitute, no HP is restored to the user
_mega-drain:
  goto End

# * Does not deal damage
# * 90% accuracy
# * 100% chance to poison target
_leech-seed:
  goto End

# * Does not deal damage
# * Increases user's Special stat by one stage
_growth:
  goto End

# * Deals damage
# * Increased critical hit ratio
# * Hits all adjacent foes in battles with multiple opponents
# * Each target's critical hit chance is calculated individually
_razor-leaf:
  goto End

# * Deals damage
# * User cannot switch out during the duration of the move
# * Sleep, freezing, binding, and flinching pause but do not disrupt the move
# * If the target uses Mirror Move during the charging turn, it copies the move the user executed immediately before using Solar Beam (or fails if it cannot)
# * If Solar Beam is not fully executed, PP is not deducted and it does not count as the last move used
_solar-beam:
  goto End

# * Does not deal damage
# * poison target
# * Does not affect Poison-type Pokémon
_poison-powder:
  goto End

# * Does not deal damage
# * Paralyzes target
# * Can affect target behind a substitute in Generation I handheld games only
_stun-spore:
  goto End

# * Does not deal damage
# * 100% chance to put target to sleep
# * Can affect target behind a substitute in Generation I handheld games
_sleep-powder:
  goto End

# * Deals damage
# * Hits for 3-4 turns
# * PP is deducted only on the turn it is first called
# * User cannot switch out during Petal Dance
# * After finishing, user becomes confused
# * If duration is disrupted (full paralysis, self-harm from confusion), Petal Dance ends immediately
# * Sleep, freeze, binding, flinching pause but do not disrupt duration
# * Accuracy decreases by modifiers each turn and is reapplied on each automatic turn
# * If Petal Dance misses due to the 99.6% accuracy bug, its accuracy is unaffected
# * Secondary effects (like confusion) do not activate if Petal Dance misses on the first turn
_petal-dance:
  goto End

# * Does not deal damage
# * Decreases target's Speed by 1 stage
_string-shot:
  goto End

# * Deals damage
# * Always inflicts exactly 40 HP damage if it hits
# * Does not take weaknesses or resistances into account
# * Does not ignore type immunity
_dragon-rage:
  goto End

# * Deals damage
# * 70% accuracy
# * Hits for 2-5 turns with the following probabilities: 37.5% for 2 turns, 37.5% for 3 turns, 12.5% for 4 turns, 12.5% for 5 turns
# * Binding: Target cannot attack during the duration
# * Each hit deals the same amount of damage
# * Only the first hit can be a critical hit
# * If the user switches out before the duration ends, the target will be unable to attack during that turn
# * If the target switches out before the duration ends, Fire Spin will automatically be used against the incoming Pokémon, deducting an additional PP from the move
_fire-spin:
  goto End

# * Deals damage
# * 10% chance to paralyze target
# * Does not affect Electric-type Pokémon
_thunder-shock:
  goto End

# * Deals damage
# * 10% chance to paralyze target (does not affect Electric-type Pokémon)
_thunderbolt:
  goto End

# * Does not deal damage
# * Paralyzes target
# * In Generation I handheld games, can affect a target behind a substitute
# * Cannot usually affect Ground-type Pokémon (takes type into consideration)
_thunder-wave:
  goto End

# * Deals damage
# * 10% chance to paralyze target
# * Does not paralyze Electric-type Pokémon
_thunder:
  goto End

# * Deals damage
# * 65% accuracy
_rock-throw:
  goto End

# * Deals damage
_earthquake:
  goto End

# * Deals damage
# * One-hit KO move
# * 30% accuracy
# * Fails if target's current Speed stat is greater than the user's current Speed stat
_fissure:
  goto End

# * Deals damage
# * Charging turn: First turn is semi-invulnerable, second turn deals damage
# * Cannot switch out until move is executed or disrupted
# * Disrupted by full paralysis, infatuation, or self-inflicted confusion damage
_dig:
  goto End

# * Does not deal damage
# * 85% accuracy
# * Badly poisons target
# * Cannot affect Poison-type Pokémon
# * After battle ends, bad poison becomes regular poison
# * If target switches out or uses Haze, poison becomes regular
# * Using Rest cures poison but does not reset N
_toxic:
  goto End

# * Deals damage
# * 10% chance to confuse target
_confusion:
  goto End

# * Deals damage
# * 33.2% chance to lower target's Special by one stage
# * 25% chance for effect to fail when used by in-game opponent (resulting in 24.9% effective chance)
_psychic:
  goto End

# * Does not deal damage
# * 60% accuracy
# * 100% chance to put target to sleep
# * Can affect target behind a substitute in Generation I handheld games
_hypnosis:
  goto End

# * Does not deal damage
# * Increases user's Attack by 1 stage
_meditate:
  goto End

# * Increases user's Speed by two stages
_agility:
  goto End

# * Deals damage
# * Priority +1, used before all moves without increased priority
# * If user is asleep or frozen during the turn, increased priority is not reset during sleep/freeze
# * Increased priority is reset on the turn after waking up/defrosted or if user switches out
_quick-attack:
  goto End

# * Deals damage
# * 99.6% accuracy when no other accuracy or evasion modifiers are present
# * Attack stat increases by one stage each time the user is damaged or targeted by Disable
# * Attack stat increases by one stage for each hit from a multi-hit move
_rage:
  goto End

# * Does not deal damage
# * Fails in Trainer battles
# * Fails if user's level is less than opponent's level (failure chance formula: ⌊Levelopponent/4⌋ / (Levelopponent + Leveluser + 1))
# * Fails if user is trapped by a trapping move (except binding moves)
# * Fails in battles with Pokémon encountered as traps in Team Rocket's Hideout, GS Ball Celebi, Tin Tower Suicune (Crystal), and scripted Red Gyarados
# * Fails in wild battles that are not Single Battles
# * Fails if user is trapped by any trapping move (including Ingrain)
# * Fails in battles during trials
_teleport:
  goto End

# * Deals damage
# * Damage equals user's level
_night-shade:
  goto End

# * Does not deal damage
_mimic:
  goto End

# * Does not deal damage
# * Lowers target's Defense by 2 stat stages
# * Cannot affect a Pokémon behind a substitute
_screech:
  goto End

# * Does not deal damage
# * Increases user's evasion by one stage
_double-team:
  goto End

# * Does not deal damage
# * Restores up to 50% of user's maximum HP, rounded down
# * Fails if the difference between user's maximum HP and current HP leaves a remainder of 255 when divided by 256
_recover:
  goto End

# * Does not deal damage
# * Increases user's Defense by 1 stage
_harden:
  goto End

# Does not deal damage
# * Raises user's evasion stat
_minimize:
  goto End

# * Does not deal damage
# * Lowers target's accuracy by one stage
_smokescreen:
  goto End

# * Does not deal damage
# * Confuses target
_confuse-ray:
  goto End

# * Does not deal damage
# * Increases user's Defense by 1 stage
_withdraw:
  goto End

# * Does not deal damage
# * Increases user's Defense by 1 stage
# * Effect does not stack with itself
# * Cannot be Baton Passed
_defense-curl:
  goto End

# * Does not deal damage
# * Increases user's Defense by two stages
_barrier:
  goto End

# * Does not deal damage
# * Doubles the user's Special when the opponent damages the user with a special move
# * Fails if the user is already under its effect
# * Effect is ignored by critical hits
# * If the user's Special reaches 1024 or higher, it is reduced mod 1024
# * Can be lifted by Haze
_light-screen:
  goto End

# * Does not deal damage
# * Resets stat stages of both active Pokémon to 0
# * Removes stat reductions caused by burns and paralysis
# * Lifts effects of Focus Energy, Dire Hit, Mist, Guard Spec., X Accuracy, Leech Seed, Disable, Reflect, and Light Screen from both sides
# * Cures confusion for both active Pokémon
# * Converts bad poison to regular poison for both active Pokémon
# * Removes non-volatile status conditions from the opponent
# * If a frozen or sleeping opponent is affected, it cannot move in the same turn
# * If a frozen Pokémon that has not recharged from Hyper Beam is unfrozen, it remains unable to act until it faints
_haze:
  goto End

# * Does not deal damage
# * Doubles user's Defense when opponent uses a physical move
# * Fails if user is already under its effect
# * Effect ignored by self-inflicted confusion damage and critical hits
# * If user's Defense reaches 1024 or higher, it is reduced mod 1024
# * Can be lifted by Haze
# * If opponent has Reflect, lowers user's confusion damage
_reflect:
  goto End

# * Does not deal damage
# * Permanently divides the user's critical hit probability by 4
# * Cannot stack; fails if user is already under its effect
# * Removed by switching or Haze
_focus-energy:
  goto End

# * Deals damage
# * User is unable to select a move for 2-3 turns (chosen randomly), but can switch out during the effect
# * After the idling period, deals damage equal to twice the damage received during the period
# * Fails if the user is not directly attacked during the idling period
# * Damage is calculated based on the last amount of damage done, including crash damage, confusion damage, and damage absorbed by a substitute
# * Sleep, freeze, binding, and flinching will pause but not disrupt the duration of Bide
# * Bypasses accuracy checks to always hit, even during semi-invulnerable moves like Dig or Fly
_bide:
  goto End

# * Does not deal damage
# * Executes a randomly selected move
# * If the called move has 0 PP, PP can roll over
# * Can use moves that are disabled
_metronome:
  goto End

# * Does not deal damage
# * Uses the last move targeted at the user by a Pokémon still on the field
# * Fails if no moves were targeted at the user before use
# * Fails if the move that would be called switches out during the turn
# * Fails if it would call itself
# * Paralysis, confusion, recharging, or building up for a multi-turn move do not count as using a move
# * Can be used on teammates
# * Allows use of disabled moves
# * If used on a move targeting opponents (like Rock Slide), it uses it without hurting allies
_mirror-move:
  goto End

# * Deals damage
# * User takes 100% recoil damage (faints)
# * Target's Defense is halved during damage calculation (unless it is at a value of 1)
# * If breaks target's substitute, user does not faint (but image becomes blank)
# * User faints even if attack misses or target is immune to damage
# * If user attacks first and faints, opponent does not attack during that round
_self-destruct:
  goto End

# * Deals damage
_egg-bomb:
  goto End

# * Deals damage
# * 30% chance to paralyze target
# * Does not affect Ghost-type Pokémon
_lick:
  goto End

# * Deals damage
# * 40% chance to poison target
_smog:
  goto End

# * Deals damage
# * 40% chance to poison target
_sludge:
  goto End

# * Deals damage
# * 10% chance to flinch target
# * Does not affect targets with a substitute
_bone-club:
  goto End

# * Deals damage
# * 30% chance to burn target
_fire-blast:
  goto End

# * Deals damage
_waterfall:
  goto End

# * Deals damage
# * 75% accuracy
# * Hits 2-5 times with 37.5% chance for 2 turns, 37.5% for 3 turns, 12.5% for 4 turns, and 12.5% for 5 turns
# * First hit can be critical
# * Target cannot attack during duration
# * If user switches out, target cannot attack during that turn
# * If target switches out, Clamp is used on incoming Pokémon, deducting an additional PP
# * If Clamp has 0 PP, it still uses it and current PP rolls over to 63
# * Negates Hyper Beam's recharge turn even if Clamp misses
_clamp:
  goto End

# * Deals damage
# * Bypasses accuracy checks to always hit
# * In Japanese versions, cannot hit if target is behind a substitute
_swift:
  goto End

# * Deals damage
# * Requires 2 turns to execute
# * User cannot switch out until Skull Bash is fully executed or disrupted
# * PP is deducted only when the move is fully executed
# * Sleep, freeze, binding, and flinching pause but do not disrupt Skull Bash
# * If opponent uses Mirror Move during the first turn, it copies the move executed immediately before Skull Bash (or fails if no prior move)
_skull-bash:
  goto End

# * Deals damage
# * Hits 2-5 times: 37.5% chance for 2, 37.5% chance for 3, 12.5% chance for 4, 12.5% chance for 5
# * Increased critical hit ratio (only first strike)
# * Ends immediately if it breaks a substitute
# * Bide and Counter only acknowledge the last strike
_spike-cannon:
  goto End

# * Deals damage
# * 33.2% chance to lower target's Speed by 1 stage
# * 25% chance for effect to fail when used by in-game opponent (resulting in 24.9% effective chance)
_constrict:
  goto End

# * Does not deal damage
# * Increases user's Special by two stages
_amnesia:
  goto End

# * Does not deal damage
# * Decreases target's accuracy by 1 stage
_kinesis:
  goto End

# * Does not deal damage
# * Restores up to 50% of user's maximum HP, rounded down
# * Fails if user's current HP is equal to its maximum HP
# * Fails if the difference between user's maximum HP and current HP is 255 modulo 256 (i.e., 255 or 511)
_soft-boiled:
  goto End

# * Deals damage
# * User takes 1 HP crash damage if move misses
# * No crash damage if target is Ghost-type
# * If user faints from crash damage, target does not attack
_high-jump-kick:
  goto End

# * Does not deal damage
# * 75% accuracy
# * 100% chance to paralyze target
_glare:
  goto End

# * Deals damage
# * Only works if target is asleep
# * 50% of damage dealt is restored to user (up to user's maximum HP)
# * If user's current HP exceeds maximum HP after restoration, set to maximum HP
# * In localized Generation I versions, if target has a substitute and Dream Eater breaks it, no HP is restored to user
# * If user is under the effect of Heal Block, cannot use Dream Eater; if no other moves are available, uses Struggle
_dream-eater:
  goto End

# * Does not deal damage
# * 55% accuracy
# * 100% chance to poison target
_poison-gas:
  goto End

# * Deals damage
# * Hits 2-5 times with 37.5% chance for 2, 37.5% for 3, 12.5% for 4, and 12.5% for 5
# * Ends immediately if it breaks a substitute
# * Bide and Counter only acknowledge the last strike
_barrage:
  goto End

# * Deals damage
# * Restores up to 50% of damage dealt to user
# * If breaks a substitute, no HP restored
# * In Japanese Gen I, misses if target has a substitute
_leech-life:
  goto End

# * Does not deal damage
# * Causes target to fall asleep
# * In Generation I handheld games only, can affect target behind a substitute
_lovely-kiss:
  goto End

# * Deals damage
# * Charge turn: first turn does nothing, damage on the following turn
# * PP is deducted only if executed fully
# * Sleep, freeze, binding, and flinching pause but do not disrupt the duration
# * If target uses Mirror Move during the charge turn, it copies the move executed immediately before Sky Attack
_sky-attack:
  goto End

# * Does not deal damage
# * Bypasses accuracy checks unless target is semi-invulnerable (e.g., Dig, Fly)
# * In Generation I, if the user deals or receives a critical hit, untransformed stats are used in damage calculations
_transform:
  goto End

# * Deals damage
# * 33.2% chance to lower target's Speed by one stage
# * 25% chance for effect to fail when used by an in-game opponent (effective chance 24.9%)
_bubble:
  goto End

# * Deals damage
_dizzy-punch:
  goto End

# * Does not deal damage
# * Causes target to fall asleep
# * Can affect target behind a substitute in Generation I handheld games
_spore:
  goto End

# * Does not deal damage
# * Decreases target's accuracy by one stage
# * 70% accuracy
_flash:
  goto End

# * Deals damage
# * 80% accuracy
# * Damage varies between 1 and 1.5× user's level when used by player; 0 to 1.5× when used by opponent
# * In link battles, if 0 damage is generated, causes desynchronization (target receives 0, user's game continues generating until valid)
# * Softlock if used by Level 0, 1, or 171 Pokémon (glitch levels)
_psywave:
  goto End

# * Does not deal damage
_splash:
  goto End

# * Does not deal damage
# * Increases user's Defense by 2 stages
_acid-armor:
  goto End

# * Deals damage
# * Increased critical hit ratio
# * 85% accuracy
_crabhammer:
  goto End

# * Deals damage
# * User faints regardless of whether the attack misses or the target is immune (except Ghost-type)
# * Target's Defense is halved during damage calculation (unless it is at a value of 1), effectively doubling the power to 340
# * If Explosion breaks a target's substitute, the user will not faint, though its sprite will be replaced by a blank image
# * If the user of Explosion attacks first and faints itself, the opponent will not act or be subjected to recurrent damage during that turn
# * Cannot be used when a Pokémon with the Ability Damp is on the field
_explosion:
  goto End

# * Deals damage
# * Hits 2–5 times with the following probabilities: 37.5% for 2 hits, 37.5% for 3 hits, 12.5% for 4 hits, 12.5% for 5 hits
# * Only the first strike can be a critical hit
# * Ends immediately if it breaks a substitute
# * Bide and Counter only acknowledge the last strike of this move
_fury-swipes:
  goto End

# * Deals damage
# * Hits exactly 2 times
# * Only the first strike can be a critical hit
# * Ends immediately if the first strike breaks a substitute
_bonemerang:
  goto End

# * Does not deal damage
# * Causes the user to fall asleep for 2 turns
# * Restores the user's HP to its maximum amount
# * Cures non-volatile status conditions (poison, paralysis, burn, freeze)
# * Fails if the user has full HP
# * Fails if the difference between the user's maximum HP and current HP leaves a remainder of 255 when divided by 256
# * In handheld Generation I games only, stat reductions from paralysis and burn remain even after the status is cured (glitch)
_rest:
  goto End

# * Deals damage
_rock-slide:
  goto End

# * Deals damage
# * 10% chance to flinch target
_hyper-fang:
  goto End

# * Does not deal damage
# * Increases user's Attack by 1 stage
_sharpen:
  goto End

# * Does not deal damage
# * Changes user's type to target's current type(s)
# * User's original type(s) are restored when switched out, faints, or battle ends
_conversion:
  goto End

# * Deals damage
_tri-attack:
  goto End

# * Deals damage
# * Unaffected by type immunities
# * Deals damage equal to 50% of target's current HP, rounded down, with a minimum of 1 HP damage
_super-fang:
  goto End

# * Deals damage
# * Increased critical hit ratio
_slash:
  goto End

# * Does not deal damage
_substitute:
  goto End

# * Deals damage
# * User takes recoil damage
# * Does not spend any PP
# * In Double Battles, target is a randomly selected opponent
# * If Struggle breaks a substitute, user takes no recoil damage
# * If user attacks first and knocks itself out due to recoil, opponent does not attack during that round
# * Can be copied by Mirror Move
# * Can hit through Wonder Guard
# * Automatically used when Pokémon has no usable moves
# * Cannot be called by Assist, Me First, Metronome, or Sleep Talk; cannot be copied by Mimic, Sketch, Transform, or Imposter; cannot be repeated by Encore, Copycat, or a held choice item; cannot be forced by Instruct
# * In this generation, a Pokémon is permanently unable to use Struggle if any unused move slot has more than 0 PP in the internal game data
_struggle:
  goto End

