# Dice Arena Game Specification v1

## 1. Purpose

Dice Arena is a competitive five-dice game for two players.

This specification defines:

- scoring rules
- turn lifecycle
- match lifecycle
- multiplayer behavior
- authoritative server principles
- match event history
- statistics requirements
- validation and failure behavior

This specification is the source of truth for game behavior.

Implementation details may evolve, but implementations MUST preserve the behavior defined here unless this specification is explicitly changed.

---

# 2. Core game rules

## 2.1 Dice

A match uses five standard six-sided dice.

Each die has a value from 1 through 6.

A player receives a maximum of three rolls during each turn.

The first roll of every turn MUST roll all five dice.

After roll 1 and roll 2, the player MAY hold any number of dice.

Held dice are preserved during the next roll.

The player MAY release previously held dice before the next roll.

Only non-held dice are rolled again.

The player MAY score after roll 1, roll 2, or roll 3.

After roll 3, the player MUST select an unused scoring category.

---

# 3. Scorecard

Each player has the following scoring categories.

## Upper section

- Ones
- Twos
- Threes
- Fours
- Fives
- Sixes

## Lower section

- One Pair
- Two Pairs
- Three of a Kind
- Four of a Kind
- Small Straight
- Large Straight
- Full House
- Chance
- Yatzy

Each scoring category MAY be used exactly once.

Once scored, a category is permanently locked for the remainder of the match.

---

# 4. Upper-section scoring

Upper categories score only dice matching the selected value.

Examples using:

5, 5, 5, 3, 2

score as follows:

- Ones = 0
- Twos = 2
- Threes = 3
- Fours = 0
- Fives = 15
- Sixes = 0

Dice that do not match the selected upper category contribute no points.

---

# 5. Upper-section bonus

The upper-section bonus threshold is:

63 points

If the combined score of:

- Ones
- Twos
- Threes
- Fours
- Fives
- Sixes

is at least 63 points, the player receives:

50 bonus points.

The bonus is added once.

---

# 6. Lower-section scoring

## 6.1 One Pair

One Pair scores the sum of two dice with the same value.

If multiple pairs are available, the highest-scoring valid pair MUST automatically be used.

Example:

6, 6, 4, 3, 1

One Pair = 12.

---

## 6.2 Two Pairs

Two Pairs requires pairs of two different die values.

The score is the sum of the four dice forming the two pairs.

If multiple valid combinations exist, the highest-scoring valid combination MUST automatically be used.

Example:

6, 6, 5, 5, 1

Two Pairs = 22.

Three dice of one value may supply two dice for one of the pairs.

Example:

6, 6, 6, 4, 4

is a valid Two Pairs result:

6 + 6 + 4 + 4 = 20.

Four dice of the same value MUST NOT be interpreted as two separate pairs because the pairs must use different values.

---

## 6.3 Three of a Kind

Three of a Kind requires at least three dice of the same value.

Only three matching dice contribute to the score.

Example:

5, 5, 5, 3, 2

Three of a Kind = 15.

The remaining dice contribute no points.

---

## 6.4 Four of a Kind

Four of a Kind requires at least four dice of the same value.

Only four matching dice contribute to the score.

Example:

4, 4, 4, 4, 2

Four of a Kind = 16.

The remaining die contributes no points.

---

## 6.5 Small Straight

Small Straight is:

1, 2, 3, 4, 5

Small Straight scores:

15 points.

---

## 6.6 Large Straight

Large Straight is:

2, 3, 4, 5, 6

Large Straight scores:

20 points.

---

## 6.7 Full House

Full House requires exactly:

- three dice of one value
- two dice of another value

The two values MUST be different.

The score is the sum of all five dice.

Example:

5, 5, 5, 3, 3

Full House = 21.

Five identical dice MUST NOT count as Full House.

---

## 6.8 Chance

Chance scores the sum of all five dice.

Example:

6, 5, 4, 3, 2

Chance = 20.

---

## 6.9 Yatzy

Yatzy requires five identical dice.

Yatzy scores:

50 points.

Five identical dice do not automatically qualify for categories whose explicit requirements they do not satisfy, such as Full House or Two Pairs.

---

# 7. Zero scoring

During a turn, the player MUST eventually select one unused category.

A player MAY select an unused category even when the current dice do not satisfy its scoring requirements.

In that case:

- the category receives 0 points
- the category becomes permanently used
- the category cannot be selected again

This is a valid strategic action, not a validation error.

---

# 8. Score preview

After every roll, the client SHOULD calculate and display the score the current dice would produce for every unused category.

These previews are informational only.

