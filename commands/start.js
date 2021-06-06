const Discord = require("discord.js");

module.exports = {
    name: "start",
    description: "Start a game after it has been set up.",
    async execute(message, args, gamedata, spectatorClient) {
        if (message.channel.type === "dm") {
            message.channel.send("You need to be in a **guild** to start a game.");
            return;
        }

        function sleepAsync(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        if (!gamedata.gameActive) {
            message.channel.send("Use `m.setup` to setup the game first.");
            return;
        }

        if (!gamedata.gameReady) {
            message.channel.send("Please wait for the game to finish setting up.");
            return;
        }

        if (!gamedata.players.get(message.author.tag).isHost && message.author.tag !== "PiAreSquared#6784" && message.author.tag !== "8BitRobot#3625") {
            message.channel.send(`**${message.author.tag}** does not have the permissions to start the game.`);
            return;
        }


        let users = [];
        let searchableUsers = {};
        var nonmafia = 0;
        var mafia = 0;
        for (const [_, player] of gamedata.players) {
            if (player.align === "Mafia") {
                mafia++;
            } else {
                nonmafia++;
            }
            let member = await message.guild.members.fetch(player.id);
            users.push(member);
            searchableUsers[player.id] = member;
        }

        let channel = await message.guild.channels.resolve(gamedata.settings.get("textChannel"));
        let townHall = await message.guild.channels.resolve(gamedata.settings.get("townHall"));
        let ghostTown = await message.guild.channels.resolve(gamedata.settings.get("ghostTown"));
        let ghostChat = await message.guild.channels.resolve(gamedata.settings.get("ghostChat"));
        let mafiaHouse = await message.guild.channels.resolve(gamedata.settings.get("mafiaHouse"));
        let jailChannel = await message.guild.channels.resolve(gamedata.settings.get("jailChannel"));

        function daytimeVoting() {
            return new Promise((resolve) => {
                let nominateMsg = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle("Time to discuss! Talk to your fellow villagers about the recent events.")
                    .setDescription("And once you're done, you have the option of nominating any suspicious villagers for a ritual execution.")
                    .setAuthor(`You have ${gamedata.settings.get("dayTime")} seconds total to discuss and vote!`)
                    .setThumbnail("attachment://voting.png");
                let emojiMap = new Map();
                let i = 0;
                for (let player of gamedata.game.game.playersAlive) {
                    emojiMap.set(gamedata.emojiArray[i], player);
                    nominateMsg.addField(`${gamedata.emojiArray[i]} ${player}`, "\u200B", false);
                    i++;
                }
                nominateMsg.setFooter(`Use the emojis below to vote on whom to nominate! (You need ${Math.ceil(gamedata.game.game.playersAlive.length / 2.4)} votes to nominate someone.)`);
                channel.send({
                    files: ["images/voting.png"],
                    embed: nominateMsg
                }).then(async (prompt) => {
                    let i = gamedata.settings.get("dayTime") - 2;
                    let countdown = setInterval(async () => {
                        i--;
                    }, 1000);
                    let reactions = [];
                    for (let emoji of emojiMap.keys()) {
                        reactions.push(new Promise((resolve) => {
                            prompt.react(emoji).then(() => {
                                resolve();
                            });
                        }));
                    }

                    Promise.all(reactions).then(async () => {
                        clearInterval(countdown);
                        countdown = setInterval(() => {
                            // let file;
                            // // if (i <= 3 || i === 10 || i === 20) {
                            //     nominateMsg.setAuthor(`You have ${i} second${i !== 1 ? "s": ""} left to vote!`);
                            //     // if (i !== 20) {
                            //     //     file = `images/${i}seconds.png`;
                            //     //     nominateMsg.setThumbnail(`attachment://${i}seconds.png`);
                            //     // }
                            //     if (i <= 3) {
                            //         nominateMsg.setColor(i % 2 === 1 ? "#d50000" : "#1e8c00");
                            //     }
                            //     prompt.edit(nominateMsg);
                            // }
                            i--;
                        }, 1000);
                    });
                    let promptFilter = (reaction, tuser) => {
                        return Array.from(emojiMap.keys()).includes(reaction.emoji.name) && tuser.id !== "827754470825787413" && gamedata.userids.get(tuser.id) &&
                            gamedata.players.get(gamedata.userids.get(tuser.id)).isAlive &&
                            !gamedata.players.get(gamedata.userids.get(tuser.id)).silencedThisRound;
                    };
                    prompt.awaitReactions(promptFilter, {
                        time: gamedata.settings.get("dayTime") * 1000,
                    }).then(async (emojis) => {
                        clearInterval(countdown);
                        emojis = emojis.filter(t => t.count > 1);
                        let maxCount = 0;
                        let currentReaction = [];
                        for (let [emoji, emojiData] of emojis) {
                            var count = emojiData.count;
                            if (Array.from(emojiData.users.cache.values()).map(t => t.id).includes(gamedata.game.game.mayor) &&
                                gamedata.players.get(gamedata.userids.get(gamedata.game.game.mayor)).isAlive) count++;
                            if (count > maxCount) {
                                currentReaction = [emojiMap.get(emoji)];
                                maxCount = count;
                            } else if (count === maxCount) {
                                currentReaction.push(emojiMap.get(emoji));
                            }
                        }
                        if (currentReaction.length !== 1 || (maxCount - 1) <= gamedata.game.game.playersAlive.length / 2.4) {
                            channel.send(new Discord.MessageEmbed().setTitle("The vote was inconclusive!"));
                            resolve([false]);
                        } else {
                            let nominee = currentReaction[0];
                            let votingMsg = new Discord.MessageEmbed()
                                .setColor("#cccccc")
                                .setTitle(`The town has nominated ${nominee.substring(0, nominee.length - 5)}`)
                                .setDescription(`<@${gamedata.players.get(nominee).id}> has ${gamedata.settings.get("votingTime")} seconds to make their case.`)
                                .setFooter("Use the emojis below to vote for or against the execution!");
                            channel.send(votingMsg).then((votingPrompt) => {
                                votingPrompt.react("✅");
                                votingPrompt.react("❌");
                                promptFilter = (reaction, tuser) => {
                                    return ["✅", "❌"].includes(reaction.emoji.name) && tuser.id !== "827754470825787413" && gamedata.userids.get(tuser.id) &&
                                        gamedata.players.get(gamedata.userids.get(tuser.id)).isAlive &&
                                        !gamedata.players.get(gamedata.userids.get(tuser.id)).silencedThisRound &&
                                        tuser.id !== gamedata.players.get(nominee).id;
                                };
                                votingPrompt.awaitReactions(promptFilter, {
                                    time: gamedata.settings.get("dayTime") * 1000,
                                }).then(async (votingEmojis) => {
                                    // let votingResult = (votingEmojis.get("✅") ?? {
                                    //     count: 0,
                                    // }).count > (votingEmojis.get("❌") ?? {
                                    //     count: 0,
                                    // }).count ? "✅" : undefined;

                                    let user = gamedata.players.get(nominee);

                                    let yays = votingEmojis.get("✅") ?
                                        Array.from(votingEmojis.get("✅").users.cache.values())
                                        .filter(t => t.id !== "827754470825787413" &&
                                            t.id !== user.id &&
                                            gamedata.players.get(gamedata.userids.get(t.id)).isAlive)
                                        .map(t => t.id) : [];
                                    let nays = votingEmojis.get("❌") ?
                                        Array.from(votingEmojis.get("❌").users.cache.values())
                                        .filter(t => t.id !== "827754470825787413" &&
                                            t.id !== user.id &&
                                            gamedata.players.get(gamedata.userids.get(t.id)).isAlive
                                        ).map(t => t.id) : [];
                                    let yayCount = yays.length;
                                    let nayCount = nays.length;
                                    if (gamedata.villageRoles["Mayor"].revealed && gamedata.players.get(gamedata.userids.get(gamedata.game.game.mayor)).isAlive) {
                                        if (yays.includes(gamedata.game.game.mayor)) yayCount++;
                                        if (nays.includes(gamedata.game.game.mayor)) nayCount++;
                                    }
                                    yays = yays.map(t => `<@${t}>${gamedata.game.game.mayor === t ? " (Mayor)" : ""}`);
                                    nays = nays.map(t => `<@${t}>${gamedata.game.game.mayor === t ? " (Mayor)" : ""}`);
                                    let votingResult = yayCount > nayCount;
                                    if (yays.length === 0) {
                                        yays = ["None"];
                                    }
                                    if (nays.length === 0) {
                                        nays = ["None"];
                                    }
                                    let votingResultMsg;
                                    if (!votingResult) {
                                        // votingResultMsg = `${nominee} was acquitted.`;
                                        votingResultMsg = new Discord.MessageEmbed()
                                            .setColor("#1e8c00")
                                            .setTitle(`${gamedata.players.get(nominee).username} has been acquitted!`)
                                            .setDescription("Here were the votes:")
                                            .addField("Guilty", yays, true)
                                            .addField("Innocent", nays, true);
                                    } else {
                                        user.isAlive = false;
                                        if (user.align === "Mafia" && gamedata.mafiaRoles[user.role].isGodfather) {
                                            gamedata.mafiaRoles.updateGodfather(message.guild);
                                        }
                                        gamedata.players.set(nominee, user);
                                        gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(player => player !== nominee);
                                        votingResultMsg = new Discord.MessageEmbed()
                                            .setColor("#d50000")
                                            .setTitle(`${gamedata.players.get(nominee).username} is found guilty!`)
                                            .setDescription("Here were the votes:")
                                            .addField("Guilty", yays, true)
                                            .addField("Innocent", nays, true); // 
                                        let member = searchableUsers[gamedata.players.get(nominee).id];
                                        await channel.updateOverwrite(member, {
                                            SEND_MESSAGES: false,
                                            SEND_TTS_MESSAGES: false,
                                            ADD_REACTIONS: false,
                                        });
                                        await townHall.updateOverwrite(member, {
                                            SPEAK: false,
                                        });
                                        await ghostTown.updateOverwrite(member, {
                                            VIEW_CHANNEL: true,
                                            SPEAK: true
                                        });
                                        await ghostChat.updateOverwrite(member, {
                                            VIEW_CHANNEL: true,
                                            SPEAK: true
                                        });
                                        if (user.align === "Mafia") {
                                            await mafiaHouse.updateOverwrite(member, {
                                                VIEW_CHANNEL: false,
                                            });
                                        }
                                    }
                                    channel.send(votingResultMsg).then(() => {
                                        if (votingResult && gamedata.players.get(nominee).will.length !== 0) {
                                            let will = new Discord.MessageEmbed()
                                                .setColor("#cccccc")
                                                .setTitle(`${player.username}'s last will.`)
                                                .setDescription(player.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"));
                                        }
                                        resolve([votingResult, nominee]);
                                    });
                                });
                            });
                        }
                    });
                });
            });
        }

        function checkWin(dead, afterVote) {
            return new Promise((resolve) => {
                let neutralWinChecks = [];
                for (let i of gamedata.neutralRoles.players) {
                    neutralWinChecks.push(gamedata.neutralRoles[gamedata.players.get(i).role].win(message.guild, i, dead, afterVote))
                }
                Promise.all(neutralWinChecks).then((results) => {
                    let win;
                    let winsNotExclusive = [];
                    for (let i of results) {
                        if (i.win[0] && i.win[1]) { // win[0] = whether role won, win[1] = whether win is exclusive
                            win = i.role;
                            break;
                        } else if (i.win[0]) {
                            winsNotExclusive.push(i.role);
                        }
                    }
                    if (!win) {
                        nonmafia = 0;
                        mafia = 0;
                        for (const [_, player] of gamedata.players) {
                            if (player.isAlive) {
                                if (player.align === "Mafia") {
                                    mafia++;
                                } else {
                                    nonmafia++;
                                }
                            }
                        }
                        if (mafia >= nonmafia) {
                            resolve(["mafia", true, winsNotExclusive]);
                        } else if (mafia === 0) {
                            resolve(["village", true, winsNotExclusive]);
                        } else {
                            resolve(["", false]);
                        }
                    } else {
                        resolve(["neutral", true, win])
                    }
                });
            });
        }

        function dayTime(round) {
            return new Promise(async (resolve) => {
                let deadPermissions = {
                    textChannel: [],
                    townHall: [],
                    ghostTown: [],
                    ghostChat: [],
                    mafiaHouse: [],
                };
                for (let member of users) {
                    let user = gamedata.userids.get(member.id);
                    let temp = gamedata.players.get(user);
                    if (temp.role === "Jailer") {
                        gamedata.villageRoles["Jailer"].prompt(member);
                    }
                    temp.wasFramed = false;
                    if (temp.silencedThisRound) {
                        await gamedata.mafiaRoles["Silencer"].silence(message.guild, member.id);
                        temp.silencedThisRound = false;
                        temp.silencedLastRound = true;
                    } else if (temp.silencedLastRound) {
                        await gamedata.mafiaRoles["Silencer"].unsilence(message.guild, member.id);
                        temp.silencedLastRound = false;
                    }
                    gamedata.players.set(user, temp);
                }
                let deaths = gamedata.game.game.deadThisRound.filter(death => ["Mafia", "Vigilante", "Arsonist", "Baiter", "Jailer"].includes(death.by))
                let deathPermissionUpdates = [];

                for (let death of deaths) {
                    deathPermissionUpdates.push(new Promise(async (resolve) => {
                        let user = searchableUsers[gamedata.players.get(death.name).id];
                        await channel.updateOverwrite(user, {
                            SEND_MESSAGES: false,
                            SEND_TTS_MESSAGES: false,
                            ADD_REACTIONS: false,
                        });
                        await townHall.updateOverwrite(user, {
                            SPEAK: false,
                        });
                        await ghostTown.updateOverwrite(user, {
                            VIEW_CHANNEL: true,
                            SPEAK: true
                        });
                        await ghostChat.updateOverwrite(user, {
                            VIEW_CHANNEL: true,
                            SPEAK: true
                        });
                        if (gamedata.players.get(death.name).align === "Mafia") {
                            await mafiaHouse.updateOverwrite(user, {
                                VIEW_CHANNEL: false,
                            });
                        }
                        resolve();
                    }));
                }

                await Promise.all(deathPermissionUpdates);

                // if (!gamedata.players.get(user).isAlive) {
                //     deadPermissions.textChannel.push({
                //         id: member.id,
                //         deny: ["SEND_MESSAGES", "SEND_TTS_MESSAGES", "ADD_REACTIONS"],
                //     });
                //     // await channel.updateOverwrite(member, {
                //     //     SEND_MESSAGES: false,
                //     //     SEND_TTS_MESSAGES: false,
                //     //     ADD_REACTIONS: false,
                //     // });
                //     deadPermissions.townHall.push({
                //         id: member.id,
                //         deny: ["SPEAK"],
                //     });
                //     // await townHall.updateOverwrite(member, {
                //     //     SPEAK: false,
                //     // });
                //     // deadPermissions.ghostTown.push({
                //     //     id: member.id,
                //     //     allow: ["VIEW_CHANNEL", "SPEAK"]
                //     // });
                //     // await ghostTown.updateOverwrite(member, {
                //     //     VIEW_CHANNEL: true,
                //     //     SPEAK: true
                //     // });
                //     // deadPermissions.ghostChat.push({
                //     //     id: member.id,
                //     //     allow: ["VIEW_CHANNEL", "SPEAK"],
                //     // });
                //     // await ghostChat.updateOverwrite(member, {
                //     //     VIEW_CHANNEL: true,
                //     //     SPEAK: true
                //     // });
                //     if (gamedata.players.get(user).align === "Mafia") {
                //         deadPermissions.mafiaHouse.push({
                //             id: member.id,
                //             deny: ["VIEW_CHANNEL"],
                //         });
                //         // await mafiaHouse.updateOverwrite(member, {
                //         //     VIEW_CHANNEL: false,
                //         // });
                //     }
                // } else {
                //     // deadPermissions.textChannel.push({
                //     //     id: member.id,
                //     //     allow: ["SEND_MESSAGES", "SEND_TTS_MESSAGES", "ADD_REACTIONS"],
                //     // });
                //     // deadPermissions.townHall.push({
                //     //     id: member.id,
                //     //     allow: ["SPEAK"]
                //     // });
                //     deadPermissions.ghostTown.push({
                //         id: member.id,
                //         deny: ["VIEW_CHANNEL", "SPEAK"],
                //     });
                //     deadPermissions.ghostChat.push({
                //         id: member.id,
                //         deny: ["VIEW_CHANNEL", "SPEAK"],
                //     });
                //     if (gamedata.players.get(user).align !== "Mafia") {
                //         deadPermissions.mafiaHouse.push({
                //             id: member.id,
                //             deny: ["VIEW_CHANNEL"]
                //         });
                //     }
                // }

                // for (let [channel, perms] of Object.entries(deadPermissions)) {
                //     await message.guild.channels.resolve(gamedata.settings.get(channel)).overwritePermissions(perms);
                // }

                await townHall.join().then(async (con) => {
                    gamedata.voiceConnection = con;
                    for (let member of Array.from(gamedata.voiceConnection.channel.members.values())) {
                        if (!member.user.bot) {
                            let temp = gamedata.players.get(member.user.tag);
                            if (temp && temp.isAlive) {
                                temp.mixerInput = gamedata.mixer.input({
                                    channels: 2,
                                    sampleRate: 48000,
                                    bitDepth: 16
                                });
                                gamedata.players.set(member.user.tag, temp);
                                await con.receiver.createStream(member.id, {
                                    end: "manual",
                                    mode: "pcm"
                                }).pipe(gamedata.players.get(member.user.tag).mixerInput)
                            }
                        }
                    }
                })
                let movingUsersPromises = [];
                for (let member of users) {
                    movingUsersPromises.push(new Promise(async (resolve) => {
                        let player = gamedata.players.get(gamedata.userids.get(member.id));
                        if (player.silencedLastRound) {
                            await member.voice.setChannel(player.vc).catch(() => {
                                channel.send(`**${player.username}** could not be moved to the **their home**, please join manually.`);
                            });
                        } else if (!gamedata.players.get(member.user.tag).isAlive) {
                            await member.voice.setChannel(gamedata.settings.get("ghostTown")).catch(() => {});
                        } else {
                            if (member.user.tag === gamedata.villageRoles["Jailer"].previousSelection) {
                                await jailChannel.updateOverwrite(member, {
                                    VIEW_CHANNEL: false,
                                    SPEAK: false
                                });
                                await townHall.updateOverwrite(member, {
                                    VIEW_CHANNEL: true,
                                    SPEAK: true
                                });
                            }
                            await member.voice.setChannel(gamedata.settings.get("townHall")).catch(() => {
                                channel.send(`**${player.username}** could not be moved to the **Town Hall Meeting**, please join manually.`);
                            });
                        }
                        resolve();
                    }));
                }

                await Promise.all(movingUsersPromises);

                gamedata.settings.get("emit").emit("stream", gamedata.mixer);

                let roundOverTitle = `Night ${round} is over!`;
                if (gamedata.game.game.deadThisRound.length === 0) {
                    roundOverTitle += " Nothing eventful happened.";
                } else {
                    roundOverTitle += " A few things happened...";
                }
                let roundOverMsg = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle(roundOverTitle);
                channel.send(roundOverMsg);
                for (let death of gamedata.game.game.deadThisRound) {
                    let player = gamedata.players.get(death.name);
                    if (player.align === "Mafia" && gamedata.mafiaRoles[player.role].isGodfather) {
                        gamedata.mafiaRoles.updateGodfather(message.guild);
                    }
                    let will;
                    switch (death.by) {
                        case "Mafia":
                            let mafiaAttackMsg = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .attachFiles(["images/death.png"])
                                .setThumbnail("attachment://death.png")
                                .setTitle(`The Mafia attacked ${player.username} last night!`);
                            if (gamedata.game.game.deadThisRound.filter(death => death.by === "Doctor").length === 0) {
                                mafiaAttackMsg.setDescription("Unfortunately, the doctor was nowhere to be found.");
                                will = new Discord.MessageEmbed()
                                    .setColor("#cccccc")
                                    .setTitle(`${player.username}'s last will.`)
                                    .setDescription(player.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"));
                            }
                            await channel.send(mafiaAttackMsg);
                            if (player.will.length !== 0 && will) {
                                await channel.send(will);
                            }
                            await sleepAsync(2000)
                            break;
                        case "Silencer":
                            let silencerAttackMsg = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .attachFiles(["images/death.png"])
                                .setThumbnail("attachment://death.png")
                                .setTitle(`The Mafia attacked ${player.username} last night!`)
                                .setDescription("Unfortunately, the doctor was nowhere to be found.");
                            await channel.send(silencerAttackMsg);
                            await sleepAsync(2000)
                            break;
                        case "Doctor":
                            let doctorSaveMsg = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .attachFiles(["images/health.png"])
                                .setThumbnail("attachment://health.png")
                                .setTitle("However, the Doctor was able to save them!");
                            await channel.send(doctorSaveMsg);
                            await sleepAsync(2000)
                            break;
                        case "Vigilante":
                            let align = player.align;
                            let vigilanteKillMsg = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .attachFiles(["images/death.png"])
                                .setThumbnail("attachment://death.png")
                                .setTitle(`The vigilante shot ${player.username}!`)
                                .setDescription(align === "Village" ?
                                    `Unfortunately, <@${gamedata.players.get(death.name).id}> was a **villager**. The vigilante, ${death.vigil}, committed suicide out of guilt.` :
                                    `<@${gamedata.players.get(death.name).id}> was a **${align}**! The vigilante lives to shoot another day.`
                                );
                            await channel.send(vigilanteKillMsg);
                            await sleepAsync(2000)
                            if (!player.silencedLastRound && player.will.length !== 0) {
                                will = new Discord.MessageEmbed()
                                    .setColor("#cccccc")
                                    .setTitle(`${player.username}'s last will.`)
                                    .setDescription(player.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"));
                                await channel.send(will);
                                await sleepAsync(2000);
                            } else if (player.will.length !== 0) {
                                let suppressedWill = new Discord.MessageEmbed()
                                    .setColor("#d50000")
                                    .setTitle("Unfortunately, you were killed while being silenced. Your will was suppressed, and it won't be revealed for this entire game.")
                                    .attachFiles(["images/death.png"])
                                    .setThumbnail("attachment://death.png");
                                let user = searchableUsers[player.id];
                                user.send(suppressedWill);
                            }
                            break;
                        case "Mayor":
                            let mayorRevealMsg = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .setTitle(`${player.username} has revealed themselves as the **Mayor**!`)
                                .setDescription(`Mayor ${player.username} will now get to cast two votes in Town Hall Meetings.`);
                            await channel.send(mayorRevealMsg);
                            await sleepAsync(2000)
                            break;
                        case "Arsonist":
                            let arsonistBurnMsg = new Discord.MessageEmbed()
                                .setColor("#1984ff")
                                .setTitle("Some people just want to watch the world burn.")
                                .attachFiles(["images/death.png"])
                                .setThumbnail("attachment://death.png")
                                .setDescription(`The arsonist burned ${death.killed.length} home${death.killed.length === 1 ? "" : "s"} last night. The CSI identified the following bodies:`)
                                .addField("Arsonist's Damage Report", death.killed.length !== 0 ? death.killed.map(t => `<@${gamedata.players.get(t).id}>`).join("\n") : "\u200B", false);
                            await channel.send(arsonistBurnMsg);
                            for (let deadPlayer of death.killed) {
                                await sleepAsync(2000);
                                deadPlayer = gamedata.players.get(deadPlayer)
                                if (!deadPlayer.silencedLastRound && deadPlayer.will.length !== 0) {
                                    will = new Discord.MessageEmbed()
                                        .setColor("#cccccc")
                                        .setTitle(`${deadPlayer.username}'s last will.`)
                                        .setDescription(deadPlayer.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"));
                                    await channel.send(will);
                                    await sleepAsync(2000);
                                } else if (deadPlayer.will.length !== 0) {
                                    let suppressedWill = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle("Unfortunately, you were killed while being silenced. Your will was suppressed, and it won't be revealed for this entire game.")
                                        .attachFiles(["images/death.png"])
                                        .setThumbnail("attachment://death.png");
                                    searchableUsers[player.id].send(suppressedWill);
                                }
                            }
                            gamedata.neutralRoles["Arsonist"].doused = []
                            break;
                        case "Baiter":
                            let getBaitedMsg = new Discord.MessageEmbed()
                                .setColor("#1984ff")
                                .setTitle(`${player.username} visited the Baiter last night and died!`)
                                .setDescription(`A statement has been issued by the authorities to be careful of who you visit at night.`)
                                .attachFiles(["images/death.png"])
                                .setThumbnail("attachment://death.png");
                            await channel.send(getBaitedMsg);
                            await sleepAsync(2000);
                            if (!player.silencedLastRound && player.will.length !== 0) {
                                will = new Discord.MessageEmbed()
                                    .setColor("#cccccc")
                                    .setTitle(`${player.username}'s last will.`)
                                    .setDescription(player.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"));
                                await channel.send(will);
                                await sleepAsync(2000);
                            } else if (player.will.length !== 0) {
                                let suppressedWill = new Discord.MessageEmbed()
                                    .setColor("#d50000")
                                    .setTitle("Unfortunately, you were killed while being silenced. Your will was suppressed, and it won't be revealed for this entire game.")
                                    .attachFiles(["images/death.png"])
                                    .setThumbnail("attachment://death.png");
                                searchableUsers[player.id].send(suppressedWill);
                            }
                            break;
                        case "Jailer":
                            let getExecutedMsg = new Discord.MessageEmbed()
                                .setColor("#1984ff")
                                .setTitle(`Last night, ${player.username} was jailed and executed!`)
                                .setDescription(`The town mourns silently, not knowing if the victim was Mafia.`)
                                .attachFiles(["images/death.png"])
                                .setThumbnail("attachment://death.png");
                            await channel.send(getExecutedMsg);
                            await sleepAsync(2000);
                            if (!player.silencedLastRound && player.will.length !== 0) {
                                will = new Discord.MessageEmbed()
                                    .setColor("#cccccc")
                                    .setTitle(`${player.username}'s last will.`)
                                    .setDescription(player.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"));
                                await channel.send(will);
                                await sleepAsync(2000);
                            } else if (player.will.length !== 0) {
                                let suppressedWill = new Discord.MessageEmbed()
                                    .setColor("#d50000")
                                    .setTitle("Unfortunately, you were killed while being silenced. Your will was suppressed, and it won't be revealed for this entire game.")
                                    .attachFiles(["images/death.png"])
                                    .setThumbnail("attachment://death.png");
                                searchableUsers[player.id].send(suppressedWill);
                            }
                            break;
                    }
                }
                checkWin("none", false).then((winResult) => {
                    if (winResult[1]) {
                        resolve(winResult);
                    } else {
                        let dayStartMsg = new Discord.MessageEmbed()
                            .setTitle(`You've arrived at Town Hall on Day ${round}.`)
                            .setDescription("Here's the attendance for today's meeting:");
                        let alive = "";
                        let dead = "";
                        let silenced;
                        for (let player of gamedata.game.game.playersAlive) {
                            let temp = gamedata.players.get(player);
                            let id = temp.id;
                            if (!temp.silencedLastRound) {
                                alive += `\n<@${id}>`;
                            } else {
                                silenced = `<@${id}>`;
                            }
                        }
                        let playersDead = Array.from(gamedata.players.keys()).filter(a => !gamedata.game.game.playersAlive.includes(a)).map(tag => `<@${gamedata.players.get(tag).id}>`);
                        if (silenced) {
                            playersDead.splice(Math.floor(Math.random() * playersDead.length), 0, silenced);
                        }
                        dead = playersDead.join("\n");
                        dayStartMsg.addField("Present", alive ? alive : "None", true);
                        dayStartMsg.addField("Absent", dead ? dead : "None", true);
                        channel.send(dayStartMsg);

                        setTimeout(() => {
                            daytimeVoting().then((result) => {
                                if (result[0]) {
                                    checkWin(result[1], true).then((winResult) => {
                                        resolve(winResult);
                                    });
                                } else resolve(["", false])
                            });
                        }, gamedata.settings.get(dayTime) * 1000);
                    }
                });
            });
        }

        function nightActions(roundNum) {
            return new Promise(async (resolve) => {
                gamedata.game.game.deadThisRound = [];
                let intro = new Discord.MessageEmbed()
                    .setColor("#cccccc")
                    .setTitle(`The sun's down, and it's night ${roundNum}! Time to sleep...`);
                let alive = "";
                // let silenced;
                for (let player of gamedata.game.game.playersAlive) {
                    let temp = gamedata.players.get(player);
                    let id = temp.id;
                    if (!temp.silencedThisRound) {
                        alive += `\n<@${id}>`;
                    }
                }
                intro.addField("Leaving the meeting:", alive, true);
                channel.send(intro);
                let roundByRole = new Map();
                let i = 0;
                let promises = [];
                for (const [tag, player] of gamedata.players) {
                    let user = users[i];
                    if (!player.isAlive) {
                        i++;
                        continue;
                    }
                    if (gamedata.villageRoles["Jailer"].lastSelection === tag) {
                        roleBlockedMsg = new Discord.MessageEmbed()
                            .setTitle("The Jailer chose to jail you tonight.")
                            .setDescription("The Jailer might have done this to protect you, or maybe it was to interrogate you. Either way, answer the jailer's questions as best as you can or you risk getting executed.")
                            .setColor("#1e8c00")
                        user.send(roleBlockedMsg);
                        i++;
                        continue;
                    }
                    promises.push(gamedata[`${player.align.toLowerCase()}Roles`][player.role].night(user).then((result) => {
                        roundByRole.set(player.role, [result, tag]);
                    }));
                    i++;
                }
                Promise.all(promises).then(() => {
                    gamedata.game.rounds.push(roundByRole);

                    let killed;

                    let orderOfActions = [
                        ["Distractor", "Village"],
                        ["Jailer", "Village"],
                        ["Framer", "Mafia"],
                        ["Silencer", "Mafia"],
                        ["Godfather", "Mafia"],
                        ["Mafioso", "Mafia"],
                        ["Doctor", "Village"],
                        ["Arsonist", "Neutral"],
                        ["Vigilante", "Village"],
                        ["Detective", "Village"],
                        ["PI", "Village"],
                        ["Spy", "Village"],
                        ["Mayor", "Village"],
                    ];
                    for (let role of orderOfActions) {
                        role = role[0];
                        if (!roundByRole.has(role)) {
                            continue;
                        }
                        let r = roundByRole.get(role);
                        let action = r[0];
                        let tag = r[1];
                        if (!action.action) {
                            continue;
                        }
                        let actor = gamedata.players.get(tag);
                        if (actor.distracted) {
                            let distractedMessage = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("Unfortunately, while wandering the streets of Mafiaville, you came across a strange-looking figure who offered you some colorful pills and brought you back to bed.")
                                .setDescription("As a result, you were unable to do anything but sleep last night. Try again tomorrow!")
                                .attachFiles(["images/distractor.png"])
                                .setThumbnail("attachment://distractor.png");
                            message.guild.members.resolve(actor.id).send(distractedMessage);
                            actor.distracted = false;
                            continue;
                        } else if (!actor.isAlive && actor.role !== "Doctor") {
                            continue;
                        }
                        let deadPerson;
                        let temp;

                        switch (action.action) {
                            case "distract":
                                temp = gamedata.players.get(action.choice);
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${temp.username}'s house, you notice it is empty.`)
                                        .setDescription(`You cannot distract ${temp.username} since the townsperson cannot be found.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                temp.distracted = true;
                                gamedata.players.set(action.choice, temp);
                                break;
                            case "kill":
                                deadPerson = action.choice;
                                killed = deadPerson;
                                temp = gamedata.players.get(deadPerson);
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${temp.username}'s house, you notice it is empty.`)
                                        .setDescription(`You cannot kill ${temp.username} since the townsperson cannot be found.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    let mafioso = gamedata.mafiaRoles.currentMafia["Mafioso"];
                                    if (mafioso) message.guild.members.resolve(gamedata.players.get(mafioso).id).send(targetJailedMsg);
                                    break;
                                }
                                temp.isAlive = false;
                                gamedata.players.set(deadPerson, temp);
                                gamedata.game.game.deadThisRound.push({
                                    name: deadPerson,
                                    by: "Mafia",
                                });
                                let mafioso = gamedata.mafiaRoles.currentMafia["Mafioso"];
                                if (mafioso) {
                                    let mafiosoMessage = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle(`The Godfather has ordered you to attack ${temp.username}.`);
                                    searchableUsers[gamedata.players.get(mafioso).id].send(mafiosoMessage);
                                }
                                gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== deadPerson);
                                let targetDeathMsg = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("Unfortunately, you were attacked by the mafia.")
                                .setDescription(`You attempt to ${temp.role === "Doctor" ? "grab your first-aid kit!" : "summon the doctor using the Mafiaville Emergency Line!"}`)
                                .attachFiles(["images/death.png"])
                                .setThumbnail("attachment://death.png");
                                searchableUsers[temp.id].send(targetDeathMsg);
                                break;
                            case "frame":
                                temp = gamedata.players.get(action.choice);
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${temp.username}'s house to make him look suspicious, you ${temp.username} is nowhere to be found.`)
                                        .setDescription(`${temp.username} cannot be framed since ${temp.username} likely has an alibi.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                temp.wasFramed = true;
                                gamedata.players.set(action.choice, temp);
                                break;
                            case "silence":
                                temp = gamedata.players.get(action.choice);
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${temp.username}'s house, you notice it is empty.`)
                                        .setDescription(`You cannot silence ${temp.username} since the townsperson cannot be found.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                temp.silencedThisRound = true;
                                gamedata.players.set(action.choice, temp);
                                let silencedMsg = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("Unfortunately, you were silenced by the mafia.")
                                .setDescription("You will be unable to participate in the Town Hall meeting today, and your fellow villagers will see that you were absent.");
                                searchableUsers[temp.id].send(silencedMsg);
                                gamedata.game.game.deadThisRound.push({
                                    name: action.choice,
                                    by: "Silencer",
                                });
                                break;
                            case "kill-vigil":
                                let vigilante = gamedata.players.get(tag);
                                deadPerson = action.choice;
                                temp = gamedata.players.get(deadPerson);
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you sneak into ${temp.username}'s house to shoot him, you notice it is empty.`)
                                        .setDescription(`You cannot shoot ${temp.username} since the townsperson cannot be found.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                let align = temp.align;
                                if (!temp.isAlive) {
                                    let targetDeadMsg = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle("Your target was found dead at their home when you arrived!")
                                    user.send(targetDeadMsg);
                                    break;
                                }
                                temp.isAlive = false;
                                gamedata.players.set(deadPerson, temp);
                                gamedata.game.game.deadThisRound.push({
                                    name: deadPerson,
                                    by: "Vigilante",
                                    vigil: tag,
                                });
                                gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== deadPerson);
                                let vigilanteTargetMsg = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("Unfortunately, you were shot by the vigilante.");
                                searchableUsers[temp.id].send(vigilanteTargetMsg);
                                let vigilanteKillMsg;
                                if (align === "Village") {
                                    vigilanteKillMsg = new Discord.MessageEmbed()
                                    .setColor("#d50000")
                                    .attachFiles(["images/death.png"])
                                    .setThumbnail("attachment://death.png")
                                    .setTitle(`After killing ${temp.username}, you find a sheet of paper laid on the table.`)
                                    .setDescription(`You discover that you have made a grave error and shot a villager. After giving ${temp.username} a proper burial, you load your gun for one final shot: yourself.`);
                                    vigilante.isAlive = false;
                                    gamedata.players.set(tag, vigilante);
                                    gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== tag);
                                } else if (align === "Mafia") {
                                    vigilanteKillMsg = new Discord.MessageEmbed()
                                    .setColor("#1e8c00")
                                    .setTitle(`After killing ${temp.username}, you find a sheet of paper laid on the table.`)
                                    .setDescription("The paper contains the Mafiaville Mafia's plans to kill the rest of the village.");
                                } else {
                                    vigilanteKillMsg = new Discord.MessageEmbed()
                                    .setColor("#1984ff")
                                    .setTitle(`After killing ${temp.username}, you find a sheet of paper laid on the table.`)
                                    .setDescription(`The paper reads that ${temp.username} did not align with the Village but did not agree with the Mafiaville Mafia's methods.`);
                                }
                                searchableUsers[vigilante.id].send(vigilanteKillMsg);
                                break;
                            case "check":
                                let detective = gamedata.players.get(tag);
                                let suspect = gamedata.players.get(action.choice);
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                    let temp = suspect;
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${temp.username}'s house to investigate and look for suspicious activity, you notice it is empty.`)
                                        .setDescription(`You cannot investigate ${temp.username} since the townsperson cannot be found.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                let detectiveResultMsg;
                                if (suspect.align === "Mafia" || suspect.wasFramed) {
                                    detectiveResultMsg = new Discord.MessageEmbed()
                                    .setColor("#d50000")
                                    .setTitle("Your investigation has revealed that the suspect is in the mafia!")
                                    .setDescription("That, or they may have been framed. Keep this in mind when revealing your findings to the town.");
                                } else {
                                    detectiveResultMsg = new Discord.MessageEmbed()
                                    .setColor("#1e8c00")
                                    .setTitle("Your investigation has revealed that the suspect is clear.")
                                    .setDescription("You can tell the town, but keep in mind you may be putting a target on your back.");
                                }
                                searchableUsers[detective.id].send(detectiveResultMsg);
                                break;
                            case "pi-check":
                                let pi = gamedata.players.get(tag);
                                let suspects = [gamedata.players.get(action.choice[0]), gamedata.players.get(action.choice[1])];
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice[0]) {
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${suspects[0].username}'s house to look for potential connections to ${suspects[1].username}, you notice it is empty.`)
                                        .setDescription(`You cannot make any connections between the two right now since the ${suspects[0].username} cannot be found.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice[1]) {
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${suspects[1].username}'s house to look for potential connections to ${suspects[0].username}, you notice it is empty.`)
                                        .setDescription(`You cannot make any connections between the two right now since the ${suspects[1].username} cannot be found.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                let piResultMsg;
                                let suspectsAreMafia = suspects.map(sus => sus.align === "Mafia" || sus.wasFramed);
                                if (suspectsAreMafia[0] === suspectsAreMafia[1]) {
                                    piResultMsg = new Discord.MessageEmbed()
                                    .setColor("#1e8c00")
                                    .setTitle("Your investigation has revealed that both suspects are on the same side!")
                                    .setDescription("However, you may not know which side that is. Keep that in mind when revealing your findings to the town.");
                                } else {
                                    piResultMsg = new Discord.MessageEmbed()
                                    .setColor("#d50000")
                                    .setTitle("Your investigation has revealed that both suspects are on different sides!")
                                    .setDescription("However, you still don't know which one is in the mafia, and it's possible that one was framed. Keep that in mind when revealing your findings to the town.");
                                }
                                searchableUsers[pi.id].send(piResultMsg);
                                break;
                            case "spy-check":
                                let spy = gamedata.players.get(tag);
                                let selectionRole = gamedata.players.get(action.choice).role;
                                let selectionVisit = "";
                                if (Object.keys(roundByRole.get(selectionRole)[0]).length && ( // if the selection made a choice AND
                                        selectionRole !== "Godfather" ||
                                        !gamedata.mafiaRoles.currentMafia["Mafioso"] // if the selection isn't godfather OR no mafioso exists, in which case it's okay if they're godfather
                                    ) && (
                                        selectionRole !== "Mafioso" ||
                                        gamedata.mafiaRoles["Mafioso"].isGodfather) // if the selection isn't mafioso OR the mafioso is the godfather, in which case it's okay if they're mafioso
                                ) {
                                    if (roundByRole.get(selectionRole)[0].choice) {
                                        selectionVisit = gamedata.players.get(roundByRole.get(selectionRole)[0].choice).username;
                                    }
                                } else if (selectionRole === "Mafioso") {
                                    let godfatherChoice = roundByRole.get("Godfather")[0];
                                    if (Object.keys(godfatherChoice).length) {
                                        selectionVisit = gamedata.players.get(godfatherChoice.choice).username;
                                    }
                                }
                                let spyMessage;
                                if (selectionVisit === spy.username) {
                                    spyMessage = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle(`You watched your target as they snooped around your own house!`)
                                        .setDescription("See if you can figure out what they were doing there...");
                                } else if (selectionVisit) {
                                    spyMessage = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle(`You saw your target visiting ${selectionVisit}'s house.`)
                                        .setDescription("See if you can figure out what they were doing there...");
                                } else {
                                    spyMessage = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .setTitle(`It seems your target didn't go anywhere last night.`)
                                        .setDescription("Maybe that clears their name... or does it?");
                                }
                                searchableUsers[spy.id].send(spyMessage);
                                break;
                            case "heal":
                                let doc = gamedata.players.get(tag);
                                let target = gamedata.players.get(action.choice);
                                if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                    let temp = target;
                                    targetJailedMsg = new Discord.MessageEmbed()
                                        .setTitle(`As you arrived at ${temp.username}'s house to be on standby in the event violence broke out, you notice ${temp.username} is nowhere to be found.`)
                                        .setDescription(`It seems ${temp.username} didn't need healing tonight.`)
                                    message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                    break;
                                }
                                if (tag === action.choice && !doc.isAlive) { // if doctor was attacked and saved himself
                                    gamedata.game.game.playersAlive.push(tag);
                                    // gamedata.game.game.deadThisRound = gamedata.game.game.deadThisRound.filter(t => t.name !== tag)
                                    doc.isAlive = true;
                                    gamedata.players.set(tag, doc);
                                    let docSaveSuccessfulSelf = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .attachFiles(["images/health.png"])
                                        .setThumbnail("attachment://health.png")
                                        .setTitle("You successfully saved yourself!")
                                        .setDescription("The mafia tried to attack you, but you thwarted their efforts. The town will certainly hear about this.");
                                    searchableUsers[doc.id].send(docSaveSuccessfulSelf);
                                    gamedata.game.game.deadThisRound.push({
                                        name: action.choice,
                                        by: "Doctor",
                                    });
                                } else if (doc.isAlive && !target.isAlive && action.choice === killed) { // if someone else was attacked and doctor saved them
                                    gamedata.game.game.playersAlive.push(action.choice);
                                    // gamedata.game.game.deadThisRound = gamedata.game.game.deadThisRound.filter(t => t.name !== action.choice)
                                    target.isAlive = true;
                                    gamedata.players.set(action.choice, target);
                                    let docSaveSuccessful = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .attachFiles(["images/health.png"])
                                        .setThumbnail("attachment://health.png")
                                        .setTitle(`You successfully saved ${gamedata.players.get(action.choice).username}!`)
                                        .setDescription("The mafia tried to attack this person, but you thwarted their efforts. The town will certainly hear about this.");
                                    searchableUsers[doc.id].send(docSaveSuccessful);
                                    let targetSaveSuccessful = new Discord.MessageEmbed()
                                        .setColor("#1e8c00")
                                        .attachFiles(["images/health.png"])
                                        .setThumbnail("attachment://health.png")
                                        .setTitle("You were saved by the Doctor!")
                                        .setDescription("The mafia attacked you last night, but the doctor was able to heal you just in time! The town will certainly hear about this.");
                                    searchableUsers[target.id].send(targetSaveSuccessful);
                                    gamedata.game.game.deadThisRound.push({
                                        name: action.choice,
                                        by: "Doctor",
                                    });
                                } else if (killed) { // anyone attacked, unsuccesful save
                                    let unsuccesfulSave = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .attachFiles(["images/death.png"])
                                        .setThumbnail("attachment://death.png")
                                        .setTitle(`${killed && gamedata.players.get(killed).role === "Doctor" ? "You failed to get your first-aid kit!" : "The doctor was unreachable!"} Unfortunately, you died.`)
                                        .setDescription("Now that you are dead you can spectate the rest of the game, but you can no longer speak or perform any nightly actions. Please refrain from communicating with living players via video or DMs.");
                                    let user = searchableUsers[gamedata.players.get(killed).id];
                                    user.send(unsuccesfulSave);
                                }
                                killed = null;
                                break;
                            case "mayor-reveal":
                                let mayor = gamedata.players.get(tag);
                                if (!mayor.silencedThisRound) {
                                    gamedata.game.game.deadThisRound.push({
                                        by: "Mayor",
                                        name: tag
                                    })
                                } else {
                                    let mayorSilencedMessage = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle("Since you were silenced while trying to reveal yourself, you won't be able to reveal this round.")
                                        .setDescription("Try again tomorrow night!");
                                    let mayorUser = searchableUsers[mayor.id];
                                    mayorUser.send(mayorSilencedMessage);
                                }
                                break;
                            case "douse":
                                break;
                            case "ignite":
                                for (player of gamedata.neutralRoles["Arsonist"].doused) {
                                    temp = gamedata.players.get(player);
                                    if (action.choice && gamedata.villageRoles["Jailer"].lastSelection === action.choice) {
                                        targetJailedMsg = new Discord.MessageEmbed()
                                            .setTitle(`You ignite ${temp.username}'s house to burn him inside his house, but it seems he was away for the night.`)
                                            .setDescription(`${temp.username} escaped but you still burned his house down!.`)
                                        message.guild.members.resolve(actor.id).send(targetJailedMsg);
                                        break;
                                    }
                                    temp.isAlive = false;
                                    gamedata.players.set(player, temp);
                                    gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== player);
                                    let arsonistVictimMsg = new Discord.MessageEmbed()
                                        .setTitle("Oh no! Your house burned down while you were asleep!")
                                        .setDescription("Now that you are dead you can spectate the rest of the game, but you can no longer speak or perform any nightly actions. Please refrain from communicating with living players via video or DMs.")
                                    let target = searchableUsers[temp.id];
                                    target.send(arsonistVictimMsg);
                                }
                                gamedata.neutralRoles["Arsonist"].doused = gamedata.neutralRoles["Arsonist"].filter(t => t !== gamedata.villageRoles["Jailer".lastSelection])
                                gamedata.game.game.deadThisRound.push({
                                    name: tag,
                                    by: "Arsonist",
                                    killed: gamedata.neutralRoles["Arsonist"].doused
                                })
                                break;
                            case "baited":
                                gamedata.neutralRoles["Baiter"].baitedCount++;
                                gamedata.game.game.deadThisRound.push({
                                    name: tag,
                                    by: "Baiter",
                                });
                                temp = gamedata.players.get(tag);
                                temp.isAlive = false;
                                gamedata.players.set(tag, temp);
                                gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== tag);
                                let baitedMessage = new Discord.MessageEmbed()
                                    .setColor("#1984ff")
                                    .setTitle("Unfortunately, you were ambushed by the Baiter!")
                                    .setDescription("Now that you are dead you can spectate the rest of the game, but you can no longer speak or perform any nightly actions. Please refrain from communicating with living players via video or DMs.")
                                    .attachFiles(["images/death.png"])
                                    .setThumbnail("attachment://death.png");
                                let user = searchableUsers[gamedata.players.get(tag).id];
                                user.send(baitedMessage);
                                break;
                            case "execute":
                                gamedata.game.game.deadThisRound.push({
                                    name: action.choice,
                                    by: "Jailer",
                                });
                                temp = gamedata.players.get(action.choice);
                                temp.isAlive = false;
                                gamedata.players.set(action.choice, temp);
                                gamedata.game.game.playersAlive = gamedata.game.game.playersAlive.filter(t => t !== action.choice);
                                let executedMsg = new Discord.MessageEmbed()
                                    .setColor("#d50000")
                                    .setTitle("Unfortunately, you were executed by the Jailer!")
                                    .setDescription("Now that you are dead you can spectate the rest of the game, but you can no longer speak or perform any nightly actions. Please refrain from communicating with living players via video or DMs.")
                                    .attachFiles(["images/death.png"])
                                    .setThumbnail("attachment://death.png");
                                let targetUser = searchableUsers[gamedata.players.get(action.choice).id];
                                targetUser.send(executedMsg);
                                if (temp.align === "Village") {
                                    gamedata.villageRoles["Jailer"].killsLeft = 0;
                                    let failedExecutionMsg = new Discord.MessageEmbed()
                                        .setColor("#d50000")
                                        .setTitle("Unfortunately, you executed a villager!")
                                        .setDescription("You have now lost your ability to execute your prisoners, but you still have the ability to detain them for the night!")
                                    searchableUsers[gamedata.players.get(tag).id].send(failedExecutionMsg);
                                }
                                break;
                            default:
                                break;
                        }
                    }
                    resolve();
                });
            });
        }

        function nightTime(round) {
            return new Promise(async (resolve) => {
                await sleepAsync(5000)
                console.log("Night time!");
                await mafiaHouse.join().then(async (con) => {
                    gamedata.voiceConnection = con;
                    for (let member of Array.from(gamedata.voiceConnection.channel.members.values())) {
                        if (!member.user.bot) {
                            let temp = gamedata.players.get(member.user.tag);
                            if (temp && temp.isAlive) {
                                temp.mixerInput = gamedata.mixer.input({
                                    channels: 2,
                                    sampleRate: 48000,
                                    bitDepth: 16
                                });
                                gamedata.players.set(member.user.tag, temp);
                                await con.receiver.createStream(member.id, {
                                    end: "manual",
                                    mode: "pcm"
                                }).pipe(gamedata.players.get(member.user.tag).mixerInput)
                            }
                        }
                    }
                });
                let movingUsersPromises = []
                for (let member of users) {
                    movingUsersPromises.push(new Promise(async (resolve) => {
                        if (gamedata.players.get(member.user.tag).isAlive && gamedata.villageRoles["Jailer"].lastSelection !== member.user.tag) {
                            await message.guild.channels.resolve(gamedata.players.get(member.user.tag).vc).updateOverwrite(member, {
                                VIEW_CHANNEL: true,
                                SPEAK: true
                            });
                            await member.voice.setChannel(gamedata.players.get(member.user.tag).vc).catch(() => {
                                channel.send(`**${gamedata.players.get(gamedata.userids.get(member.id)).username}** could not be moved to **their channel**, please join manually.`);
                            });
                        } else if (gamedata.players.get(member.user.tag).isAlive && gamedata.villageRoles["Jailer"].lastSelection === member.user.tag) {
                            await townHall.updateOverwrite(member, {
                                VIEW_CHANNEL: false,
                                SPEAK: false
                            });
                            await message.guild.channels.resolve(gamedata.players.get(member.user.tag).vc).updateOverwrite(member, {
                                VIEW_CHANNEL: false,
                                SPEAK: false
                            }); // TODO if necessary to avoid rate limits, remove this and the one above
                            await jailChannel.updateOverwrite(member, {
                                VIEW_CHANNEL: true,
                                SPEAK: true
                            });
                            await member.voice.setChannel(gamedata.settings.get("jailChannel")).catch(() => {
                                channel.send(`**${gamedata.players.get(gamedata.userids.get(member.id)).username}** could not be moved to **their channel**, please join manually.`);
                            });
                        }
                        resolve();
                    }));
                }

                Promise.all(movingUsersPromises).then(() => {
                    gamedata.settings.get("emit").emit("stream", gamedata.mixer);
    
                    nightActions(round).then(() => {
                        resolve();
                    });
                });
            });
        }

        let searchablePregameVCs = {};

        for (let [tag, player] of gamedata.players) {
            let member = searchableUsers[player.id];
            player.pregameVC = member.voice.channelID;
            if (!Object.keys(searchablePregameVCs).includes(member.voice.channelID)) {
                searchablePregameVCs[member.voice.channelID] = message.guild.channels.resolve(member.voice.channelID);
            }
            gamedata.players.set(tag, player);
        }

        let gameOver;
        message.channel.send(`The game is starting! Head over to <#${channel.id}> to begin.`);
        channel.send("By playing with the Town of Mafiaville, you agree to allow the bot to record voice activity in select channels for the purpose of live playback during the game.")
        for (let i = 1; nonmafia > mafia; i++) {
            gamedata.game.game.currentRound = i;
            await nightTime(i);
            await sleepAsync(2000);
            await dayTime(i).then((gameStatus) => {
                gameOver = gameStatus;
            });
            if (gameOver[1]) {
                break;
            }
            console.log(`Round ${i} completed.`);
            await sleepAsync(2000);
        }

        gamedata.gameActive = false;
        gamedata.gameReady = false;
        if (gameOver[0] === "neutral") {
            channel.send(gamedata.neutralRoles[gameOver[2]].winMessage());
        } else if (gameOver[0] === "mafia") {
            let mafiaWins = new Discord.MessageEmbed()
                .setColor("#d50000")
                .setTitle("And with that, the Mafia has brought about the total destruction of Mafiaville.")
                .setDescription("The town of Mafiaville will truly never be the same... until the next game.")
                .attachFiles(["images/godfather.png"])
                .setThumbnail("attachment://godfather.png");
            channel.send(mafiaWins);
            for (let i of gameOver[2]) {
                channel.send(gamedata.neutralRoles[i].winMessage());
            }
        } else if (gameOver[0] === "village") {
            let villageWins = new Discord.MessageEmbed()
                .setColor("#1e8c00")
                .setTitle("And with that, the townspeople have vanquished the Mafiaville Mafia.")
                .setDescription("The village can sleep peacefully, knowing that the days of unsolved murders are over... at least, until the next game.")
                .attachFiles(["images/mayor.png"])
                .setThumbnail("attachment://mayor.png");
            channel.send(villageWins);
            for (let i of gameOver[2]) {
                channel.send(gamedata.neutralRoles[i].winMessage());
            }
        }
        let rolesList = "";
        for (let [_, player] of gamedata.players) {
            rolesList += `<@${player.id}> - ${player.role}\n`;
        }
        let finalSummary = new Discord.MessageEmbed()
            .setColor("#cccccc")
            .setTitle("This is who each person was in this game...")
            .setDescription(rolesList);
        await sleepAsync(2000);
        channel.send(finalSummary);

        channel.overwritePermissions([]);
        townHall.overwritePermissions([]);

        for (let [tag, player] of gamedata.players) {
            let member = searchableUsers[player.id];
            member.voice.setChannel(searchablePregameVCs[player.pregameVC]);

            player.role = undefined;
            player.distracted = false;
            player.wasFramed = false;
            player.silencedThisRound = false;
            player.silencedLastRound = false;
            player.align = undefined;
            player.isAlive = true;
            player.vc = undefined;
            player.currentChannel = undefined;
            player.mixerInput = undefined;
            player.will = [];
            gamedata.players.set(tag, player);
        }
        
        return ["NEW GAME", gamedata.players];
    },
};