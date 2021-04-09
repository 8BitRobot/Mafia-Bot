const Discord = require("discord.js");

module.exports = {
    name: "setup",
    description: "",
    async execute(message, args, gamedata, spectatorClient) {
        function createVillage() {
            if (gamedata.players.size < 1) { // TODO: increase to 5
                message.channel.send("You don't have enough people!");
                return false;
            }

            if (gamedata.gameActive) {
                message.channel.send("You already ran `m.setup`. Use `m.start` to start the game.");
                return false;
            }

            if (!gamedata.players.get(message.author.tag).isHost && message.author.tag !== "PiAreSquared#6784" && message.author.tag !== "8BitRobot#3625") {
                message.channel.send(`**${message.author.tag}** does not have the permissions to setup the game.`);
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
                mafiaCount = 2;
                neutralCount = Math.round(Math.random());
                if (gamedata.players.size > 7) {
                    neutralCount++;
                }
            } else {
                mafiaCount = 1;
                neutralCount = (gamedata.players.size < 5) ? 0 : 1;
            }
            let villagerCount = gamedata.players.size - mafiaCount - neutralCount;

            let playersList = Array.from(gamedata.players.keys());
            gamedata.game.game.playersAlive = playersList;

            // Mafia assignments

            let currentTierObject = JSON.parse(JSON.stringify(gamedata.mafiaRoles.tiers));
            let currentTier = 1;
            let rolePool = [...currentTierObject.pool];

            for (var i = 0; i < mafiaCount; i++) { // Godfather, Framer, (Mafioso || Silencer)
                var randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Mafia";

                if (!currentTierObject[currentTier]) {
                    player.role = rolePool[Math.floor(Math.random() * rolePool.length)];
                } else if (!currentTierObject[currentTier].pick) {
                    player.role = currentTierObject[currentTier].roles[Math.floor(Math.random() * currentTierObject[currentTier].roles.length)];
                    currentTierObject[currentTier].roles = currentTierObject[currentTier].roles.filter(v => v !== player.role);
                    if (currentTierObject[currentTier].roles.length === 0) {
                        currentTier++;
                    }
                } else {
                    player.role = currentTierObject[currentTier].roles[Math.floor(Math.random() * currentTierObject[currentTier].roles.length)];
                    currentTierObject[currentTier].roles = currentTierObject[currentTier].roles.filter(v => v !== player.role);
                    currentTierObject[currentTier].pick--;
                    if (!currentTierObject[currentTier].pick) {
                        currentTier++;
                    }
                }
                rolePool = rolePool.filter(v => v !== player.role);

                gamedata.mafiaRoles.currentMafia[player.role] = randPlayer;
                player.roleMessage = new Discord.MessageEmbed()
                    .setColor("#d50000")
                    .setTitle(`You are the **${player.role}**`)
                    .setDescription(gamedata[`${player.align.toLowerCase()}Roles`][player.role].description)
                    .attachFiles([`images/${player.role.toLowerCase()}.png`])
                    .setImage(`attachment://${player.role.toLowerCase()}.png`);
                // assignedMafiaRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }

            // Village Assignments

            currentTierObject = JSON.parse(JSON.stringify(gamedata.villageRoles.tiers));
            currentTier = 1;
            rolePool = [...currentTierObject.pool];

            for (i = 0; i < villagerCount; i++) {
                randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                gamedata.villageRoles.players.push(randPlayer);
                player.align = "Village";

                if (!currentTierObject[currentTier]) {
                    player.role = rolePool[Math.floor(Math.random() * rolePool.length)];
                } else if (!currentTierObject[currentTier].pick) {
                    player.role = currentTierObject[currentTier].roles[Math.floor(Math.random() * currentTierObject[currentTier].roles.length)];
                    currentTierObject[currentTier].roles = currentTierObject[currentTier].roles.filter(v => v !== player.role);
                    if (currentTierObject[currentTier].roles.length === 0) {
                        currentTier++;
                    }
                } else {
                    player.role = currentTierObject[currentTier].roles[Math.floor(Math.random() * currentTierObject[currentTier].roles.length)];
                    currentTierObject[currentTier].roles = currentTierObject[currentTier].roles.filter(v => v !== player.role);
                    currentTierObject[currentTier].pick--;
                    if (!currentTierObject[currentTier].pick) {
                        currentTier++;
                    }
                }
                rolePool = rolePool.filter(v => v !== player.role);
                
                player.roleMessage = new Discord.MessageEmbed()
                    .setColor("#1e8c00")
                    .setTitle(`You are the **${player.role}**`)
                    .setDescription(gamedata[`${player.align.toLowerCase()}Roles`][player.role].description)
                    .attachFiles([`images/${player.role.toLowerCase()}.png`])
                    .setImage(`attachment://${player.role.toLowerCase()}.png`);
                // assignedVillageRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }

            // Neutral Assignments

            currentTierObject = JSON.parse(JSON.stringify(gamedata.neutralRoles.tiers));
            currentTier = 1;
            rolePool = [...currentTierObject.pool];

            for (i = 0; i < neutralCount; i++) {
                randPlayer = playersList[Math.floor(Math.random() * playersList.length)];
                playersList = playersList.filter(v => v !== randPlayer);
                let player = gamedata.players.get(randPlayer);
                player.align = "Neutral";
                gamedata.neutralRoles.players.push(randPlayer);
                
                if (!currentTierObject[currentTier]) {
                    player.role = rolePool[Math.floor(Math.random() * rolePool.length)];
                } else if (!currentTierObject[currentTier].pick) {
                    player.role = currentTierObject[currentTier].roles[Math.floor(Math.random() * currentTierObject[currentTier].roles.length)];
                    currentTierObject[currentTier].roles = currentTierObject[currentTier].roles.filter(v => v !== player.role);
                    if (currentTierObject[currentTier].roles.length === 0) {
                        currentTier++;
                    }
                } else {
                    player.role = currentTierObject[currentTier].roles[Math.floor(Math.random() * currentTierObject[currentTier].roles.length)];
                    currentTierObject[currentTier].roles = currentTierObject[currentTier].roles.filter(v => v !== player.role);
                    currentTierObject[currentTier].pick--;
                    if (!currentTierObject[currentTier].pick) {
                        currentTier++;
                    }
                }
                rolePool = rolePool.filter(v => v !== player.role);

                if (player.role === "Executioner") {
                    let villageRolesFiltered = gamedata.villageRoles.players.filter(t => gamedata.players.get(t).role !== "Mayor");
                    let target = villageRolesFiltered[Math.floor(Math.random() * villageRolesFiltered.length)];
                    gamedata.neutralRoles["Executioner"].target = target;
                    let targetUsername = gamedata.players.get(target).username;
                    let targetMessage = new Discord.MessageEmbed()
                        .setColor("#1984ff")
                        .setTitle(`Your target is ${targetUsername}. Your goal is to get them lynched.`)
                        .setDescription("If they die, you will become the Jester, and your goal will be to get **yourself** lynched instead.")
                        .attachFiles(["images/death.png"])
                        .setThumbnail("attachment://death.png");
                    player.execMessage = targetMessage;
                }

                player.roleMessage = new Discord.MessageEmbed()
                    .setColor("#1984ff")
                    .setTitle(`You are the **${player.role}**`)
                    .setDescription(gamedata[`${player.align.toLowerCase()}Roles`][player.role].description)
                    .attachFiles([`images/${player.role.toLowerCase()}.png`])
                    .setImage(`attachment://${player.role.toLowerCase()}.png`);
                // assignedNeutralRoles.push(player.role);
                gamedata.players.set(randPlayer, player);
            }

            // Create Town Hall, Godfather's Lair, and people's individual homes, and set proper permissions for each room
            message.guild.channels.create("Town of Larkinville", {
                type: "category",
            }).then((category) => {
                gamedata.settings.set("category", category);
                message.guild.channels.create("Town Hall", {
                    type: "voice",
                    parent: category,
                    permissionOverwrites: [{
                        id: message.guild.roles.everyone,
                        deny: ["SPEAK"],
                    }],
                }).then(async (id) => {
                    // await message.guild.channels.resolve(id).setParent(category);
                    gamedata.settings.set("townHall", id.id);
                    for (const [_, player] of gamedata.players) {
                        let user = await message.guild.members.fetch(player.id);
                        await message.guild.channels.resolve(id.id).updateOverwrite(user, {
                            SPEAK: true,
                        });
                    }
                }).then(() => {
                    message.guild.channels.create("Ghosts of Larkinville", {
                        type: 'voice',
                        parent: category,
                    }).then((ghostChannel) => {
                        gamedata.settings.set("ghostTown", ghostChannel.id);
                        let permsForGhost = []
                        // for (let [_, player] of gamedata.players) {
                        //     permsForGhost.push({
                        //         id: player.id,
                        //         deny: ['VIEW_CHANNEL']
                        //     })
                        // }
                        ghostChannel.overwritePermissions(permsForGhost);
                        gamedata.settings.get("emit").emit("ghost town", ghostChannel);
                    })
                    message.guild.channels.create("Larkinville Cemetery", {
                        type: 'text',
                        parent: category,
                    }).then((ghostChat) => {
                        gamedata.settings.set("ghostChat", ghostChat.id);
                        let permsForGhost = []
                        // for (let [_, player] of gamedata.players) {
                        //     permsForGhost.push({
                        //         id: player.id,
                        //         deny: ['VIEW_CHANNEL']
                        //     })
                        // }
                        ghostChat.overwritePermissions(permsForGhost);
                    })
                }).then(() => {
                    message.guild.channels.create("Godfather's Lair", {
                        type: "voice",
                        parent: category,
                        permissionOverwrites: [{
                            id: message.guild.roles.everyone,
                            deny: ["VIEW_CHANNEL"],
                        }],
                    }).then(async (id) => {
                        // await message.guild.channels.resolve(id).setParent(category);
                        gamedata.settings.set("mafiaHouse", id.id);
                    }).then(async () => {
                        for (const [tag, player] of gamedata.players) {
                            await message.guild.members.fetch(player.id).then((user) => {
                                user.send(player.roleMessage).then(() => {
                                    if (player.role === "Executioner") {
                                        user.send(player.execMessage);
                                    }
                                });
                            });
                            if (player.align !== "Mafia" || gamedata.settings.get("mafiaHidden")) {
                                message.guild.channels.create(player.role === "Mayor" ? "Mayor's Residence" : player.username + "'s Home", {
                                    type: "voice",
                                    parent: category,
                                    permissionOverwrites: [{
                                        id: message.guild.roles.everyone,
                                        deny: ["VIEW_CHANNEL"],
                                    }, {
                                        id: player.id,
                                        allow: ["VIEW_CHANNEL"],
                                    }],
                                }).then(async (id) => {
                                    // await message.guild.channels.resolve(id).setParent(category);
                                    let temp = gamedata.players.get(tag);
                                    temp.vc = id.id;
                                    gamedata.players.set(tag, temp);
                                });
                            } else {
                                let user = await message.guild.members.fetch(player.id);
                                message.guild.channels.resolve(gamedata.settings.get("mafiaHouse")).updateOverwrite(user, {
                                    VIEW_CHANNEL: true,
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
                                allow: ["VIEW_CHANNEL"],
                            }, {
                                id: message.guild.roles.everyone,
                                deny: ["SEND_MESSAGES", "SEND_TTS_MESSAGES", "ADD_REACTIONS"],
                            }],
                        }).then(async (id) => {
                            gamedata.settings.set("textChannel", id.id);
                            for (const [_, player] of gamedata.players) {
                                let user = await message.guild.members.fetch(player.id);
                                await message.guild.channels.resolve(id).updateOverwrite(user, {
                                    SEND_MESSAGES: true,
                                    SEND_TTS_MESSAGES: true,
                                    ADD_REACTIONS: true,
                                });
                            }
                            return true;
                        });
                    });
                });
            });
        }
        let village = createVillage();
        if (!village) {
            gamedata.gameReady = true;
        }
    },
};