For online multiplayer, the client MUST NOT be authoritative for the final awarded score.

The server MUST independently calculate the score when the player submits the selected category.

---

# 9. Turn lifecycle

A normal turn follows:

START_TURN
→ ROLL_1
→ optional HOLD/RELEASE
→ optional ROLL_2
→ optional HOLD/RELEASE
→ optional ROLL_3
→ SCORE_CATEGORY
→ END_TURN

The player MAY score after any completed roll.

The player MUST have completed at least one roll before scoring.

The first roll MUST include all five dice.

A maximum of three rolls is allowed.

After the third roll, another roll MUST NOT be accepted.

---

# 10. Holding dice

After roll 1 or roll 2, the player MAY hold or release any dice.

The player MAY hold all five dice.

If all five dice are held, another roll cannot occur until at least one die is released.

The player MAY instead score the current dice and finish the turn.

Held state is part of the current authoritative match state for online multiplayer.

---

# 11. Match completion

A normal fully played match ends when both players have filled every scoring category.

Final score consists of:

upper-section score +
upper-section bonus, if awarded +
lower-section score.

The player with the higher final score receives:

WIN

The player with the lower final score receives:

LOSS

If both final scores are equal, both players receive:

DRAW

There is no tie-break procedure.

A draw is a first-class match result and MUST be stored separately from wins and losses.

---

# 12. Match lifecycle

The architecture MUST support match states conceptually equivalent to:

CREATED
WAITING_FOR_OPPONENT
ACTIVE
COMPLETED
FORFEITED
EXPIRED

Exact implementation names MAY differ, but the behavioral distinctions MUST remain.

Completed historical matches MUST NOT be reset for rematches.

A rematch creates a new match.

A rematch MAY reference the previous match for history/head-to-head purposes.

---

# 13. Match creation concepts

The architecture should allow future support for:

QUICK
Random opponent.

RANKED
Rating-based matchmaking.

FRIEND
Challenge a specific player.

PRIVATE
Invite using a code or link.

TOURNAMENT
Created by tournament infrastructure.

REMATCH is an action that creates a new match between the same players; it is not required to be a distinct underlying match type.

These modes do not need to be implemented in Game Specification v1.

---

# 14. Multiplayer model

Normal Dice Arena matches are server-persisted and asynchronous-compatible.

When both players are online, the same match SHOULD behave in realtime.

Realtime connectivity does not define a separate game ruleset.

A player disconnecting MUST NOT automatically lose the match.

Closing the application, losing network connectivity, changing networks, device shutdown, or application crash MUST NOT count as forfeiting.

The authoritative match continues to exist on the server.

When reconnecting, the client retrieves the current authoritative MatchState and resumes from it.

---

# 15. Turn timeout

The initial standard timeout is:

24 hours per turn.

The timeout begins when control passes to the active player.

If the player fails to submit a valid action within the authoritative deadline, the match MAY be expired according to backend timeout processing.

For an expired standard match:

inactive player = LOSS
opponent = WIN

The server clock is authoritative.

The client device clock MUST NOT determine whether a deadline has passed.

Ranked and Tournament modes MAY use different timeout policies in future specifications.

---

# 16. Server authority

For online multiplayer, the backend is authoritative.

The mobile client MUST NOT be trusted to determine authoritative:

- dice results
- final scores
- valid moves
- match outcomes
- rankings
- tournament advancement
- purchases
- rewards

The client submits player intent.

Example:

SCORE_CATEGORY(YATZY)

The client MUST NOT submit an authoritative claim such as:

YATZY = 50

The server already knows the authoritative dice state and calculates the result independently.

---

# 17. Randomness

Authoritative online dice rolls MUST be generated by trusted backend logic.

The client MUST NOT generate dice results that the server blindly accepts.

Client-side randomness MAY be used for explicitly defined local/offline modes.

Core scoring and validation logic SHOULD remain deterministic.

---

# 18. MatchState

The backend SHOULD maintain a directly accessible current MatchState.

Conceptually this includes:

- match status
- players
- active player
- current turn
- current roll number
- current dice
- held dice
- both scorecards
- last action time
- turn deadline
- match version

The backend MUST NOT require replaying the complete event history merely to determine current match state during normal gameplay.

---

# 19. Match event log

In addition to current MatchState, Dice Arena MUST preserve meaningful authoritative gameplay events.

Initial event concepts include:

MATCH_CREATED
PLAYER_JOINED
MATCH_STARTED
TURN_STARTED
DICE_ROLLED
DICE_HOLD_CHANGED
CATEGORY_SCORED
TURN_COMPLETED
PLAYER_FORFEITED
MATCH_EXPIRED
MATCH_COMPLETED

