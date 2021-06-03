// https://discord.com/api/oauth2/authorize?client_id=827754470825787413&permissions=2278030656&scope=bot

const Discord = require("discord.js");
let intents = new Discord.Intents();
intents.add(
    "GUILDS",
    "GUILD_EMOJIS",
    "GUILD_VOICE_STATES",
    "GUILD_MESSAGES",
    "GUILD_MESSAGE_REACTIONS",
    "GUILD_MESSAGE_TYPING",
    "DIRECT_MESSAGES",
    "DIRECT_MESSAGE_REACTIONS",
    "DIRECT_MESSAGE_TYPING"
);
const client = new Discord.Client({
    intents: intents,
    partials: ['CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION', 'USER']
});
const spectatorClient = new Discord.Client({
    intents: intents
});
const config = require("./config.json");
const spectatorConfig = require("./spectatorConfig.json");
const fs = require("fs");
const stream = require("stream");
const AudioMixer = require('audio-mixer')

const prefix = "m.";

class GameData {
    constructor(playersFromLastRound) {
        this.players = playersFromLastRound ?? new Map();
        this.botid = undefined;
        this.spectatorbotid = undefined;
        this.userids = new Map();
        this.settings = new Map();
        this.gameActive = false;
        this.gameReady = false;
        this.voiceConnection = undefined;
        this.mixer = new AudioMixer.Mixer({
            channels: 2,
            bitDepth: 16,
            sampleRate: 48000,
            clearInterval: 1000
        });
        this.game = {
            game: {
                mayor: "",
                playersAlive: [],
                currentRound: 0,
                deadThisRound: [],
            },
            rounds: [],
        };
        this.emojiArray = [
            "🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲",
            "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿",
        ];

        this.settings.set("nightTime", 30); // TODO increase these times
        this.settings.set("dayTime", 40);
        this.settings.set("votingTime", 20);

        this.allRoles = [
            "Godfather", "Mafioso", "Framer", "Silencer",
            "Detective", "Doctor", "Vigilante", "Mayor",
            "Distractor", "PI", "Spy", "Jester",
            "Executioner", "Baiter", "Arsonist",
        ];

        this.mafiaRoles = {
            updateGodfather: (guild) => {
                let hierarchy = ["Mafioso", "Framer", "Disguiser", "Silencer"];
                let activeMafia = Array.from(this.players.keys()).filter(i => this.players.get(i).align === "Mafia" && this.players.get(i).isAlive);
                if (activeMafia.includes(this.mafiaRoles.currentMafia["Godfather"])) {
                    return;
                } else {
                    for (let i of hierarchy) {
                        let tag = this.mafiaRoles.currentMafia[i];
                        if (activeMafia.includes(tag)) {
                            this.mafiaRoles[i].isGodfather = true;
                            let newGodfather = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("As the current Godfather has died, you have been chosen to lead the Mafiaville Mafia.")
                                .setDescription("You will hereafter be responsible for killing the villagers of Mafiaville. Use your newfound power wisely, for with great power comes great responsibility.")
                                .attachFiles(["images/godfather.png"])
                                .setImage("attachment://godfather.png")
                            guild.members.fetch(this.players.get(tag).id).then((user) => {
                                user.send(newGodfather);
                            });
                            break;
                        }
                    }
                }
            },
            currentMafia: {
                "Godfather": "",
                "Mafioso": "",
                "Framer": "",
                "Disguiser": "",
                "Silencer": "",
            },
            tiers: {
                1: {
                    roles: ["Godfather"],
                    pick: false,
                },
                2: {
                    roles: ["Framer", "Silencer"],
                    pick: false,
                },
                3: {
                    roles: ["Mafioso"],
                    pick: false,
                },
                pool: [],
            },
            "Godfather": {
                description: "You're the leader of the Mafiaville Mafia and order a murder each night. Your goal is to have all the townspeople killed.",
                goal: "To kill the villagers. (However, you'll win when the number of villagers equals the number of mafia.",
                align: "Mafia",
                emojiMap: new Map(),
                isGodfather: true,
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Godfather"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#d50000")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to kill?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id) && this.players.get(t).align !== "Mafia")) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to kill anyone tonight.")
                                        .setColor("#d50000");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to kill ${selection} tonight.`)
                                        .setColor("#d50000");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Godfather"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "kill",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Framer": {
                align: "Mafia",
                emojiMap: new Map(),
                description: "You've moved up the ranks in the Mafiaville Mafia due to your uncanny ability to alter the evidence. Your goal is to help the Mafia destroy the town by framing innocent villagers each night.",
                goal: "To help the Godfather kill the villagers. (However, you'll win when the number of villagers equals the number of mafia.",
                isGodfather: false,
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Framer"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#d50000")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to frame?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id) && this.players.get(t).align !== "Mafia")) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to frame anyone tonight.")
                                        .setColor("#d50000");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to frame ${selection} tonight.`)
                                        .setColor("#d50000");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Framer"];
                        if (that.isGodfather) {
                            that = this.mafiaRoles["Godfather"];
                        }
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                let action = {};
                                if (this.players.get(selection).role === "Baiter") {
                                    action = {
                                        action: "baited",
                                        choice: this.userids.get(user.id),
                                    };
                                } else if (this.mafiaRoles["Framer"].isGodfather) {
                                    action = {
                                        action: "kill",
                                        choice: selection,
                                    };
                                } else {
                                    action = {
                                        action: "frame",
                                        choice: selection,
                                    };
                                }
                                resolve(action);
                            }
                        });
                        n
                    });
                },
            },
            "Silencer": {
                align: "Mafia",
                description: "You, like the rest of the mafia, go after innocent villagers. But instead of killing them, you silence them, locking them into their homes for the night and day.",
                goal: "To help the Godfather kill the villagers. (However, you'll win when the number of villagers equals the number of mafia.",
                emojiMap: new Map(),
                isGodfather: false,
                workedLastNight: false,
                silencedSoFar: [],
                silence: (guild, userid) => {
                    return new Promise(async (resolve) => {
                        let townHall = await guild.channels.resolve(this.settings.get("townHall"));
                        let textChannel = await guild.channels.resolve(this.settings.get("textChannel"));
                        let user = await guild.members.fetch(userid);
                        await townHall.updateOverwrite(user, {
                            VIEW_CHANNEL: false,
                            SPEAK: false,
                        });
                        await textChannel.updateOverwrite(user, {
                            SEND_MESSAGES: false,
                            SEND_TTS_MESSAGES: false,
                            ADD_REACTIONS: false,
                        });
                        resolve();
                    });
                },
                unsilence: (guild, userid) => {
                    return new Promise(async (resolve) => {
                        let townHall = await guild.channels.resolve(this.settings.get("townHall"));
                        let textChannel = await guild.channels.resolve(this.settings.get("textChannel"));
                        let user = await guild.members.fetch(userid);
                        await townHall.updateOverwrite(user, {
                            VIEW_CHANNEL: true,
                            SPEAK: true,
                        });
                        await textChannel.updateOverwrite(user, {
                            SEND_MESSAGES: true,
                            SEND_TTS_MESSAGES: true,
                            ADD_REACTIONS: true,
                        });
                        resolve();
                    });
                },
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Silencer"];
                        that.emojiMap.clear();
                        if (that.workedLastNight) {
                            let message = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("You're too tired to silence anyone tonight. Try to get some sleep.");
                            user.send(message);
                            that.workedLastNight = false;
                            resolve("");
                        } else {
                            let i = 0;
                            let message = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle(`Night ${this.game.game.currentRound}: Who do you want to silence?`)
                                .setDescription("Select a player using the reactions below:");
                            for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id) && !that.silencedSoFar.includes(t))) {
                                that.emojiMap.set(this.emojiArray[i], player);
                                message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                                i++;
                            }
                            let selection;
                            user.send(message).then(async (prompt) => {
                                for (let emoji of that.emojiMap.keys()) {
                                    prompt.react(emoji);
                                }
                                let promptFilter = (reaction, tuser) => {
                                    return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                                };
                                prompt.awaitReactions(promptFilter, {
                                    time: this.settings.get("nightTime") * 1000,
                                }).then((emoji) => {
                                    emoji = emoji.filter(t => t.count > 1);
                                    let reaction;
                                    if (emoji.size === 0) {
                                        let noActionMessage = new Discord.MessageEmbed()
                                            .setTitle("You chose not to silence anyone tonight.")
                                            .setColor("#d50000");
                                        user.send(noActionMessage);
                                        resolve("");
                                    } else {
                                        reaction = emoji.first().emoji.name;
                                        selection = that.emojiMap.get(reaction);
                                        let selectionMessage = new Discord.MessageEmbed()
                                            .setTitle(`You chose to silence ${selection} tonight.`)
                                            .setColor("#d50000");
                                        user.send(selectionMessage);
                                        that.workedLastNight = true;
                                        resolve(selection);
                                    }
                                });
                            });
                        }
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Silencer"];
                        if (that.isGodfather) {
                            that = this.mafiaRoles["Godfather"];
                        }
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                let action = {};
                                if (this.players.get(selection).role === "Baiter") {
                                    action = {
                                        action: "baited",
                                        choice: this.userids.get(user.id),
                                    };
                                } else if (this.mafiaRoles["Silencer"].isGodfather) {
                                    action = {
                                        action: "kill",
                                        choice: selection,
                                    };
                                } else {
                                    action = {
                                        action: "silence",
                                        choice: selection,
                                    };
                                }
                                resolve(action);
                            }
                        });
                    });
                },
            },
            "Mafioso": {
                align: "Mafia",
                description: "You're the Godfather's right-hand man. As long as the Godfather is alive, you'll do exclusively his bidding, visiting villagers to kill them on his behalf. However, if he meets his demise, you'll replace him.",
                goal: "To help the Godfather kill the villagers. (However, you'll win when the number of villagers equals the number of mafia.",
                isGodfather: false,
                prompt: (user) => {},
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.mafiaRoles["Mafioso"];
                        if (that.isGodfather) {
                            that = this.mafiaRoles["Godfather"];
                            that.prompt(user).then((selection) => {
                                if (selection === "") {
                                    resolve({});
                                } else {
                                    let action = {};
                                    if (this.players.get(selection).role === "Baiter") {
                                        action = {
                                            action: "baited",
                                            choice: this.userids.get(user.id),
                                        };
                                    } else if (this.mafiaRoles["Mafioso"].isGodfather) {
                                        action = {
                                            action: "kill",
                                            choice: selection,
                                        };
                                    }
                                    resolve(action);
                                }
                            });
                        } else {
                            resolve({});
                        }
                    });
                },
            },
        };

        this.villageRoles = {
            players: [],
            tiers: {
                1: {
                    roles: ["Doctor", "Detective"],
                    pick: false
                },
                2: {
                    roles: ["Vigilante", "Mayor"],
                    pick: false,
                },
                3: {
                    roles: ["Distractor"], // TODO add Jailer
                    pick: 1,
                },
                4: {
                    roles: ["PI", "Spy"],
                    pick: 1
                },
                pool: ["Distractor", "PI", "Spy"] // TODO add Jailer
            },
            "Doctor": {
                align: "Village",
                description: "You're the resident medical expert in Mafiaville. Your job is to save those attacked by the Mafia.",
                goal: "To help the village eliminate all the mafia.",
                emojiMap: new Map(),
                lastChoice: "",
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Doctor"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to save?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => (t !== that.lastChoice))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to save anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to save ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    that.lastChoice = selection;
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Doctor"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "heal",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Detective": {
                align: "Village",
                description: "As the criminology expert in the Mafiaville Police Department, you've been hard at work investigating recent murders each night. Your goal is to deduce the identities of the Mafia.",
                goal: "To help the village eliminate all the mafia.",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Detective"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to investigate?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to investigate anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to investigate ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Detective"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "check",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Vigilante": {
                align: "Village",
                description: "Having little faith in the Mafiaville Police Department, you've chosen to take matters into your own hands. You can hunt for mafia and neutrals each night, and you can shoot on sight; but if you miss and murder an innocent villager, you'll take your own life out of guilt.",
                goal: "To help the village eliminate all the mafia.",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Vigilante"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to shoot?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to shoot anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to shoot ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Vigilante"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "kill-vigil",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "Mayor": {
                align: "Village",
                description: "The results are in, and you've been elected as the leader of the Mafiaville City Council! However, you can't say anything right away because the Mafia might hunt you down. Should you choose to reveal yourself, you'll be granted an extra vote in Town Hall meetings - but until then, you're invisible amongst the people.",
                goal: "To help the village eliminate all the mafia.",
                revealed: false,
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Mayor"];
                        if (this.players.get(this.userids.get(user.id)).silencedLastRound) that.revealed = false;
                        if (!that.revealed) {
                            let message = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .setTitle(`Night ${this.game.game.currentRound}: Do you want to reveal yourself as the mayor tomorrow?`)
                                .setDescription("Select Y or N using the reactions below:");
                            user.send(message).then(async (prompt) => {
                                prompt.react("🇾");
                                prompt.react("🇳");
                                let promptFilter = (reaction, tuser) => {
                                    return ["🇾", "🇳"].includes(reaction.emoji.name) && tuser.id === user.id;
                                };
                                prompt.awaitReactions(promptFilter, {
                                    time: this.settings.get("nightTime") * 1000,
                                }).then((emoji) => {
                                    emoji = emoji.filter(t => t.count > 1);
                                    let selection;
                                    let reaction;
                                    if (emoji.size === 0) {
                                        let noActionMessage = new Discord.MessageEmbed()
                                            .setTitle("You will not reveal yourself tomorrow.")
                                            .setColor("#cccccc");
                                        user.send(noActionMessage);
                                        resolve(false);
                                    } else {
                                        let selectionMessage;
                                        reaction = emoji.first().emoji.name;
                                        selection = reaction === "🇾";
                                        if (selection) {
                                            selectionMessage = new Discord.MessageEmbed()
                                                .setTitle(`You have chosen to reveal yourself tomorrow.`)
                                                .setColor("#1e8c00");
                                            that.revealed = true;
                                            gamedata.game.game.mayor = user.id;
                                        } else {
                                            selectionMessage = new Discord.MessageEmbed()
                                                .setTitle(`You have chosen not to reveal yourself tomorrow.`)
                                                .setColor("#cccccc");
                                        }
                                        user.send(selectionMessage);
                                        resolve(selection);
                                    }
                                })
                            })
                        } else resolve(false);
                    })
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Mayor"];
                        that.prompt(user).then((selection) => {
                            if (selection) {
                                resolve({
                                    action: "mayor-reveal",
                                })
                            } else resolve({})
                        })
                    });
                },
            },
            "Jailer": {
                align: "Village",
                canJail: true,
                description: "Running the Mafiaville Prison means you have a pair of handcuffs and easy access to arrest warrants. Every other night, you have the option to jail a townsperson overnight to interrogate them - and execute them if you don't like their answers. If you execute a villager, however, you'll never be able to execute again, so be careful of whom you kill.",
                goal: "To help the village eliminate all the mafia.",
                emojiMap: new Map(),
                killsLeft: 3,
                lastSelection: undefined,
                previousSelection: undefined,
                prompt: (user) => {
                    let that = this.villageRoles["Jailer"]
                    console.log("in jailer prompt function")
                    if (that.canJail) {
                        console.log("creating jailer message")
                        let i = 0;
                        let jailerMsg = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle("Who do you want to jail tonight?")
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            jailerMsg.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        user.send(jailerMsg).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("dayTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to jail anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    that.canJail = true;
                                    that.previousSelection = that.lastSelection;
                                    that.lastSelection = undefined;
                                    resolve();
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    let selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to jail ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    that.canJail = false;
                                    that.previousSelection = that.lastSelection;
                                    that.lastSelection = selection;
                                    resolve();
                                }
                            });
                        });
                    } else {
                        that.canJail = true;
                        that.previousSelection = that.lastSelection;
                        that.lastSelection = undefined;
                    }
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Jailer"];
                        if (that.killsLeft !== 0 && that.lastSelection) {
                            let jailerMsg = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .setTitle(`Do you want to kill your target, ${that.lastSelection}, tonight?`)
                                .setDescription("Select a player using the reactions below:");
                            user.send(jailerMsg).then(async (prompt) => {
                                prompt.react("🇾");
                                prompt.react("🇳");
                                let promptFilter = (reaction, tuser) => {
                                    return ["🇾", "🇳"].includes(reaction.emoji.name) && tuser.id === user.id;
                                };
                                prompt.awaitReactions(promptFilter, {
                                    time: this.settings.get("nightTime") * 1000,
                                }).then((emoji) => {
                                    emoji = emoji.filter(t => t.count > 1);
                                    let selection;
                                    let reaction;
                                    if (emoji.size === 0) {
                                        let noActionMessage = new Discord.MessageEmbed()
                                            .setTitle("You will not execute your target.")
                                            .setColor("#cccccc");
                                        user.send(noActionMessage);
                                        resolve({})
                                    } else {
                                        let selectionMessage;
                                        reaction = emoji.first().emoji.name;
                                        selection = reaction === "🇾";
                                        if (selection) {
                                            selectionMessage = new Discord.MessageEmbed()
                                                .setTitle(`You have chosen to execute your target.`)
                                                .setColor("#1e8c00");
                                            that.revealed = true;
                                            gamedata.game.game.mayor = user.id;
                                            user.send(selectionMessage);
                                            resolve({
                                                action: "execute",
                                                choice: this.players.get(that.lastSelection)
                                            });
                                        } else {
                                            selectionMessage = new Discord.MessageEmbed()
                                                .setTitle(`You have chosen not to execute your target.`)
                                                .setColor("#cccccc");
                                            user.send(selectionMessage);
                                            resolve({});
                                        }
                                    }
                                })
                            })
                        }
                        resolve({});
                    });
                },
            },
            "Distractor": {
                align: "Village",
                description: "As a former wrestler and one of the eldest members of the City Council, you're naturally very intimidating. When you visit a house, the resident will forget their plans for the night and instead hide in their bedroom, cowering in fear and quietly sobbing. Of course, that house visit is quite exhausting, so you can only distract every other night - so use this power wisely.",
                goal: "To help the village eliminate all the mafia.",
                workedLastNight: false,
                emojiMap: new Map(),
                prompt: (user) => {
                    let that = this.villageRoles["Distractor"];
                    return new Promise((resolve) => {
                        if (that.workedLastNight) {
                            let message = new Discord.MessageEmbed()
                                .setColor("#d50000")
                                .setTitle("You're too tired to distract anyone tonight. Try to get some sleep.");
                            user.send(message);
                            that.workedLastNight = false;
                            resolve("");
                        } else {
                            that.emojiMap.clear();
                            let i = 0;
                            let message = new Discord.MessageEmbed()
                                .setColor("#1e8c00")
                                .setTitle(`Night ${this.game.game.currentRound}: Who do you want to distract?`)
                                .setDescription("Select a player using the reactions below:");
                            for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                                that.emojiMap.set(this.emojiArray[i], player);
                                message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                                i++;
                            }
                            let selection;
                            user.send(message).then(async (prompt) => {
                                for (let emoji of that.emojiMap.keys()) {
                                    prompt.react(emoji);
                                }
                                let promptFilter = (reaction, tuser) => {
                                    return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                                };
                                prompt.awaitReactions(promptFilter, {
                                    time: this.settings.get("nightTime") * 1000,
                                }).then((emoji) => {
                                    emoji = emoji.filter(t => t.count > 1);
                                    let reaction;
                                    if (emoji.size === 0) {
                                        let noActionMessage = new Discord.MessageEmbed()
                                            .setTitle("You chose not to distract anyone tonight.")
                                            .setColor("#1e8c00");
                                        user.send(noActionMessage);
                                        resolve("");
                                    } else {
                                        reaction = emoji.first().emoji.name;
                                        selection = that.emojiMap.get(reaction);
                                        let selectionMessage = new Discord.MessageEmbed()
                                            .setTitle(`You chose to distract ${selection} tonight.`)
                                            .setColor("#1e8c00");
                                        user.send(selectionMessage);
                                        that.workedLastNight = true;
                                        resolve(selection);
                                    }
                                });
                            });
                        }
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Distractor"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "distract",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
            "PI": {
                align: "Village",
                description: "You and the Detective went to college together, but you chose a minor in psychology and focused on reading people. While the detective looks for evidence, you examine a subject's social interactions, determining if two members of the town are on the same side. However, you won't know which side they're on, so be careful when sharing this information.",
                goal: "To help the village eliminate all the mafia.",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["PI"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to investigate?`)
                            .setDescription("Select TWO players using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to investigate anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else if (emoji.size === 1) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You didn't select enough people to investigate.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    let selections = [];
                                    for (let e of emoji.first(2)) {
                                        // console.log(e);
                                        let reaction = e.emoji.name;
                                        let selection = that.emojiMap.get(reaction);
                                        selections.push(selection);
                                    }
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to investigate ${selections[0]} and ${selections[1]} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    resolve(selections);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["PI"];
                        that.prompt(user).then((selections) => {
                            if (selections === "") {
                                resolve({});
                            } else {
                                resolve([this.players.get(selections[0]).role, this.players.get(selections[1]).role].includes("Baiter") ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "pi-check",
                                    choice: selections,
                                });
                            }
                        });
                    });
                },
            },
            "Spy": {
                align: "Village",
                description: "Unlike the other investigators, you're self-trained. You don't bother with evidence or social cues. Instead, you pick a villager and follow them all night. Maybe you'll find that they visited the Mafia's victim, in which case the implications are clear; or maybe they visited nobody, and you're still left guessing.",
                goal: "To help the village eliminate all the mafia.",
                emojiMap: new Map(),
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Spy"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#1e8c00")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to watch?`)
                            .setDescription("Select a player using the reactions below:");
                        for (let player of this.game.game.playersAlive.filter(t => t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i], player);
                            message.addField(`${this.emojiArray[i]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to watch anyone tonight.")
                                        .setColor("#1e8c00");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(`You chose to watch ${selection} tonight.`)
                                        .setColor("#1e8c00");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.villageRoles["Spy"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : {
                                    action: "spy-check",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
            },
        };

        this.neutralRoles = {
            players: [],
            tiers: {
                1: {
                    roles: ["Executioner", "Jester"],
                    pick: 1,
                },
                2: {
                    roles: ["Baiter", "Arsonist"],
                    pick: 1,
                },
                //                 3: {
                //                     roles: ["Eternal"],
                //                     pick: false,
                //                 },
                pool: ["Baiter", "Arsonist"]
            },
            "Executioner": {
                align: "Neutral",
                description: "Unlike the Mafia, you don't want all the villagers dead; rather, you're focused on one specific villager, and your goal is to get them lynched at the hands of the town. If they die overnight (by Mafia or Vigilante), you'll become the Jester, and your goal will be to prank the town by getting **yourself** lynched.",
                goal: "To have your target **lynched**.",
                target: "",
                id: "",
                wasLynched: false,
                isJester: false,
                winMessage: () => {
                    return new Discord.MessageEmbed()
                        .setColor("#1984ff")
                        .setTitle("You fools! You've played right into the Executioner's hands!")
                        .setDescription(`<@${this.neutralRoles["Executioner"].id}> tricked you into lynching his target. You thought the target was a Mafia, but they were only an innocent villager that the Executioner deeply hated.`)
                        .attachFiles(["images/executioner.png"])
                        .setThumbnail("attachment://executioner.png");
                },
                prompt: (user) => {},
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
                win: (guild, user, dead, byLynch) => {
                    let that = this.neutralRoles["Executioner"];
                    return new Promise((resolve) => {
                        if (that.isJester && user === dead && byLynch) {
                            this.neutralRoles["Jester"].id = this.players.get(user).id;
                            resolve({
                                role: "Jester",
                                win: [true, true]
                            });
                        } else if (!this.players.get(that.target).isAlive && !byLynch) {
                            that.isJester = true;
                            let execToJesterMessage = new Discord.MessageEmbed()
                                .setColor("#1984ff")
                                .setTitle("Since your target died during the night, you've decided to become the town Jester.")
                                .setDescription("Your new goal is to get **yourself** lynched at a Town Hall meeting.")
                                .attachFiles(["images/jester.png"])
                                .setImage("attachment://jester.png");
                            guild.members.fetch(this.players.get(user).id).then((user) => {
                                user.send(execToJesterMessage);
                            });
                            resolve({
                                role: "Executioner",
                                win: [false, true],
                            });
                        } else {
                            if (that.target === dead && byLynch) {
                                that.id = this.players.get(user).id;
                                resolve({
                                    role: "Executioner",
                                    win: [true, true],
                                });
                            } else {
                                resolve({
                                    role: "Executioner",
                                    win: [false, true],
                                });
                            }
                        }
                    });
                }, // RESOLVE FORMAT: { role: <role>, win: [, <win condition satisfied>, <win condition exclusive>]}
            },
            "Jester": {
                align: "Neutral",
                description: "All your life, people have laughed at you. It makes sense, after all, because you're a clown. Now, it's time to pull the ultimate prank: getting **YOURSELF** lynched by the town. If you die for any other reason, you'll have died a failure.",
                goal: "To get yourself **lynched**.",
                wasLynched: false,
                id: "",
                winMessage: () => {
                    return new Discord.MessageEmbed()
                        .setColor("#1984ff")
                        .setTitle("You fools! You've played right into the Jester's hands!")
                        .setDescription(`<@${this.neutralRoles["Jester"].id}> tricked you into lynching him. You thought the Jester was a clown, but the rest of you were the clowns all along!`)
                        .attachFiles(["images/jester.png"])
                        .setThumbnail("attachment://jester.png");
                },
                prompt: (user) => {},
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
                win: (guild, user, dead, byLynch) => {
                    return new Promise((resolve) => {
                        if (user === dead && byLynch) {
                            this.neutralRoles["Jester"].id = this.players.get(dead).id;
                            resolve({
                                role: "Jester",
                                win: [true, true],
                            });
                        } else {
                            resolve({
                                role: "Jester",
                                win: [false, true],
                            });
                        }
                    });
                },
            },
            "Eternal": {
                align: "Neutral",
                description: "",
                newAlign: "",
                prompt: (user) => {
                    user.send("bruh");
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
            },
            "Baiter": {
                align: "Neutral",
                description: "Being an angry, wheelchair-bound army veteran, you can't go out much apart from Town Hall meetings. You also hate the world for sending you off to war. As a result, you became the Baiter, using your knowledge of bombs to blow up anyone who visits your house. If you blow up **THREE** people and survive to tell the tale, you'll consider your life a success.",
                goal: "To bait **three** members of the town and survive to the end of the game.",
                baitedCount: 0,
                id: "",
                winMessage: () => {
                    return new Discord.MessageEmbed()
                        .setColor("#1984ff")
                        .setTitle("All the Baiter had to do was wait; suspecting nothing, others took the bait.")
                        .setDescription(`<@${this.neutralRoles["Baiter"].id}> also wins! Try to be more careful with whom you visit at night.`)
                        .attachFiles(["images/baiter.png"])
                        .setThumbnail("attachment://baiter.png");
                },
                prompt: (user) => {},
                night: (user) => {
                    return new Promise((resolve) => {
                        resolve({});
                    });
                },
                win: (_, user, __, ___) => {
                    return new Promise((resolve) => { // don't step yet, let's check this manually
                        if (this.neutralRoles["Baiter"].baitedCount >= 3 && this.players.get(user).isAlive) {
                            this.neutralRoles["Baiter"].id = this.players.get(user).id;
                            resolve({
                                role: "Baiter",
                                win: [true, false]
                            });
                        } else {
                            resolve({
                                role: "Baiter",
                                win: [false, false]
                            });
                        }
                    });
                }
            },
            "Arsonist": {
                align: "Neutral",
                description: "Like Nero fiddled over a burning Rome, you too play the flute over a city in flames. You have one goal in life, and it's to kill **EVERYONE**. Mafia, village, neutral - alignments aren't important to you, only the fall of Mafiaville.",
                goal: "To kill **everyone**.",
                emojiMap: new Map(),
                doused: [],
                alreadyDead: false,
                winMessage: () => {
                    return new Discord.MessageEmbed()
                        .setColor("#1984ff")
                        .setTitle("The Arsonist grins as Mafiaville burns to the ground.")
                        .setDescription(`<@${this.neutralRoles["Arsonist"].id}> wins! Maybe establish a fire department next time?`)
                        .attachFiles(["images/arsonist.png"])
                        .setThumbnail("attachment://arsonist.png");
                },
                prompt: (user) => {
                    return new Promise((resolve) => {
                        let that = this.neutralRoles["Arsonist"];
                        that.emojiMap.clear();
                        let i = 0;
                        let message = new Discord.MessageEmbed()
                            .setColor("#d50000")
                            .setTitle(`Night ${this.game.game.currentRound}: Who do you want to douse?`)
                            .setDescription("Select a player to douse or ignite all previously doused players using the reactions below:");
                        that.emojiMap.set(this.emojiArray[0], user.user.tag);
                        message.addField(`${this.emojiArray[0]} Ignite`, "\u200B", false);
                        for (let player of this.game.game.playersAlive.filter(t => !that.doused.includes(t) && this.players.get(t).isAlive && t !== this.userids.get(user.id))) {
                            that.emojiMap.set(this.emojiArray[i + 1], player);
                            message.addField(`${this.emojiArray[i + 1]} ${player}`, "\u200B", false);
                            i++;
                        }
                        let selection;
                        user.send(message).then(async (prompt) => {
                            for (let emoji of that.emojiMap.keys()) {
                                prompt.react(emoji);
                            }
                            let promptFilter = (reaction, tuser) => {
                                return Array.from(that.emojiMap.keys()).includes(reaction.emoji.name) && tuser.id === user.id;
                            };
                            prompt.awaitReactions(promptFilter, {
                                time: this.settings.get("nightTime") * 1000,
                            }).then((emoji) => {
                                emoji = emoji.filter(t => t.count > 1);
                                let reaction;
                                if (emoji.size === 0) {
                                    let noActionMessage = new Discord.MessageEmbed()
                                        .setTitle("You chose not to douse anyone tonight.")
                                        .setColor("#d50000");
                                    user.send(noActionMessage);
                                    resolve("");
                                } else {
                                    reaction = emoji.first().emoji.name;
                                    selection = that.emojiMap.get(reaction);
                                    if (this.players.get(selection).id !== user.id) {
                                        that.doused.push(selection);
                                    }
                                    let selectionMessage = new Discord.MessageEmbed()
                                        .setTitle(this.players.get(selection).id === user.id ? "You chose to ignite all previously doused players tonight" : `You chose to douse ${selection} tonight.`)
                                        .setColor("#d50000");
                                    user.send(selectionMessage);
                                    resolve(selection);
                                }
                            });
                        });
                    });
                },
                night: (user) => {
                    return new Promise((resolve) => {
                        let that = this.neutralRoles["Arsonist"];
                        that.prompt(user).then((selection) => {
                            if (selection === "") {
                                resolve({});
                            } else {
                                resolve(this.players.get(selection).role === "Baiter" ? {
                                    action: "baited",
                                    choice: this.userids.get(user.id),
                                } : this.players.get(selection).id === user.id ? {
                                    action: "ignite",
                                    choice: selection
                                } : {
                                    action: "douse",
                                    choice: selection,
                                });
                            }
                        });
                    });
                },
                win: (guild, user, _, byLynch) => {
                    return new Promise((resolve) => {
                        if (this.game.game.playersAlive.length === 1 && this.players.get(user).isAlive) {
                            resolve({
                                role: "Arsonist",
                                win: [true, true]
                            })
                        } else if (!this.players.get(user).isAlive && !this.neutralRoles["Arsonist"].alreadyDead) {
                            guild.channels.resolve(this.settings.get("textChannel")).then(async (channel) => {
                                this.neutralRoles["Arsonist"].alreadyDead = true;
                                let dousedList = this.neutralRoles["Arsonist"].doused;
                                let arsonistMessage = new Discord.MessageEmbed()
                                    .setColor("#1984ff")
                                    .setTitle("Oh no! You've killed the Arsonist!");
                                if (dousedList.length > 0) {
                                    let finalVictim = dousedList[Math.floor(Math.random() * dousedList.length)];
                                    finalVictim = this.players.get(finalVictim);
                                    finalVictim.isAlive = false;
                                    arsonistMessage.setDescription(`As a parting gift to a cruel world, <@${this.players.get(user).id}> lit one of his targets on fire. Mafiaville intelligence reports identified the body as that of <@${this.players.get(finalVictim).id}>.`);
                                    if (!finalVictim.silencedLastRound && finalVictim.will.length !== 0) {
                                        will = new Discord.MessageEmbed()
                                            .setColor("#cccccc")
                                            .setTitle(`${finalVictim.username}'s last will.`)
                                            .setDescription(finalVictim.will.map(i => `\t${i[0]}.\t${i[1]}`).join("\n"));
                                        await channel.send(will);
                                        await sleepAsync(2000);
                                    } else if (finalVictim.will.length !== 0) {
                                        let suppressedWill = new Discord.MessageEmbed()
                                            .setColor("#d50000")
                                            .setTitle("Unfortunately, you were killed while being silenced. Your will was suppressed, and it won't be revealed for this entire game.")
                                            .attachFiles(["images/death.png"])
                                            .setThumbnail("attachment://death.png");
                                        message.guild.members.fetch(finalVictim.id).then((user) => {
                                            user.send(suppressedWill);
                                        });
                                    }
                                } else {
                                    arsonistMessage.setDescription(`However, <@${this.players.get(user).id}> had no recent targets, and thus didn't kill anyone before dying.`);
                                }

                                channel.send(arsonistMessage);
                                resolve({
                                    role: "Arsonist",
                                    win: [false, true]
                                });
                            });
                        } else {
                            resolve({
                                role: "Arsonist",
                                win: [false, true]
                            })
                        }
                    })
                }
            },
        };
    }

    addSpectatorBot(channel) {
        channel.join()
    }
}

