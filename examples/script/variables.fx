# MOVE_DIG
@const move:dig

@const move:fly

const fStatusSleep      1 << 0
const fStatusBurn       1 << 3
const fStatusPoison     1 << 4
const fStatusParalysis  1 << 5
const fStatusFreeze     1 << 6

const fStatusConfused   1 << 7
const fStatusFlinching  1 << 8
const fStatusWrapped    1 << 9

var moveResult

const fTurnCanceled     1 << 0
const fMoveMissed       1 << 1
const fSourceFainted    1 << 2
const fTargetFainted    1 << 3

var random

var multiHitCounter

