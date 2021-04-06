const Discord = require("discord.js");

module.exports = {
    name: "setup",
    description: "",
    async execute(message, args, gamedata) {
        function createVillage() {
            if (gamedata.players.size < 4) { // TODO: increase to 5
                message.channel.send("You don't have enough people!");
                return false;
            }

            if (gamedata.gameActive) {
                message.channel.send("You already ran `m.setup`. Use `m.start` to start the game.");
                return false;
            }

            if (!gamedata.players.get(message.author.tag).isHost && message.author.tag !== "PiAreSquared#6784" && message.author.tag !== "8BitRobot#3625") {
                message.channel.send(`**${message.author.tag}** does not have the permissions to setup the game.`)
                return false;
            }

            gamedata.gameActive = true;

            // Determine number of players in each group

            let mafiaCount, neutralCount;
            if (gamedata.settings.get("mafiaHidden") && gamedata.players.size >= 10 || gamedata.players.size >= 13) {
                mafiaCount = 3;
                neutralCount = Math.round(Math.random()) + 3;
                if (gamedata.players.size <= 11) {
                    neutralCount--;
                }
            } else if (gamedata.settings.get("mafiaHidden") && gamedata.players.size >= 6 || gamedata.players.size >= 8) {
                mafiaCount = 2
                neutralCount = Math.round(Math.random());
                if (gamedata.players.size > 7) {
                    neutralCount++;
                }
            } else {
                mafiaCount = 1;
                neutralCount = (gamedata.players.size < 5) ? 0 : 1;
            }

            let villagerCount = gamedata.players.size - mafiaCount - neutralCount;


            // Randomly assign each player to a role

            let playersList = Array.from(gamedata.players.keys());
            gamedata.game.game.playersAlive = playersList;

            // Mafia assignments

            let assignedMafiaRoles = [];
            let tierMafiaRoles = {};
            for (const [key, role] of Object.entries(gamedata.mafiaRoles)) {
                if (!(role.tier in tierMafiaRoles)) tierMafiaRoles[role.tier] = [key];
                else tierMafiaRoles[role.tier].push(key);
            }
            for (var i = 0; i < mafiaCount; i++) { // Godfather, Framer, (Mafioso || Silencer)
                var randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Mafia"
                switch (i) {
                    case 0:
                        player.role = tierMafiaRoles[1][0];
                        break;
                    case 1:
                        player.role = tierMafiaRoles[2][0];
                        break;
                    default:
                        player.role = tierMafiaRoles[3][Math.floor(Math.random() * tierMafiaRoles[3].length)];
                        tierMafiaRoles[3] = tierMafiaRoles[3].filter(v => v !== player.role);
                        break;
                }
                player.roleMessage = new Discord.MessageEmbed()
                    .setColor("#d50000")
                    .setTitle(`You are the **${player.role}**`)
                    .setDescription("You do stuff.")
                    .attachFiles([`images/${player.role.toLowerCase()}.png`])
                    .setImage(`attachment://${player.role.toLowerCase()}.png`);
                assignedMafiaRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }

            // Village Assignments

            let assignedVillageRoles = [];
            let tierVillageRoles = {};
            for (const [key, role] of Object.entries(gamedata.villageRoles)) {
                if (!(role.tier in tierVillageRoles)) tierVillageRoles[role.tier] = [key];
                else tierVillageRoles[role.tier].push(key);
            }
            for (var i = 0; i < villagerCount; i++) {
                var randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Village"
                switch (i) {
                    case 0:
                        player.role = tierVillageRoles[1][0];
                        break;
                    case 1:
                        player.role = tierVillageRoles[2][0];
                        break;
                    case 2:
                        player.role = tierVillageRoles[3][Math.round(Math.random())];
                        tierVillageRoles[3] = tierVillageRoles[3].filter(v => v !== player.role);
                        break;
                    case 3:
                        player.role = tierVillageRoles[3][0];
                        break;
                    case 4:
                        player.role = tierVillageRoles[4][Math.floor(Math.random() * 3)];
                        tierVillageRoles[4] = tierVillageRoles[4].filter(v => v !== player.role);
                        break;
                    case 5:
                        player.role = tierVillageRoles[4][Math.floor(Math.random() * 2)];
                        tierVillageRoles[4] = tierVillageRoles[4].filter(v => v !== player.role);
                        break;
                    case 6:
                        player.role = tierVillageRoles[4][0];
                        break;
                    default:
                        player.role = tierVillageRoles[5][Math.floor(Math.random() * tier4VillageRoles.length)];
                        tierVillageRoles[5] = tier4VillageRoles.filter(v => v !== player.role);
                        break;
                }
                player.roleMessage = new Discord.MessageEmbed()
                    .setColor("#1e8c00")
                    .setTitle(`You are the **${player.role}**`)
                    .setDescription("You do stuff.")
                    .attachFiles([`images/${player.role.toLowerCase()}.png`])
                    .setImage(`attachment://${player.role.toLowerCase()}.png`);
                assignedVillageRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }

            // Neutral Assignments

            let assignedNeutralRoles = [];
            let tierNeutralRoles = {};
            for (const [key, role] of Object.entries(gamedata.neutralRoles)) {
                if (!(role.tier in tierNeutralRoles)) tierNeutralRoles[role.tier] = [key];
                else tierNeutralRoles[role.tier].push(key);
            }
            for (var i = 0; i < neutralCount; i++) {
                var randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Neutral"
                switch (i) {
                    case 0:
                        player.role = tierNeutralRoles[1][Math.round(Math.random())];
                        break;
                    default:
                        player.role = tierNeutralRoles[2][Math.floor(Math.random() * 3)];
                        tierNeutralRoles[2] = tierNeutralRoles[2].filter(v => v !== player.role);
                        break;
                }
                player.roleMessage = new Discord.MessageEmbed()
                    .setColor("#1984ff")
                    .setTitle(`You are the **${player.role}**`)
                    .setDescription("You do stuff.")
                    .attachFiles([`images/${player.role.toLowerCase()}.png`])
                    .setImage(`attachment://${player.role.toLowerCase()}.png`);
                assignedNeutralRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }

            // Create Town Hall, Godfather's Lair, and people's individual homes, and set proper permissions for each room
            message.guild.channels.create("Town of Larkinville", {
                type: 'category',
            }).then((category) => {
                gamedata.settings.set("category", category)
                message.guild.channels.create("Town Hall", {
                    type: 'voice',
                    parent: category,
                    permissionOverwrites: [{
                        id: message.guild.roles.everyone,
                        deny: ['SPEAK'],
                    }],
                }).then(async (id) => {
                    // await message.guild.channels.resolve(id).setParent(category);
                    gamedata.settings.set("townHall", id.id)
                    for (const [tag, player] of gamedata.players) {
                        let user = await message.guild.members.fetch(player.id);
                        await message.guild.channels.resolve(id.id).updateOverwrite(user, {
                            SPEAK: true,
                        });
                    }
                }).then(() => {
                    message.guild.channels.create("Godfather's Lair", {
                        type: 'voice',
                        parent: category,
                        permissionOverwrites: [{
                            id: message.guild.roles.everyone,
                            deny: ['VIEW_CHANNEL'],
                        }],
                    }).then(async (id) => {
                        // await message.guild.channels.resolve(id).setParent(category);
                        gamedata.settings.set("mafiaHouse", id.id);
                    }).then(async () => {
                        for (const [tag, player] of gamedata.players) {
                            await message.guild.members.fetch(player.id).then((user) => {
                                user.send(player.roleMessage);
                            });
                            if (player.align !== "Mafia" || gamedata.settings.get("mafiaHidden")) {
                                message.guild.channels.create(player.role === "Mayor" ? "Mayor's Residence" : player.username + "'s Home", {
                                    type: 'voice',
                                    parent: category,
                                    permissionOverwrites: [{
                                            id: message.guild.roles.everyone,
                                            deny: ['VIEW_CHANNEL'],
                                        },
                                        {
                                            id: player.id,
                                            allow: ['VIEW_CHANNEL'],
                                        },
                                    ],
                                }).then(async (id) => {
                                    // await message.guild.channels.resolve(id).setParent(category);
                                    let temp = gamedata.players.get(tag);
                                    temp.vc = id.id;
                                    gamedata.players.set(tag, temp);
                                });
                            } else {
                                let user = await message.guild.members.fetch(player.id);
                                message.guild.channels.resolve(gamedata.settings.get("mafiaHouse")).updateOverwrite(user, {
                                    VIEW_CHANNEL: true
                                }).then((id) => {
                                    let temp = gamedata.players.get(tag);
                                    temp.vc = id.id;
                                    gamedata.players.set(tag, temp);
                                });
                            }
                        }
                        message.guild.channels.create("The Larkinville Mafia", {
                            type: "text",
                            parent: category,
                            permissionOverwrites: [{
                                id: message.guild.roles.everyone,
                                allow: ['VIEW_CHANNEL'],
                            }, {
                                id: message.guild.roles.everyone,
                                deny: ['SEND_MESSAGES', 'SEND_TTS_MESSAGES', 'ADD_REACTIONS'],
                            }],
                        }).then(async (id) => {
                            gamedata.settings.set("textChannel", id.id);
                            for (const [tag, player] of gamedata.players) {
                                let user = await message.guild.members.fetch(player.id);
                                await message.guild.channels.resolve(id).updateOverwrite(user, {
                                    SEND_MESSAGES: true,
                                    SEND_TTS_MESSAGES: true,
                                    ADD_REACTIONS: true
                                });
                            }
                            return true;
                        });
                    })
                });
            });

        }
        let village = createVillage();
        if (!village) {
            gamedata.gameReady = true;
        }
    },
};