let gamedata = new GameData();

client.login(config.token);
spectatorClient.login(spectatorConfig.token);

client.once("ready", () => {
    console.log("Ready!");
    gamedata.botid = client.user.id;
});

const EventEmitter = require("events");
const {
    resolve
} = require("path");
class MyEmitter extends EventEmitter {}
const emit = new MyEmitter();
gamedata.settings.set("emit", emit);

// emit.setMaxListeners(0);

spectatorClient.once("ready", () => {
    console.log("Spectator ready!");
    gamedata.spectatorbotid = spectatorClient.user.id;
});

let connection;
emit.on("ghost town", async (channel) => {
    let vchannel;
    console.log("Ghost town created!");
    // console.log(channel);
    vchannel = spectatorClient.channels.resolve(channel.id);
    // console.log(channel);
    try {
        vchannel.join().then((con) => {
            connection = con;
        });
    } catch (e) {
        console.log("Error, trying again.");
        setTimeout(() => {
            vchannel = spectatorClient.channels.resolve(channel.id);
            vchannel.join().then((con) => {
                connection = con;
            });
        }, 2000);
    }

});
emit.on("stream", (mixedStream) => {
    var pass = stream.PassThrough()
    mixedStream.pipe(pass);
    connection.play(pass, {
        type: "converted"
    });
});

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