Exact storage representation is not defined by this specification.

Each event SHOULD contain conceptually:

- event ID
- match ID
- monotonically increasing sequence number within the match
- event type
- actor player ID when applicable
- event payload
- server timestamp

Sequence numbers establish deterministic event ordering.

---

# 20. Event immutability

Historical gameplay events MUST be immutable.

Once an authoritative event is recorded, it MUST NOT later be edited to represent a different historical action.

Corrections, if ever required, must use an explicit future correction strategy rather than silently rewriting history.

---

# 21. What belongs in the match event log

The event log represents meaningful game state transitions and player gameplay actions.

It SHOULD contain events such as:

- dice rolls
- hold-state changes relevant to gameplay
- scoring decisions
- turn completion
- match completion
- forfeits
- expiration

It SHOULD NOT be used for generic product analytics such as:

- opening a menu
- viewing statistics
- UI hover/tap telemetry
- navigating between unrelated screens

Product analytics should use a separate analytics system.

---

# 22. Match replay

The event model SHOULD preserve enough information to allow future match replay.

Replay is not required in v1.

Historical dice rolls, hold changes, scoring actions, and turn ordering should make future reconstruction possible.

---

# 23. Match result data

Completed match data MUST preserve more than only the final totals.

For each fully completed scorecard, preserve at least:

- score for every category
- upper-section total
- whether bonus was awarded
- bonus value
- lower-section total
- final score
- Yatzy count
- player result: WIN, LOSS, or DRAW

The underlying scorecard is important historical data and MUST be preserved.

---

# 24. Player statistics

The data model MUST allow future calculation of at least:

- matches played
- wins
- draws
- losses
- win rate
- average completed score
- highest completed score
- lowest completed score
- current win streak
- longest win streak
- current loss streak
- longest loss streak
- total Yatzys
- Yatzys per match
- matches containing a Yatzy
- upper-section bonus frequency
- average upper-section score
- average score by category
- zeroed categories
- most frequently zeroed category
- average rolls per turn
- turns scored after roll 1
- turns scored after roll 2
- turns scored after roll 3

Not all statistics need to be implemented initially.

The raw game data MUST make these calculations possible.

---

# 25. Advanced statistics

The event history SHOULD make future analysis possible for concepts such as:

- reroll behavior
- completed combinations abandoned to pursue another combination
- performance against opponent strength
- head-to-head statistics
- monthly and seasonal performance
- tournament performance
- decision tendencies

These features are not required in v1.

---

# 26. Statistics periods

The architecture SHOULD allow statistics and leaderboards over periods such as:

- all time
- year
- month
- week
- season

Time-period statistics do not need to be implemented in v1.

---

# 27. Leaderboard data requirements

The data model SHOULD allow future leaderboards including:

- Most Matches
- Most Wins
- Highest Score
- Lowest Score
- Longest Win Streak
- Most Yatzys
- Highest Average Score
- Highest Win Rate
- Most Draws
- Highest Yatzy Rate
- Best Monthly Streak

Percentage- and average-based leaderboards SHOULD support minimum qualification thresholds to avoid statistically meaningless rankings based on very small sample sizes.

The exact threshold is not defined in this specification.

---

# 28. Win rate

Win rate is:

Wins / Completed Competitive Matches

Draws remain in the denominator.

Example:

100 matches
55 wins
5 draws
40 losses

Win rate = 55%.

If future ranking systems award partial value for draws, that metric MUST remain distinct from win rate.

---

# 29. Forfeit and expiration statistics

Forfeit and expiration results count toward competitive statistics including:

- matches
- wins
- losses
- streaks

However, incomplete scorecards MUST NOT be included in statistics that require a fully completed scorecard, including:

- average final score
- highest/lowest completed score
- category averages
- bonus frequency based on completed scorecards

The system MUST distinguish competitive match result from completed-scorecard statistics.

---

# 30. Derived statistics

Match events and completed match records are foundational historical data.

Frequently accessed statistics and leaderboards MAY later be materialized or cached for performance.

The system MUST NOT require scanning all historical events for every leaderboard request at production scale.

Derived/materialized statistics must remain reproducible from authoritative underlying data where practical.

---

# 31. Idempotent actions

Every state-changing client request for an online match MUST have a unique action identifier.

Conceptually:

actionId

If the server receives the same action again, it MUST NOT execute the game action twice.

This is especially critical for dice rolls.

If:

ROLL(actionId = abc123)

was successfully processed but the response was lost, retrying the same actionId MUST NOT generate a second dice result.

