module.exports = {
    name: "setup",
    description: "",
    async execute(message, args, gamedata) {

        function createVillage() {
            if (gamedata.players.size <= 4) {
                message.channel.send("You don't have enough people!");
                return;
            }

            let mafiaCount, neutralCount;
            if (gamedata.settings.get("mafiaHidden") && gamedata.players.size >= 10 || gamedata.players.size >= 13) {
                mafiaCount = 3;
                neutralCount = round(Math.random()) + 3;
                if (gamedata.players.size <= 11) {
                    neutralCount--;
                }
            } else if (gamedata.settings.get("mafiaHidden") && gamedata.players.size >= 6 || gamedata.players.size >= 8) {
                mafiaCount = 2
                neutralCount = round(Math.random());
                if (gamedata.players.size > 7) {
                    neutralCount++;
                }
            } else {
                mafiaCount = 1;
                neutralCount = (gamedata.players.size < 5) ? 0 : 1;
            }

            let villagerCount = gamedata.players.size - mafiaCount - neutralCount;

            let playersList = Array.from(gamedata.players.keys());
            console.log(playersList);

            let assignedMafiaRoles = [];
            let tier2MafiaRoles = ["Mafioso", "Silencer"];
            for (var i = 0; i < mafiaCount; i++) { // Godfather, Framer, (Mafioso || Silencer)
                var randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Mafia"
                // if (i < 3) {
                //     player.role = gamedata.mafiaRoles[i];
                // } else {
                //     player.role = tier3VillageRoles[Math.floor(Math.random() * tier3VillageRoles.length)];
                //     tier3VillageRoles = tier3VillageRoles.filter(v => v !== player.role);
                // }
                switch (i) {
                    case 0:
                        player.role = "Godfather";
                        break;
                    case 1:
                        player.role = "Framer";
                        break;
                    default:
                        player.role = tier2MafiaRoles[Math.floor(Math.random() * tier2MafiaRoles.length)];
                        tier2VillageRoles = tier2VillageRoles.filter(v => v !== player.role);
                        break;
                        assignedMafiaRoles.push(player.role);
                        gamedata.players.set(randPlayer, temp);
                }
            }

            let assignedVillageRoles = [];
            let tier2VillageRoles = ["Mayor", "Vigilante"];
            let tier3VillageRoles = ["PI", "Jailor", "Distractor"]
            let tier4VillageRoles = ["Spy"];
            for (var i = 0; i < villagerCount; i++) {
                var randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Village"
                switch (i) {
                    case 0:
                        player.role = "Doctor";
                        break;
                    case 1:
                        player.role = "Detective";
                        break;
                    case 2:
                        player.role = tier2VillageRoles[Math.round(Math.random())];
                        tier2VillageRoles = tier2VillageRoles.filter(v => v !== player.role);
                        break;
                    case 3:
                        player.role = tier2VillageRoles[0];
                        break;
                    case 4:
                        player.role = tier3VillageRoles[Math.floor(Math.random() * 3)];
                        tier3VillageRoles = tier3VillageRoles.filter(v => v !== player.role);
                        break;
                    case 5:
                        player.role = tier3VillageRoles[Math.floor(Math.random() * 2)];
                        tier3VillageRoles = tier3VillageRoles.filter(v => v !== player.role);
                        break;
                    case 6:
                        player.role = tier3VillageRoles[0];
                        break;
                    default:
                        player.role = tier4VillageRoles[Math.floor(Math.random() * tier4VillageRoles.length)];
                        tier4VillageRoles = tier4VillageRoles.filter(v => v !== player.role);
                        break;
                }
                assignedVillageRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }

            let assignedNeutralRoles = [];
            let tier1NeutralRoles = ["Jester", "Executioner"]
            let tier2NeutralRoles = ["Eternal"]

            for(var i = 0; i < villagerCount; i++) {
                var randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Neutral"
                switch (i) {
                    case 0:
                        player.role = tier1NeutralRoles[Math.round(Math.random())];
                        break;
                    default:
                        player.role = tier2NeutralRoles[Math.round(Math.random())];
                        tier2NeutralRoles = tier2NeutralRoles.filter(v => v !== player.role);
                        break;
                }
                assignedNeutralRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }




            message.guild.channels.create("Town Hall", {
                type: 'voice'
            }).then((id) => {
                gamedata.settings.set("townHall", id.id)
            }).then(() => {
                return new Promise((resolve) => {
                    for (const [tag, player] of gamedata.players) {
                        if (player.align !== "Mafia" || gamedata.settings.get("mafiaHidden")) {
                            message.guild.channels.create(player.role === "Mayor" ? "Mayor's Residence" : player.username + "'s Home", {
                                type: 'voice',
                                permissionOverwrites: [{
                                        id: message.guild.roles.everyone,
                                        deny: ['VIEW_CHANNEL'],
                                    },
                                    {
                                        id: player.id,
                                        allow: ['VIEW_CHANNEL'],
                                    },
                                ],
                            }).then((id) => {
                                let temp = gamedata.players.get(tag);
                                temp.vc = id.id;
                                gamedata.players.set(tag, temp);
                            })
                        }
                    }
                })
            })
        }
        createVillage();
    },
};