client.on("voiceStateUpdate", (oldState, newState) => {
    // player moves to a different channel --> update current channel in gamedata
    if (gamedata.players.get(newState.member.user.tag) && !newState.member.user.bot && oldState.channelID !== newState.channelID) {
        let temp = gamedata.players.get(newState.member.user.tag);
        temp.currentChannel = newState.channelID;
        gamedata.players.set(newState.member.user.tag, temp);
        // ADDING NEW CODE BELOW
        // console.log(`${newState.member.user.tag} moved from ${oldState.channel.name} to ${newState.channel.name}, clearing any inputs.`);
        temp = gamedata.players.get(newState.member.user.tag);
        if (temp.mixerInput) {
            temp.mixerInput = undefined;
            gamedata.mixer.removeInput(gamedata.players.get(newState.member.user.tag).mixerInput);
            gamedata.players.set(newState.member.user.tag, temp);
        }
    }
    // bot moves to a different channel --> create a new audiomixer in gamedata
    if (newState.member.user.bot && oldState.channelID !== newState.channelID) {
        // console.log();
        // console.log(`${newState.member.user.tag} moved from ${oldState.channel ? oldState.channel.name : "thin air"} to ${newState.channel ? newState.channel.name : "thin air"}, creating new audiomixer.`);
        gamedata.mixer = new AudioMixer.Mixer({
            channels: 2,
            bitDepth: 16,
            sampleRate: 48000,
            clearInterval: 1000
        });
    }
    // a player moves to a channel that the bot is currently in --> create a new mixerinput for that player
    if (!newState.member.user.bot && gamedata.voiceConnection && gamedata.voiceConnection.channel.id === newState.channelID && gamedata.voiceConnection.channel.id !== oldState.channelID && gamedata.game.game.playersAlive.includes(newState.member.user.tag)) {
        let temp = gamedata.players.get(newState.member.user.tag);
        temp.mixerInput = gamedata.mixer.input({
            channels: 2,
            sampleRate: 48000,
            bitDepth: 16
        });
        gamedata.players.set(newState.member.user.tag, temp);
        // console.log(`Creating a new mixer for ${newState.member.user.tag} since user joined ${newState.channel.name} which the bot is currently in.`)
        let channelStream = gamedata.voiceConnection.receiver.createStream(newState.member.user.id, {
            end: "manual",
            mode: "pcm"
        });
        channelStream.pipe(gamedata.players.get(newState.member.user.tag).mixerInput)
    }
    // a player leaves the channel that the bot is in --> remove the mixerinput for that player
    // if (!newState.member.user.bot && gamedata.voiceConnection && gamedata.voiceConnection.channel.id === oldState.channelID && gamedata.voiceConnection.channel.id !== newState.channelID && gamedata.players.get(newState.member.user.tag)) {
    //     console.log(`${newState.member.user.tag} moved from ${oldState.channel.name} to ${newState.channel.name}`);
    //     let temp = gamedata.players.get(newState.member.user.tag);
    //     if (temp.mixerInput) {
    //         temp.mixerInput = undefined;
    //         gamedata.mixer.removeInput(gamedata.players.get(newState.member.user.tag).mixerInput)
    //         gamedata.players.set(newState.member.user.tag, temp);
    //     }
    // }
})

client.on("message", (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) {
        return;
    }
    if (message.content.startsWith(`${prefix}write`)) {
        let args = message.content.substring(`${prefix}write`.length).trim();
        let command = "write";
        try {
            client.commands.get(command).execute(message, args, gamedata, spectatorClient);
        } catch (error) {
            console.error(error);
            message.channel.send("There was an error. The command didn't work.");
        }
    } else if (message.content.startsWith(prefix)) {
        let args = message.content.substring(prefix.length).trim().split(/ +/);
        let command = args.shift().toLowerCase();
        let createNewGame;
        try {
            createNewGame = client.commands.get(command).execute(message, args, gamedata, spectatorClient);
            if (createNewGame && createNewGame[0] === "NEW GAME") {
                gamedata = new GameData(createNewGame[1]);
            }
        } catch (error) {
            console.error(error);
            message.channel.send("There was an error. The command didn't work.");
        }
    }
});