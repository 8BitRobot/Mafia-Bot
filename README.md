# Mafia-Bot

A Discord Bot to facilitate games of the popular party game Mafia.

## What is Mafia?

[Mafia](https://en.wikipedia.org/wiki/Mafia_%28party_game%29) is a role-playing party game in which players are divided into three groups. Each member of the Mafia is given the identities of the other Mafia, and their goal is to eliminate the non-Mafia players. The Villagers don't know anyone else's role, and their goal is to figure out the identities of the Mafia and eliminate them via a daily vote. The Neutrals are allied with neither the Mafia nor the Villagers, and each Neutral has a different goal to work towards during the game.

## Features
- support for 16 different roles (5-16 players)
- automatic movement of players between Town Hall voice channel and their individual homes
- separate voice and text channel for dead players
- one-way voice relay allowing dead players to hear Town Hall meetings from their own voice channel
- emoji reaction-based selection and voting system
- pretty pixel drawings in role and status messages
- support for Last Will allowing players to reveal information automatically upon their death

## Primary Commands

### `m.join`

Joins the game party or creates one if none is present.

<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/join.png?token=AHZVCGOINWNCWZGPA5BV4Y3AY7X66" width=500>

### `m.write`

Creates or adds to a Final Will. The Final Will is text written privately by the player to be revealed on the player's death. Due to the private nature of the information the player may want to reveal, this command can only be used in Direct Messages (DMs).

<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/write.png?token=AHZVCGOMELPETPQZD3BWRTTAY7YDO" width=500>

### `m.erase`

Erases a given line from the Final Will. Like `m.write`, this command can only be used in the bot's DMs.

### `m.setup`

Sets up a new game by:

 1. Assigning a role to every player in the party.
 2. Creating a voice channel to represent every player's home and restricting channel permissions so each player can only view their own home and the Town Hall.
 3. Creating a voice and text channel for dead players to communicate and instantiating the Mafiaville Spectator to listen to the Town Hall and Godfather's Lair.
 4. Creating a text channel to send status updates and manage the daily voting process.

This command can only be used by the Host, the person who created the party.

<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/setup.png?token=AHZVCGI4U56PGAVX2H32ZO3AY7ZRK" width=500>

### `m.start`

Runs the game.

Each "night," the bot moves all players to their own homes. Then, it sends a DM to all active players to prompt them for their actions. Nightly actions include the Godfather killing, the Detective investigating another player, and so on. Then, the bot combines all the choices and determines the outcome of those choices, i.e. who has been killed that night and what other information can be revealed.

Each "day," the bot moves all players to the Town Hall (barring those killed or blocked by the Silencer role). Then, it releases the results from that night and allows the players to vote for one person whom they believe to be the Mafia. Players are given roughly 40 seconds to discuss before a decision must be made. If a person is nominated, the bot gives them 20 seconds to defend themselves before a final vote is taken. If the town votes to convict them, they are executed (and moved to the channel for the dead players).

<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/night.png?token=AHZVCGND3CSEM37C3WMDMGLAY7YH6" width=500>
<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/voting.png?token=AHZVCGINZGA5GGDFIYGT63LAY7YKQ" width=500>
<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/endgame.png?token=AHZVCGKJ6A5ANNAV4EKTGVTAY7ZDS" width=500>

## Auxiliary Commands

### `m.party`

Lists the members of the current game party.

<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/party.png?token=AHZVCGMA2C26S7NWAXSWXXTAY7YNA" width=500>

### `m.leave`

Removes the user from the game party.

### `m.remove @username`

Removes a tagged user from the game party.

This command can only be used by the Host, the person who created the party.

### `m.66`

Deletes all voice and text channels associated with past games, allowing the Host to set up and start a new game.

This command can only be used by the Host, the person who created the party.

## Roles

<img src="https://raw.githubusercontent.com/8BitRobot/Mafia-Bot/master/readme_screenshots/gallery.png?token=AHZVCGJAB2MTC5TVHLDYKCTAY7ZF2" width=1000>