The server SHOULD return the previously accepted result or equivalent current authoritative state.

---

# 32. Server-side action validation

Every authoritative action MUST be validated by the server.

For a roll, validation includes conceptually:

- match is active
- player belongs to match
- player is the active player
- turn is active
- maximum roll count has not been reached
- action has not already been independently executed

For scoring:

- match is active
- correct active player
- at least one roll completed
- category is unused
- current dice state is authoritative and valid

The server calculates the score.

Client validation exists only for user experience and MUST NOT replace server validation.

---

# 33. Application restart and reconnect

All gameplay state necessary to resume an online match MUST exist server-side.

The application may terminate at any time.

After restart/reconnect, the client MUST be able to retrieve authoritative MatchState and reconstruct the current gameplay screen.

Correctness MUST NOT depend on the mobile application remaining alive.

---

# 34. Concurrent actions

A single match MUST NOT undergo conflicting authoritative state transitions concurrently.

Authoritative state changes for a match must be serialized or protected using an appropriate concurrency strategy.

The exact implementation is not specified yet.

The architecture SHOULD support a monotonically increasing match version.

Conceptually:

version 37
→ accepted transition
→ version 38

This may be used for optimistic concurrency and realtime synchronization.

---

# 35. Stale client state

The server remains authoritative when client state is stale.

A client MUST NOT overwrite newer server state with older local state.

When stale state is detected, the client SHOULD retrieve/resynchronize with current MatchState.

---

# 36. Explicit forfeit

A player MAY explicitly forfeit an active match.

The UI SHOULD require confirmation before sending the action.

Once the server accepts the forfeit:

forfeiting player = LOSS
opponent = WIN

The action cannot be undone.

The event history records the forfeit and resulting match completion.

---

# 37. Timeout race conditions

Timeout processing and player actions may occur near the same deadline.

The server MUST resolve these atomically.

A match MUST NOT both accept an action and expire from the same prior state.

The result must be exactly one valid authoritative transition.

Server time determines deadline validity.

---

# 38. Realtime synchronization

Realtime transport is a notification/synchronization mechanism, not the persistent source of truth.

Missing a realtime message MUST NOT permanently corrupt client state.

The client MUST be able to retrieve current MatchState from the backend and recover.

---

# 39. Untrusted clients

Assume clients may be modified or malicious.

The server MUST ignore client claims about authoritative data that the server can determine itself.

Examples of data the client must not dictate include:

- dice values
- awarded score
- match winner
- rating changes
- rewards

Requests should communicate player intent using the minimum information required.

---

# 40. Completed match immutability

After a match reaches a terminal state, normal gameplay actions MUST NOT modify it.

Old or delayed client requests arriving after completion MUST be rejected or treated as already obsolete.

Historical match results and events remain immutable.

---

# 41. Failure handling

If the client cannot determine whether a state-changing action succeeded, it MUST NOT invent a local authoritative result.

The client should enter a synchronization/recovery state and retrieve authoritative server state.

Example UI behavior:

"Could not confirm the action. Reconnecting…"

Correctness takes priority over immediate visual continuity.

---

# 42. Deterministic domain logic

Core game-rule functions SHOULD be deterministic wherever practical.

Functions for:

- scoring
- move validation
- category availability
- state transitions

must not directly depend on:

- system clock
- network
- persistent storage
- React state
- device APIs
- random number generation

External values should be supplied explicitly as inputs.

Randomness is an external concern.

This enables:

- reproducible tests
- match replay
- server verification
- consistent client previews
- future shared game-domain code

---

# 43. Architectural separation

The specification distinguishes:

## Pure game rules

Examples:

calculateScore
isMoveValid
getAvailableCategories
calculateFinalScore

These can potentially be shared between mobile and backend.

## Authoritative execution

Examples:

generateDice
acceptAction
persistMatchState
declareWinner
updateRating

For online multiplayer these responsibilities belong to trusted backend infrastructure.

---

# 44. Out of scope for Game Specification v1

This specification intentionally does not define:

- authentication implementation
- database technology
- backend framework
- API protocol
- WebSocket provider
- deployment platform
- advertising implementation
- Apple in-app purchase implementation
- Google Play billing implementation
- rating algorithm
- tournament bracket algorithm
- detailed matchmaking algorithm
- push notification provider
- offline game mode
- AI opponents
- premium feature design

These decisions will be specified separately.

---

# 45. Implementation rule

When implementation behavior and this specification conflict, the specification is authoritative unless the specification is explicitly amended.

Do not silently change game rules in code.

Changes to game behavior should first update this specification and then update implementation and tests.
