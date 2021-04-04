const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const fs = require("fs");

const prefix = "m.";

class GameData {
    constructor() {
        this.players = new Map();
        this.userids = new Map();
        this.settings = new Map();
        this.gameActive = false
        // this.mafiaTiers = {
        //     "Mafia": [
        //         ["Godfather"],
        //         ["Framer"],
        //         ["Silencer", "Mafioso"]
        //     ],
        //     "Village": [
        //         ["Doctor"],
        //         ["Detective"],
        //         ["Mayor", "Vigilante"],
                
        //     ],
        //     "Neutral": [
        //         [],
        //     ]
        // }
        this.mafiaRoles = {
            "Godfather": {
                description: "",
                tier: 1,
                align: "Mafia",
                // image: "/images"
                night: function (player) {}
            },
            "Framer": {
                align: "Mafia",
                tier: 2,
                description: "",
                night: function (player) {},
            },
            "Silencer": {
                align: "Mafia",
                tier: 3,
                description: "",
                night: function (player) {},
            },
            "Mafioso": {
                align: "Mafia",
                tier: 3,
                description: "",
                night: function (player) {}
            }
        }

        this.villageRoles = {
            "Doctor": {
                align: "Village",
                tier: 1,
                description: "",
                night: function (player) {},
            },
            "Detective": {
                align: "Village",
                tier: 2,
                description: "",
                night: function (player) {},
            },
            "Vigilante": {
                align: "Village",
                tier: 3,
                description: "",
                night: function (player) {},
            },
            "Mayor": {
                align: "Village",
                tier: 3,
                description: "",
                night: function (player) {},
            },
            "PI": {
                align: "Village",
                tier: 4,
                description: "",
                night: function (player) {},
            },
            "Jailer": {
                align: "Village",
                tier: 4,
                description: "",
                night: function (player) {},
            },
            "Distractor": {
                align: "Village",
                tier: 4,
                description: "",
                night: function (player) {},
            },
            "Spy": {
                align: "Village",
                tier: 5,
                description: "",
                night: function (player) {},
            },
        };
        
        this.neutralRoles = {
            "Executioner": {
                align: "Neutral",
                tier: 1,
                description: "",
                night: function (player) {}
            },
            "Jester": {
                align: "Neutral",
                tier: 1,
                description: "",
                night: function (player) {}
            },
            "Eternal": {
                align: "Neutral",
                tier: 2,
                description: "",
                night: function (player) {}
            },
            "Baiter": {
                align: "Neutral",
                tier: 2,
                description: "",
                night: function (player) {}
            },
            "Bomber": {
                align: "Neutral",
                tier: 2,
                description: "",
                night: function (player) {}
            }
        }
    };
}

let gamedata = new GameData();

client.once("ready", () => {
    console.log("Ready!");
});

client.login(config.token);

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

client.on("message", (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) {
        return;
    }
    if (message.content.startsWith(prefix)) {
        let args = message.content.substring(prefix.length).trim().split(/ +/);
        let command = args.shift().toLowerCase();
        try {
            client.commands.get(command).execute(message, args, gamedata);
        } catch (error) {
            console.error(error);
            message.channel.send("There was an error. The command didn't work.");
        }
    }
});